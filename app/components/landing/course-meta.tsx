import { BookOpen, User } from "lucide-react";
import { cn } from "~/lib/utils";
import type { LandingCourse } from "~/modules/landing/index.server";

export function courseHref(course: Pick<LandingCourse, "slug">) {
  return `/courses/${course.slug}`;
}

export function CourseMeta({
  course,
  className,
  iconClassName,
}: {
  course: Pick<LandingCourse, "instructorName" | "lessonCount">;
  className?: string;
  iconClassName: string;
}) {
  return (
    <div className={cn("flex items-center", className)}>
      <span className="flex items-center gap-1">
        <User className={iconClassName} />
        {course.instructorName}
      </span>
      <span className="flex items-center gap-1">
        <BookOpen className={iconClassName} />
        {course.lessonCount} lessons
      </span>
    </div>
  );
}
