import { useFetcher } from "react-router";
import { Clock, Github } from "lucide-react";
import { CommentThread } from "~/components/comment-thread";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { YouTubePlayer } from "~/components/youtube-player";
import { formatDuration } from "~/lib/utils";
import type {
  BestAttempt,
  LessonOutline,
  LessonQuiz,
  LessonVisit,
  ThreadComment,
} from "~/modules/lesson-page/types";
import { BookmarkToggle } from "./bookmark-toggle";
import { LessonLayout } from "./lesson-layout";
import { LessonNote } from "./lesson-note";
import { LessonCompletion, LessonPager } from "./lesson-navigation";
import { QuizSection } from "./quiz-section";
import { useAutoplay } from "./use-autoplay";

export type FullLessonData = LessonOutline &
  LessonVisit & {
    view: "full";
    contentHtml: string | null;
    enrolled: boolean;
    currentUserId: number | null;
    quiz: LessonQuiz | null;
    bestAttempt: BestAttempt | null;
    comments: ThreadComment[];
    canModerate: boolean;
    bookmarked: boolean;
    note: { body: string; updatedAt: string } | null;
  };

export function FullLesson({ data }: { data: FullLessonData }) {
  const { course, lesson, enrolled, currentUserId } = data;
  const canTakePart = enrolled && currentUserId !== null;

  return (
    <LessonLayout
      outline={data}
      lessonProgressMap={data.lessonProgressMap}
      enrolled={enrolled}
    >
      <LessonHeader
        lesson={lesson}
        bookmarked={currentUserId !== null ? data.bookmarked : null}
      />
      <LessonMedia data={data} />

      {data.quiz && canTakePart && (
        <LessonQuizSection
          lessonId={lesson.id}
          quiz={data.quiz}
          bestAttempt={data.bestAttempt}
        />
      )}

      {canTakePart && (
        <LessonCompletion
          courseSlug={course.slug}
          lessonId={lesson.id}
          lessonStatus={data.lessonStatus}
          nextLesson={data.nextLesson}
        />
      )}

      {/* Questions & Discussion — confidential to people with access */}
      <CommentThread
        comments={data.comments}
        currentUserId={currentUserId}
        canModerate={data.canModerate}
        canPost
        instructorName={data.instructorName}
      />

      <LessonPager
        course={course}
        prevLesson={data.prevLesson}
        nextLesson={data.nextLesson}
      />
    </LessonLayout>
  );
}

function LessonHeader({
  lesson,
  bookmarked,
}: {
  lesson: FullLessonData["lesson"];
  /** Null when nobody is signed in, so there is nothing to bookmark. */
  bookmarked: boolean | null;
}) {
  return (
    <>
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold">{lesson.title}</h1>
        {bookmarked !== null && <BookmarkToggle bookmarked={bookmarked} />}
      </div>
      <div className="mb-6 flex items-center gap-3">
        {lesson.durationMinutes && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-4" />
            {formatDuration(lesson.durationMinutes, true, false, false)}
          </div>
        )}
        {lesson.githubRepoUrl && (
          <a
            href={lesson.githubRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <Github className="mr-1.5 size-4" />
              Open Code
            </Button>
          </a>
        )}
      </div>
    </>
  );
}

/** The video, the Student's Note under it, then the written content. */
function LessonMedia({ data }: { data: FullLessonData }) {
  const { lesson, contentHtml, currentUserId } = data;
  const [autoplay, toggleAutoplay] = useAutoplay();

  return (
    <>
      {lesson.videoUrl && (
        <YouTubePlayer
          videoUrl={lesson.videoUrl}
          lessonId={lesson.id}
          title={lesson.title}
          startPosition={data.lastWatchPosition}
          durationMinutes={lesson.durationMinutes}
          watchProgress={data.watchProgress}
          trackingEnabled={data.enrolled && currentUserId !== null}
          autoplay={autoplay}
          onToggleAutoplay={toggleAutoplay}
        />
      )}

      {/* Under the video, so the Student can write while they watch */}
      {currentUserId !== null && (
        <LessonNote key={lesson.id} note={data.note} />
      )}

      {contentHtml && (
        <div
          className="prose prose-neutral dark:prose-invert mb-8 max-w-none"
          // oxlint-disable-next-line react/no-danger -- the instructor wrote this Markdown
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      )}

      {!contentHtml && !lesson.videoUrl && (
        <Card className="mb-8">
          <CardContent className="py-12 text-center text-muted-foreground">
            No content has been added to this lesson yet.
          </CardContent>
        </Card>
      )}
    </>
  );
}

function LessonQuizSection({
  lessonId,
  quiz,
  bestAttempt,
}: {
  lessonId: number;
  quiz: LessonQuiz;
  bestAttempt: BestAttempt | null;
}) {
  const quizFetcher = useFetcher({ key: `quiz-${lessonId}` });

  return (
    <QuizSection
      quiz={quiz}
      bestAttempt={bestAttempt}
      quizResult={quizFetcher.data?.quizResult ?? null}
      quizFetcher={quizFetcher}
      isSubmitting={quizFetcher.state !== "idle"}
    />
  );
}
