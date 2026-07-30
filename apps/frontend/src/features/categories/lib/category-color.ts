import type { CategoryColor } from "../types/model";

const CATEGORY_BACKGROUND_ALPHA = "25%";
const CATEGORY_BACKGROUND_LIGHTNESS = 0.684;
const HEX_COLOR = /^#([0-9a-f]{6})$/i;

export interface CategoryBadgeColors {
  background: string;
  foreground: string;
}

const badgeCache = new Map<CategoryColor, CategoryBadgeColors>();

const extractHue = (color: CategoryColor): number | null => {
  const match = color?.match(HEX_COLOR);
  if (!match) {
    return null;
  }

  const channels = [0, 2, 4].map((offset) =>
    Number.parseInt(match[1].slice(offset, offset + 2), 16),
  );
  const [red, green, blue] = channels.map((channel) => channel / 255);
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const chroma = maximum - minimum;

  if (chroma === 0) {
    return null;
  }

  const segment =
    maximum === red
      ? ((green - blue) / chroma) % 6
      : maximum === green
        ? (blue - red) / chroma + 2
        : (red - green) / chroma + 4;

  return Math.round((segment * 60 + 360) % 360);
};

const computeBadgeColors = (color: CategoryColor): CategoryBadgeColors => {
  const hue = extractHue(color);
  if (hue === null) {
    return {
      background: `oklch(${CATEGORY_BACKGROUND_LIGHTNESS} 0 0 / ${CATEGORY_BACKGROUND_ALPHA})`,
      foreground: "var(--foreground)",
    };
  }

  return {
    background: `oklch(${CATEGORY_BACKGROUND_LIGHTNESS} 0.239 ${hue} / ${CATEGORY_BACKGROUND_ALPHA})`,
    foreground: `oklch(var(--category-badge-foreground-lightness) var(--category-badge-foreground-chroma) ${hue})`,
  };
};

export const getCategoryBadgeColors = (color: CategoryColor): CategoryBadgeColors => {
  const cached = badgeCache.get(color);
  if (cached) {
    return cached;
  }

  const colors = computeBadgeColors(color);
  badgeCache.set(color, colors);

  return colors;
};
