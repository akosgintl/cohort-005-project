import { describe, expect, it } from "vitest";
import { LessonProgressStatus } from "~/db/schema";
import {
  addLesson,
  addModule,
  addUser,
  addWatchEvent,
  NOW,
  setup,
} from "./fixtures";

function courseWithVideo() {
  const fixture = setup();
  const { db, course } = fixture;
  const mod = addModule(db, course.id, { title: "M", position: 1 });
  const video = addLesson(db, mod.id, {
    title: "Video",
    position: 1,
    videoUrl: "https://youtube.com/watch?v=abc",
    durationMinutes: 10,
  });
  const reading = addLesson(db, mod.id, { title: "Reading", position: 2 });
  return { ...fixture, video, reading };
}

describe("visitLesson", () => {
  it("starts a lesson the Student has not opened before", () => {
    const { lessonPage, student, course, reading } = courseWithVideo();

    const visit = lessonPage.visitLesson({
      studentId: student.id,
      courseId: course.id,
      lesson: reading,
    });

    expect(visit.lessonStatus).toBe(LessonProgressStatus.InProgress);
    expect(visit.lessonProgressMap).toEqual({
      [reading.id]: LessonProgressStatus.InProgress,
    });
  });

  it("leaves a completed lesson completed", () => {
    const { lessonPage, student, course, reading } = courseWithVideo();
    lessonPage.completeLesson(student.id, reading.id, NOW);

    const visit = lessonPage.visitLesson({
      studentId: student.id,
      courseId: course.id,
      lesson: reading,
    });

    expect(visit.lessonStatus).toBe(LessonProgressStatus.Completed);
  });

  it("maps every lesson's status in the course, and only the Student's", () => {
    const { db, lessonPage, student, course, video, reading } =
      courseWithVideo();
    const classmate = addUser(db, "Classmate");
    lessonPage.completeLesson(student.id, video.id, NOW);
    lessonPage.completeLesson(classmate.id, reading.id, NOW);

    const visit = lessonPage.visitLesson({
      studentId: student.id,
      courseId: course.id,
      lesson: reading,
    });

    expect(visit.lessonProgressMap).toEqual({
      [video.id]: LessonProgressStatus.Completed,
      [reading.id]: LessonProgressStatus.InProgress,
    });
  });

  it("resumes the video where the Student last was, and shows how far they got", () => {
    const { db, lessonPage, student, course, video } = courseWithVideo();
    const watch = (positionSeconds: number, createdAt: string) =>
      addWatchEvent(db, {
        userId: student.id,
        lessonId: video.id,
        positionSeconds,
        createdAt,
      });
    watch(300, "2026-11-19T10:00:00.000Z");
    watch(120, "2026-11-19T11:00:00.000Z");

    const visit = lessonPage.visitLesson({
      studentId: student.id,
      courseId: course.id,
      lesson: video,
    });

    expect(visit.lastWatchPosition).toBe(120);
    expect(visit.watchProgress).toBe(50);
  });

  it("caps watch progress at 100%", () => {
    const { db, lessonPage, student, course, video } = courseWithVideo();
    addWatchEvent(db, {
      userId: student.id,
      lessonId: video.id,
      positionSeconds: 900,
      createdAt: NOW.toISOString(),
    });

    const visit = lessonPage.visitLesson({
      studentId: student.id,
      courseId: course.id,
      lesson: video,
    });

    expect(visit.watchProgress).toBe(100);
  });

  it("starts at zero on a video the Student has not watched", () => {
    const { lessonPage, student, course, video } = courseWithVideo();

    const visit = lessonPage.visitLesson({
      studentId: student.id,
      courseId: course.id,
      lesson: video,
    });

    expect(visit.lastWatchPosition).toBe(0);
    expect(visit.watchProgress).toBe(0);
  });

  it("shows no progress for a video with no duration", () => {
    const { db, lessonPage, student, course, video } = courseWithVideo();
    addWatchEvent(db, {
      userId: student.id,
      lessonId: video.id,
      positionSeconds: 60,
      createdAt: NOW.toISOString(),
    });

    const visit = lessonPage.visitLesson({
      studentId: student.id,
      courseId: course.id,
      lesson: { ...video, durationMinutes: null },
    });

    expect(visit.lastWatchPosition).toBe(60);
    expect(visit.watchProgress).toBe(0);
  });

  it("ignores watch events on a lesson without a video", () => {
    const { db, lessonPage, student, course, reading } = courseWithVideo();
    addWatchEvent(db, {
      userId: student.id,
      lessonId: reading.id,
      positionSeconds: 60,
      createdAt: NOW.toISOString(),
    });

    const visit = lessonPage.visitLesson({
      studentId: student.id,
      courseId: course.id,
      lesson: { ...reading, durationMinutes: 1 },
    });

    expect(visit.lastWatchPosition).toBe(0);
    expect(visit.watchProgress).toBe(0);
  });
});

describe("completeLesson", () => {
  it("completes a lesson the Student was part way through", () => {
    const { lessonPage, student, course, reading } = courseWithVideo();
    const visit = {
      studentId: student.id,
      courseId: course.id,
      lesson: reading,
    };
    lessonPage.visitLesson(visit);

    lessonPage.completeLesson(student.id, reading.id, NOW);

    expect(lessonPage.visitLesson(visit).lessonStatus).toBe(
      LessonProgressStatus.Completed
    );
  });

  it("completes a lesson the Student never opened", () => {
    const { lessonPage, student, course, reading } = courseWithVideo();

    lessonPage.completeLesson(student.id, reading.id, NOW);

    expect(
      lessonPage.visitLesson({
        studentId: student.id,
        courseId: course.id,
        lesson: reading,
      }).lessonStatus
    ).toBe(LessonProgressStatus.Completed);
  });
});
