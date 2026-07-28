import type { CategoryHue } from "../types/model";

const CATEGORY_BACKGROUND_ALPHA = "30%";

export interface CategoryBadgeColors {
  background: string;
  foreground: string;
}

const badgeCache = new Map<CategoryHue, CategoryBadgeColors>();

const computeBadgeColors = (hue: CategoryHue): CategoryBadgeColors => {
  if (hue === null) {
    return {
      background: `oklch(0.68 0 0 / ${CATEGORY_BACKGROUND_ALPHA})`,
      foreground: "var(--foreground)",
    };
  }

  return {
    background: `oklch(0.68 0.11 ${hue} / ${CATEGORY_BACKGROUND_ALPHA})`,
    foreground: `oklch(var(--category-badge-foreground-lightness) var(--category-badge-foreground-chroma) ${hue})`,
  };
};

export const getCategoryBadgeColors = (hue: CategoryHue): CategoryBadgeColors => {
  const cached = badgeCache.get(hue);
  if (cached) {
    return cached;
  }

  const colors = computeBadgeColors(hue);
  badgeCache.set(hue, colors);

  return colors;
};
