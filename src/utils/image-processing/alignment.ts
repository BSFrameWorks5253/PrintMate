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
 * Performs two-phase search across -45° to +45° using projection profile variance
 */
export function detectDocumentSkew(canvas: HTMLCanvasElement): number {
  const width = Math.min(320, canvas.width);
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

  // Binarize based on local contrast / text threshold
  const binary = new Uint8Array(width * height);
  let totalLum = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalLum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const meanLum = totalLum / (width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      binary[y * width + x] = lum < Math.min(130, meanLum * 0.85) ? 1 : 0;
    }
  }

  const computeVariance = (deg: number) => {
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
    return count > 0 ? sumSq / count - (sum / count) ** 2 : 0;
  };

  // Phase 1: Wide coarse sweep (-25° to +25° in 1.5° steps)
  let bestAngle = 0;
  let maxVar = -1;
  for (let deg = -25; deg <= 25; deg += 1.5) {
    const v = computeVariance(deg);
    if (v > maxVar) {
      maxVar = v;
      bestAngle = deg;
    }
  }

  // Phase 2: High precision fine sweep around peak (±2° in 0.2° steps)
  let fineBest = bestAngle;
  let fineMax = maxVar;
  for (let deg = bestAngle - 2; deg <= bestAngle + 2; deg += 0.2) {
    const v = computeVariance(deg);
    if (v > fineMax) {
      fineMax = v;
      fineBest = deg;
    }
  }

  return Math.round(-fineBest * 10) / 10; // Invert to straighten
}

/**
 * Result of comprehensive document boundary analysis
 */
export interface DocumentBoundsResult {
  corners: PerspectivePoints;
  normalizedBox: { x: number; y: number; w: number; h: number };
  confidence: number; // 0.0 to 1.0
  detectedType: string;
}

/**
 * Classifies document type from aspect ratio and physical proportions
 */
export function detectDocumentType(width: number, height: number): string {
  const maxDim = Math.max(width, height);
  const minDim = Math.max(1, Math.min(width, height));
  const ratio = maxDim / minDim;

  if (ratio < 1.05) return 'Square 1:1';

  const candidates: Array<{ label: string; targetRatio: number; maxTol: number }> = [
    { label: 'A4 Document', targetRatio: 297 / 210, maxTol: 0.08 },
    { label: 'ID Card / License', targetRatio: 85.6 / 54, maxTol: 0.10 },
    { label: '4x6 Photo', targetRatio: 1.5, maxTol: 0.06 },
    { label: 'Passport Photo', targetRatio: 45 / 35, maxTol: 0.035 },
    { label: 'Stamp Photo', targetRatio: 25 / 20, maxTol: 0.035 },
  ];

  let bestMatch = 'Document / Photo';
  let bestDelta = Infinity;

  for (const c of candidates) {
    const delta = Math.abs(ratio - c.targetRatio);
    if (delta <= c.maxTol && delta < bestDelta) {
      bestDelta = delta;
      bestMatch = c.label;
    }
  }

  return bestMatch;
}

/**
 * Advanced Document Page & Corner Detection
 * Combines Sobel gradient contour analysis, edge projection, and quad corner optimization.
 */
export function detectDocumentCorners(canvas: HTMLCanvasElement): PerspectivePoints {
  return detectDocumentBounds(canvas).corners;
}

/**
 * Full Document Boundary Analyzer
 */
