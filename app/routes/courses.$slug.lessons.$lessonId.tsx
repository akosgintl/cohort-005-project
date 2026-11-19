import { data, isRouteErrorResponse, Link } from "react-router";
import { AlertTriangle } from "lucide-react";
import { z } from "zod";
import type { Route } from "./+types/courses.$slug.lessons.$lessonId";
import {
  coursePermissions,
  type Capability,
  type CourseRef,
} from "~/modules/permissions/course-permissions.server";
import { lessonPage } from "~/modules/lesson-page/index.server";
import {
  createComment,
  deleteComment,
  editComment,
} from "~/lib/comments.server";
import { defaultNotifications } from "~/lib/notifications.server";
import { isBookmarked, toggleBookmark } from "~/lib/bookmarks.server";
import { getNote, saveNote } from "~/lib/notes.server";
import { MAX_NOTE_LENGTH } from "~/lib/notes";
import { renderMarkdown } from "~/lib/markdown.server";
import { parseFormData } from "~/lib/validation";
import { db } from "~/db";
import { Button } from "~/components/ui/button";
import { FullLesson } from "~/components/lesson/full-lesson";
import { LockedLesson } from "~/components/lesson/locked-lesson";

const createCommentSchema = z.object({
  intent: z.literal("create-comment"),
  body: z.string(),
  parentId: z.coerce.number().int().optional(),
});

const editCommentSchema = z.object({
  intent: z.literal("edit-comment"),
  commentId: z.coerce.number().int(),
  body: z.string(),
});

const saveNoteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write something before saving your note.")
    .max(
      MAX_NOTE_LENGTH,
      `Your note is over ${MAX_NOTE_LENGTH.toLocaleString("en")} characters, so it was not saved.`
    ),
});

const deleteCommentSchema = z.object({
  intent: z.literal("delete-comment"),
  commentId: z.coerce.number().int(),
});

const submitQuizSchema = z.object({
  quizId: z.coerce.number().int(),
});

/**
 * The course named by this route's slug, through this lesson. A lesson in
 * another course, or a malformed lesson id, counts as not found.
 */
function lessonRef(params: { slug: string; lessonId: string }): CourseRef {
  return { slug: params.slug, lessonId: params.lessonId };
}

const lessonParamsSchema = z.object({
  lessonId: z.coerce.number().int().positive(),
});

/** The permission check has already found the lesson, so a bad id is a 404. */
function lessonIdOf(params: { lessonId: string }): number {
  const parsed = lessonParamsSchema.safeParse(params);
  if (!parsed.success) throw data("Lesson not found", { status: 404 });
  return parsed.data.lessonId;
}

/**
 * What each action intent needs: comments, Bookmarks and Notes need view;
 * progress and quizzes need take. Moderating Discussions (deleting someone
 * else's post) additionally needs manage, checked in the delete intent.
 */
const INTENT_CAPABILITY: Record<string, Capability | undefined> = {
  "create-comment": "view",
  "edit-comment": "view",
  "delete-comment": "view",
  "toggle-bookmark": "view",
  "save-note": "view",
  "mark-complete": "take",
  "submit-quiz": "take",
};

const quizAnswerSchema = z.tuple([
  z.coerce.number().int().positive(),
  z.coerce.number().int().positive(),
]);

