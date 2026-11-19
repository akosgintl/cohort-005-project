import { db } from "~/db";
import { getLandingPage, type Db } from "./lib/landing";

export {
  NEWEST_COURSE_LIMIT,
  SPOTLIGHT_MODULE_LIMIT,
} from "./lib/landing";
export type {
  LandingCourse,
  LandingPage,
  LandingStats,
  Spotlight,
  SpotlightModule,
} from "./lib/landing";

/**
 * The landing page bound to a database. The app uses `landing`, which reads
 * the app database; tests build their own against a test database.
 */
export function createLanding(database: Db) {
  return {
    /**
     * The newest published courses, the catalogue's figures, and the newest
     * course's outline. Drafts and archived courses never appear.
     */
    get() {
      return getLandingPage(database);
    },
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const landing = /* @__PURE__ */ createLanding(db);
