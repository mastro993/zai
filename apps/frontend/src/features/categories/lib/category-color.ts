import Color from "color";

const HEX = /^#?[0-9a-f]{6}$/i;

const CATEGORY_BACKGROUND_ALPHA = "22";

const normalize = (value: string): string | null => {
  const trimmed = value.trim();
  return HEX.test(trimmed) ? Color(trimmed).hex() : null;
};

export interface CategoryBadgeColors {
  background: string;
  foreground: string;
}

const badgeCache = new Map<string, CategoryBadgeColors>();

const computeBadgeColors = (color: string): CategoryBadgeColors => {
  const normalized = normalize(color);
  if (!normalized) {
    return { background: "var(--muted)", foreground: "var(--foreground)" };
  }

  return {
    background: `${normalized}${CATEGORY_BACKGROUND_ALPHA}`,
    foreground: normalized,
  };
};

export const getCategoryBadgeColors = (color: string): CategoryBadgeColors => {
  const cached = badgeCache.get(color);
  if (cached) {
    return cached;
  }

  const colors = computeBadgeColors(color);
  badgeCache.set(color, colors);

  return colors;
};
