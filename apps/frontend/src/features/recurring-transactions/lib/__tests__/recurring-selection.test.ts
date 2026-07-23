import { describe, expect, it } from "vitest";

import {
  buildRecurringBulkItems,
  getPageCheckboxState,
  retainAfterPartialSuccess,
  shouldShowSelectAllMatching,
  togglePageInSelection,
  toggleRowInSelection,
} from "../recurring-selection";

describe("recurring selection helpers", () => {
  it("tracks page checkbox independently of hidden selections", () => {
    const selected = new Set(["a", "hidden"]);
    expect(getPageCheckboxState([{ id: "a" }, { id: "b" }], selected)).toBe("some");
    expect(getPageCheckboxState([{ id: "a" }], selected)).toBe("all");
  });

  it("toggles rows and pages without clearing hidden ids", () => {
    let selected = new Set(["hidden"]);
    selected = toggleRowInSelection(selected, "a", true);
    selected = togglePageInSelection(selected, [{ id: "a" }, { id: "b" }], true);
    expect([...selected].toSorted()).toEqual(["a", "b", "hidden"]);
    selected = togglePageInSelection(selected, [{ id: "a" }, { id: "b" }], false);
    expect([...selected]).toEqual(["hidden"]);
  });

  it("shows select-all-matching only after the loaded page is fully selected", () => {
    expect(shouldShowSelectAllMatching("all", true, false)).toBe(true);
    expect(shouldShowSelectAllMatching("all", false, false)).toBe(false);
    expect(shouldShowSelectAllMatching("some", true, false)).toBe(false);
  });

  it("keeps failed and unchanged ids after partial success", () => {
    const next = retainAfterPartialSuccess(new Set(["a", "b", "c"]), [
      { recurringTransactionId: "a", outcome: "succeeded" },
      { recurringTransactionId: "b", outcome: "unchanged" },
      { recurringTransactionId: "c", outcome: "failed" },
    ]);
    expect([...next].toSorted()).toEqual(["b", "c"]);
  });

  it("builds bulk identities from frozen revisions", () => {
    expect(
      buildRecurringBulkItems(new Set(["hidden", "visible"]), new Map([["hidden", 4]])),
    ).toEqual([{ recurringTransactionId: "hidden", expectedRevision: 4 }]);
  });
});
