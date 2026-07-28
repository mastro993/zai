import { describe, expect, it } from "vitest";

import { CATEGORY_HUES } from "../../types/model";
import { getCategoryBadgeColors } from "../category-color";

describe("category badge colors", () => {
  it("defines nine hue-spaced chromatic choices", () => {
    expect(CATEGORY_HUES).toEqual([20, 60, 100, 140, 180, 220, 260, 300, 340]);
    expect(new Set(CATEGORY_HUES).size).toBe(CATEGORY_HUES.length);
  });

  it("uses a 30% OKLCH background and theme-aware readable foreground", () => {
    expect(getCategoryBadgeColors(20)).toEqual({
      background: "oklch(0.74 0.11 20 / 30%)",
      foreground:
        "oklch(var(--category-badge-foreground-lightness) var(--category-badge-foreground-chroma) 20)",
    });
  });

  it("uses neutral tokens without a chromatic hue", () => {
    expect(getCategoryBadgeColors(null)).toEqual({
      background: "oklch(0.74 0 0 / 30%)",
      foreground: "var(--foreground)",
    });
  });
});