export function detectDocumentBounds(canvas: HTMLCanvasElement): DocumentBoundsResult {
  const w = canvas.width;
  const h = canvas.height;
  const defaultMargin = 0.04;

  const fallbackCorners: PerspectivePoints = {
    topLeft: { x: Math.round(w * defaultMargin), y: Math.round(h * defaultMargin) },
    topRight: { x: Math.round(w * (1 - defaultMargin)), y: Math.round(h * defaultMargin) },
    bottomRight: { x: Math.round(w * (1 - defaultMargin)), y: Math.round(h * (1 - defaultMargin)) },
    bottomLeft: { x: Math.round(w * defaultMargin), y: Math.round(h * (1 - defaultMargin)) },
  };

  const detectedType = detectDocumentType(w, h);

  try {
    const thumbW = Math.min(260, w);
    const scale = thumbW / w;
    const thumbH = Math.max(1, Math.round(h * scale));

    const thumb = document.createElement('canvas');
    thumb.width = thumbW;
    thumb.height = thumbH;
    const ctx = thumb.getContext('2d');
    if (!ctx) {
      return {
        corners: fallbackCorners,
        normalizedBox: { x: defaultMargin, y: defaultMargin, w: 1 - 2 * defaultMargin, h: 1 - 2 * defaultMargin },
        confidence: 0.5,
        detectedType,
      };
    }

    ctx.drawImage(canvas, 0, 0, thumbW, thumbH);
    const imgData = ctx.getImageData(0, 0, thumbW, thumbH);
    const data = imgData.data;

    // 1. Build grayscale buffer
    const gray = new Float32Array(thumbW * thumbH);
    for (let y = 0; y < thumbH; y++) {
      for (let x = 0; x < thumbW; x++) {
        const i = (y * thumbW + x) * 4;
        gray[y * thumbW + x] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
    }

    // 2. Sample outer edge luminance (scanner cover / desk background)
    let bgSum = 0;
    let bgSamples = 0;
    for (let x = 0; x < thumbW; x += 4) {
      bgSum += gray[x] + gray[(thumbH - 1) * thumbW + x];
      bgSamples += 2;
    }
    for (let y = 0; y < thumbH; y += 4) {
      bgSum += gray[y * thumbW] + gray[y * thumbW + thumbW - 1];
      bgSamples += 2;
    }
    const bgLum = bgSamples > 0 ? bgSum / bgSamples : 128;

    // 3. Compute Sobel Gradient Magnitudes
    const grad = new Float32Array(thumbW * thumbH);
    let maxGrad = 0;
    for (let y = 1; y < thumbH - 1; y++) {
      for (let x = 1; x < thumbW - 1; x++) {
        const gx =
          gray[(y - 1) * thumbW + x + 1] +
          2 * gray[y * thumbW + x + 1] +
          gray[(y + 1) * thumbW + x + 1] -
          (gray[(y - 1) * thumbW + x - 1] +
            2 * gray[y * thumbW + x - 1] +
            gray[(y + 1) * thumbW + x - 1]);

        const gy =
          gray[(y + 1) * thumbW + x - 1] +
          2 * gray[(y + 1) * thumbW + x] +
          gray[(y + 1) * thumbW + x + 1] -
          (gray[(y - 1) * thumbW + x - 1] +
            2 * gray[(y - 1) * thumbW + x] +
            gray[(y - 1) * thumbW + x + 1]);

        const gMag = Math.sqrt(gx * gx + gy * gy);
        grad[y * thumbW + x] = gMag;
        if (gMag > maxGrad) maxGrad = gMag;
      }
    }

    // 4. Threshold edges and segment document candidate points
    const edgeThreshold = Math.max(30, maxGrad * 0.25);
    const candidatePoints: { x: number; y: number }[] = [];

    for (let y = 4; y < thumbH - 4; y++) {
      for (let x = 4; x < thumbW - 4; x++) {
        const isEdge = grad[y * thumbW + x] > edgeThreshold;
        const diffFromBg = Math.abs(gray[y * thumbW + x] - bgLum);
        if (isEdge || diffFromBg > 35) {
          candidatePoints.push({ x, y });
        }
      }
    }

    // 5. If strong candidates found, optimize for the 4 quad corners
    if (candidatePoints.length > thumbW * thumbH * 0.05) {
      let minSum = Infinity;
      let maxSum = -Infinity;
      let minDiff = Infinity;
      let maxDiff = -Infinity;

      let tl = { x: 0, y: 0 };
      let br = { x: thumbW, y: thumbH };
      let tr = { x: thumbW, y: 0 };
      let bl = { x: 0, y: thumbH };

      for (let i = 0; i < candidatePoints.length; i++) {
        const p = candidatePoints[i];
        const sum = p.x + p.y;
        const diff = p.x - p.y;

        // Top-Left minimizes (x + y)
        if (sum < minSum) {
          minSum = sum;
          tl = p;
        }
        // Bottom-Right maximizes (x + y)
        if (sum > maxSum) {
          maxSum = sum;
          br = p;
        }
        // Top-Right maximizes (x - y)
        if (diff > maxDiff) {
          maxDiff = diff;
          tr = p;
        }
        // Bottom-Left minimizes (x - y)
        if (diff < minDiff) {
          minDiff = diff;
          bl = p;
        }
      }

      const invScale = 1 / scale;
      const docW = Math.max(tr.x - tl.x, br.x - bl.x);
      const docH = Math.max(bl.y - tl.y, br.y - tr.y);

      // Verify that candidate forms a reasonable page (> 25% of image)
      if (docW > thumbW * 0.25 && docH > thumbH * 0.25) {
        const detectedCorners: PerspectivePoints = {
          topLeft: { x: Math.max(0, Math.round(tl.x * invScale)), y: Math.max(0, Math.round(tl.y * invScale)) },
          topRight: { x: Math.min(w, Math.round(tr.x * invScale)), y: Math.max(0, Math.round(tr.y * invScale)) },
          bottomRight: { x: Math.min(w, Math.round(br.x * invScale)), y: Math.min(h, Math.round(br.y * invScale)) },
          bottomLeft: { x: Math.max(0, Math.round(bl.x * invScale)), y: Math.min(h, Math.round(bl.y * invScale)) },
        };

        const minNormX = Math.min(detectedCorners.topLeft.x, detectedCorners.bottomLeft.x) / w;
        const maxNormX = Math.max(detectedCorners.topRight.x, detectedCorners.bottomRight.x) / w;
        const minNormY = Math.min(detectedCorners.topLeft.y, detectedCorners.topRight.y) / h;
        const maxNormY = Math.max(detectedCorners.bottomLeft.y, detectedCorners.bottomRight.y) / h;

        return {
          corners: detectedCorners,
          normalizedBox: {
            x: Math.max(0, minNormX),
            y: Math.max(0, minNormY),
            w: Math.min(1 - minNormX, maxNormX - minNormX),
            h: Math.min(1 - minNormY, maxNormY - minNormY),
          },
          confidence: 0.92,
          detectedType,
        };
      }
    }
  } catch (err) {
    console.warn('Corner detection fallback:', err);
  }

  return {
    corners: fallbackCorners,
    normalizedBox: {
      x: defaultMargin,
      y: defaultMargin,
      w: 1 - 2 * defaultMargin,
      h: 1 - 2 * defaultMargin,
    },
    confidence: 0.5,
    detectedType,
  };
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
