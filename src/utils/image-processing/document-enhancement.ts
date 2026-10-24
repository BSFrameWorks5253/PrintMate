/**
 * PrintMate Image Processing — Document Enhancement Module (Xerox Studio & Cleanup)
 * Handles faded text darkening, paper whitening, edge sharpening, and photo background replacement.
 */

import { BackgroundMode } from '../../types';

/**
 * Xerox Studio Text Darkener & Background Whitener
 * Darkens faded document text (<160 luminance) while brightening/cleaning paper background (>185 luminance).
 */
export function applyTextDarkening(data: Uint8ClampedArray, intensity: number): void {
  if (intensity <= 0) return;

  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (lum < 160) {
      // Darken text aggressively according to slider intensity
      const darkenFactor = Math.max(0, 1 - intensity * 0.45);
      data[i] = Math.min(255, Math.max(0, Math.round(r * darkenFactor)));
      data[i + 1] = Math.min(255, Math.max(0, Math.round(g * darkenFactor)));
      data[i + 2] = Math.min(255, Math.max(0, Math.round(b * darkenFactor)));
    } else if (lum > 185) {
      // Brighten paper background to clean up Xerox speckles
      const cleanFactor = 1 + intensity * 0.2;
      data[i] = Math.min(255, Math.max(0, Math.round(r * cleanFactor)));
      data[i + 1] = Math.min(255, Math.max(0, Math.round(g * cleanFactor)));
      data[i + 2] = Math.min(255, Math.max(0, Math.round(b * cleanFactor)));
    }
  }
}

/**
 * 3x3 Laplacian Convolution Sharpening Filter
 * Enhances edge contrast for document text and fine photographic detail.
 */
export function applySharpen(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
): void {
  if (amount <= 0 || width < 3 || height < 3) return;

  const imgData = ctx.getImageData(0, 0, width, height);
  const src = imgData.data;
  const output = ctx.createImageData(width, height);
  const dst = output.data;

  const strength = Math.min(amount, 3);
  const centerWeight = 1 + 4 * strength;
  const edgeWeight = -strength;

  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width * 4;
    const topRow = (y - 1) * width * 4;
    const btmRow = (y + 1) * width * 4;

    for (let x = 1; x < width - 1; x++) {
      const idx = rowOffset + x * 4;

      for (let c = 0; c < 3; c++) {
        const top = topRow + x * 4 + c;
        const bottom = btmRow + x * 4 + c;
        const left = rowOffset + (x - 1) * 4 + c;
        const right = rowOffset + (x + 1) * 4 + c;

        const val =
          src[idx + c] * centerWeight +
          (src[top] + src[bottom] + src[left] + src[right]) * edgeWeight;

        dst[idx + c] = Math.min(255, Math.max(0, Math.round(val)));
      }
      dst[idx + 3] = src[idx + 3]; // Preserve alpha
    }
  }

  ctx.putImageData(output, 0, 0);
}

/**
 * Photo Background Replacement with Soft Feathering
 * Designed for Passport/ID photo studio backgrounds (White, Blue, Transparent, or Custom Hex).
 */
export function applyBackgroundReplacement(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bgMode: BackgroundMode,
  customColorHex?: string | null
): void {
  if (bgMode === 'original') return;

  let targetBgR = 255;
  let targetBgG = 255;
  let targetBgB = 255;
  const isTransparent = bgMode === 'transparent';

  if (bgMode === 'white') {
    targetBgR = 255;
    targetBgG = 255;
    targetBgB = 255;
  } else if (bgMode === 'blue') {
    targetBgR = 0;
    targetBgG = 80;
    targetBgB = 210;
  } else if (bgMode === 'custom' && customColorHex) {
    const hex = customColorHex.replace('#', '');
    if (hex.length === 6) {
      targetBgR = parseInt(hex.substring(0, 2), 16);
      targetBgG = parseInt(hex.substring(2, 4), 16);
      targetBgB = parseInt(hex.substring(4, 6), 16);
    }
  }

  // Sample corner background colors to detect dominant photo background
  const sample1 = 0;
  const sample2 = Math.max(0, (width - 1) * 4);
  const bgSampleR = (data[sample1] + data[sample2]) / 2;
  const bgSampleG = (data[sample1 + 1] + data[sample2 + 1]) / 2;
  const bgSampleB = (data[sample1 + 2] + data[sample2 + 2]) / 2;

  const threshold = 45;
  const feather = 25;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    const dist = Math.sqrt(
      (r - bgSampleR) ** 2 +
      (g - bgSampleG) ** 2 +
      (b - bgSampleB) ** 2
    );

    if (dist < threshold) {
      if (isTransparent) {
        data[i + 3] = 0;
        continue;
      } else {
        data[i] = targetBgR;
        data[i + 1] = targetBgG;
        data[i + 2] = targetBgB;
      }
    } else if (dist < threshold + feather) {
      const factor = (dist - threshold) / feather;
      if (isTransparent) {
        data[i + 3] = Math.round(data[i + 3] * factor);
      } else {
        data[i] = Math.round(targetBgR * (1 - factor) + r * factor);
        data[i + 1] = Math.round(targetBgG * (1 - factor) + g * factor);
        data[i + 2] = Math.round(targetBgB * (1 - factor) + b * factor);
      }
    }
  }
}
