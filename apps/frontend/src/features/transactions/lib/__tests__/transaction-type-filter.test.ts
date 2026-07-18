import { describe, expect, it } from "vitest";

import {
  DEFAULT_TYPE_FILTER_SELECTION,
  formatTypeFilterLabel,
  isActiveTypeFilter,
} from "../transaction-type-filter";

describe("transaction type filter", () => {
  it("detects active selections", () => {
    expect(isActiveTypeFilter(DEFAULT_TYPE_FILTER_SELECTION)).toBe(false);
    expect(isActiveTypeFilter("income")).toBe(true);
    expect(isActiveTypeFilter("expense")).toBe(true);
  });

  it("formats trigger labels", () => {
    expect(formatTypeFilterLabel(null)).toBe("Type");
    expect(formatTypeFilterLabel("income")).toBe("Income");
    expect(formatTypeFilterLabel("expense")).toBe("Expense");
  });
});
