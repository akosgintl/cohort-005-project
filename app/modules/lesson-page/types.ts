import type { lessons } from "~/db/schema";

export type Lesson = typeof lessons.$inferSelect;

export type NeighbourLesson = {
  id: number;
  title: string;
  moduleId: number;
  moduleTitle: string;
};

export type CurriculumModule = {
  id: number;
  title: string;
  lessons: Array<{ id: number; title: string }>;
};

/** Where a Lesson sits in its course: what every viewer of the page sees. */
export type LessonOutline = {
  course: { id: number; title: string; slug: string };
  instructorName: string;
  curriculum: CurriculumModule[];
  module: { id: number; title: string };
  lesson: Lesson;
  prevLesson: NeighbourLesson | null;
  nextLesson: NeighbourLesson | null;
};

/** The Student's progress through the Lesson and its course. */
export type LessonVisit = {
  lessonStatus: string | null;
  lessonProgressMap: Record<number, string>;
  lastWatchPosition: number;
  watchProgress: number;
};

export type ThreadComment = {
  id: number;
  /** Raw markdown, only for the edit box. */
  body: string;
  /** Sanitised HTML: comments are untrusted input. */
  bodyHtml: string;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  author: {
    id: number;
    name: string;
    avatarUrl: string | null;
    isInstructor: boolean;
    isPlatformAdmin: boolean;
  };
  replies: ThreadComment[];
};

/** A quiz as the browser sees it: no option says whether it is correct. */
export type LessonQuiz = {
  id: number;
  title: string;
  passingScore: number;
  questions: Array<{
    id: number;
    questionText: string;
    questionType: string;
    position: number;
    options: Array<{ id: number; optionText: string }>;
  }>;
};

export type BestAttempt = { score: number; passed: boolean };

export type QuestionResult = {
  questionId: number;
  correct: boolean;
  selectedOptionId: number | null;
  correctOptionId: number | null;
};

export type QuizResult = {
  attemptId: number;
  score: number;
  passed: boolean;
  grade: string;
  totalCorrect: number;
  totalQuestions: number;
  questionResults: QuestionResult[];
};
