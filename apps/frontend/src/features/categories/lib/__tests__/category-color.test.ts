import { describe, expect, it } from "vitest";

import { CATEGORY_HUES } from "../../types/model";
import { getCategoryBadgeColors } from "../category-color";

describe("category badge colors", () => {
  it("defines nine hue-spaced chromatic choices", () => {
    expect(CATEGORY_HUES).toEqual([20, 60, 100, 140, 180, 220, 260, 300, 340]);
    expect(new Set(CATEGORY_HUES).size).toBe(CATEGORY_HUES.length);
  });

  it("uses an OKLCH background and theme-aware readable foreground", () => {
    expect(getCategoryBadgeColors(20)).toEqual({
      background: "oklch(0.584 0.239 20 / 25%)",
      foreground:
        "oklch(var(--category-badge-foreground-lightness) var(--category-badge-foreground-chroma) 20)",
    });
  });

  it("uses neutral foreground tokens", () => {
    expect(getCategoryBadgeColors(null)).toEqual({
      background: "oklch(0.584 0.239 0 / 25%)",
      foreground: "var(--foreground)",
    });
  });
});
