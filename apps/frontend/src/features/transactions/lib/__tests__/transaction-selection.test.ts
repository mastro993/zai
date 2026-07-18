import { describe, expect, it } from "vitest";

import {
  computeFilteredTotalCount,
  getPageCheckboxState,
  selectRangeOnPage,
  shouldShowSelectAllMatching,
  togglePageInSelection,
  toggleRowInSelection,
} from "../transaction-selection";

const transactions = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("transaction selection", () => {
  it("derives page checkbox state", () => {
    expect(getPageCheckboxState(transactions, new Set())).toBe("none");
    expect(getPageCheckboxState(transactions, new Set(["a"]))).toBe("some");
    expect(getPageCheckboxState(transactions, new Set(["a", "b", "c"]))).toBe("all");
  });

  it("toggles rows and pages", () => {
    expect(toggleRowInSelection(new Set(), "a", true)).toEqual(new Set(["a"]));
    expect(toggleRowInSelection(new Set(["a", "b"]), "a", false)).toEqual(new Set(["b"]));
    expect(togglePageInSelection(new Set(["x"]), transactions, true)).toEqual(
      new Set(["x", "a", "b", "c"]),
    );
    expect(togglePageInSelection(new Set(["a", "b", "c", "x"]), transactions, false)).toEqual(
      new Set(["x"]),
    );
  });

  it("selects ranges on the current page", () => {
    expect(selectRangeOnPage(new Set(), transactions, "a", "c")).toEqual(new Set(["a", "b", "c"]));
    expect(selectRangeOnPage(new Set(["z"]), transactions, "b", "c")).toEqual(
      new Set(["z", "b", "c"]),
    );
  });

  it("computes filtered totals on the last page only", () => {
    expect(computeFilteredTotalCount(3, 50, 3, 12)).toBe(112);
    expect(computeFilteredTotalCount(1, 50, 3, 50)).toBeNull();
    expect(computeFilteredTotalCount(1, 50, 1, 0)).toBe(0);
  });

  it("shows select-all-matching when the page is fully selected", () => {
    expect(shouldShowSelectAllMatching("all", 2, false)).toBe(true);
    expect(shouldShowSelectAllMatching("all", 1, false)).toBe(false);
    expect(shouldShowSelectAllMatching("all", 2, true)).toBe(false);
    expect(shouldShowSelectAllMatching("some", 2, false)).toBe(false);
  });
});
