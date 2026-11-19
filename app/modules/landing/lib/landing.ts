import { count, countDistinct, desc, eq, inArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import {
  CourseStatus,
  categories,
  courses,
  lessons,
  modules,
  users,
} from "~/db/schema";

// ─── Landing page ───
// Everything the public landing page (`/`) shows. Only published courses
// count: a draft or archived course is invisible to a visitor, so it is left
// out of the figures as well as the course list.

export type Db = BetterSQLite3Database<typeof schema>;

export const NEWEST_COURSE_LIMIT = 3;
export const SPOTLIGHT_MODULE_LIMIT = 4;

export type LandingCourse = {
  id: number;
  title: string;
  slug: string;
  description: string;
  coverImageUrl: string | null;
  instructorName: string;
  categoryName: string;
  lessonCount: number;
};

export type LandingStats = {
  courses: number;
  lessons: number;
  instructors: number;
  categories: number;
};

export type SpotlightModule = {
  id: number;
  title: string;
  lessonCount: number;
};

export type Spotlight = {
  course: LandingCourse;
  modules: SpotlightModule[];
  moduleCount: number;
};

export type LandingPage = {
  newestCourses: LandingCourse[];
  stats: LandingStats;
  spotlight: Spotlight | null;
};

const isPublished = eq(courses.status, CourseStatus.Published);

function getNewestCourses(db: Db): LandingCourse[] {
  const newest = db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      coverImageUrl: courses.coverImageUrl,
      instructorName: users.name,
      categoryName: categories.name,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .innerJoin(categories, eq(courses.categoryId, categories.id))
    .where(isPublished)
    .orderBy(desc(courses.createdAt), desc(courses.id))
    .limit(NEWEST_COURSE_LIMIT)
    .all();

  const lessonCounts = countLessonsByCourse(
    db,
    newest.map((course) => course.id)
  );
  return newest.map((course) => ({
    ...course,
    lessonCount: lessonCounts.get(course.id) ?? 0,
  }));
}

function countLessonsByCourse(db: Db, courseIds: number[]) {
  const rows = db
    .select({ courseId: modules.courseId, lessons: count(lessons.id) })
    .from(modules)
    .innerJoin(lessons, eq(lessons.moduleId, modules.id))
    .where(inArray(modules.courseId, courseIds))
    .groupBy(modules.courseId)
    .all();
  return new Map(rows.map((row) => [row.courseId, row.lessons]));
}

function getStats(db: Db): LandingStats {
  const courseFigures = db
    .select({
      courses: count(courses.id),
      instructors: countDistinct(courses.instructorId),
      categories: countDistinct(courses.categoryId),
    })
    .from(courses)
    .where(isPublished)
    .get();

  const lessonFigures = db
    .select({ lessons: count(lessons.id) })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(isPublished)
    .get();

  return {
    courses: courseFigures?.courses ?? 0,
    instructors: courseFigures?.instructors ?? 0,
    categories: courseFigures?.categories ?? 0,
    lessons: lessonFigures?.lessons ?? 0,
  };
}

function getSpotlight(db: Db, course: LandingCourse | undefined) {
  if (!course) return null;
  const rows = db
    .select({
      id: modules.id,
      title: modules.title,
      lessonCount: count(lessons.id),
    })
    .from(modules)
    .leftJoin(lessons, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, course.id))
    .groupBy(modules.id)
    .orderBy(modules.position, modules.id)
    .limit(SPOTLIGHT_MODULE_LIMIT)
    .all();
  const total = db
    .select({ modules: count(modules.id) })
    .from(modules)
    .where(eq(modules.courseId, course.id))
    .get();

  return { course, modules: rows, moduleCount: total?.modules ?? 0 };
}

export function getLandingPage(db: Db): LandingPage {
  const newestCourses = getNewestCourses(db);
  return {
    newestCourses,
    stats: getStats(db),
    spotlight: getSpotlight(db, newestCourses[0]),
  };
}
