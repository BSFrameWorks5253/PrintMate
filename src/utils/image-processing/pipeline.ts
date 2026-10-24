/**
 * PrintMate Image Processing — Processing Pipeline Module
 * Coordinates image loading, default state creation, and the full non-destructive render pipeline.
 */

import { AssetEdits, PerspectivePoints } from '../../types';
import { applyRotationAndFlip, warpPerspective } from './alignment';
import { applyCropToCanvas } from './crop';
import { applyToneAdjustments } from './tone-setter';
import { applyTextDarkening, applySharpen, applyBackgroundReplacement } from './document-enhancement';

/**
 * Load HTMLImageElement safely from URL / data URI
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e));
    img.src = src;
  });
}

/**
 * Create a fresh default edits object for an asset
 */
export function createDefaultEdits(assetId: string): AssetEdits {
  return {
    id: crypto.randomUUID(),
    asset_id: assetId,
    revision: 1,
    rotation_degrees: 0,
    flip_horizontal: false,
    flip_vertical: false,
    straighten_degrees: 0,
    crop_x: null,
    crop_y: null,
    crop_width: null,
    crop_height: null,
    perspective_data_json: null,
    brightness: 0,
    contrast: 1,
    saturation: 1,
    sharpness: 0,
    grayscale: false,
    text_darkening: 0,
    background_mode: 'original',
    background_color: '#FFFFFF',
    background_asset_path: null,
    processing_options_json: null,
    is_current: true,
    created_at: new Date().toISOString(),
  };
}

/**
 * Render an image with its full non-destructive edit pipeline onto an HTMLCanvasElement
 */
export async function renderProcessedCanvas(
  sourceImage: HTMLImageElement,
  edits: AssetEdits,
  maxDimension?: number,
  options?: { lockToA4?: boolean; preservePageDimensions?: boolean }
): Promise<HTMLCanvasElement> {
  let lockToA4 = !!options?.lockToA4;
  let preservePageDimensions = options?.preservePageDimensions !== undefined ? options.preservePageDimensions : true;

  if (edits.processing_options_json) {
    try {
      const parsed = JSON.parse(edits.processing_options_json);
      if (parsed.lockToA4 !== undefined) lockToA4 = !!parsed.lockToA4;
      if (parsed.preservePageDimensions !== undefined) preservePageDimensions = !!parsed.preservePageDimensions;
    } catch {}
  }

  // 1. Rotation, Flip & Straighten (with fixed page boundaries & optional A4 lock)
  let currentCanvas = applyRotationAndFlip(
    sourceImage,
    edits.rotation_degrees,
    edits.flip_horizontal,
    edits.flip_vertical,
    edits.straighten_degrees || 0,
    maxDimension,
    preservePageDimensions,
    lockToA4
  );

  // 2. Perspective Quad Correction (if corners are defined)
  if (edits.perspective_data_json) {
    try {
      const points = JSON.parse(edits.perspective_data_json) as PerspectivePoints;
      if (points.topLeft && points.topRight && points.bottomRight && points.bottomLeft) {
        currentCanvas = warpPerspective(currentCanvas, points);
      }
    } catch (e) {
      console.warn('Failed to parse perspective points:', e);
    }
  }

  // 3. Crop handling
  const finalCanvas = applyCropToCanvas(
    currentCanvas,
    edits.crop_x,
    edits.crop_y,
    edits.crop_width,
    edits.crop_height
  );

  const finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true });
  if (!finalCtx) throw new Error('Failed to obtain 2D canvas context');

  const imgData = finalCtx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
  const data = imgData.data;

  // 4. Background Replacement (Passport photo mode)
  if (edits.background_mode && edits.background_mode !== 'original') {
    applyBackgroundReplacement(
      data,
      finalCanvas.width,
      finalCanvas.height,
      edits.background_mode,
      edits.background_color
    );
  }

  // 5. Tone Adjustments: Brightness, Contrast, Saturation, Grayscale
  applyToneAdjustments(
    data,
    edits.brightness,
    edits.contrast,
    edits.saturation,
    edits.grayscale
  );

  // 6. Xerox Studio Text Darkening & Paper Whitening
  if (edits.text_darkening && edits.text_darkening > 0) {
    applyTextDarkening(data, edits.text_darkening);
  }

  finalCtx.putImageData(imgData, 0, 0);

  // 7. Sharpness (Laplacian convolution filter)
  if (edits.sharpness && edits.sharpness > 0) {
    applySharpen(finalCtx, finalCanvas.width, finalCanvas.height, edits.sharpness);
  }

  return finalCanvas;
}
