# The landing page shows only published courses

The landing page (`/`) is public. A draft or archived course is not open to anyone who is not signed in, so the landing page leaves it out of everything it shows: the newest-course list, the spotlight, and the figures (courses, lessons, Instructors, categories). If a figure counted a course nobody can open, it would promise more than the catalogue holds.

## Consequences

The figures can differ from what an Instructor or a Platform Admin sees elsewhere. `app/modules/landing` filters on `CourseStatus.Published` in every query, and its tests pin that.
