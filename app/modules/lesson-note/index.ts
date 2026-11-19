import { describeDraft, type NoteDraft } from "./lib/draft";

export type { NoteDraft };

/**
 * What the Lesson page shows under the Student's Note while they type: the
 * character count against the limit, whether there is anything new to save,
 * and whether Save should be enabled.
 */
export function describeNoteDraft(
  draft: string,
  savedBody: string | null
): NoteDraft {
  return describeDraft(draft, savedBody);
}
