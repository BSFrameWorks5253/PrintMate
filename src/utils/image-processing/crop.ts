/**
 * PrintMate Image Processing — Crop Module
 * Handles normalized crop calculations, bounds validation, and standard print aspect presets.
 */

export interface NormalizedCropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Standard Print & Document Aspect Ratio Presets
 */
export const CROP_ASPECT_PRESETS = {
  SQUARE: { label: '1:1 Square', ratio: 1 },
  PASSPORT: { label: 'Passport (35x45mm)', ratio: 35 / 45 },
  STAMP: { label: 'Stamp (20x25mm)', ratio: 20 / 25 },
  ID_CARD: { label: 'ID Card (85.6x54mm)', ratio: 85.6 / 54 },
  PHOTO_4X6: { label: '4x6 Photo (10x15cm)', ratio: 6 / 4 },
  A4_DOCUMENT: { label: 'A4 Document (210x297mm)', ratio: 210 / 297 },
} as const;

/**
 * Computes centered normalized crop coordinates (0 to 1) for a target aspect ratio.
 */
export function calculateAspectCrop(aspect: number): NormalizedCropBox {
  let w = 0.8;
  let h = 0.8;

  if (aspect > 1) {
    h = w / aspect;
  } else {
    w = h * aspect;
  }

  return {
    x: Math.max(0, (1 - w) / 2),
    y: Math.max(0, (1 - h) / 2),
    w: Math.min(1, w),
    h: Math.min(1, h),
  };
}

/**
 * Applies normalized crop box to a canvas, returning a cropped canvas element.
 */
export function applyCropToCanvas(
  sourceCanvas: HTMLCanvasElement,
  cropX: number | null,
  cropY: number | null,
  cropW: number | null,
  cropH: number | null
): HTMLCanvasElement {
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;

  if (
    cropX === null ||
    cropY === null ||
    cropW === null ||
    cropH === null ||
    cropW <= 0 ||
    cropH <= 0
  ) {
    const uncropped = document.createElement('canvas');
    uncropped.width = srcW;
    uncropped.height = srcH;
    const ctx = uncropped.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(sourceCanvas, 0, 0);
    return uncropped;
  }

  const pixelX = Math.max(0, Math.round(cropX * srcW));
  const pixelY = Math.max(0, Math.round(cropY * srcH));
  const pixelW = Math.max(1, Math.min(srcW - pixelX, Math.round(cropW * srcW)));
  const pixelH = Math.max(1, Math.min(srcH - pixelY, Math.round(cropH * srcH)));

  const cropped = document.createElement('canvas');
  cropped.width = pixelW;
  cropped.height = pixelH;
  const ctx = cropped.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(sourceCanvas, pixelX, pixelY, pixelW, pixelH, 0, 0, pixelW, pixelH);

  return cropped;
}
