import { useEffect, useState } from "react";
import type { useFetcher } from "react-router";
import { toast } from "sonner";
import {
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  Trophy,
  XCircle,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import type {
  BestAttempt,
  LessonQuiz,
  QuestionResult,
  QuizResult,
} from "~/modules/lesson-page/types";

type Question = LessonQuiz["questions"][number];
type Answers = Record<number, number>;

type QuizSectionProps = {
  quiz: LessonQuiz;
  bestAttempt: BestAttempt | null;
  quizResult: QuizResult | null;
  quizFetcher: ReturnType<typeof useFetcher>;
  isSubmitting: boolean;
};

export function QuizSection({
  quiz,
  bestAttempt,
  quizResult,
  quizFetcher,
  isSubmitting,
}: QuizSectionProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Answers>({});
  const [showQuiz, setShowQuiz] = useState(!bestAttempt?.passed);
  const [retaking, setRetaking] = useState(false);

  useResultToast(quizResult, retaking);

  if (quizResult && !retaking) {
    return (
      <QuizResultCard
        quiz={quiz}
        result={quizResult}
        onRetake={() => {
          setSelectedAnswers({});
          setRetaking(true);
        }}
      />
    );
  }

  if (!showQuiz && bestAttempt?.passed) {
    return (
      <QuizPassedSummary
        title={quiz.title}
        bestAttempt={bestAttempt}
        onRetake={() => setShowQuiz(true)}
      />
    );
  }

  return (
    <QuizCard title={quiz.title}>
      <p className="mb-6 text-sm text-muted-foreground">
        Answer all questions and submit. Passing score:{" "}
        {Math.round(quiz.passingScore * 100)}%.
      </p>
      <QuizForm
        quiz={quiz}
        answers={selectedAnswers}
        onAnswer={setSelectedAnswers}
        quizFetcher={quizFetcher}
        isSubmitting={isSubmitting}
        onSubmit={() => setRetaking(false)}
      />
    </QuizCard>
  );
}

function useResultToast(result: QuizResult | null, retaking: boolean) {
  useEffect(() => {
    if (!result || retaking) return;
    const score = `Score: ${Math.round(result.score * 100)}%`;
    if (result.passed) toast.success(`Quiz passed! ${score}`);
    else toast.error(`Quiz not passed. ${score}`);
  }, [result, retaking]);
}

function QuizCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <HelpCircle className="size-5 text-primary" />
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function QuizResultCard({
  quiz,
  result,
  onRetake,
}: {
  quiz: LessonQuiz;
  result: QuizResult;
  onRetake: () => void;
}) {
  return (
    <QuizCard title={quiz.title}>
      <ResultSummary result={result} />
      <div className="space-y-4">
        {quiz.questions.map((question, qIndex) => (
          <QuestionReview
            key={question.id}
            number={qIndex + 1}
            question={question}
            result={result.questionResults.find(
              (r) => r.questionId === question.id
            )}
          />
        ))}
      </div>
      {!result.passed && (
        <div className="mt-6">
          <Button variant="outline" onClick={onRetake}>
            <RotateCcw className="mr-2 size-4" />
            Retake Quiz
          </Button>
        </div>
      )}
    </QuizCard>
  );
}

function ResultSummary({ result }: { result: QuizResult }) {
  return (
    <div
      className={`mb-6 rounded-lg p-4 ${result.passed ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}`}
    >
      <div className="flex items-center gap-3">
        {result.passed ? (
          <Trophy className="size-8 text-green-600" />
        ) : (
          <XCircle className="size-8 text-red-600" />
        )}
        <div>
          <p
            className={`text-lg font-semibold ${result.passed ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
          >
            {result.passed ? "You passed!" : "Not quite — try again!"}
          </p>
          <p className="text-sm text-muted-foreground">
            Score: {result.totalCorrect}/{result.totalQuestions} (
            {Math.round(result.score * 100)}%) — Grade: {result.grade}
          </p>
        </div>
      </div>
    </div>
  );
}

function QuestionReview({
  number,
  question,
  result,
}: {
  number: number;
  question: Question;
  result: QuestionResult | undefined;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-start gap-2">
        {result?.correct ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" />
        ) : (
          <XCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
        )}
        <p className="font-medium">
          {number}. {question.questionText}
        </p>
      </div>
      <div className="ml-7 space-y-1">
        {question.options.map((option) => {
          const isSelected = result?.selectedOptionId === option.id;
          const isCorrect = result?.correctOptionId === option.id;
          let className = "text-sm";
          if (isCorrect)
            className += " font-medium text-green-700 dark:text-green-400";
          else if (isSelected && !result?.correct)
            className += " text-red-600 dark:text-red-400 line-through";
          return (
            <p key={option.id} className={className}>
              {isCorrect ? "✓ " : isSelected ? "✗ " : "  "}
              {option.optionText}
            </p>
          );
        })}
      </div>
    </div>
  );
}

function QuizPassedSummary({
  title,
  bestAttempt,
  onRetake,
}: {
  title: string;
  bestAttempt: BestAttempt;
  onRetake: () => void;
}) {
  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-green-600" />
            <span className="font-medium">{title}</span>
            <span className="text-sm text-muted-foreground">
              — Best score: {Math.round(bestAttempt.score * 100)}%
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={onRetake}>
            <RotateCcw className="mr-2 size-4" />
            Retake
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QuizForm({
  quiz,
  answers,
  onAnswer,
  quizFetcher,
  isSubmitting,
  onSubmit,
}: {
  quiz: LessonQuiz;
  answers: Answers;
  onAnswer: (update: (prev: Answers) => Answers) => void;
  quizFetcher: ReturnType<typeof useFetcher>;
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  const allAnswered = quiz.questions.every((q) => answers[q.id] !== undefined);

  return (
    <quizFetcher.Form method="post" onSubmit={onSubmit}>
      <input type="hidden" name="intent" value="submit-quiz" />
      <input type="hidden" name="quizId" value={quiz.id} />

      <div className="space-y-6">
        {quiz.questions.map((question, qIndex) => (
          <QuestionField
            key={question.id}
            number={qIndex + 1}
            question={question}
            selected={answers[question.id]}
            onSelect={(optionId) =>
              onAnswer((prev) => ({ ...prev, [question.id]: optionId }))
            }
          />
        ))}
      </div>

      <div className="mt-6">
        <Button type="submit" disabled={!allAnswered || isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit Quiz"}
        </Button>
        {!allAnswered && (
          <p className="mt-2 text-sm text-muted-foreground">
            Please answer all questions before submitting.
          </p>
        )}
      </div>
    </quizFetcher.Form>
  );
}

function QuestionField({
  number,
  question,
  selected,
  onSelect,
}: {
  number: number;
  question: Question;
  selected: number | undefined;
  onSelect: (optionId: number) => void;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="mb-3 font-medium">
        {number}. {question.questionText}
      </p>
      <div className="space-y-2">
        {question.options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted"
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              value={option.id}
              checked={selected === option.id}
              onChange={() => onSelect(option.id)}
              className="size-4 accent-primary"
            />
            <span className="text-sm">{option.optionText}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
