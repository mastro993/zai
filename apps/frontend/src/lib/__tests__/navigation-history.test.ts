import { describe, expect, it } from "vitest";

import {
  nextForwardBound,
  readHistoryIndex,
  resolveNavigationHistoryAbility,
} from "../navigation-history";

describe("readHistoryIndex", () => {
  it("reads the TanStack history index and defaults to the session start", () => {
    expect(readHistoryIndex({ __TSR_index: 3 })).toBe(3);
    expect(readHistoryIndex({})).toBe(0);
  });
});

describe("nextForwardBound", () => {
  it("truncates the forward stack on a new push", () => {
    expect(nextForwardBound(4, 1, true)).toBe(1);
  });

  it("keeps the farthest index on back, forward, replace, and go", () => {
    expect(nextForwardBound(4, 1, false)).toBe(4);
    expect(nextForwardBound(4, 5, false)).toBe(5);
  });
});

describe("resolveNavigationHistoryAbility", () => {
  it("disables both directions at the start of history", () => {
    expect(resolveNavigationHistoryAbility(0, 0)).toEqual({
      canGoBack: false,
      canGoForward: false,
    });
  });

  it("enables back after a push and forward after a back", () => {
    expect(resolveNavigationHistoryAbility(2, 2)).toEqual({
      canGoBack: true,
      canGoForward: false,
    });
    expect(resolveNavigationHistoryAbility(1, 2)).toEqual({
      canGoBack: true,
      canGoForward: true,
    });
    expect(resolveNavigationHistoryAbility(0, 2)).toEqual({
      canGoBack: false,
      canGoForward: true,
    });
  });
});
