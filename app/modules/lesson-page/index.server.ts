import { db as appDb } from "~/db";
import type { Db } from "./lib/db";
import { getLessonOutline } from "./lib/outline";
import { completeLesson, visitLesson, type Visit } from "./lib/progress";
import { getLessonQuiz, submitQuiz, type Submission } from "./lib/quiz";
import { getLessonThread, isCommentOnLesson } from "./lib/thread";

export type { Submission, Visit };

/**
 * Everything the Lesson page reads and writes, bound to a database. The app
 * uses `lessonPage`; tests build their own against a test database.
 *
 * Permission is the caller's job: check view or take with
 * `coursePermissions` before calling these.
 */
export function createLessonPage(db: Db) {
  return {
    /** The Lesson in its course, or null when it is not in that course. */
    getOutline: (courseId: number, lessonId: number) =>
      getLessonOutline(db, courseId, lessonId),
    /** Starts the Lesson for the Student and returns their progress. */
    visitLesson: (visit: Visit) => visitLesson(db, visit),
    completeLesson: (studentId: number, lessonId: number, now: Date) =>
      completeLesson(db, { studentId, lessonId }, now),
    getThread: (lessonId: number) => getLessonThread(db, lessonId),
    isCommentOnLesson: (lessonId: number, commentId: number) =>
      isCommentOnLesson(db, lessonId, commentId),
    getQuiz: (lessonId: number, studentId: number | null) =>
      getLessonQuiz(db, lessonId, studentId),
    /** Null when the quiz is not on this Lesson. */
    submitQuiz: (submission: Submission) => submitQuiz(db, submission),
  };
}

export const lessonPage = createLessonPage(appDb);
