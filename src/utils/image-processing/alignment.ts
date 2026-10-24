/**
 * PrintMate Image Processing — Alignment & Geometry Module
 * Handles rotation, flipping, skew detection, document edge detection, and perspective quad warping.
 */

import { PerspectivePoints } from '../../types';

/**
 * Applies 90/180/270 rotation, arbitrary deskew angle, and horizontal/vertical flipping.
 */
export function applyRotationAndFlip(
  sourceImage: HTMLImageElement,
  rotationDegrees: number,
  flipHorizontal: boolean,
  flipVertical: boolean,
  straightenDegrees: number = 0,
  maxDimension?: number
): HTMLCanvasElement {
  let srcW = sourceImage.naturalWidth || sourceImage.width;
  let srcH = sourceImage.naturalHeight || sourceImage.height;

  if (maxDimension && (srcW > maxDimension || srcH > maxDimension)) {
    const scale = maxDimension / Math.max(srcW, srcH);
    srcW = Math.round(srcW * scale);
    srcH = Math.round(srcH * scale);
  }

  const totalAngle = rotationDegrees + straightenDegrees;
  const rad = (totalAngle * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));

  const rotatedW = Math.max(1, Math.round(srcW * cos + srcH * sin));
  const rotatedH = Math.max(1, Math.round(srcW * sin + srcH * cos));

  const rotCanvas = document.createElement('canvas');
  rotCanvas.width = rotatedW;
  rotCanvas.height = rotatedH;
  const rotCtx = rotCanvas.getContext('2d', { willReadFrequently: true });
  if (!rotCtx) throw new Error('Failed to get 2D canvas context');

  rotCtx.translate(rotatedW / 2, rotatedH / 2);
  rotCtx.rotate(rad);
  rotCtx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
  rotCtx.drawImage(sourceImage, -srcW / 2, -srcH / 2, srcW, srcH);

  return rotCanvas;
}

/**
 * Fast Automatic Skew Angle Detection
 * Scans projection profile variance across angles -15° to +15°
 */
