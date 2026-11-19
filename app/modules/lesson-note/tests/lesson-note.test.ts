import { describe, expect, it } from "vitest";
import { describeNoteDraft } from "../index";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

describe("describeNoteDraft", () => {
  it("is new and cannot be saved before the Student writes anything", () => {
    expect(describeNoteDraft("", null)).toEqual({
      length: 0,
      max: MAX_NOTE_LENGTH,
      tooLong: false,
      state: "new",
      canSave: false,
    });
  });

  it("does not count whitespace alone", () => {
    const draft = describeNoteDraft("   \n ", null);
    expect(draft.length).toBe(0);
    expect(draft.canSave).toBe(false);
  });

  it("has unsaved changes once the Student types a first note", () => {
    const draft = describeNoteDraft("Generics are like parameters", null);
    expect(draft.state).toBe("unsaved");
    expect(draft.length).toBe(28);
    expect(draft.canSave).toBe(true);
  });

  it("is saved when the draft matches the stored note", () => {
    const draft = describeNoteDraft(
      "Remember strict mode",
      "Remember strict mode"
    );
    expect(draft.state).toBe("saved");
    expect(draft.canSave).toBe(false);
  });

  it("ignores surrounding whitespace when comparing with the stored note", () => {
    expect(describeNoteDraft("  same \n", "same").state).toBe("saved");
  });

  it("has unsaved changes when the draft differs from the stored note", () => {
    const draft = describeNoteDraft(
      "Remember strict mode!",
      "Remember strict mode"
    );
    expect(draft.state).toBe("unsaved");
    expect(draft.canSave).toBe(true);
  });

  it("cannot save a cleared note over a stored one", () => {
    const draft = describeNoteDraft("", "Remember strict mode");
    expect(draft.state).toBe("unsaved");
    expect(draft.canSave).toBe(false);
  });

  it("allows a note of exactly the limit", () => {
    const draft = describeNoteDraft("a".repeat(MAX_NOTE_LENGTH), null);
    expect(draft.tooLong).toBe(false);
    expect(draft.canSave).toBe(true);
  });

  it("refuses a note one character over the limit", () => {
    const draft = describeNoteDraft("a".repeat(MAX_NOTE_LENGTH + 1), null);
    expect(draft.tooLong).toBe(true);
    expect(draft.length).toBe(MAX_NOTE_LENGTH + 1);
    expect(draft.canSave).toBe(false);
  });
});
