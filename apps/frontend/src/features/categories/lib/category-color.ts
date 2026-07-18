import Color from "color";

// Minimum contrast for badge text (WCAG 2.1 AA, normal text).
const AA_CONTRAST = 4.5;
const LIGHTNESS_STEPS = 40;
const LIGHT_FOREGROUND_MIN_LIGHTNESS = 88;

const HEX = /^#?[0-9a-f]{6}$/i;

type ColorInstance = ReturnType<typeof Color>;

const parse = (value: string): ColorInstance | null =>
  HEX.test(value.trim()) ? Color(value.trim()) : null;

const foregroundCache = new Map<string, string>();

const computeForeground = (background: string): string => {
  const base = parse(background);
  if (!base) {
    return "#000000";
  }

  const goLighter = base.contrast(Color("white")) >= base.contrast(Color("black"));
  const { h, s, l } = base.hsl().object();
  const target = goLighter ? 100 : 0;

  for (let step = 1; step <= LIGHTNESS_STEPS; step += 1) {
    const lightness = l + ((target - l) * step) / LIGHTNESS_STEPS;
    const candidate = Color({ h, s, l: lightness }).hex();

    if (base.contrast(Color(candidate)) >= AA_CONTRAST) {
      const foregroundLightness = goLighter
        ? Math.max(lightness, LIGHT_FOREGROUND_MIN_LIGHTNESS)
        : lightness;

      return Color({ h, s, l: foregroundLightness }).hex();
    }
  }

  return goLighter ? "#FFFFFF" : "#000000";
};

export const getCategoryForeground = (background: string): string => {
  const cached = foregroundCache.get(background);
  if (cached) {
    return cached;
  }

  const foreground = computeForeground(background);
  foregroundCache.set(background, foreground);

  return foreground;
};

export const getContrastRatio = (foreground: string, background: string): number => {
  const fg = parse(foreground);
  const bg = parse(background);

  return fg && bg ? fg.contrast(bg) : 0;
};

export interface CategoryBadgeColors {
  background: string;
  foreground: string;
  border: string;
}

const badgeCache = new Map<string, CategoryBadgeColors>();

const darkerBorder = (background: string): string => {
  const color = parse(background);
  return color ? color.darken(0.2).hex() : background;
};

const computeBadgeColors = (color: string): CategoryBadgeColors => {
  const base = parse(color);
  if (!base) {
    return { background: color, foreground: "#000000", border: darkerBorder(color) };
  }

  const background = base.hex();

  return {
    background,
    foreground: computeForeground(color),
    border: darkerBorder(background),
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
