import Color from "color";

// Minimum contrast for badge text (WCAG 2.1 AA, normal text).
const AA_CONTRAST = 4.5;
// Lightness increments walked between the color and white/black.
const LIGHTNESS_STEPS = 40;
// How far a badge background may be darkened (fraction of its lightness) while
// hunting for a readable light foreground before we give up and use a dark one.
const MAX_DARKEN = 0.35;
const DARKEN_STEPS = 30;

const HEX = /^#?[0-9a-f]{6}$/i;

type ColorInstance = ReturnType<typeof Color>;

const parse = (value: string): ColorInstance | null =>
  HEX.test(value.trim()) ? Color(value.trim()) : null;

// ponytail: tiny unbounded cache; keys are the handful of category hexes in use.
const foregroundCache = new Map<string, string>();

// Keeps the category color's hue and saturation, then walks its lightness toward
// whichever end (white or black) it already contrasts with most and returns the
// first same-hue variant that clears WCAG AA. A dark color yields a lighter
// variant, a light color a darker one.
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
      return candidate;
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

// Soft, high-lightness variant of a category color for the picker's pastel row.
export const toPastelColor = (base: string): string => {
  const color = parse(base);
  return color ? color.lightness(85).desaturate(0.25).hex() : base;
};

export interface CategoryBadgeColors {
  background: string;
  foreground: string;
  border: string;
}

const badgeCache = new Map<string, CategoryBadgeColors>();

// A light, same-hue tint used as the badge foreground when the background is (or
// can be made) dark enough to carry it.
const lightForeground = (base: ColorInstance): ColorInstance => {
  const { h, s } = base.hsl().object();
  return Color({ h, s: Math.min(s, 60), l: 92 });
};

const darkerBorder = (background: string): string => {
  const color = parse(background);
  return color ? color.darken(0.2).hex() : background;
};

// Badges read best as light text on a rich background, so we prefer a light
// foreground and darken the category color just enough (up to MAX_DARKEN) to
// clear AA. Colors too luminous to carry light text (yellow, pastels) fall back
// to the original background with a dark foreground.
const computeBadgeColors = (color: string): CategoryBadgeColors => {
  const base = parse(color);
  if (!base) {
    return { background: color, foreground: "#000000", border: darkerBorder(color) };
  }

  const { h, s, l } = base.hsl().object();
  const foreground = lightForeground(base).hex();

  for (let step = 0; step <= DARKEN_STEPS; step += 1) {
    const lightness = l * (1 - (MAX_DARKEN * step) / DARKEN_STEPS);
    const background = Color({ h, s, l: lightness }).hex();

    if (Color(background).contrast(Color(foreground)) >= AA_CONTRAST) {
      return { background, foreground, border: darkerBorder(background) };
    }
  }

  return {
    background: base.hex(),
    foreground: computeForeground(color),
    border: darkerBorder(base.hex()),
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
