import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { LandingStats, Spotlight } from "~/modules/landing/index.server";
import { courseHref } from "./course-meta";
import { SpotlightCard } from "./spotlight-card";

type HeroProps = {
  stats: LandingStats;
  spotlight: Spotlight | null;
  signedIn: boolean;
};

export function Hero({ stats, spotlight, signedIn }: HeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-muted/70 to-background"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        <div>
          {spotlight && <NewBadge spotlight={spotlight} />}
          <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Learn to code,
            <br />
            <span className="text-muted-foreground">at your own pace.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Structured courses built by experienced instructors. Work through
            real lessons, check yourself with quizzes, and pick up exactly where
            you left off.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <Link to="/courses">
                Browse courses
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              {signedIn ? (
                <Link to="/dashboard">Go to your dashboard</Link>
              ) : (
                <Link to="/signup">Sign up free</Link>
              )}
            </Button>
          </div>
          <StatsRow stats={stats} />
        </div>
        {spotlight && <SpotlightCard spotlight={spotlight} />}
      </div>
    </section>
  );
}

function StatsRow({ stats }: { stats: LandingStats }) {
  const figures = [
    { label: "Courses", value: stats.courses },
    { label: "Lessons", value: stats.lessons },
    { label: "Instructors", value: stats.instructors },
    { label: "Categories", value: stats.categories },
  ];
  return (
    <dl className="mt-14 grid max-w-xl grid-cols-2 gap-6 border-t border-border pt-8 sm:grid-cols-4">
      {figures.map((figure) => (
        <div key={figure.label}>
          <dt className="text-sm text-muted-foreground">{figure.label}</dt>
          <dd className="mt-1 text-3xl font-bold tracking-tight">
            {figure.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function NewBadge({ spotlight }: { spotlight: Spotlight }) {
  return (
    <Link
      to={courseHref(spotlight.course)}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
        New
      </span>
      {spotlight.course.title}
      <ArrowRight className="size-3" />
    </Link>
  );
}
