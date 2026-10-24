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

export interface AutoToneResult {
  brightness: number;
  contrast: number;
  isUnderExposed: boolean;
  isOverExposed: boolean;
  isLowContrast: boolean;
  meanLuminance: number;
}

/**
 * Automatically analyzes image luminance histogram and calculates optimal brightness & contrast
 */
export function autoDetectTone(canvas: HTMLCanvasElement): AutoToneResult {
  const thumbW = Math.min(200, canvas.width);
  const scale = thumbW / canvas.width;
  const thumbH = Math.max(1, Math.round(canvas.height * scale));

  const thumb = document.createElement('canvas');
  thumb.width = thumbW;
  thumb.height = thumbH;
  const ctx = thumb.getContext('2d');

  if (!ctx) {
    return {
      brightness: 0,
      contrast: 1.0,
      isUnderExposed: false,
      isOverExposed: false,
      isLowContrast: false,
      meanLuminance: 128,
    };
  }

  ctx.drawImage(canvas, 0, 0, thumbW, thumbH);
  const imgData = ctx.getImageData(0, 0, thumbW, thumbH);
  const data = imgData.data;

  // Build 256-bin histogram
  const hist = new Uint32Array(256);
  const totalPixels = thumbW * thumbH;
  let totalLum = 0;

  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.min(255, Math.max(0, Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])));
    hist[lum]++;
    totalLum += lum;
  }

  const meanLum = totalPixels > 0 ? totalLum / totalPixels : 128;

  // Calculate 5th percentile (shadows) and 95th percentile (highlights)
  let count = 0;
  let p5 = 0;
  let p95 = 255;
  const threshold5 = totalPixels * 0.05;
  const threshold95 = totalPixels * 0.95;

  for (let i = 0; i < 256; i++) {
    count += hist[i];
    if (count >= threshold5 && p5 === 0) {
      p5 = i;
    }
    if (count >= threshold95) {
      p95 = i;
      break;
    }
  }

  const dynamicRange = p95 - p5;
  let contrast = 1.0;
  let brightness = 0.0;

  const isLowContrast = dynamicRange < 140;
  const isUnderExposed = meanLum < 115 || p95 < 190;
  const isOverExposed = meanLum > 195 && p5 > 70;

  if (isLowContrast) {
    contrast = Math.min(1.5, Math.max(1.1, 190 / Math.max(60, dynamicRange)));
  }

  if (isUnderExposed) {
    brightness = Math.min(0.35, Math.max(0.05, (135 - meanLum) / 255));
  } else if (isOverExposed) {
    brightness = Math.max(-0.25, Math.min(-0.05, (155 - meanLum) / 255));
  }

  return {
    brightness: Math.round(brightness * 100) / 100,
    contrast: Math.round(contrast * 100) / 100,
    isUnderExposed,
    isOverExposed,
    isLowContrast,
    meanLuminance: Math.round(meanLum),
  };
}
