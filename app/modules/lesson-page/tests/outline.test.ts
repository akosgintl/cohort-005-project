import { describe, expect, it } from "vitest";
import * as schema from "~/db/schema";
import { markdown } from "~/lib/text";
import { addLesson, addModule, setup } from "./fixtures";

function courseWithTwoModules() {
  const fixture = setup();
  const { db, course } = fixture;
  // Inserted out of order, so the outline has to sort by position.
  const second = addModule(db, course.id, { title: "Second", position: 2 });
  const first = addModule(db, course.id, { title: "First", position: 1 });
  const b1 = addLesson(db, second.id, { title: "B1", position: 1 });
  const a2 = addLesson(db, first.id, { title: "A2", position: 2 });
  const a1 = addLesson(db, first.id, { title: "A1", position: 1 });
  return { ...fixture, first, second, a1, a2, b1 };
}

describe("getOutline", () => {
  it("lists the curriculum in position order", () => {
    const { lessonPage, course, a1, first, second, a2, b1 } =
      courseWithTwoModules();

    const outline = lessonPage.getOutline(course.id, a1.id);

    expect(outline?.curriculum).toEqual([
      {
        id: first.id,
        title: "First",
        lessons: [
          { id: a1.id, title: "A1" },
          { id: a2.id, title: "A2" },
        ],
      },
      { id: second.id, title: "Second", lessons: [{ id: b1.id, title: "B1" }] },
    ]);
  });

  it("names the course, its instructor, and the lesson's module", () => {
    const { lessonPage, course, a2, first } = courseWithTwoModules();

    const outline = lessonPage.getOutline(course.id, a2.id);

    expect(outline?.course).toEqual({
      id: course.id,
      title: "Test Course",
      slug: "test-course",
    });
    expect(outline?.instructorName).toBe("Test Instructor");
    expect(outline?.module).toEqual({ id: first.id, title: "First" });
    expect(outline?.lesson.title).toBe("A2");
  });

  it("links the previous and next lesson across modules", () => {
    const { lessonPage, course, a1, a2, b1, first, second } =
      courseWithTwoModules();

    const outline = lessonPage.getOutline(course.id, a2.id);

    expect(outline?.prevLesson).toEqual({
      id: a1.id,
      title: "A1",
      moduleId: first.id,
      moduleTitle: "First",
    });
    expect(outline?.nextLesson).toEqual({
      id: b1.id,
      title: "B1",
      moduleId: second.id,
      moduleTitle: "Second",
    });
  });

  it("has no previous lesson at the start or next lesson at the end", () => {
    const { lessonPage, course, a1, b1 } = courseWithTwoModules();

    expect(lessonPage.getOutline(course.id, a1.id)?.prevLesson).toBeNull();
    expect(lessonPage.getOutline(course.id, b1.id)?.nextLesson).toBeNull();
  });

  it("does not find a lesson from another course", () => {
    const { db, lessonPage, course, instructor, category } =
      courseWithTwoModules();
    const other = db
      .insert(schema.courses)
      .values({
        title: "Other",
        slug: "other",
        description: "",
        salesCopy: markdown(""),
        status: schema.CourseStatus.Published,
        instructorId: instructor.id,
        categoryId: category.id,
      })
      .returning()
      .get();
    const otherModule = addModule(db, other.id, { title: "M", position: 1 });
    const elsewhere = addLesson(db, otherModule.id, {
      title: "X",
      position: 1,
    });

    expect(lessonPage.getOutline(course.id, elsewhere.id)).toBeNull();
  });

  it("does not find an unknown course or lesson", () => {
    const { lessonPage, course, a1 } = courseWithTwoModules();

    expect(lessonPage.getOutline(course.id, 9999)).toBeNull();
    expect(lessonPage.getOutline(9999, a1.id)).toBeNull();
  });
});