/** Form fields named "question-{questionId}" hold the chosen option id. */
function quizAnswers(formData: FormData): Record<number, number> {
  const answers: Record<number, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("question-")) continue;
    const parsed = quizAnswerSchema.safeParse([
      key.slice("question-".length),
      value,
    ]);
    if (parsed.success) {
      const [questionId, optionId] = parsed.data;
      answers[questionId] = optionId;
    }
  }
  return answers;
}

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.lesson?.title ?? "Lesson";
  const courseTitle = loaderData?.course?.title ?? "Course";
  return [{ title: `${title} — ${courseTitle} — Cadence` }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  // Not found covers an unknown course, a malformed lesson id, and a lesson
  // from another course.
  const decisions = await coursePermissions.getCourseDecisions(
    request,
    lessonRef(params)
  );
  if (!decisions.found) {
    throw data("Lesson not found", { status: 404 });
  }
  const { course, person, enrolled, view, take, manage } = decisions;
  const currentUserId = person?.id ?? null;

  const outline = lessonPage.getOutline(course.id, lessonIdOf(params));
  if (!outline) {
    throw data("Lesson not found", { status: 404 });
  }
  const { lesson } = outline;

  // Someone who can't view the content gets the lesson's title, its module and
  // the course outline — never the body, video or quiz — plus the reason, so
  // the page can show the right call to action.
  if (!view.allowed) {
    return {
      view: "locked" as const,
      course: outline.course,
      curriculum: outline.curriculum,
      module: outline.module,
      lesson: { id: lesson.id, title: lesson.title },
      enrolled,
      lockedReason: view.reason,
    };
  }

  // Progress is recorded only for people who can take the course, so a
  // Student under a Country Lock gets none.
  const visit =
    currentUserId !== null && take.allowed
      ? lessonPage.visitLesson({
          studentId: currentUserId,
          courseId: course.id,
          lesson,
        })
      : {
          lessonStatus: null,
          lessonProgressMap: {},
          lastWatchPosition: 0,
          watchProgress: 0,
        };

  // Everything from here on is behind the can-view-content bar above:
  // comments, Bookmarks and Notes are confidential to the course.
  const note =
    currentUserId !== null ? getNote(db, currentUserId, lesson.id) : undefined;

  return {
    view: "full" as const,
    ...outline,
    ...visit,
    ...lessonPage.getQuiz(lesson.id, currentUserId),
    contentHtml: lesson.content ? await renderMarkdown(lesson.content) : null,
    enrolled,
    currentUserId,
    comments: await lessonPage.getThread(lesson.id),
    canModerate: manage.allowed,
    bookmarked:
      currentUserId !== null
        ? isBookmarked(db, currentUserId, lesson.id)
        : false,
    note: note ? { body: note.body, updatedAt: note.updatedAt } : null,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  // Every intent checks its own capability here — loader guards don't protect
  // actions. The ref includes the lesson, so a lesson from another course (or
  // a malformed id) is a 404.
  const capability =
    typeof intent === "string" ? INTENT_CAPABILITY[intent] : undefined;
  if (!capability) {
    throw data("Invalid action", { status: 400 });
  }
  const ref = lessonRef(params);
  const { person } = await coursePermissions.requireCapability(
    request,
    capability,
    ref
  );
  const currentUserId = person.id;
  const lessonId = lessonIdOf(params);

  // Scope a comment id to this lesson so a comment elsewhere can't be reached
  // by posting its id to this route.
  const requireCommentOnLesson = (commentId: number) => {
    if (!lessonPage.isCommentOnLesson(lessonId, commentId)) {
      throw data("Comment not found", { status: 404 });
    }
  };

  if (
    intent === "create-comment" ||
    intent === "edit-comment" ||
    intent === "delete-comment"
  ) {
    try {
      if (intent === "create-comment") {
        const parsed = parseFormData(formData, createCommentSchema);
        if (!parsed.success) {
          return { ok: false, error: "Enter a comment before posting." };
        }
        const created = await createComment(
          db,
          currentUserId,
          lessonId,
          parsed.data.parentId ?? null,
          parsed.data.body,
          new Date(),
          await defaultNotifications()
        );
        if (!created.ok) return created;
        return { ok: true };
      }

      if (intent === "edit-comment") {
        const parsed = parseFormData(formData, editCommentSchema);
        if (!parsed.success) {
          return { ok: false, error: "Enter a comment before saving." };
        }
        requireCommentOnLesson(parsed.data.commentId);
        const edited = editComment(
          db,
          parsed.data.commentId,
          currentUserId,
          parsed.data.body,
          new Date()
        );
        if (!edited.ok) return edited;
        return { ok: true };
      }

      const parsed = parseFormData(formData, deleteCommentSchema);
      if (!parsed.success) {
        return { ok: false, error: "Could not delete that comment." };
      }
      requireCommentOnLesson(parsed.data.commentId);
      // Anyone who can view may delete their own posts; moderating someone
      // else's takes the manage capability.
      const decisions = coursePermissions.decide(person, ref);
      const canModerate = decisions.found && decisions.manage.allowed;
      const deleted = await deleteComment(
        db,
        parsed.data.commentId,
        currentUserId,
        canModerate,
        new Date(),
        await defaultNotifications()
      );
      if (!deleted.ok) return deleted;
      return { ok: true };
    } catch (error) {
      // Service validation failures are user-correctable; anything thrown as a
      // Response (404 above) should keep bubbling.
      if (error instanceof Error) {
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  if (intent === "toggle-bookmark") {
    const bookmarked = toggleBookmark(db, currentUserId, lessonId, new Date());
    return { ok: true, bookmarked };
  }

  if (intent === "save-note") {
    const parsed = parseFormData(formData, saveNoteSchema);
    if (!parsed.success) {
      return { ok: false, error: parsed.errors.body };
    }
    const saved = saveNote(
      db,
      currentUserId,
      lessonId,
      parsed.data.body,
      new Date()
    );
    if (!saved.ok) return saved;
    return { ok: true };
  }

  if (intent === "mark-complete") {
    lessonPage.completeLesson(currentUserId, lessonId, new Date());
    return { success: true };
  }

  const parsed = parseFormData(formData, submitQuizSchema);
  if (!parsed.success) {
    throw data("Invalid quiz ID", { status: 400 });
  }
  // A quiz on another lesson is not found, so its id can't be posted here.
  const result = lessonPage.submitQuiz({
    studentId: currentUserId,
    lessonId,
    quizId: parsed.data.quizId,
    answers: quizAnswers(formData),
  });
  if (!result) {
    throw data("Quiz not found", { status: 404 });
  }
  return { quizResult: result };
}

export default function LessonViewer({ loaderData }: Route.ComponentProps) {
  if (loaderData.view === "locked") {
    return <LockedLesson data={loaderData} />;
  }
  return <FullLesson data={loaderData} />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading this lesson.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Lesson not found";
      message =
        "The lesson you're looking for doesn't exist or may have been removed.";
    } else if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/courses">
            <Button variant="outline">Browse Courses</Button>
          </Link>
          <Link to="/dashboard">
            <Button>My Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
