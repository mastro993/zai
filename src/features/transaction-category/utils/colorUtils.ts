/**
 * Color utilities for transaction categories.
 * Maps category colors to HSL values and derives child shades from parent colors.
 */

import { type TransactionCategoryColor } from "../types";

/**
 * All available parent colors with their HSL values (hard colors and their soft versions).
 * Kebab-case keys map to HSL color objects.
 */
export const TRANSACTION_CATEGORY_COLOR: Record<
  TransactionCategoryColor,
  { h: number; s: number; l: number }
> = {
  red: { h: 0, s: 84, l: 45 },
  orange: { h: 24, s: 100, l: 50 },
  yellow: { h: 45, s: 96, l: 53 },
  green: { h: 142, s: 76, l: 36 },
  teal: { h: 174, s: 76, l: 35 },
  sky: { h: 200, s: 98, l: 39 },
  blue: { h: 217, s: 91, l: 60 },
  indigo: { h: 239, s: 84, l: 67 },
  purple: { h: 280, s: 85, l: 67 },
  pink: { h: 330, s: 81, l: 60 },
  neutral: { h: 0, s: 0, l: 45 },
  "red-soft": { h: 0, s: 25.2, l: 80 },
  "orange-soft": { h: 24, s: 30, l: 85 },
  "yellow-soft": { h: 45, s: 28.8, l: 88.8 },
  "green-soft": { h: 142, s: 22.8, l: 71 },
  "teal-soft": { h: 174, s: 22.8, l: 70 },
  "sky-soft": { h: 200, s: 29.4, l: 74.3 },
  "blue-soft": { h: 217, s: 27.3, l: 80 },
  "indigo-soft": { h: 239, s: 25.2, l: 82 },
  "purple-soft": { h: 280, s: 25.5, l: 81.5 },
  "pink-soft": { h: 330, s: 24.3, l: 80 },
  "neutral-soft": { h: 0, s: 0, l: 80 },
};

/**
 * HSL values for hard colors (vibrant).
 * Using Tailwind-like color hues with fixed saturation and luminosity.
 */
const colorHSLMap: Record<
  Exclude<TransactionCategoryColor, `${string}-soft`>,
  { h: number; s: number; l: number }
> = {
  red: { h: 0, s: 84, l: 45 },
  orange: { h: 24, s: 100, l: 50 },
  yellow: { h: 45, s: 96, l: 53 },
  green: { h: 142, s: 76, l: 36 },
  teal: { h: 174, s: 76, l: 35 },
  sky: { h: 200, s: 98, l: 39 },
  blue: { h: 217, s: 91, l: 60 },
  indigo: { h: 239, s: 84, l: 67 },
  purple: { h: 280, s: 85, l: 67 },
  pink: { h: 330, s: 81, l: 60 },
  neutral: { h: 0, s: 0, l: 45 },
};

/**
 * Derive HSL values for soft colors based on hard colors.
 * Soft colors use same hue with reduced saturation and increased luminosity.
 */
function getSoftColorHSL(hardColorKey: Exclude<TransactionCategoryColor, `${string}-soft`>): {
  h: number;
  s: number;
  l: number;
} {
  const hardColor = colorHSLMap[hardColorKey];
  return {
    h: hardColor.h,
    s: hardColor.s * 0.3, // Reduce saturation to ~30%
    l: hardColor.l + 35, // Increase luminosity for soft appearance
  };
}

/**
 * Get HSL values for any color.
 */
export function getColorHSL(color: TransactionCategoryColor): { h: number; s: number; l: number } {
  if (color.endsWith("-soft")) {
    const hardKey = color.slice(0, -5) as Exclude<TransactionCategoryColor, `${string}-soft`>;
    return getSoftColorHSL(hardKey);
  }
  return colorHSLMap[color as Exclude<TransactionCategoryColor, `${string}-soft`>];
}

/**
 * Convert HSL to hex color string.
 */
function hslToHex(h: number, s: number, l: number): string {
  // Normalize values
  const hNorm = h;
  const sNorm = s / 100;
  const lNorm = l / 100;

  // Calculate RGB from HSL
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - (((hNorm / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (hNorm >= 0 && hNorm < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (hNorm >= 60 && hNorm < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (hNorm >= 120 && hNorm < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (hNorm >= 180 && hNorm < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (hNorm >= 240 && hNorm < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (hNorm >= 300 && hNorm < 360) {
    r = c;
    g = 0;
    b = x;
  }

  const rByte = Math.round((r + m) * 255)
    .toString(16)
    .padStart(2, "0");
  const gByte = Math.round((g + m) * 255)
    .toString(16)
    .padStart(2, "0");
  const bByte = Math.round((b + m) * 255)
    .toString(16)
    .padStart(2, "0");

  return `#${rByte}${gByte}${bByte}`.toUpperCase();
}

/**
 * Simple hash function to generate a deterministic number from a string.
 * Used to derive child color shades from category ID.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Derive a child category color shade from parent color and child ID.
 * Creates a deterministic shade by adjusting saturation and luminosity.
 * Always uses the parent's hue to maintain color family consistency.
 */
export function deriveChildColorShade(
  parentColor: TransactionCategoryColor,
  childId: string,
): { color: string; hex: string } {
  const parentHSL = getColorHSL(parentColor);
  const hash = simpleHash(childId);

  // Use hash to determine saturation and luminosity adjustments
  // This creates a pseudo-random but deterministic shade for each child ID
  const satAdjust = (hash % 40) - 20; // Range: -20 to +20 (relative adjustment in percentage points)
  const lumAdjust = ((hash >> 8) % 40) - 20; // Range: -20 to +20

  // Clamp saturation and luminosity to valid ranges
  const childS = Math.max(0, Math.min(100, parentHSL.s + satAdjust));
  const childL = Math.max(0, Math.min(100, parentHSL.l + lumAdjust));

  const hex = hslToHex(parentHSL.h, childS, childL);

  return {
    color: `${parentColor}-derived`, // Marker that this is a derived color
    hex,
  };
}

/**
 * Get the hex color value for any category color.
 * For standard colors, returns their hex representation.
 */
export function getColorHex(color: TransactionCategoryColor): string {
  const hsl = getColorHSL(color);
  return hslToHex(hsl.h, hsl.s, hsl.l);
}
