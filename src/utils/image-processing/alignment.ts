/**
 * PrintMate Image Processing — Alignment & Geometry Module
 * Handles rotation, flipping, skew detection, document edge detection, and perspective quad warping.
 */

import { PerspectivePoints } from '../../types';

/**
 * Applies 90/180/270 rotation, arbitrary deskew angle, and horizontal/vertical flipping.
 * When preservePageDimensions is true (default), the canvas maintains fixed page dimensions
 * without expanding wider or distorting aspect ratio when tilting/straightening.
 */
export function applyRotationAndFlip(
  sourceImage: HTMLImageElement,
  rotationDegrees: number,
  flipHorizontal: boolean,
  flipVertical: boolean,
  straightenDegrees: number = 0,
  maxDimension?: number,
  preservePageDimensions: boolean = true,
  lockToA4: boolean = false
): HTMLCanvasElement {
  let srcW = sourceImage.naturalWidth || sourceImage.width;
  let srcH = sourceImage.naturalHeight || sourceImage.height;

  if (maxDimension && (srcW > maxDimension || srcH > maxDimension)) {
    const scale = maxDimension / Math.max(srcW, srcH);
    srcW = Math.round(srcW * scale);
    srcH = Math.round(srcH * scale);
  }

  // Base dimensions swap on 90 / 270 degrees
  const isSwapped = (rotationDegrees % 180 !== 0);
  let baseW = isSwapped ? srcH : srcW;
  let baseH = isSwapped ? srcW : srcH;

  if (lockToA4) {
    // Standard ISO A4 aspect ratio 210 x 297 (1:1.4142)
    const a4Ratio = 297 / 210;
    if (baseW > baseH) {
      baseH = Math.round(baseW / a4Ratio);
    } else {
      baseH = Math.round(baseW * a4Ratio);
    }
  }

  const rotCanvas = document.createElement('canvas');
  const rotCtx = rotCanvas.getContext('2d', { willReadFrequently: true });
  if (!rotCtx) throw new Error('Failed to get 2D canvas context');

  if (preservePageDimensions) {
    // Fixed page boundaries: canvas NEVER gets wider when tilting, no artificial zoom cutting content
    rotCanvas.width = baseW;
    rotCanvas.height = baseH;

    rotCtx.translate(baseW / 2, baseH / 2);

    // Apply rotation & straighten without artificial magnification
    rotCtx.rotate(((rotationDegrees + straightenDegrees) * Math.PI) / 180);
    rotCtx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
    rotCtx.drawImage(sourceImage, -srcW / 2, -srcH / 2, srcW, srcH);
  } else {
    // Unconstrained expansion mode
    const totalAngle = rotationDegrees + straightenDegrees;
    const rad = (totalAngle * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));

    const rotatedW = Math.max(1, Math.round(srcW * cos + srcH * sin));
    const rotatedH = Math.max(1, Math.round(srcW * sin + srcH * cos));

    rotCanvas.width = rotatedW;
    rotCanvas.height = rotatedH;

    rotCtx.translate(rotatedW / 2, rotatedH / 2);
    rotCtx.rotate(rad);
    rotCtx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
    rotCtx.drawImage(sourceImage, -srcW / 2, -srcH / 2, srcW, srcH);
  }

  return rotCanvas;
}

/**
 * Fast Automatic Skew Angle Detection
 * Combines robust document/card contour analysis with projection profile variance fallback
 */
