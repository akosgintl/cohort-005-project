import { describe, expect, it } from "vitest";
import * as schema from "~/db/schema";
import { eq } from "drizzle-orm";
import { addLesson, addModule, addQuiz, setup } from "./fixtures";

function lessonWithQuiz() {
  const fixture = setup();
  const { db, course } = fixture;
  const mod = addModule(db, course.id, { title: "M", position: 1 });
  const lesson = addLesson(db, mod.id, { title: "L", position: 1 });
  const other = addLesson(db, mod.id, { title: "Other", position: 2 });
  const quiz = addQuiz(db, lesson.id, [
    { text: "2 + 2?", options: ["3", "*4"] },
    { text: "Is TS typed?", options: ["*Yes", "No"] },
    { text: "Pick c", options: ["a", "b", "*c"] },
    { text: "Pick z", options: ["*z", "y"] },
  ]);
  const [q1, q2, q3, q4] = quiz.questions;
  const right = (q: (typeof quiz.questions)[number]) =>
    q.options.find((o) => o.isCorrect)?.id ?? 0;
  const wrong = (q: (typeof quiz.questions)[number]) =>
    q.options.find((o) => !o.isCorrect)?.id ?? 0;
  return { ...fixture, lesson, other, quiz, q1, q2, q3, q4, right, wrong };
}

describe("getQuiz", () => {
  it("has no quiz on a lesson without one", () => {
    const { lessonPage, other, student } = lessonWithQuiz();

    expect(lessonPage.getQuiz(other.id, student.id)).toEqual({
      quiz: null,
      bestAttempt: null,
    });
  });

  it("returns the questions in order without saying which option is right", () => {
    const { lessonPage, lesson, quiz, q1 } = lessonWithQuiz();

    const { quiz: shown } = lessonPage.getQuiz(lesson.id, null);

    expect(shown?.id).toBe(quiz.id);
    expect(shown?.title).toBe("Check yourself");
    expect(shown?.passingScore).toBe(0.7);
    expect(shown?.questions.map((q) => q.questionText)).toEqual([
      "2 + 2?",
      "Is TS typed?",
      "Pick c",
      "Pick z",
    ]);
    expect(shown?.questions[0]).toEqual({
      id: q1.id,
      questionText: "2 + 2?",
      questionType: schema.QuestionType.MultipleChoice,
      position: 0,
      options: q1.options.map((o) => ({ id: o.id, optionText: o.optionText })),
    });
  });

  it("returns the Student's best attempt", () => {
    const { lessonPage, lesson, quiz, student, q1, q2, q3, right } =
      lessonWithQuiz();
    const submit = (answers: Record<number, number>) =>
      lessonPage.submitQuiz({
        studentId: student.id,
        lessonId: lesson.id,
        quizId: quiz.id,
        answers,
      });
    submit({ [q1.id]: right(q1) });
    submit({ [q1.id]: right(q1), [q2.id]: right(q2), [q3.id]: right(q3) });
    submit({});

    expect(lessonPage.getQuiz(lesson.id, student.id).bestAttempt).toEqual({
      score: 0.75,
      passed: true,
    });
  });

  it("has no best attempt for someone signed out or who has not tried", () => {
    const { lessonPage, lesson, student } = lessonWithQuiz();

    expect(lessonPage.getQuiz(lesson.id, null).bestAttempt).toBeNull();
    expect(lessonPage.getQuiz(lesson.id, student.id).bestAttempt).toBeNull();
  });
});

