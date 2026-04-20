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

/**
 * Convert HSL color string to hex format.
 * Input: "hsl(h, s%, l%)"
 * Output: "#RRGGBB"
 */
export function hslToHex(hslString: string): string {
  const match = hslString.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return "#000000";

  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 1 / 6) {
    r = c;
    g = x;
  } else if (h < 2 / 6) {
    r = x;
    g = c;
  } else if (h < 3 / 6) {
    g = c;
    b = x;
  } else if (h < 4 / 6) {
    g = x;
    b = c;
  } else if (h < 5 / 6) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (val: number) => Math.round((val + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Derive child color with visual feedback showing shade progression.
 * Children inherit the parent's base color (ignoring shades during creation).
 * Returns both hex and hsl representations for UI display.
 */
export function deriveChildColorShade(
  parentColor: TransactionCategoryColor,
  childId: string,
): { hex: string; hsl: string } {
  // Use child ID hash to determine shade index (0-9)
  let hash = 0;
  for (let i = 0; i < childId.length; i++) {
    hash = ((hash << 5) - hash) + childId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  const shadeIndex = Math.abs(hash) % 10;
  const hsl = getColorHslShade(parentColor, shadeIndex);
  const hex = hslToHex(hsl);

  return { hex, hsl };
}

/**
 * Get hex color from a parent color.
 */
export function getColorHex(color: TransactionCategoryColor): string {
  return hslToHex(getColorHsl(color));
}
