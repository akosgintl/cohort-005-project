import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteDraft = {
  /** Characters that would be saved: the server trims before it stores. */
  length: number;
  max: number;
  tooLong: boolean;
  empty: boolean;
  /** "new" until the first save, then "saved" or "unsaved". */
  state: "new" | "saved" | "unsaved";
  canSave: boolean;
};

export function describeDraft(
  draft: string,
  savedBody: string | null
): NoteDraft {
  const trimmed = draft.trim();
  const length = trimmed.length;
  const tooLong = length > MAX_NOTE_LENGTH;
  const empty = length === 0;
  const unsaved = trimmed !== (savedBody ?? "");
  const state = unsaved ? "unsaved" : savedBody === null ? "new" : "saved";

  return {
    length,
    max: MAX_NOTE_LENGTH,
    tooLong,
    empty,
    state,
    canSave: unsaved && !empty && !tooLong,
  };
}
