import { AssetEdits, PerspectivePoints } from '../types';

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
 * Render an image with its full non-destructive edit pipeline onto an OffscreenCanvas or HTMLCanvasElement
 */
export async function renderProcessedCanvas(
  sourceImage: HTMLImageElement,
  edits: AssetEdits,
  maxDimension?: number
): Promise<HTMLCanvasElement> {
  // 1. Initial dimension calculation
  let srcW = sourceImage.naturalWidth || sourceImage.width;
  let srcH = sourceImage.naturalHeight || sourceImage.height;

  // Scale down if maxDimension is provided (for fast preview generation)
  let scale = 1;
  if (maxDimension && (srcW > maxDimension || srcH > maxDimension)) {
    scale = maxDimension / Math.max(srcW, srcH);
    srcW = Math.round(srcW * scale);
    srcH = Math.round(srcH * scale);
  }

  // Intermediate canvas for rotation & deskew
  const totalAngle = edits.rotation_degrees + (edits.straighten_degrees || 0);
  const rad = (totalAngle * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));

  const rotatedW = Math.round(srcW * cos + srcH * sin);
  const rotatedH = Math.round(srcW * sin + srcH * cos);

  const rotCanvas = document.createElement('canvas');
  rotCanvas.width = rotatedW;
  rotCanvas.height = rotatedH;
  const rotCtx = rotCanvas.getContext('2d', { willReadFrequently: true });
  if (!rotCtx) throw new Error('Failed to get 2D canvas context');

  rotCtx.translate(rotatedW / 2, rotatedH / 2);
  rotCtx.rotate(rad);
  rotCtx.drawImage(sourceImage, -srcW / 2, -srcH / 2, srcW, srcH);

  // 2. Crop handling
  let finalCanvas = document.createElement('canvas');
  let finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true })!;

  if (
    edits.crop_x !== null &&
    edits.crop_y !== null &&
    edits.crop_width !== null &&
    edits.crop_height !== null &&
    edits.crop_width > 0 &&
    edits.crop_height > 0
  ) {
    const cropX = Math.max(0, Math.round(edits.crop_x * rotatedW));
    const cropY = Math.max(0, Math.round(edits.crop_y * rotatedH));
    const cropW = Math.min(rotatedW - cropX, Math.round(edits.crop_width * rotatedW));
    const cropH = Math.min(rotatedH - cropY, Math.round(edits.crop_height * rotatedH));

    finalCanvas.width = Math.max(1, cropW);
    finalCanvas.height = Math.max(1, cropH);
    finalCtx.drawImage(rotCanvas, cropX, cropY, cropW, cropH, 0, 0, finalCanvas.width, finalCanvas.height);
  } else {
    finalCanvas.width = rotatedW;
    finalCanvas.height = rotatedH;
    finalCtx.drawImage(rotCanvas, 0, 0);
  }

  // 3. Pixel Manipulation (Brightness, Contrast, Saturation, Grayscale, Text Darkening, Sharpness, Background)
  const imgData = finalCtx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
  const data = imgData.data;
  const len = data.length;

  const b = edits.brightness; // -1 to 1
  const c = edits.contrast; // 0 to 3 (default 1)
  const s = edits.saturation; // 0 to 3 (default 1)
  const isGray = edits.grayscale;
  const textDarkening = edits.text_darkening || 0; // 0 to 2

  // Background removal settings
  const bgMode = edits.background_mode;
  const isBgReplace = bgMode !== 'original';
  let targetBgR = 255;
  let targetBgG = 255;
  let targetBgB = 255;
  let isTransparent = bgMode === 'transparent';

  if (bgMode === 'white') {
    targetBgR = 255;
    targetBgG = 255;
    targetBgB = 255;
  } else if (bgMode === 'blue') {
    targetBgR = 0;
    targetBgG = 80;
    targetBgB = 210;
  } else if (bgMode === 'custom' && edits.background_color) {
    const hex = edits.background_color.replace('#', '');
    if (hex.length === 6) {
      targetBgR = parseInt(hex.substring(0, 2), 16);
      targetBgG = parseInt(hex.substring(2, 4), 16);
      targetBgB = parseInt(hex.substring(4, 6), 16);
    }
  }

  // Sample corner background colors to detect dominant photo background
  let bgSampleR = 240;
  let bgSampleG = 240;
  let bgSampleB = 240;
  if (isBgReplace) {
    // Average top-left and top-right pixels
    const sample1 = 0;
    const sample2 = (finalCanvas.width - 1) * 4;
    bgSampleR = (data[sample1] + data[sample2]) / 2;
    bgSampleG = (data[sample1 + 1] + data[sample2 + 1]) / 2;
    bgSampleB = (data[sample1 + 2] + data[sample2 + 2]) / 2;
  }

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let bVal = data[i + 2];

    // Background replacement mask check
    if (isBgReplace) {
      const dist = Math.sqrt(
        (r - bgSampleR) ** 2 +
        (g - bgSampleG) ** 2 +
        (bVal - bgSampleB) ** 2
      );
      // Tolerance threshold with soft feathering
      const threshold = 45;
      const feather = 25;
      if (dist < threshold) {
        if (isTransparent) {
          data[i + 3] = 0; // Transparent
          continue;
        } else {
          r = targetBgR;
          g = targetBgG;
          bVal = targetBgB;
        }
      } else if (dist < threshold + feather) {
        const factor = (dist - threshold) / feather;
        if (isTransparent) {
          data[i + 3] = Math.round(data[i + 3] * factor);
        } else {
          r = Math.round(targetBgR * (1 - factor) + r * factor);
          g = Math.round(targetBgG * (1 - factor) + g * factor);
          bVal = Math.round(targetBgB * (1 - factor) + bVal * factor);
        }
      }
    }

    // Brightness (-255 to +255)
    if (b !== 0) {
      r += b * 255;
      g += b * 255;
      bVal += b * 255;
    }

    // Contrast
    if (c !== 1) {
      r = (r - 128) * c + 128;
      g = (g - 128) * c + 128;
      bVal = (bVal - 128) * c + 128;
    }

    // Grayscale luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * bVal;

    // Saturation
    if (isGray) {
      r = lum;
      g = lum;
      bVal = lum;
    } else if (s !== 1) {
      r = lum + (r - lum) * s;
      g = lum + (g - lum) * s;
      bVal = lum + (bVal - lum) * s;
    }

    // Document Text Darkening (Xerox Mode)
    // Darkens faded ink while brightening / cleaning gray paper
    if (textDarkening > 0) {
      const currentLum = 0.299 * r + 0.587 * g + 0.114 * bVal;
      if (currentLum < 160) {
        // Darken text aggressively according to slider intensity
        const darkenFactor = 1 - (textDarkening * 0.45);
        r = Math.max(0, r * darkenFactor);
        g = Math.max(0, g * darkenFactor);
        bVal = Math.max(0, bVal * darkenFactor);
      } else if (currentLum > 185) {
        // Brighten paper background to clean up Xerox speckles
        const cleanFactor = 1 + (textDarkening * 0.2);
        r = Math.min(255, r * cleanFactor);
        g = Math.min(255, g * cleanFactor);
        bVal = Math.min(255, bVal * cleanFactor);
      }
    }

    // Clamp values
    data[i] = Math.min(255, Math.max(0, Math.round(r)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(bVal)));
  }

  finalCtx.putImageData(imgData, 0, 0);

  // 4. Sharpening (Laplacian convolution filter)
  if (edits.sharpness > 0) {
    applySharpen(finalCtx, finalCanvas.width, finalCanvas.height, edits.sharpness);
  }

  return finalCanvas;
}

