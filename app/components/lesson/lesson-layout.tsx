import type { CurriculumModule } from "~/modules/lesson-page/types";
import { CurriculumSidebar } from "./curriculum-sidebar";
import { LessonBreadcrumb } from "./lesson-breadcrumb";

/** The course sidebar, the breadcrumb, and the column the Lesson sits in. */
export function LessonLayout({
  outline,
  lessonProgressMap,
  enrolled,
  children,
}: {
  outline: {
    course: { id: number; title: string; slug: string };
    curriculum: CurriculumModule[];
    module: { id: number; title: string };
    lesson: { id: number; title: string };
  };
  lessonProgressMap: Record<number, string>;
  enrolled: boolean;
  children: React.ReactNode;
}) {
  const { course, lesson } = outline;

  return (
    <div className="flex">
      <CurriculumSidebar
        course={course}
        curriculum={outline.curriculum}
        currentLessonId={lesson.id}
        lessonProgressMap={lessonProgressMap}
        enrolled={enrolled}
      />

      <div className="flex-1 p-6 lg:p-8">
        <LessonBreadcrumb
          course={course}
          mod={outline.module}
          lessonTitle={lesson.title}
        />

        <div className="mx-auto max-w-4xl">{children}</div>
      </div>
    </div>
  );
}
