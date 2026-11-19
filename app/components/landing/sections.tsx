import { Link } from "react-router";
import {
  ArrowRight,
  BookOpen,
  ListChecks,
  Route as RouteIcon,
  User,
  type LucideIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "~/components/ui/card";
import { CourseImage } from "~/components/course-image";
import type { LandingCourse } from "~/modules/landing/index.server";

const valueProps: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: BookOpen,
    title: "Structured, not scattered",
    body: "Every course is split into modules and short lessons, so you always know what comes next.",
  },
  {
    icon: RouteIcon,
    title: "Progress that sticks",
    body: "Cadence remembers every lesson you finish. Close the tab and pick up exactly where you stopped.",
  },
  {
    icon: ListChecks,
    title: "Check what you learned",
    body: "Quizzes at the end of a lesson tell you whether it landed before you move on.",
  },
];

export function ValueProps() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="max-w-2xl text-3xl font-bold tracking-tight">
        Built for learning that actually finishes.
      </h2>
      <div className="mt-12 grid gap-10 sm:grid-cols-3">
        {valueProps.map(({ icon: Icon, title, body }) => (
          <div key={title}>
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Icon className="size-5" />
            </div>
            <h3 className="mt-5 font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function NewestCourses({ courses }: { courses: LandingCourse[] }) {
  if (courses.length === 0) return null;
  return (
    <section className="border-t border-border bg-muted/40">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              New on Cadence
            </h2>
            <p className="mt-2 text-muted-foreground">
              The latest courses from our instructors
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/courses">
              View all
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CourseCard({ course }: { course: LandingCourse }) {
  return (
    <Link to={`/courses/${course.slug}`} className="group">
      <Card className="h-full overflow-hidden pt-0 transition-shadow group-hover:shadow-md">
        <CourseImage
          src={course.coverImageUrl}
          alt={course.title}
          className="aspect-video w-full object-cover"
        />
        <CardHeader>
          <p className="text-xs font-medium text-muted-foreground">
            {course.categoryName}
          </p>
          <h3 className="font-semibold leading-snug group-hover:text-primary">
            {course.title}
          </h3>
        </CardHeader>
        <CardContent>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {course.description}
          </p>
        </CardContent>
        <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="size-3" />
            {course.instructorName}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="size-3" />
            {course.lessonCount} lessons
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}

export function LandingFooter({ signedIn }: { signedIn: boolean }) {
  const links = signedIn
    ? [
        { to: "/courses", label: "Courses" },
        { to: "/dashboard", label: "Dashboard" },
      ]
    : [
        { to: "/courses", label: "Courses" },
        { to: "/login", label: "Log in" },
        { to: "/signup", label: "Sign up" },
      ];
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/" className="text-lg font-bold tracking-tight">
            Cadence
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            Learn to code, at your own pace.
          </p>
        </div>
        <nav className="flex gap-6 text-sm text-muted-foreground">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
