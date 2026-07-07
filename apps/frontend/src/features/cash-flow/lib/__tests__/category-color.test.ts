import { describe, expect, it } from "vitest";

import { CATEGORY_COLORS } from "../../types/model";
import {
  getCategoryBadgeColors,
  getCategoryForeground,
  getContrastRatio,
  toPastelColor,
} from "../category-color";

describe("category badge foreground", () => {
  it("clears WCAG AA (4.5:1) for every palette color", () => {
    for (const background of CATEGORY_COLORS) {
      const foreground = getCategoryForeground(background);
      expect(getContrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("gives computed pastels a dark foreground", () => {
    for (const background of CATEGORY_COLORS.map(toPastelColor)) {
      const foreground = getCategoryForeground(background);
      expect(getContrastRatio(foreground, "#FFFFFF")).toBeGreaterThan(
        getContrastRatio(foreground, "#000000"),
      );
    }
  });

  it("gives deep saturated colors a light foreground", () => {
    for (const background of ["#C92A2A", "#007A91", "#345FD2", "#7B4CC2", "#B43C7A"]) {
      const foreground = getCategoryForeground(background);
      expect(getContrastRatio(foreground, "#000000")).toBeGreaterThan(
        getContrastRatio(foreground, "#FFFFFF"),
      );
    }
  });

  it("falls back to a readable foreground for unknown colors", () => {
    const foreground = getCategoryForeground("not-a-color");
    expect(getContrastRatio(foreground, "not-a-color")).toBe(0);
    expect(foreground).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("category badge colors", () => {
  it("clears WCAG AA (4.5:1) for palette colors and their pastels", () => {
    for (const color of [...CATEGORY_COLORS, ...CATEGORY_COLORS.map(toPastelColor)]) {
      const { background, foreground } = getCategoryBadgeColors(color);
      expect(getContrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("darkens deep colors so the foreground is light", () => {
    for (const color of ["#E53935", "#1E88E5", "#5E35B1"]) {
      const { background, foreground } = getCategoryBadgeColors(color);
      expect(getContrastRatio(foreground, "#000000")).toBeGreaterThan(
        getContrastRatio(foreground, "#FFFFFF"),
      );
      // background is never lightened, only darkened toward legibility.
      expect(getContrastRatio(background, "#000000")).toBeLessThanOrEqual(
        getContrastRatio(color, "#000000"),
      );
    }
  });

  it("keeps light pastels on a dark foreground", () => {
    for (const color of CATEGORY_COLORS.map(toPastelColor)) {
      const { background, foreground } = getCategoryBadgeColors(color);
      expect(background).toBe(color);
      expect(getContrastRatio(foreground, "#FFFFFF")).toBeGreaterThan(
        getContrastRatio(foreground, "#000000"),
      );
    }
  });
});
