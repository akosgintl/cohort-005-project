import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  quizAnswers,
  quizAttempts,
  quizOptions,
  quizQuestions,
  quizzes,
} from "~/db/schema";
import type {
  BestAttempt,
  LessonQuiz,
  QuestionResult,
  QuizResult,
} from "../types";
import type { Db } from "./db";

function questionsOf(db: Db, quizId: number) {
  return db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.position))
    .all();
}

function optionsOf(db: Db, questionIds: number[]) {
  return db
    .select()
    .from(quizOptions)
    .where(inArray(quizOptions.questionId, questionIds))
    .orderBy(asc(quizOptions.id))
    .all();
}

/**
 * The Lesson's quiz, without the answers, and the Student's best attempt at
 * it so far.
 */
export function getLessonQuiz(
  db: Db,
  lessonId: number,
  studentId: number | null
): { quiz: LessonQuiz | null; bestAttempt: BestAttempt | null } {
  const quiz = db
    .select()
    .from(quizzes)
    .where(eq(quizzes.lessonId, lessonId))
    .get();
  if (!quiz) return { quiz: null, bestAttempt: null };

  const questions = questionsOf(db, quiz.id);
  const options = optionsOf(
    db,
    questions.map((q) => q.id)
  );

  const best =
    studentId === null
      ? undefined
      : db
          .select({ score: quizAttempts.score, passed: quizAttempts.passed })
          .from(quizAttempts)
          .where(
            and(
              eq(quizAttempts.userId, studentId),
              eq(quizAttempts.quizId, quiz.id)
            )
          )
          .orderBy(desc(quizAttempts.score))
          .limit(1)
          .get();

  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      passingScore: quiz.passingScore,
      questions: questions.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        position: q.position,
        options: options
          .filter((o) => o.questionId === q.id)
          .map((o) => ({ id: o.id, optionText: o.optionText })),
      })),
    },
    bestAttempt: best ?? null,
  };
}

export function gradeFor(score: number): string {
  if (score >= 0.9) return "A";
  if (score >= 0.8) return "B";
  if (score >= 0.7) return "C";
  if (score >= 0.6) return "D";
  return "F";
}

type QuizOption = { questionId: number; id: number; isCorrect: boolean };

function markQuestion(
  questionId: number,
  selected: number | undefined,
  options: QuizOption[]
): QuestionResult {
  if (!selected) {
    return {
      questionId,
      correct: false,
      selectedOptionId: null,
      correctOptionId: null,
    };
  }
  const correctOptionId =
    options.find((o) => o.questionId === questionId && o.isCorrect)?.id ?? null;
  return {
    questionId,
    correct: selected === correctOptionId,
    selectedOptionId: selected,
    correctOptionId,
  };
}

function recordAttempt(
  db: Db,
  attempt: {
    studentId: number;
    quizId: number;
    score: number;
    passed: boolean;
  },
  results: QuestionResult[]
): number {
  return db.transaction((tx) => {
    const { id } = tx
      .insert(quizAttempts)
      .values({
        userId: attempt.studentId,
        quizId: attempt.quizId,
        score: attempt.score,
        passed: attempt.passed,
      })
      .returning({ id: quizAttempts.id })
      .get();
    const answered = results.flatMap((r) =>
      r.selectedOptionId === null
        ? []
        : [
            {
              attemptId: id,
              questionId: r.questionId,
              selectedOptionId: r.selectedOptionId,
            },
          ]
    );
    if (answered.length > 0) tx.insert(quizAnswers).values(answered).run();
    return id;
  });
}

export type Submission = {
  studentId: number;
  lessonId: number;
  quizId: number;
  /** Question id to the chosen option id. */
  answers: Record<number, number>;
};

/**
 * Scores the Student's answers and records the attempt. Returns null when the
 * quiz is not on this Lesson, so an id from elsewhere cannot be reached.
 */
export function submitQuiz(
  db: Db,
  { studentId, lessonId, quizId, answers }: Submission
): QuizResult | null {
  const quiz = db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.lessonId, lessonId)))
    .get();
  if (!quiz) return null;

  const questions = questionsOf(db, quiz.id);
  const options = optionsOf(
    db,
    questions.map((q) => q.id)
  );
  const questionResults = questions.map((q) =>
    markQuestion(q.id, answers[q.id], options)
  );

  const totalQuestions = questions.length;
  const totalCorrect = questionResults.filter((r) => r.correct).length;
  const score = totalQuestions > 0 ? totalCorrect / totalQuestions : 0;
  const passed = score > 0.7;
  const attemptId = recordAttempt(
    db,
    { studentId, quizId: quiz.id, score, passed },
    questionResults
  );

  return {
    attemptId,
    score,
    passed,
    grade: gradeFor(score),
    totalCorrect,
    totalQuestions,
    questionResults,
  };
}
