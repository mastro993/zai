/**
 * Color utilities for transaction categories.
 * Maps category colors to HSL values and derives child shades from parent colors.
 */

import { type TransactionCategoryColor } from "../types";

/**
 * All available parent colors with their HSL values.
 * 8 high-contrast colors evenly distributed across the color spectrum.
 * Kebab-case keys map to HSL color objects.
 */
export const AVAILABLE_PARENT_COLORS: Record<
  TransactionCategoryColor,
  { h: number; s: number; l: number }
> = {
  red: { h: 0, s: 84, l: 45 },
  orange: { h: 30, s: 100, l: 50 },
  yellow: { h: 60, s: 92, l: 54 },
  green: { h: 142, s: 76, l: 36 },
  cyan: { h: 180, s: 98, l: 45 },
  blue: { h: 210, s: 91, l: 60 },
  purple: { h: 270, s: 85, l: 67 },
  pink: { h: 330, s: 81, l: 60 },
};

/**
 * Derive a color shade by index (0-9), varying only luminosity.
 * Keeps hue and saturation fixed to maintain color family consistency.
 */
export function getColorHslShade(parentColor: TransactionCategoryColor, index: number): string {
  if (index < 0 || index > 9) {
    throw new Error("Index must be between 0 and 9");
  }

  const parentHSL = AVAILABLE_PARENT_COLORS[parentColor];

  // Vary luminosity from 20 to 80 in 10 steps
  const childL = 20 + (index * 60) / 9;

  return `hsl(${parentHSL.h}, ${parentHSL.s}%, ${childL}%)`;
}

/**
 * Get the HSL color string for any category color.
 * Returns format: "hsl(h, s%, l%)"
 */
export function getColorHsl(color: TransactionCategoryColor): string {
  const hsl = AVAILABLE_PARENT_COLORS[color];
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}
