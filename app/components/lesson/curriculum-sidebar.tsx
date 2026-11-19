import { useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, ChevronDown, Circle, PlayCircle } from "lucide-react";
import { LessonProgressStatus } from "~/db/schema";
import { cn } from "~/lib/utils";
import type { CurriculumModule } from "~/modules/lesson-page/types";

type SidebarLessonProps = {
  courseSlug: string;
  lesson: { id: number; title: string };
  isCurrent: boolean;
  status: LessonProgressStatus | undefined;
  enrolled: boolean;
};

export function CurriculumSidebar({
  course,
  curriculum,
  currentLessonId,
  lessonProgressMap,
  enrolled,
}: {
  course: { id: number; title: string; slug: string };
  curriculum: CurriculumModule[];
  currentLessonId: number;
  lessonProgressMap: Record<number, LessonProgressStatus>;
  enrolled: boolean;
}) {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-border lg:block">
      <div className="sticky top-0 flex h-screen flex-col overflow-y-auto">
        <div className="border-b border-border p-4">
          <Link
            to={`/courses/${course.slug}`}
            className="text-sm font-semibold hover:text-primary"
          >
            {course.title}
          </Link>
        </div>

        <nav className="flex-1 p-2">
          {curriculum.map((mod) => (
            <SidebarModule
              key={mod.id}
              mod={mod}
              // The current lesson's module starts open.
              initiallyExpanded={mod.lessons.some(
                (l) => l.id === currentLessonId
              )}
            >
              {mod.lessons.map((l) => (
                <SidebarLesson
                  key={l.id}
                  courseSlug={course.slug}
                  lesson={l}
                  isCurrent={l.id === currentLessonId}
                  status={lessonProgressMap[l.id]}
                  enrolled={enrolled}
                />
              ))}
            </SidebarModule>
          ))}
        </nav>
      </div>
    </aside>
  );
}

function SidebarModule({
  mod,
  initiallyExpanded,
  children,
}: {
  mod: CurriculumModule;
  initiallyExpanded: boolean;
  children: React.ReactNode;
}) {
  const [isExpanded, setExpanded] = useState(initiallyExpanded);

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted"
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform",
            !isExpanded && "-rotate-90"
          )}
        />
        <span className="flex-1 text-left">{mod.title}</span>
      </button>

      {isExpanded && <ul className="ml-4 space-y-0.5 py-1">{children}</ul>}
    </div>
  );
}

function SidebarLesson({
  courseSlug,
  lesson,
  isCurrent,
  status,
  enrolled,
}: SidebarLessonProps) {
  return (
    <li>
      <Link
        to={`/courses/${courseSlug}/lessons/${lesson.id}`}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
          isCurrent
            ? "bg-primary/10 font-medium text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <LessonStatusIcon status={enrolled ? status : undefined} />
        <span className="truncate">{lesson.title}</span>
      </Link>
    </li>
  );
}

function LessonStatusIcon({
  status,
}: {
  status: LessonProgressStatus | undefined;
}) {
  if (status === LessonProgressStatus.Completed) {
    return <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />;
  }
  if (status === LessonProgressStatus.InProgress) {
    return <PlayCircle className="size-3.5 shrink-0 text-blue-500" />;
  }
  return <Circle className="size-3.5 shrink-0" />;
}
