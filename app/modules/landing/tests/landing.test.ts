import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { CourseStatus, UserRole } from "~/db/schema";
import { markdown } from "~/lib/text";
import { createLanding } from "../index.server";

let db: TestDb;
let instructor: typeof schema.users.$inferSelect;
let category: typeof schema.categories.$inferSelect;
let baseCourse: typeof schema.courses.$inferSelect;

beforeEach(() => {
  db = createTestDb();
  const base = seedBaseData(db);
  instructor = base.instructor;
  category = base.category;
  baseCourse = base.course;
  db.update(schema.courses)
    .set({ createdAt: "2026-01-01T00:00:00.000Z" })
    .run();
});

// ─── Fixtures ───
// The landing module only reads, so rows go in directly. Kept in one place so
// a schema change touches only this block.

let slugCounter = 0;

function addUser(name: string) {
  return db
    .insert(schema.users)
    .values({
      name,
      email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
      role: UserRole.Instructor,
    })
    .returning()
    .get();
}

function addCategory(name: string) {
  return db
    .insert(schema.categories)
    .values({ name, slug: name.toLowerCase() })
    .returning()
    .get();
}

function addCourse(
  title: string,
  createdAt: string,
  options: {
    status?: CourseStatus;
    instructorId?: number;
    categoryId?: number;
  } = {}
) {
  slugCounter += 1;
  return db
    .insert(schema.courses)
    .values({
      title,
      slug: `course-${slugCounter}`,
      description: `${title} description`,
      salesCopy: markdown(title),
      instructorId: options.instructorId ?? instructor.id,
      categoryId: options.categoryId ?? category.id,
      status: options.status ?? CourseStatus.Published,
      createdAt,
    })
    .returning()
    .get();
}

function addModule(courseId: number, title: string, position: number) {
  return db
    .insert(schema.modules)
    .values({ courseId, title, position })
    .returning()
    .get();
}

function addLessons(moduleId: number, howMany: number) {
  for (let position = 1; position <= howMany; position++) {
    db.insert(schema.lessons)
      .values({ moduleId, title: `Lesson ${position}`, position })
      .run();
  }
}

const landing = () => createLanding(db).get();

describe("newest courses", () => {
  it("lists published courses newest first, at most three", () => {
    addCourse("February", "2026-02-01T00:00:00.000Z");
    addCourse("April", "2026-04-01T00:00:00.000Z");
    addCourse("March", "2026-03-01T00:00:00.000Z");

    expect(landing().newestCourses.map((c) => c.title)).toEqual([
      "April",
      "March",
      "February",
    ]);
  });

  it("leaves out drafts and archived courses", () => {
    addCourse("Draft", "2026-05-01T00:00:00.000Z", {
      status: CourseStatus.Draft,
    });
    addCourse("Archived", "2026-05-02T00:00:00.000Z", {
      status: CourseStatus.Archived,
    });

    expect(landing().newestCourses.map((c) => c.title)).toEqual([
      "Test Course",
    ]);
  });

  it("breaks a tie on creation time by the later course", () => {
    addCourse("First", "2026-02-01T00:00:00.000Z");
    addCourse("Second", "2026-02-01T00:00:00.000Z");

    expect(landing().newestCourses[0].title).toBe("Second");
  });

  it("names the instructor and category and counts every lesson", () => {
    const course = addCourse("Counted", "2026-02-01T00:00:00.000Z");
    addLessons(addModule(course.id, "One", 1).id, 2);
    addLessons(addModule(course.id, "Two", 2).id, 3);

    const [newest, base] = landing().newestCourses;
    expect(newest).toMatchObject({
      title: "Counted",
      slug: course.slug,
      description: "Counted description",
      instructorName: "Test Instructor",
      categoryName: "Programming",
      lessonCount: 5,
    });
    expect(base.lessonCount).toBe(0);
  });

  it("is empty when nothing is published", () => {
    db.update(schema.courses).set({ status: CourseStatus.Draft }).run();

    expect(landing()).toEqual({
      newestCourses: [],
      stats: { courses: 0, lessons: 0, instructors: 0, categories: 0 },
      spotlight: null,
    });
  });
});

describe("stats", () => {
  it("counts published courses, their lessons, instructors and categories", () => {
    const other = addUser("Olive Other");
    const design = addCategory("Design");
    const course = addCourse("Design 101", "2026-02-01T00:00:00.000Z", {
      instructorId: other.id,
      categoryId: design.id,
    });
    addLessons(addModule(course.id, "Basics", 1).id, 4);
    addLessons(addModule(baseCourse.id, "Intro", 1).id, 1);
    addCourse("Same teacher", "2026-03-01T00:00:00.000Z");

    expect(landing().stats).toEqual({
      courses: 3,
      lessons: 5,
      instructors: 2,
      categories: 2,
    });
  });

  it("ignores everything belonging to an unpublished course", () => {
    const other = addUser("Olive Other");
    const design = addCategory("Design");
    addCategory("Empty");
    const draft = addCourse("Draft", "2026-02-01T00:00:00.000Z", {
      status: CourseStatus.Draft,
      instructorId: other.id,
      categoryId: design.id,
    });
    addLessons(addModule(draft.id, "Hidden", 1).id, 7);

    expect(landing().stats).toEqual({
      courses: 1,
      lessons: 0,
      instructors: 1,
      categories: 1,
    });
  });

  it("counts every published course, not only the ones listed", () => {
    for (let month = 2; month <= 9; month++) {
      addCourse(`Month ${month}`, `2026-0${month}-01T00:00:00.000Z`);
    }

    const page = landing();
    expect(page.newestCourses).toHaveLength(3);
    expect(page.stats.courses).toBe(9);
  });
});

describe("spotlight", () => {
  it("outlines the newest course's modules in order, with lesson counts", () => {
    const course = addCourse("Newest", "2026-02-01T00:00:00.000Z");
    const second = addModule(course.id, "Second", 2);
    addLessons(second.id, 3);
    const empty = addModule(course.id, "Empty", 3);
    const first = addModule(course.id, "First", 1);
    addLessons(first.id, 2);

    const spotlight = landing().spotlight;
    expect(spotlight?.course.title).toBe("Newest");
    expect(spotlight?.modules).toEqual([
      { id: first.id, title: "First", lessonCount: 2 },
      { id: second.id, title: "Second", lessonCount: 3 },
      { id: empty.id, title: "Empty", lessonCount: 0 },
    ]);
    expect(spotlight?.moduleCount).toBe(3);
  });

  it("shows the first four modules and counts them all", () => {
    const course = addCourse("Long", "2026-02-01T00:00:00.000Z");
    for (let position = 1; position <= 6; position++) {
      addModule(course.id, `Module ${position}`, position);
    }

    const spotlight = landing().spotlight;
    expect(spotlight?.modules.map((m) => m.title)).toEqual([
      "Module 1",
      "Module 2",
      "Module 3",
      "Module 4",
    ]);
    expect(spotlight?.moduleCount).toBe(6);
  });

  it("has no modules for a course without an outline yet", () => {
    expect(landing().spotlight).toMatchObject({
      course: { title: "Test Course" },
      modules: [],
      moduleCount: 0,
    });
  });
});
