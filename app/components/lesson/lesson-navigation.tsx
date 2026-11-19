import { useEffect } from "react";
import { Link, useFetcher, useNavigate } from "react-router";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { LessonProgressStatus } from "~/db/schema";
import type { NeighbourLesson } from "~/modules/lesson-page/types";

type Neighbours = {
  courseSlug: string;
  nextLesson: NeighbourLesson | null;
};

function CompletedBanner({ courseSlug, nextLesson }: Neighbours) {
  return (
    <div className="mb-8 flex items-center gap-3">
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="size-5" />
        <span className="font-medium">Lesson completed</span>
      </div>
      {nextLesson && (
        <Link to={`/courses/${courseSlug}/lessons/${nextLesson.id}`}>
          <Button variant="outline" size="sm">
            Up next: {nextLesson.title}
            <ChevronRight className="ml-1 size-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}

/** Mark the Lesson complete, which moves the Student on to the next one. */
export function LessonCompletion({
  courseSlug,
  lessonId,
  lessonStatus,
  nextLesson,
}: Neighbours & { lessonId: number; lessonStatus: string | null }) {
  const fetcher = useFetcher({ key: `mark-complete-${lessonId}` });
  const navigate = useNavigate();
  const isMarking =
    fetcher.state !== "idle" &&
    fetcher.formData?.get("intent") === "mark-complete";
  const justCompleted = fetcher.data?.success;

  useEffect(() => {
    if (justCompleted && nextLesson) {
      navigate(`/courses/${courseSlug}/lessons/${nextLesson.id}`);
    }
  }, [justCompleted, nextLesson, courseSlug, navigate]);

  if (lessonStatus === LessonProgressStatus.Completed || justCompleted) {
    return <CompletedBanner courseSlug={courseSlug} nextLesson={nextLesson} />;
  }

  return (
    <fetcher.Form method="post" className="mb-8">
      <input type="hidden" name="intent" value="mark-complete" />
      <Button disabled={isMarking}>
        {nextLesson ? (
          isMarking ? (
            "Completing..."
          ) : (
            <>
              Up next: {nextLesson.title}
              <ChevronRight className="ml-1 size-4" />
            </>
          )
        ) : (
          <>
            <CheckCircle2 className="mr-2 size-4" />
            {isMarking ? "Marking..." : "Mark as Complete"}
          </>
        )}
      </Button>
    </fetcher.Form>
  );
}

const pagerLink =
  "flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground";

function PagerLabel({ label, title }: { label: string; title: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{title}</div>
    </div>
  );
}

/** Previous and next Lesson, or back to the course after the last one. */
export function LessonPager({
  course,
  prevLesson,
  nextLesson,
}: {
  course: { title: string; slug: string };
  prevLesson: NeighbourLesson | null;
  nextLesson: NeighbourLesson | null;
}) {
  return (
    <div className="flex items-center justify-between border-t pt-6">
      {prevLesson ? (
        <Link
          to={`/courses/${course.slug}/lessons/${prevLesson.id}`}
          className={pagerLink}
        >
          <ChevronLeft className="size-4" />
          <PagerLabel label="Previous" title={prevLesson.title} />
        </Link>
      ) : (
        <div />
      )}

      {nextLesson ? (
        <Link
          to={`/courses/${course.slug}/lessons/${nextLesson.id}`}
          className={`${pagerLink} text-right`}
        >
          <PagerLabel label="Next" title={nextLesson.title} />
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <Link to={`/courses/${course.slug}`} className={pagerLink}>
          <PagerLabel label="Back to" title={course.title} />
          <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