export function detectDocumentSkew(canvas: HTMLCanvasElement): number {
  const width = Math.min(400, canvas.width);
  const scale = width / canvas.width;
  const height = Math.max(1, Math.round(canvas.height * scale));

  const thumb = document.createElement('canvas');
  thumb.width = width;
  thumb.height = height;
  const ctx = thumb.getContext('2d');
  if (!ctx) return 0;

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

/**
 * Detect Document Corners (Paper Boundary Detection)
 * Scans for high-contrast rectangular document boundaries against scanner or desk background.
 */
export function detectDocumentCorners(canvas: HTMLCanvasElement): PerspectivePoints {
  const w = canvas.width;
  const h = canvas.height;
  const defaultMargin = 0.05;

  const defaultPoints: PerspectivePoints = {
    topLeft: { x: Math.round(w * defaultMargin), y: Math.round(h * defaultMargin) },
    topRight: { x: Math.round(w * (1 - defaultMargin)), y: Math.round(h * defaultMargin) },
    bottomRight: { x: Math.round(w * (1 - defaultMargin)), y: Math.round(h * (1 - defaultMargin)) },
    bottomLeft: { x: Math.round(w * defaultMargin), y: Math.round(h * (1 - defaultMargin)) },
  };

  try {
    const thumbW = Math.min(200, w);
    const scale = thumbW / w;
    const thumbH = Math.max(1, Math.round(h * scale));

    const thumb = document.createElement('canvas');
    thumb.width = thumbW;
    thumb.height = thumbH;
    const ctx = thumb.getContext('2d');
    if (!ctx) return defaultPoints;

    ctx.drawImage(canvas, 0, 0, thumbW, thumbH);
    const imgData = ctx.getImageData(0, 0, thumbW, thumbH);
    const data = imgData.data;

    const getLum = (x: number, y: number) => {
      const idx = (y * thumbW + x) * 4;
      return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    };

    let topBoundary = 0;
    let bottomBoundary = thumbH - 1;
    let leftBoundary = 0;
    let rightBoundary = thumbW - 1;

    // Scan top down for paper transition
    for (let y = 0; y < Math.floor(thumbH * 0.4); y++) {
      let highCount = 0;
      for (let x = Math.floor(thumbW * 0.2); x < Math.floor(thumbW * 0.8); x += 4) {
        if (getLum(x, y) > 150) highCount++;
      }
      if (highCount > (thumbW * 0.6) / 8) {
        topBoundary = y;
        break;
      }
    }

    // Scan bottom up
    for (let y = thumbH - 1; y > Math.floor(thumbH * 0.6); y--) {
      let highCount = 0;
      for (let x = Math.floor(thumbW * 0.2); x < Math.floor(thumbW * 0.8); x += 4) {
        if (getLum(x, y) > 150) highCount++;
      }
      if (highCount > (thumbW * 0.6) / 8) {
        bottomBoundary = y;
        break;
      }
    }

    // Scan left to right
    for (let x = 0; x < Math.floor(thumbW * 0.4); x++) {
      let highCount = 0;
      for (let y = Math.floor(thumbH * 0.2); y < Math.floor(thumbH * 0.8); y += 4) {
        if (getLum(x, y) > 150) highCount++;
      }
      if (highCount > (thumbH * 0.6) / 8) {
        leftBoundary = x;
        break;
      }
    }

    // Scan right to left
    for (let x = thumbW - 1; x > Math.floor(thumbW * 0.6); x--) {
      let highCount = 0;
      for (let y = Math.floor(thumbH * 0.2); y < Math.floor(thumbH * 0.8); y += 4) {
        if (getLum(x, y) > 150) highCount++;
      }
      if (highCount > (thumbH * 0.6) / 8) {
        rightBoundary = x;
        break;
      }
    }

    if (
      rightBoundary > leftBoundary + thumbW * 0.3 &&
      bottomBoundary > topBoundary + thumbH * 0.3
    ) {
      const invScale = 1 / scale;
      return {
        topLeft: { x: Math.round(leftBoundary * invScale), y: Math.round(topBoundary * invScale) },
        topRight: { x: Math.round(rightBoundary * invScale), y: Math.round(topBoundary * invScale) },
        bottomRight: { x: Math.round(rightBoundary * invScale), y: Math.round(bottomBoundary * invScale) },
        bottomLeft: { x: Math.round(leftBoundary * invScale), y: Math.round(bottomBoundary * invScale) },
      };
    }
  } catch (err) {
    console.warn('Corner detection error, using defaults:', err);
  }

  return defaultPoints;
}

/**
 * Warps a quadrilateral region defined by 4 corner points into an upright rectangular canvas.
 * Implements standard Projective (Perspective) mapping with bilinear interpolation.
 */
export function warpPerspective(
  sourceCanvas: HTMLCanvasElement,
  points: PerspectivePoints,
  destWidth?: number,
  destHeight?: number
): HTMLCanvasElement {
  const { topLeft: p0, topRight: p1, bottomRight: p2, bottomLeft: p3 } = points;

  // Calculate destination rectangle width and height if not specified
  const wTop = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const wBottom = Math.hypot(p2.x - p3.x, p2.y - p3.y);
  const outW = Math.max(1, destWidth || Math.round((wTop + wBottom) / 2));

  const hLeft = Math.hypot(p3.x - p0.x, p3.y - p0.y);
  const hRight = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const outH = Math.max(1, destHeight || Math.round((hLeft + hRight) / 2));

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!outCtx) return sourceCanvas;

  const srcCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) return sourceCanvas;

  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const srcImgData = srcCtx.getImageData(0, 0, srcW, srcH);
  const srcData = srcImgData.data;

  const outImgData = outCtx.createImageData(outW, outH);
  const outData = outImgData.data;

  // Projective mapping coefficients from unit square [0,1]^2 to quad (p0, p1, p2, p3)
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const sx = p0.x - p1.x + p2.x - p3.x;

  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const sy = p0.y - p1.y + p2.y - p3.y;

  let a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number;

  const det = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(det) < 1e-7) {
    // Affine fallback
    a = p1.x - p0.x;
    b = p3.x - p0.x;
    c = p0.x;
    d = p1.y - p0.y;
    e = p3.y - p0.y;
    f = p0.y;
    g = 0;
    h = 0;
  } else {
    g = (sx * dy2 - sy * dx2) / det;
    h = (dx1 * sy - dy1 * sx) / det;
    a = p1.x - p0.x + g * p1.x;
    b = p3.x - p0.x + h * p3.x;
    c = p0.x;
    d = p1.y - p0.y + g * p1.y;
    e = p3.y - p0.y + h * p3.y;
    f = p0.y;
  }

  // Iterate over each destination pixel (dx, dy)
  for (let dy = 0; dy < outH; dy++) {
    const v = dy / (outH - 1 || 1);
    const rowOffset = dy * outW * 4;

    for (let dx = 0; dx < outW; dx++) {
      const u = dx / (outW - 1 || 1);
      const denom = g * u + h * v + 1;
      const x = (a * u + b * v + c) / denom;
      const y = (d * u + e * v + f) / denom;

      const outIdx = rowOffset + dx * 4;

      if (x < 0 || x >= srcW - 1 || y < 0 || y >= srcH - 1) {
        const cx = Math.max(0, Math.min(srcW - 1, Math.round(x)));
        const cy = Math.max(0, Math.min(srcH - 1, Math.round(y)));
        const sIdx = (cy * srcW + cx) * 4;
        outData[outIdx] = srcData[sIdx];
        outData[outIdx + 1] = srcData[sIdx + 1];
        outData[outIdx + 2] = srcData[sIdx + 2];
        outData[outIdx + 3] = srcData[sIdx + 3];
      } else {
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const x1 = x0 + 1;
        const y1 = y0 + 1;
        const fx = x - x0;
        const fy = y - y0;

        const i00 = (y0 * srcW + x0) * 4;
        const i10 = (y0 * srcW + x1) * 4;
        const i01 = (y1 * srcW + x0) * 4;
        const i11 = (y1 * srcW + x1) * 4;

        for (let ch = 0; ch < 4; ch++) {
          const top = srcData[i00 + ch] * (1 - fx) + srcData[i10 + ch] * fx;
          const btm = srcData[i01 + ch] * (1 - fx) + srcData[i11 + ch] * fx;
          outData[outIdx + ch] = Math.round(top * (1 - fy) + btm * fy);
        }
      }
    }
  }

  outCtx.putImageData(outImgData, 0, 0);
  return outCanvas;
}
