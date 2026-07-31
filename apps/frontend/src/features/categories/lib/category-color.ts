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

  const [red, green, blue] = [0, 2, 4]
    .map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);

  if (maximum === minimum) {
    return null;
  }

  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;
  const lightnessComponent = Math.cbrt(l);
  const greenComponent = Math.cbrt(m);
  const blueComponent = Math.cbrt(s);
  const a =
    1.9779984951 * lightnessComponent - 2.428592205 * greenComponent + 0.4505937099 * blueComponent;
  const b =
    0.0259040371 * lightnessComponent + 0.7827717662 * greenComponent - 0.808675766 * blueComponent;

  // OKLCH hue is based on OKLab a/b, not the RGB/HSV hue wheel.
  return Math.round((Math.atan2(b, a) * (180 / Math.PI) + 360) % 360);
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
