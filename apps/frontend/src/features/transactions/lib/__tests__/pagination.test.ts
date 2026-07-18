import { describe, expect, it } from "vitest";

import { createPaginationRange } from "../pagination";

describe("createPaginationRange", () => {
  it("returns a single page when total is one", () => {
    expect(createPaginationRange(1, 1)).toEqual([1]);
  });

  it("returns every page when total is small", () => {
    expect(createPaginationRange(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses distant pages with ellipses", () => {
    expect(createPaginationRange(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
  });
});
