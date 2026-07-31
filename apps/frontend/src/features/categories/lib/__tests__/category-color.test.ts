import { describe, expect, it } from "vitest";

import { CATEGORY_COLORS } from "../../types/model";
import { getCategoryBadgeColors } from "../category-color";

describe("category badge colors", () => {
  it("defines eight 45-degree chromatic choices followed by neutral", () => {
    expect(CATEGORY_COLORS).toEqual([
      "#C32828",
      "#C39B28",
      "#75C328",
      "#28C34E",
      "#28C3C3",
      "#284EC3",
      "#7528C3",
      "#C3289B",
      "#737373",
    ]);
    expect(new Set(CATEGORY_COLORS).size).toBe(CATEGORY_COLORS.length);
    expect(CATEGORY_COLORS.map((color) => getCategoryBadgeColors(color).background)).toEqual([
      "oklch(0.684 0.239 27 / 25%)",
      "oklch(0.684 0.239 88 / 25%)",
      "oklch(0.684 0.239 133 / 25%)",
      "oklch(0.684 0.239 147 / 25%)",
      "oklch(0.684 0.239 195 / 25%)",
      "oklch(0.684 0.239 266 / 25%)",
      "oklch(0.684 0.239 300 / 25%)",
      "oklch(0.684 0.239 341 / 25%)",
      "oklch(0.684 0 0 / 25%)",
    ]);
  });

  it("extracts the hue from a stored HEX color", () => {
    expect(getCategoryBadgeColors("#C32828")).toEqual({
      background: "oklch(0.684 0.239 27 / 25%)",
      foreground:
        "oklch(var(--category-badge-foreground-lightness) var(--category-badge-foreground-chroma) 27)",
    });

    expect(getCategoryBadgeColors("#ff0000")).toEqual({
      background: "oklch(0.684 0.239 29 / 25%)",
      foreground:
        "oklch(var(--category-badge-foreground-lightness) var(--category-badge-foreground-chroma) 29)",
    });
  });

  it("uses neutral foreground tokens", () => {
    expect(getCategoryBadgeColors(null)).toEqual({
      background: "oklch(0.684 0 0 / 25%)",
      foreground: "var(--foreground)",
    });
  });
});
