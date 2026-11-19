import { Link } from "react-router";
import { ArrowRight, BookOpen, User } from "lucide-react";
import { CourseImage } from "~/components/course-image";
import type {
  LandingCourse,
  Spotlight,
  SpotlightModule,
} from "~/modules/landing/index.server";

export function SpotlightCard({ spotlight }: { spotlight: Spotlight }) {
  const { course, modules, moduleCount } = spotlight;
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-4 rotate-2 rounded-3xl bg-primary/5"
      />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <CourseImage
          src={course.coverImageUrl}
          alt={course.title}
          className="aspect-[16/7] w-full object-cover"
        />
        <div className="p-6">
          <CourseSummary course={course} />
          <ModuleOutline modules={modules} />
          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {moduleCount > modules.length &&
                `+${moduleCount - modules.length} more modules`}
            </span>
            <Link
              to={`/courses/${course.slug}`}
              className="flex items-center gap-1 font-medium hover:text-primary"
            >
              See the course
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function CourseSummary({ course }: { course: LandingCourse }) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Newest course · {course.categoryName}
      </p>
      <h2 className="mt-2 text-xl font-semibold leading-snug">
        {course.title}
      </h2>
      <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="size-3.5" />
          {course.instructorName}
        </span>
        <span className="flex items-center gap-1">
          <BookOpen className="size-3.5" />
          {course.lessonCount} lessons
        </span>
      </div>
    </>
  );
}

function ModuleOutline({ modules }: { modules: SpotlightModule[] }) {
  if (modules.length === 0) return null;
  return (
    <ol className="mt-5 divide-y divide-border rounded-lg border border-border">
      {modules.map((module, index) => (
        <li
          key={module.id}
          className="flex items-center gap-3 px-4 py-2.5 text-sm"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {index + 1}
          </span>
          <span className="flex-1 truncate">{module.title}</span>
          <span className="text-xs text-muted-foreground">
            {module.lessonCount} lessons
          </span>
        </li>
      ))}
    </ol>
  );
}
