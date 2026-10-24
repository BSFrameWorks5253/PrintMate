/**
 * PrintMate Image Processing — Tone Setter Module (Auto Dark & Light)
 * Handles brightness, contrast, saturation, and grayscale adjustments.
 */

/**
 * Standard ITU-R BT.601 perceptual luminance formula
 */
export function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Adjusts brightness by offset (-1 to +1 normalized -> -255 to +255)
 */
export function adjustBrightness(channelVal: number, brightness: number): number {
  return channelVal + brightness * 255;
}

/**
 * Adjusts contrast centered around midpoint (128)
 */
export function adjustContrast(channelVal: number, contrast: number): number {
  return (channelVal - 128) * contrast + 128;
}

/**
 * Adjusts color saturation relative to perceptual luminance
 */
export function adjustSaturation(
  r: number,
  g: number,
  b: number,
  saturation: number,
  luminance: number
): [number, number, number] {
  return [
    luminance + (r - luminance) * saturation,
    luminance + (g - luminance) * saturation,
    luminance + (b - luminance) * saturation,
  ];
}

/**
 * Applies all tone adjustments in-place to an RGBA pixel buffer
 */
export function applyToneAdjustments(
  data: Uint8ClampedArray,
  brightness: number,
  contrast: number,
  saturation: number,
  grayscale: boolean
): void {
  const len = data.length;
  const hasBrightness = brightness !== 0;
  const hasContrast = contrast !== 1;
  const hasSaturation = saturation !== 1 && !grayscale;

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 1. Brightness
    if (hasBrightness) {
      r += brightness * 255;
      g += brightness * 255;
      b += brightness * 255;
    }

    // 2. Contrast
    if (hasContrast) {
      r = (r - 128) * contrast + 128;
      g = (g - 128) * contrast + 128;
      b = (b - 128) * contrast + 128;
    }

    // 3. Grayscale or Saturation
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (grayscale) {
      r = lum;
      g = lum;
      b = lum;
    } else if (hasSaturation) {
      r = lum + (r - lum) * saturation;
      g = lum + (g - lum) * saturation;
      b = lum + (b - lum) * saturation;
    }

    data[i] = Math.min(255, Math.max(0, Math.round(r)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(b)));
  }
}
