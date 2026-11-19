import * as schema from "~/db/schema";
import { QuestionType, UserRole } from "~/db/schema";
import { createComment, deleteComment } from "~/lib/comments.server";
import { fakeNotifications } from "~/lib/notifications.fake.server";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import { createLessonPage } from "../index.server";

// Courses, modules, lessons, quizzes and watch events have no service that
// writes them, so these fixtures insert rows directly. Kept in one place so a
// schema change touches only this file.

export const NOW = new Date("2026-11-19T12:00:00.000Z");

export function setup() {
  const db = createTestDb();
  const base = seedBaseData(db);
  return {
    db,
    ...base,
    student: base.user,
    lessonPage: createLessonPage(db),
  };
}

export function addModule(
  db: TestDb,
  courseId: number,
  { title, position }: { title: string; position: number }
) {
  return db
    .insert(schema.modules)
    .values({ courseId, title, position })
    .returning()
    .get();
}

export function addLesson(
  db: TestDb,
  moduleId: number,
  lesson: {
    title: string;
    position: number;
    videoUrl?: string;
    durationMinutes?: number;
  }
) {
  return db
    .insert(schema.lessons)
    .values({ moduleId, ...lesson })
    .returning()
    .get();
}

export function addUser(db: TestDb, name: string, role = UserRole.Student) {
  return db
    .insert(schema.users)
    .values({ name, email: `${name.replaceAll(" ", ".")}@example.com`, role })
    .returning()
    .get();
}

export function addWatchEvent(
  db: TestDb,
  event: {
    userId: number;
    lessonId: number;
    positionSeconds: number;
    createdAt: string;
  }
) {
  db.insert(schema.videoWatchEvents)
    .values({ ...event, eventType: "progress" })
    .run();
}

/**
 * A quiz on the lesson. Each question lists its options; the option text
 * starting with "*" is the correct one.
 */
export function addQuiz(
  db: TestDb,
  lessonId: number,
  questions: Array<{ text: string; options: string[] }>
) {
  const quiz = db
    .insert(schema.quizzes)
    .values({ lessonId, title: "Check yourself", passingScore: 0.7 })
    .returning()
    .get();
  const added = questions.map((q, position) => {
    const question = db
      .insert(schema.quizQuestions)
      .values({
        quizId: quiz.id,
        questionText: q.text,
        questionType: QuestionType.MultipleChoice,
        position,
      })
      .returning()
      .get();
    const options = q.options.map((text) =>
      db
        .insert(schema.quizOptions)
        .values({
          questionId: question.id,
          optionText: text.replace(/^\*/, ""),
          isCorrect: text.startsWith("*"),
        })
        .returning()
        .get()
    );
    return { ...question, options };
  });
  return { ...quiz, questions: added };
}

export async function postComment(
  db: TestDb,
  comment: {
    authorId: number;
    lessonId: number;
    body: string;
    parentId?: number;
    at?: Date;
  }
) {
  const result = await createComment(
    db,
    comment.authorId,
    comment.lessonId,
    comment.parentId ?? null,
    comment.body,
    comment.at ?? NOW,
    fakeNotifications()
  );
  if (!result.ok) throw new Error(result.error);
  return result.comment;
}

export async function removeComment(
  db: TestDb,
  commentId: number,
  authorId: number
) {
  await deleteComment(db, commentId, authorId, false, NOW, fakeNotifications());
}