export function detectDocumentSkew(canvas: HTMLCanvasElement): number {
  // 1. Check for distinct foreground document / card
  try {
    const bounds = detectDocumentBounds(canvas);
    if (bounds.confidence >= 0.7 && bounds.deskewDegrees !== undefined && Math.abs(bounds.deskewDegrees) > 0.3) {
      return bounds.deskewDegrees;
    }
  } catch {}

  // 2. Projection profile variance method for edge-to-edge scans
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

  // Phase 1: Wide coarse sweep (-45° to +45° in 1.5° steps)
  let bestAngle = 0;
  let maxVar = -1;
  for (let deg = -45; deg <= 45; deg += 1.5) {
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
  deskewDegrees?: number;
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
 */
export function detectDocumentCorners(canvas: HTMLCanvasElement): PerspectivePoints {
  return detectDocumentBounds(canvas).corners;
}

/**
 * Full Document Boundary Analyzer
 * Uses Connected Component Analysis (CCL) with morphological dilation on Sobel gradients
 * to isolate document pages and ID cards from floors, tables, and scanner beds.
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
    const thumbW = Math.min(320, w);
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
        deskewDegrees: 0,
      };
    }

    ctx.drawImage(canvas, 0, 0, thumbW, thumbH);
    const imgData = ctx.getImageData(0, 0, thumbW, thumbH);
    const data = imgData.data;

    // 1. Grayscale
    const gray = new Float32Array(thumbW * thumbH);
    for (let i = 0; i < thumbW * thumbH; i++) {
      gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }

    // 2. Sobel Gradient
    const grad = new Float32Array(thumbW * thumbH);
    let maxGrad = 0;
    for (let y = 1; y < thumbH - 1; y++) {
      for (let x = 1; x < thumbW - 1; x++) {
        const gx =
          gray[(y - 1) * thumbW + x + 1] + 2 * gray[y * thumbW + x + 1] + gray[(y + 1) * thumbW + x + 1] -
          (gray[(y - 1) * thumbW + x - 1] + 2 * gray[y * thumbW + x - 1] + gray[(y + 1) * thumbW + x - 1]);
        const gy =
          gray[(y + 1) * thumbW + x - 1] + 2 * gray[(y + 1) * thumbW + x] + gray[(y + 1) * thumbW + x + 1] -
          (gray[(y - 1) * thumbW + x - 1] + 2 * gray[(y - 1) * thumbW + x] + gray[(y - 1) * thumbW + x + 1]);
        const mag = Math.sqrt(gx * gx + gy * gy);
        grad[y * thumbW + x] = mag;
        if (mag > maxGrad) maxGrad = mag;
      }
    }

    // 3. Threshold edges
    const edgeThresh = Math.max(28, maxGrad * 0.16);
    const binary = new Uint8Array(thumbW * thumbH);
    for (let i = 0; i < thumbW * thumbH; i++) {
      binary[i] = grad[i] >= edgeThresh ? 1 : 0;
    }

    // 4. Morphological dilation to connect text lines, logos, and borders into solid document shape
    const dilated = new Uint8Array(thumbW * thumbH);
    const radius = 3;
    for (let y = radius; y < thumbH - radius; y++) {
      for (let x = radius; x < thumbW - radius; x++) {
        if (binary[y * thumbW + x] === 1) {
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              dilated[(y + dy) * thumbW + (x + dx)] = 1;
            }
          }
        }
      }
    }

    // 5. Connected Component Analysis (CCL)
    const labels = new Int32Array(thumbW * thumbH);
    let currentLabel = 1;
    const components: Array<{ label: number; size: number; minX: number; maxX: number; minY: number; maxY: number }> = [];

    for (let y = 2; y < thumbH - 2; y++) {
      for (let x = 2; x < thumbW - 2; x++) {
        if (dilated[y * thumbW + x] === 1 && labels[y * thumbW + x] === 0) {
          const queue = [x, y];
          labels[y * thumbW + x] = currentLabel;
          let size = 0;
          let head = 0;
          let minX = x, maxX = x, minY = y, maxY = y;

          while (head < queue.length) {
            const qx = queue[head++];
            const qy = queue[head++];
            size++;

            if (qx < minX) minX = qx;
            if (qx > maxX) maxX = qx;
            if (qy < minY) minY = qy;
            if (qy > maxY) maxY = qy;

            const neighbors = [
              [qx + 1, qy],
              [qx - 1, qy],
              [qx, qy + 1],
              [qx, qy - 1],
            ];

            for (const [nx, ny] of neighbors) {
              if (nx >= 0 && nx < thumbW && ny >= 0 && ny < thumbH) {
                if (dilated[ny * thumbW + nx] === 1 && labels[ny * thumbW + nx] === 0) {
                  labels[ny * thumbW + nx] = currentLabel;
                  queue.push(nx, ny);
                }
              }
            }
          }

          components.push({ label: currentLabel, size, minX, maxX, minY, maxY });
          currentLabel++;
        }
      }
    }

    components.sort((a, b) => b.size - a.size);

    // If a dominant component exists (> 3% of image area)
    if (components.length > 0 && components[0].size > thumbW * thumbH * 0.03) {
      const best = components[0];
      const pts: Array<{ x: number; y: number }> = [];
      for (let y = best.minY; y <= best.maxY; y++) {
        for (let x = best.minX; x <= best.maxX; x++) {
          if (labels[y * thumbW + x] === best.label) {
            pts.push({ x, y });
          }
        }
      }

      // Corners
      let minSum = Infinity, maxSum = -Infinity, minDiff = Infinity, maxDiff = -Infinity;
      let tl = { x: best.minX, y: best.minY };
      let br = { x: best.maxX, y: best.maxY };
      let tr = { x: best.maxX, y: best.minY };
      let bl = { x: best.minX, y: best.maxY };

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const sum = p.x + p.y;
        const diff = p.x - p.y;
        if (sum < minSum) { minSum = sum; tl = p; }
        if (sum > maxSum) { maxSum = sum; br = p; }
        if (diff > maxDiff) { maxDiff = diff; tr = p; }
        if (diff < minDiff) { minDiff = diff; bl = p; }
      }

      const invScale = 1 / scale;
      const detectedCorners: PerspectivePoints = {
        topLeft: { x: Math.max(0, Math.round(tl.x * invScale)), y: Math.max(0, Math.round(tl.y * invScale)) },
        topRight: { x: Math.min(w, Math.round(tr.x * invScale)), y: Math.max(0, Math.round(tr.y * invScale)) },
        bottomRight: { x: Math.min(w, Math.round(br.x * invScale)), y: Math.min(h, Math.round(br.y * invScale)) },
        bottomLeft: { x: Math.max(0, Math.round(bl.x * invScale)), y: Math.min(h, Math.round(bl.y * invScale)) },
      };

      // Tilt angles (top and left edges)
      const angleRadTop = Math.atan2(tr.y - tl.y, tr.x - tl.x);
      const angleDegTop = (angleRadTop * 180) / Math.PI;

      const angleRadLeft = Math.atan2(bl.y - tl.y, bl.x - tl.x);
      const angleDegLeft = (angleRadLeft * 180) / Math.PI - 90;

      const avgTilt = (angleDegTop + angleDegLeft) / 2;
      const deskewAngle = Math.round(-avgTilt * 10) / 10;
      const deskewRad = (deskewAngle * Math.PI) / 180;
      const cosD = Math.cos(deskewRad);
      const sinD = Math.sin(deskewRad);

      // Rotate corners around center to find the true upright crop box in deskewed space
      const aspect = w / h;
      const cornerList = [detectedCorners.topLeft, detectedCorners.topRight, detectedCorners.bottomRight, detectedCorners.bottomLeft];
      let rotMinX = 1, rotMaxX = 0, rotMinY = 1, rotMaxY = 0;

      for (const p of cornerList) {
        const nx = p.x / w;
        const ny = p.y / h;
        const dx = (nx - 0.5) * aspect;
        const dy = (ny - 0.5);
        const rx = dx * cosD - dy * sinD;
        const ry = dx * sinD + dy * cosD;
        const finalX = rx / aspect + 0.5;
        const finalY = ry + 0.5;

        if (finalX < rotMinX) rotMinX = finalX;
        if (finalX > rotMaxX) rotMaxX = finalX;
        if (finalY < rotMinY) rotMinY = finalY;
        if (finalY > rotMaxY) rotMaxY = finalY;
      }

      // Safe, generous margin padding (3.5% margin so emblem, logos, and laminate edges are NEVER cut)
      const padX = 0.035;
      const padY = 0.035;
      const normX = Math.max(0, rotMinX - padX);
      const normY = Math.max(0, rotMinY - padY);
      const normW = Math.min(1 - normX, (rotMaxX - rotMinX) + 2 * padX);
      const normH = Math.min(1 - normY, (rotMaxY - rotMinY) + 2 * padY);

      // Classify based on card/document dimensions
      const cardType = detectDocumentType(Math.round(normW * w), Math.round(normH * h));

      return {
        corners: detectedCorners,
        normalizedBox: { x: normX, y: normY, w: normW, h: normH },
        confidence: 0.95,
        detectedType: cardType,
        deskewDegrees: deskewAngle,
      };
    }
  } catch (err) {
    console.warn('Document detection fallback:', err);
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
    deskewDegrees: 0,
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