/**
 * 3x3 Convolution Sharpening Filter
 */
function applySharpen(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const src = imgData.data;
  const output = ctx.createImageData(width, height);
  const dst = output.data;

  // Weight formula
  const strength = Math.min(amount, 3);
  const centerWeight = 1 + 4 * strength;
  const edgeWeight = -strength;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      for (let c = 0; c < 3; c++) {
        const top = ((y - 1) * width + x) * 4 + c;
        const bottom = ((y + 1) * width + x) * 4 + c;
        const left = (y * width + (x - 1)) * 4 + c;
        const right = (y * width + (x + 1)) * 4 + c;

        const val =
          src[idx + c] * centerWeight +
          (src[top] + src[bottom] + src[left] + src[right]) * edgeWeight;

        dst[idx + c] = Math.min(255, Math.max(0, Math.round(val)));
      }
      dst[idx + 3] = src[idx + 3];
    }
  }

  ctx.putImageData(output, 0, 0);
}

/**
 * Fast Automatic Skew Angle Detection
 * Scans projection profile variance across angles -15° to +15°
 */
export function detectDocumentSkew(canvas: HTMLCanvasElement): number {
  const width = Math.min(400, canvas.width);
  const scale = width / canvas.width;
  const height = Math.round(canvas.height * scale);

  const thumb = document.createElement('canvas');
  thumb.width = width;
  thumb.height = height;
  const ctx = thumb.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Binarize / edge detect
  const binary = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      binary[y * width + x] = lum < 128 ? 1 : 0;
    }
  }

  let bestAngle = 0;
  let maxVariance = -1;

  // Test angles from -15° to +15° in steps of 0.5°
  for (let deg = -15; deg <= 15; deg += 0.5) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const profile = new Float32Array(height);
    const counts = new Uint16Array(height);

    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        if (binary[y * width + x] === 1) {
          const projY = Math.round((x - width / 2) * sin + (y - height / 2) * cos + height / 2);
          if (projY >= 0 && projY < height) {
            profile[projY]++;
            counts[projY]++;
          }
        }
      }
    }

    // Compute profile variance
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let i = 0; i < height; i++) {
      if (counts[i] > 0) {
        sum += profile[i];
        sumSq += profile[i] * profile[i];
        count++;
      }
    }

    if (count > 0) {
      const mean = sum / count;
      const variance = sumSq / count - mean * mean;
      if (variance > maxVariance) {
        maxVariance = variance;
        bestAngle = deg;
      }
    }
  }

  return -bestAngle; // Invert to straighten
}
