import { and, asc, eq, inArray } from "drizzle-orm";
import { courses, lessons, modules, users } from "~/db/schema";
import type {
  CurriculumModule,
  LessonOutline,
  NeighbourLesson,
} from "../types";
import type { Db } from "./db";

function inCourseOrder(curriculum: CurriculumModule[]): NeighbourLesson[] {
  return curriculum.flatMap((m) =>
    m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      moduleId: m.id,
      moduleTitle: m.title,
    }))
  );
}

function lessonInCourse(db: Db, courseId: number, lessonId: number) {
  return db
    .select({
      lesson: lessons,
      module: { id: modules.id, title: modules.title },
      course: { id: courses.id, title: courses.title, slug: courses.slug },
      instructorName: users.name,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .innerJoin(users, eq(courses.instructorId, users.id))
    .where(and(eq(lessons.id, lessonId), eq(courses.id, courseId)))
    .get();
}

function curriculumOf(db: Db, courseId: number): CurriculumModule[] {
  const courseModules = db
    .select({ id: modules.id, title: modules.title })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(asc(modules.position))
    .all();
  const courseLessons = db
    .select({
      id: lessons.id,
      title: lessons.title,
      moduleId: lessons.moduleId,
    })
    .from(lessons)
    .where(
      inArray(
        lessons.moduleId,
        courseModules.map((m) => m.id)
      )
    )
    .orderBy(asc(lessons.position))
    .all();

  return courseModules.map((m) => ({
    id: m.id,
    title: m.title,
    lessons: courseLessons
      .filter((l) => l.moduleId === m.id)
      .map((l) => ({ id: l.id, title: l.title })),
  }));
}

export function getLessonOutline(
  db: Db,
  courseId: number,
  lessonId: number
): LessonOutline | null {
  const found = lessonInCourse(db, courseId, lessonId);
  if (!found) return null;

  const curriculum = curriculumOf(db, courseId);
  const inOrder = inCourseOrder(curriculum);
  const index = inOrder.findIndex((l) => l.id === lessonId);

  return {
    ...found,
    curriculum,
    prevLesson: inOrder[index - 1] ?? null,
    nextLesson: inOrder[index + 1] ?? null,
  };
}
