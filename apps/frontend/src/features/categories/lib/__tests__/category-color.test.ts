import { describe, expect, it } from "vitest";
import Color from "color";

import { CATEGORY_COLORS, CATEGORY_DARK_COLORS, CATEGORY_LIGHT_COLORS } from "../../types/model";
import { getCategoryBadgeColors, getCategoryForeground, getContrastRatio } from "../category-color";

const hueDistance = (first: string, second: string): number => {
  const firstHue = Color(first).hsl().object().h;
  const secondHue = Color(second).hsl().object().h;
  const distance = Math.abs(firstHue - secondHue);

  return Math.min(distance, 360 - distance);
};

describe("category badge foreground", () => {
  it("clears WCAG AA (4.5:1) for every palette color", () => {
    for (const background of CATEGORY_COLORS) {
      const foreground = getCategoryForeground(background);
      expect(getContrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("gives light palette colors a dark foreground", () => {
    for (const background of CATEGORY_LIGHT_COLORS) {
      const foreground = getCategoryForeground(background);
      expect(getContrastRatio(foreground, "#FFFFFF")).toBeGreaterThan(
        getContrastRatio(foreground, "#000000"),
      );
    }
  });

  it("gives deep saturated colors a light foreground", () => {
    for (const background of CATEGORY_DARK_COLORS) {
      const foreground = getCategoryForeground(background);
      expect(getContrastRatio(foreground, "#000000")).toBeGreaterThan(
        getContrastRatio(foreground, "#FFFFFF"),
      );
    }
  });

  it("uses brighter foregrounds for dark palette colors", () => {
    for (const background of CATEGORY_DARK_COLORS) {
      const foreground = getCategoryForeground(background);
      expect(Color(foreground).hsl().object().l).toBeGreaterThanOrEqual(86);
    }
  });

  it("uses same-hue foregrounds for every palette color", () => {
    for (const background of CATEGORY_COLORS) {
      const foreground = getCategoryForeground(background);

      expect(foreground).not.toBe("#FFFFFF");
      expect(foreground).not.toBe("#000000");
      expect(hueDistance(foreground, background)).toBeLessThanOrEqual(3);
    }
  });

  it("falls back to a readable foreground for unknown colors", () => {
    const foreground = getCategoryForeground("not-a-color");
    expect(getContrastRatio(foreground, "not-a-color")).toBe(0);
    expect(foreground).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("category badge colors", () => {
  it("clears WCAG AA (4.5:1) for dark and light palette colors", () => {
    for (const color of CATEGORY_COLORS) {
      const { background, foreground } = getCategoryBadgeColors(color);
      expect(getContrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the selected color as the badge background", () => {
    for (const color of CATEGORY_COLORS) {
      const { background } = getCategoryBadgeColors(color);
      expect(background).toBe(color);
    }
  });

  it("keeps light palette colors on a dark foreground", () => {
    for (const color of CATEGORY_LIGHT_COLORS) {
      const { background, foreground } = getCategoryBadgeColors(color);
      expect(background).toBe(color);
      expect(getContrastRatio(foreground, "#FFFFFF")).toBeGreaterThan(
        getContrastRatio(foreground, "#000000"),
      );
    }
  });

  it("uses a darker border than the badge background", () => {
    for (const color of CATEGORY_COLORS) {
      const { background, border } = getCategoryBadgeColors(color);
      expect(getContrastRatio(border, "#000000")).toBeLessThan(
        getContrastRatio(background, "#000000"),
      );
    }
  });
});
