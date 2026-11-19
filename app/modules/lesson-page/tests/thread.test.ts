import { describe, expect, it } from "vitest";
import { UserRole } from "~/db/schema";
import {
  addLesson,
  addModule,
  addUser,
  postComment,
  removeComment,
  setup,
} from "./fixtures";

function lessonWithDiscussion() {
  const fixture = setup();
  const { db, course } = fixture;
  const mod = addModule(db, course.id, { title: "M", position: 1 });
  const lesson = addLesson(db, mod.id, { title: "L", position: 1 });
  const other = addLesson(db, mod.id, { title: "Other", position: 2 });
  return { ...fixture, lesson, other };
}

const at = (minute: number) =>
  new Date(`2026-11-19T12:${String(minute).padStart(2, "0")}:00.000Z`);

describe("getThread", () => {
  it("is empty for a lesson nobody has asked about", async () => {
    const { lessonPage, lesson } = lessonWithDiscussion();

    expect(await lessonPage.getThread(lesson.id)).toEqual([]);
  });

  it("nests replies under their question, oldest first", async () => {
    const { db, lessonPage, lesson, student, instructor } =
      lessonWithDiscussion();
    const later = await postComment(db, {
      authorId: student.id,
      lessonId: lesson.id,
      body: "Second question",
      at: at(5),
    });
    const first = await postComment(db, {
      authorId: student.id,
      lessonId: lesson.id,
      body: "First question",
      at: at(1),
    });
    const reply = await postComment(db, {
      authorId: instructor.id,
      lessonId: lesson.id,
      parentId: first.id,
      body: "An answer",
      at: at(6),
    });

    const thread = await lessonPage.getThread(lesson.id);

    expect(thread.map((c) => c.id)).toEqual([first.id, later.id]);
    expect(thread[0].replies.map((c) => c.id)).toEqual([reply.id]);
    expect(thread[1].replies).toEqual([]);
  });

  it("renders bodies to sanitised HTML and keeps the markdown for editing", async () => {
    const { db, lessonPage, lesson, student } = lessonWithDiscussion();
    await postComment(db, {
      authorId: student.id,
      lessonId: lesson.id,
      body: "**bold** <script>alert(1)</script>",
    });

    const [comment] = await lessonPage.getThread(lesson.id);

    expect(comment.body).toBe("**bold** <script>alert(1)</script>");
    expect(comment.bodyHtml).toContain("<strong>bold</strong>");
    expect(comment.bodyHtml).not.toContain("<script>");
  });

  it("describes each author, marking the instructor and platform admins", async () => {
    const { db, lessonPage, lesson, student, instructor } =
      lessonWithDiscussion();
    const admin = addUser(db, "Pat Admin", UserRole.Admin);
    for (const [authorId, minute] of [
      [student.id, 1],
      [instructor.id, 2],
      [admin.id, 3],
    ]) {
      await postComment(db, {
        authorId,
        lessonId: lesson.id,
        body: "Hello",
        at: at(minute),
      });
    }

    const thread = await lessonPage.getThread(lesson.id);

    expect(thread.map((c) => c.author)).toEqual([
      {
        id: student.id,
        name: "Test User",
        avatarUrl: null,
        isInstructor: false,
        isPlatformAdmin: false,
      },
      {
        id: instructor.id,
        name: "Test Instructor",
        avatarUrl: null,
        isInstructor: true,
        isPlatformAdmin: false,
      },
      {
        id: admin.id,
        name: "Pat Admin",
        avatarUrl: null,
        isInstructor: false,
        isPlatformAdmin: true,
      },
    ]);
  });

  it("keeps a deleted question that has replies, without its body", async () => {
    const { db, lessonPage, lesson, student, instructor } =
      lessonWithDiscussion();
    const question = await postComment(db, {
      authorId: student.id,
      lessonId: lesson.id,
      body: "Question",
    });
    await postComment(db, {
      authorId: instructor.id,
      lessonId: lesson.id,
      parentId: question.id,
      body: "Answer",
    });
    await removeComment(db, question.id, student.id);

    const [shown] = await lessonPage.getThread(lesson.id);

    expect(shown).toMatchObject({
      id: question.id,
      deleted: true,
      body: "",
      bodyHtml: "",
      editedAt: null,
    });
    expect(shown.replies).toHaveLength(1);
  });

  it("drops a deleted question with no replies, and deleted replies", async () => {
    const { db, lessonPage, lesson, student, instructor } =
      lessonWithDiscussion();
    const lonely = await postComment(db, {
      authorId: student.id,
      lessonId: lesson.id,
      body: "Never mind",
    });
    const question = await postComment(db, {
      authorId: student.id,
      lessonId: lesson.id,
      body: "Still here",
    });
    const reply = await postComment(db, {
      authorId: instructor.id,
      lessonId: lesson.id,
      parentId: question.id,
      body: "Oops",
    });
    await removeComment(db, lonely.id, student.id);
    await removeComment(db, reply.id, instructor.id);

    const thread = await lessonPage.getThread(lesson.id);

    expect(thread.map((c) => c.id)).toEqual([question.id]);
    expect(thread[0]).toMatchObject({ deleted: false, replies: [] });
  });

  it("shows only this lesson's discussion", async () => {
    const { db, lessonPage, lesson, other, student } = lessonWithDiscussion();
    await postComment(db, {
      authorId: student.id,
      lessonId: other.id,
      body: "Elsewhere",
    });

    expect(await lessonPage.getThread(lesson.id)).toEqual([]);
  });
});

describe("isCommentOnLesson", () => {
  it("is true only for a comment on this lesson", async () => {
    const { db, lessonPage, lesson, other, student } = lessonWithDiscussion();
    const comment = await postComment(db, {
      authorId: student.id,
      lessonId: lesson.id,
      body: "Hi",
    });

    expect(lessonPage.isCommentOnLesson(lesson.id, comment.id)).toBe(true);
    expect(lessonPage.isCommentOnLesson(other.id, comment.id)).toBe(false);
    expect(lessonPage.isCommentOnLesson(lesson.id, 9999)).toBe(false);
  });
});
