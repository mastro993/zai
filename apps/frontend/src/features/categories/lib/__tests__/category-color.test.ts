import { describe, expect, it } from "vitest";

import Color from "color";

import { CATEGORY_COLORS } from "../../types/model";
import { getCategoryBadgeColors } from "../category-color";

describe("category badge colors", () => {
  it("provides ten distinct, hue-spaced colors", () => {
    expect(CATEGORY_COLORS).toHaveLength(10);
    expect(new Set(CATEGORY_COLORS).size).toBe(10);
    expect(Color(CATEGORY_COLORS[9]).saturationl()).toBeLessThan(20);

    const hues = CATEGORY_COLORS.slice(0, -1).map((color) => Color(color).hsl().object().h);
    for (let firstIndex = 0; firstIndex < hues.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < hues.length; secondIndex += 1) {
        const distance = Math.abs(hues[firstIndex] - hues[secondIndex]);
        expect(Math.min(distance, 360 - distance)).toBeGreaterThan(20);
      }
    }
  });

  it("uses 0x22 alpha for every palette color", () => {
    for (const color of CATEGORY_COLORS) {
      const { background, foreground } = getCategoryBadgeColors(color);
      expect(background).toBe(`${color}22`);
      expect(foreground).toBe(color);
    }
  });

  it("uses category color as foreground", () => {
    for (const color of CATEGORY_COLORS) {
      const { foreground } = getCategoryBadgeColors(color);
      expect(foreground).toBe(color);
    }
  });

  it("uses theme tokens for invalid colors", () => {
    expect(getCategoryBadgeColors("not-a-color")).toEqual({
      background: "var(--muted)",
      foreground: "var(--foreground)",
    });
  });
});