describe("submitQuiz", () => {
  it("scores every question right as a pass with an A", () => {
    const {
      lessonPage,
      lesson,
      quiz,
      student,
      quiz: { questions },
      right,
    } = lessonWithQuiz();

    const result = lessonPage.submitQuiz({
      studentId: student.id,
      lessonId: lesson.id,
      quizId: quiz.id,
      answers: Object.fromEntries(questions.map((q) => [q.id, right(q)])),
    });

    expect(result).toMatchObject({
      score: 1,
      passed: true,
      grade: "A",
      totalCorrect: 4,
      totalQuestions: 4,
    });
  });

  it("marks each question, naming the right option", () => {
    const { lessonPage, lesson, quiz, student, q1, q2, q3, q4, right, wrong } =
      lessonWithQuiz();

    const result = lessonPage.submitQuiz({
      studentId: student.id,
      lessonId: lesson.id,
      quizId: quiz.id,
      answers: { [q1.id]: right(q1), [q2.id]: wrong(q2), [q4.id]: right(q4) },
    });

    expect(result?.questionResults).toEqual([
      {
        questionId: q1.id,
        correct: true,
        selectedOptionId: right(q1),
        correctOptionId: right(q1),
      },
      {
        questionId: q2.id,
        correct: false,
        selectedOptionId: wrong(q2),
        correctOptionId: right(q2),
      },
      {
        questionId: q3.id,
        correct: false,
        selectedOptionId: null,
        correctOptionId: null,
      },
      {
        questionId: q4.id,
        correct: true,
        selectedOptionId: right(q4),
        correctOptionId: right(q4),
      },
    ]);
    expect(result).toMatchObject({ score: 0.5, passed: false, grade: "F" });
  });

  it("does not pass at exactly 70%", () => {
    const { db, lessonPage, course, student } = lessonWithQuiz();
    const mod = addModule(db, course.id, { title: "Ten", position: 2 });
    const lesson = addLesson(db, mod.id, { title: "Ten", position: 1 });
    const quiz = addQuiz(
      db,
      lesson.id,
      Array.from({ length: 10 }, (_, i) => ({
        text: `Q${i}`,
        options: ["*right", "wrong"],
      }))
    );
    const answers = Object.fromEntries(
      quiz.questions.map((q, i) => [q.id, q.options[i < 7 ? 0 : 1].id])
    );

    const result = lessonPage.submitQuiz({
      studentId: student.id,
      lessonId: lesson.id,
      quizId: quiz.id,
      answers,
    });

    expect(result).toMatchObject({ score: 0.7, passed: false, grade: "C" });
  });

  it("records the attempt and each answer given", () => {
    const { db, lessonPage, lesson, quiz, student, q1, q2, right, wrong } =
      lessonWithQuiz();

    const result = lessonPage.submitQuiz({
      studentId: student.id,
      lessonId: lesson.id,
      quizId: quiz.id,
      answers: { [q1.id]: right(q1), [q2.id]: wrong(q2) },
    });

    const attempt = db
      .select()
      .from(schema.quizAttempts)
      .where(eq(schema.quizAttempts.id, result?.attemptId ?? 0))
      .get();
    expect(attempt).toMatchObject({
      userId: student.id,
      quizId: quiz.id,
      score: 0.25,
      passed: false,
    });
    const answers = db
      .select({
        questionId: schema.quizAnswers.questionId,
        selectedOptionId: schema.quizAnswers.selectedOptionId,
      })
      .from(schema.quizAnswers)
      .where(eq(schema.quizAnswers.attemptId, result?.attemptId ?? 0))
      .all();
    expect(answers).toEqual([
      { questionId: q1.id, selectedOptionId: right(q1) },
      { questionId: q2.id, selectedOptionId: wrong(q2) },
    ]);
  });

  it("records an attempt with no answers", () => {
    const { lessonPage, lesson, quiz, student } = lessonWithQuiz();

    const result = lessonPage.submitQuiz({
      studentId: student.id,
      lessonId: lesson.id,
      quizId: quiz.id,
      answers: {},
    });

    expect(result).toMatchObject({ score: 0, totalCorrect: 0, grade: "F" });
    expect(lessonPage.getQuiz(lesson.id, student.id).bestAttempt).toEqual({
      score: 0,
      passed: false,
    });
  });

  it("scores a quiz with no questions as zero", () => {
    const { db, lessonPage, other, student } = lessonWithQuiz();
    const empty = addQuiz(db, other.id, []);

    const result = lessonPage.submitQuiz({
      studentId: student.id,
      lessonId: other.id,
      quizId: empty.id,
      answers: {},
    });

    expect(result).toMatchObject({ score: 0, totalQuestions: 0 });
  });

  it("refuses a quiz from another lesson", () => {
    const { lessonPage, other, quiz, student } = lessonWithQuiz();

    expect(
      lessonPage.submitQuiz({
        studentId: student.id,
        lessonId: other.id,
        quizId: quiz.id,
        answers: {},
      })
    ).toBeNull();
  });
});

describe("grades", () => {
  it.each([
    [0.9, "A"],
    [0.8, "B"],
    [0.6, "D"],
  ])("gives %s a %s", async (score, grade) => {
    const { db, lessonPage, course, student } = lessonWithQuiz();
    const mod = addModule(db, course.id, { title: "Ten", position: 2 });
    const lesson = addLesson(db, mod.id, { title: "Ten", position: 1 });
    const quiz = addQuiz(
      db,
      lesson.id,
      Array.from({ length: 10 }, (_, i) => ({
        text: `Q${i}`,
        options: ["*right", "wrong"],
      }))
    );
    const rightCount = Math.round(score * 10);
    const answers = Object.fromEntries(
      quiz.questions.map((q, i) => [q.id, q.options[i < rightCount ? 0 : 1].id])
    );

    const result = lessonPage.submitQuiz({
      studentId: student.id,
      lessonId: lesson.id,
      quizId: quiz.id,
      answers,
    });

    expect(result?.grade).toBe(grade);
  });
});

describe("a question with no correct option", () => {
  it("cannot be answered correctly", () => {
    const { db, lessonPage, other, student } = lessonWithQuiz();
    const broken = addQuiz(db, other.id, [
      { text: "Trick", options: ["a", "b"] },
    ]);
    const [question] = broken.questions;

    const result = lessonPage.submitQuiz({
      studentId: student.id,
      lessonId: other.id,
      quizId: broken.id,
      answers: { [question.id]: question.options[0].id },
    });

    expect(result?.questionResults).toEqual([
      {
        questionId: question.id,
        correct: false,
        selectedOptionId: question.options[0].id,
        correctOptionId: null,
      },
    ]);
  });
});
