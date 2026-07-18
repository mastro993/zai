import { describe, expect, it } from "vitest";

import {
  advanceRangeSelection,
  formatSelectionLabel,
  isActiveSelection,
  resolveSelection,
  type DateRangeSelection,
} from "../date-range";

const NOW = new Date("2026-07-07T13:45:00");
const d = (iso: string) => new Date(`${iso}T12:00:00`);

describe("resolveSelection", () => {
  it("returns no bounds for all-time", () => {
    expect(resolveSelection({ type: "preset", id: "all-time" }, NOW)).toEqual({});
  });

  it("spans the full calendar month", () => {
    expect(resolveSelection({ type: "preset", id: "this-month" }, NOW)).toEqual({
      startDate: "2026-07-01T00:00:00",
      endDate: "2026-07-31T23:59:59",
    });
  });

  it("covers a rolling 30-day window inclusive of today", () => {
    expect(resolveSelection({ type: "preset", id: "last-30-days" }, NOW)).toEqual({
      startDate: "2026-06-08T00:00:00",
      endDate: "2026-07-07T23:59:59",
    });
  });

  it("spans the full calendar year", () => {
    expect(resolveSelection({ type: "preset", id: "this-year" }, NOW)).toEqual({
      startDate: "2026-01-01T00:00:00",
      endDate: "2026-12-31T23:59:59",
    });
  });

  it("clamps a custom range to start-of-day and end-of-day", () => {
    const selection: DateRangeSelection = { type: "custom", from: "2026-03-02", to: "2026-03-05" };

    expect(resolveSelection(selection, NOW)).toEqual({
      startDate: "2026-03-02T00:00:00",
      endDate: "2026-03-05T23:59:59",
    });
  });
});

describe("formatSelectionLabel", () => {
  it("names the active preset", () => {
    expect(formatSelectionLabel({ type: "preset", id: "this-month" })).toBe("This month");
  });

  it("drops the year on same-year custom ranges", () => {
    expect(formatSelectionLabel({ type: "custom", from: "2026-07-01", to: "2026-07-07" })).toBe(
      "Jul 1 – Jul 7, 2026",
    );
  });

  it("keeps both years on a cross-year custom range", () => {
    expect(formatSelectionLabel({ type: "custom", from: "2025-12-28", to: "2026-01-03" })).toBe(
      "Dec 28, 2025 – Jan 3, 2026",
    );
  });

  it("collapses a single-day range to one date", () => {
    expect(formatSelectionLabel({ type: "custom", from: "2026-07-07", to: "2026-07-07" })).toBe(
      "Jul 7, 2026",
    );
  });
});

describe("isActiveSelection", () => {
  it("treats all-time as inactive and everything else as active", () => {
    expect(isActiveSelection({ type: "preset", id: "all-time" })).toBe(false);
    expect(isActiveSelection({ type: "preset", id: "this-year" })).toBe(true);
    expect(isActiveSelection({ type: "custom", from: "2026-01-01", to: "2026-01-02" })).toBe(true);
  });
});

describe("advanceRangeSelection", () => {
  it("first click sets the start and waits (no commit)", () => {
    const result = advanceRangeSelection(undefined, d("2026-07-03"));
    expect(result.draft).toEqual({ from: d("2026-07-03") });
    expect(result.committed).toBeUndefined();
  });

  it("second click closes the range", () => {
    const result = advanceRangeSelection({ from: d("2026-07-03") }, d("2026-07-07"));
    expect(result.committed).toEqual({ from: d("2026-07-03"), to: d("2026-07-07") });
  });

  it("clicking the same day twice commits a single-day range", () => {
    const result = advanceRangeSelection({ from: d("2026-07-03") }, d("2026-07-03"));
    expect(result.committed).toEqual({ from: d("2026-07-03"), to: d("2026-07-03") });
  });

  it("normalizes order when the second click is before the first", () => {
    const result = advanceRangeSelection({ from: d("2026-07-07") }, d("2026-07-03"));
    expect(result.committed).toEqual({ from: d("2026-07-03"), to: d("2026-07-07") });
  });

  it("restarts from the new day when a range is already complete", () => {
    const result = advanceRangeSelection(
      { from: d("2026-07-03"), to: d("2026-07-07") },
      d("2026-07-10"),
    );
    expect(result.draft).toEqual({ from: d("2026-07-10") });
    expect(result.committed).toBeUndefined();
  });
});
