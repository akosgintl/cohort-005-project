import { and, asc, eq } from "drizzle-orm";
import {
  comments,
  courses,
  lessons,
  modules,
  users,
  UserRole,
} from "~/db/schema";
import { renderComment } from "~/lib/comment-markdown.server";
import { markdown, type Markdown } from "~/lib/text";
import type { ThreadComment } from "../types";
import type { Db } from "./db";

type Unrendered = Omit<ThreadComment, "body" | "bodyHtml" | "replies"> & {
  body: Markdown;
  replies: Unrendered[];
};

function readThread(db: Db, lessonId: number): Unrendered[] {
  const rows = db
    .select({
      id: comments.id,
      body: comments.body,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      deletedAt: comments.deletedAt,
      authorId: users.id,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
      authorRole: users.role,
      instructorId: courses.instructorId,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .innerJoin(lessons, eq(comments.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(comments.lessonId, lessonId))
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .all();

  const toComment = (row: (typeof rows)[number]): Unrendered => {
    const deleted = row.deletedAt !== null;
    return {
      id: row.id,
      body: deleted ? markdown("") : row.body,
      createdAt: row.createdAt,
      editedAt: deleted ? null : row.editedAt,
      deleted,
      author: {
        id: row.authorId,
        name: row.authorName,
        avatarUrl: row.authorAvatarUrl,
        isInstructor: row.authorId === row.instructorId,
        isPlatformAdmin: row.authorRole === UserRole.Admin,
      },
      replies: [],
    };
  };

  const live = rows.filter((r) => r.deletedAt === null);
  const topLevel = rows
    .filter((r) => r.parentId === null)
    .map((row) => ({
      ...toComment(row),
      replies: live.filter((r) => r.parentId === row.id).map(toComment),
    }));

  // A deleted question with no replies left has nothing worth showing.
  return topLevel.filter((c) => !c.deleted || c.replies.length > 0);
}

// Comments are untrusted input, so this must be renderComment, never
// renderMarkdown, which lets raw HTML through for trusted lesson content.
async function render(nodes: Unrendered[]): Promise<ThreadComment[]> {
  return Promise.all(
    nodes.map(async (node) => ({
      ...node,
      bodyHtml: node.deleted ? "" : await renderComment(node.body),
      replies: await render(node.replies),
    }))
  );
}

/** The Lesson's Questions & Discussion, replies nested, bodies sanitised. */
export function getLessonThread(
  db: Db,
  lessonId: number
): Promise<ThreadComment[]> {
  return render(readThread(db, lessonId));
}

/** Whether the comment exists and belongs to this Lesson. */
export function isCommentOnLesson(
  db: Db,
  lessonId: number,
  commentId: number
): boolean {
  const found = db
    .select({ id: comments.id })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.lessonId, lessonId)))
    .get();
  return found !== undefined;
}
