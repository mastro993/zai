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
export function getColorHslShade(parentColor: TransactionCategoryColor, childId: string): string {
  const parentHSL = AVAILABLE_PARENT_COLORS[parentColor];
  const hash = simpleHash(childId);

  // Use hash to determine saturation and luminosity adjustments
  // This creates a pseudo-random but deterministic shade for each child ID
  const satAdjust = (hash % 40) - 20; // Range: -20 to +20 (relative adjustment in percentage points)
  const lumAdjust = ((hash >> 8) % 40) - 20; // Range: -20 to +20

  // Clamp saturation and luminosity to valid ranges
  const childS = Math.max(0, Math.min(100, parentHSL.s + satAdjust));
  const childL = Math.max(0, Math.min(100, parentHSL.l + lumAdjust));

  return `hsl(${parentHSL.h}, ${childS}%, ${childL}%)`;
}

/**
 * Get the HSL color string for any category color.
 * Returns format: "hsl(h, s%, l%)"
 */
export function getColorHsl(color: TransactionCategoryColor): string {
  const hsl = AVAILABLE_PARENT_COLORS[color];
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}
