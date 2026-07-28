import { describe, expect, it } from "vitest";

import { CATEGORY_COLORS } from "../../types/model";
import { getCategoryBadgeColors } from "../category-color";

describe("category badge colors", () => {
  it("defines ten distinct HEX choices including neutral", () => {
    expect(CATEGORY_COLORS).toEqual([
      "#C55B26",
      "#C5C526",
      "#5BC526",
      "#26C55B",
      "#26C5C5",
      "#265BC5",
      "#5B26C5",
      "#C526C5",
      "#C5265B",
      "#737373",
    ]);
    expect(new Set(CATEGORY_COLORS).size).toBe(CATEGORY_COLORS.length);
  });

  it("extracts the hue from a stored HEX color", () => {
    expect(getCategoryBadgeColors("#ff0000")).toEqual({
      background: "oklch(0.684 0.239 0 / 25%)",
      foreground:
        "oklch(var(--category-badge-foreground-lightness) var(--category-badge-foreground-chroma) 0)",
    });
  });

  it("uses neutral foreground tokens", () => {
    expect(getCategoryBadgeColors(null)).toEqual({
      background: "oklch(0.684 0 0 / 25%)",
      foreground: "var(--foreground)",
    });
  });
});
