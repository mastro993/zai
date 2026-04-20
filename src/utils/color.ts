/**
 * Color utility functions for HEX, HSL conversions and color analysis
 */

/**
 * Convert HEX value to RGB ratio
 * @internal
 */
function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/**
 * Convert 0-1 RGB value to HEX string
 * @internal
 */
function rgbValueToHex(value: number): string {
  const hex = Math.round(value * 255).toString(16);
  return hex.length === 1 ? '0' + hex : hex;
}

/**
 * Convert HEX color to HSL
 * @param hex - HEX color string (e.g., '#FF0000' or 'FF0000')
 * @returns HSL object with h (0-360), s (0-100), l (0-100)
 */
export function hexToHsl(
  hex: string
): { h: number; s: number; l: number } {
  let normalizedHex = hex.replace('#', '').toUpperCase();

  if (normalizedHex.length === 3) {
    normalizedHex = normalizedHex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  const r = parseInt(normalizedHex.substring(0, 2), 16) / 255;
  const g = parseInt(normalizedHex.substring(2, 4), 16) / 255;
  const b = parseInt(normalizedHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert HSL color to HEX
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param l - Lightness (0-100)
 * @returns HEX color string (e.g., '#FF0000')
 */
export function hslToHex(h: number, s: number, l: number): string {
  const hNorm = h / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;

  let r: number, g: number, b: number;

  if (sNorm === 0) {
    r = g = b = lNorm;
  } else {
    const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
    const p = 2 * lNorm - q;

    r = hue2rgb(p, q, hNorm + 1 / 3);
    g = hue2rgb(p, q, hNorm);
    b = hue2rgb(p, q, hNorm - 1 / 3);
  }

  return `#${rgbValueToHex(r)}${rgbValueToHex(g)}${rgbValueToHex(b)}`.toUpperCase();
}

/**
 * Change the luminosity of a color
 * @param hex - HEX color string
 * @param lumosity - Luminosity adjustment (-100 to 100, where -100 is black, 0 is original, 100 is white)
 * @returns Modified HEX color string
 */
export function changeLuminosity(hex: string, lumosity: number): string {
  const hsl = hexToHsl(hex);
  const newLuminosity = Math.max(0, Math.min(100, hsl.l + lumosity));
  return hslToHex(hsl.h, hsl.s, newLuminosity);
}

/**
 * Determine if dark foreground (dark text) should be used on a background color
 * Uses luminance calculation (WCAG standard)
 * @param hex - HEX background color
 * @returns true if dark foreground should be used, false if light foreground should be used
 */
export function shouldUseDarkForeground(hex: string): boolean {
  let normalizedHex = hex.replace('#', '').toUpperCase();

  if (normalizedHex.length === 3) {
    normalizedHex = normalizedHex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  const r = parseInt(normalizedHex.substring(0, 2), 16) / 255;
  const g = parseInt(normalizedHex.substring(2, 4), 16) / 255;
  const b = parseInt(normalizedHex.substring(4, 6), 16) / 255;

  // Calculate relative luminance using WCAG formula
  const luminance = calculateRelativeLuminance(r, g, b);

  // If luminance > 0.5, background is light, use dark foreground
  return luminance > 0.5;
}

/**
 * Calculate relative luminance (WCAG standard)
 * @internal
 */
function calculateRelativeLuminance(
  r: number,
  g: number,
  b: number
): number {
  const rsRGB = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gsRGB = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bsRGB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
}

/**
 * Determine if light foreground (light text) should be used on a background color
 * @param hex - HEX background color
 * @returns true if light foreground should be used, false if dark foreground should be used
 */
export function shouldUseLightForeground(hex: string): boolean {
  return !shouldUseDarkForeground(hex);
}
