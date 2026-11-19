import { and, desc, eq, max } from "drizzle-orm";
import {
  LessonProgressStatus,
  lessonProgress,
  lessons,
  modules,
  videoWatchEvents,
} from "~/db/schema";
import type { Lesson, LessonVisit } from "../types";
import type { Db } from "./db";

function findProgress(db: Db, studentId: number, lessonId: number) {
  return db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, studentId),
        eq(lessonProgress.lessonId, lessonId)
      )
    )
    .get();
}

type Progress = {
  studentId: number;
  lessonId: number;
  status: LessonProgressStatus;
  completedAt: string | null;
};

function setStatus(db: Db, progress: Progress) {
  const { studentId, lessonId, status, completedAt } = progress;
  const existing = findProgress(db, studentId, lessonId);
  if (existing) {
    db.update(lessonProgress)
      .set({ status, completedAt })
      .where(eq(lessonProgress.id, existing.id))
      .run();
    return;
  }
  db.insert(lessonProgress)
    .values({ userId: studentId, lessonId, status, completedAt })
    .run();
}

/** Opening a Lesson starts it, unless the Student has already completed it. */
function startLesson(db: Db, studentId: number, lessonId: number) {
  const existing = findProgress(db, studentId, lessonId);
  if (existing?.status === LessonProgressStatus.Completed) return;
  setStatus(db, {
    studentId,
    lessonId,
    status: LessonProgressStatus.InProgress,
    completedAt: null,
  });
}

export function completeLesson(
  db: Db,
  { studentId, lessonId }: { studentId: number; lessonId: number },
  now: Date
) {
  setStatus(db, {
    studentId,
    lessonId,
    status: LessonProgressStatus.Completed,
    completedAt: now.toISOString(),
  });
}

function courseProgress(db: Db, studentId: number, courseId: number) {
  const rows = db
    .select({
      lessonId: lessonProgress.lessonId,
      status: lessonProgress.status,
    })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(
      and(eq(lessonProgress.userId, studentId), eq(modules.courseId, courseId))
    )
    .all();
  return Object.fromEntries(rows.map((r) => [r.lessonId, r.status]));
}

function watchState(
  db: Db,
  studentId: number,
  lesson: Pick<Lesson, "id" | "videoUrl" | "durationMinutes">
) {
  if (!lesson.videoUrl) return { lastWatchPosition: 0, watchProgress: 0 };

  const byStudentOnLesson = and(
    eq(videoWatchEvents.userId, studentId),
    eq(videoWatchEvents.lessonId, lesson.id)
  );
  const last = db
    .select({ position: videoWatchEvents.positionSeconds })
    .from(videoWatchEvents)
    .where(byStudentOnLesson)
    .orderBy(desc(videoWatchEvents.createdAt), desc(videoWatchEvents.id))
    .limit(1)
    .get();
  // An aggregate always returns one row; position is null with no events.
  const [furthest] = db
    .select({ position: max(videoWatchEvents.positionSeconds) })
    .from(videoWatchEvents)
    .where(byStudentOnLesson)
    .all();

  const durationSeconds = (lesson.durationMinutes ?? 0) * 60;
  const watchProgress =
    durationSeconds > 0
      ? Math.min(
          Math.round(((furthest.position ?? 0) / durationSeconds) * 100),
          100
        )
      : 0;

  return { lastWatchPosition: last?.position ?? 0, watchProgress };
}

export type Visit = {
  studentId: number;
  courseId: number;
  lesson: Pick<Lesson, "id" | "videoUrl" | "durationMinutes">;
};

/**
 * Records that the Student opened the Lesson and returns their progress:
 * the Lesson's status, every Lesson's status in the course for the sidebar,
 * and where to resume the video.
 */
export function visitLesson(
  db: Db,
  { studentId, courseId, lesson }: Visit
): LessonVisit {
  startLesson(db, studentId, lesson.id);
  const lessonProgressMap = courseProgress(db, studentId, courseId);
  return {
    lessonStatus: lessonProgressMap[lesson.id] ?? null,
    lessonProgressMap,
    ...watchState(db, studentId, lesson),
  };
}
