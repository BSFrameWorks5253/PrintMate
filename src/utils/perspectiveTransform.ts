import type { Point } from '../types';

/**
 * Solves an 8x8 linear equation system via Gaussian elimination with partial pivoting.
 */
export function solveGaussian(A: number[][], B: number[]): number[] {
  const n = 8;
  const M: number[][] = [];
  for (let i = 0; i < n; i++) {
    M.push([...A[i], B[i]]);
  }

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    if (Math.abs(M[i][i]) < 1e-12) continue;

    for (let k = i + 1; k < n; k++) {
      const c = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) {
        if (i === j) M[k][j] = 0;
        else M[k][j] -= c * M[i][j];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = Math.abs(M[i][i]) > 1e-12 ? sum / M[i][i] : 0;
  }

  return x;
}

/**
 * Computes 3x3 homography matrix mapping src quadrilateral to dst rectangle
 */
export function getPerspectiveTransform(src: [Point, Point, Point, Point], dst: [Point, Point, Point, Point]): number[] {
  const A: number[][] = [];
  const B: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = src[i].x;
    const sy = src[i].y;
    const dx = dst[i].x;
    const dy = dst[i].y;

    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    B.push(dx);

    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    B.push(dy);
  }

  const h = solveGaussian(A, B);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1.0];
}

/**
 * Inverts a 3x3 matrix
 */
export function invert3x3(m: number[]): number[] {
  const a = m[0], b = m[1], c = m[2];
  const d = m[3], e = m[4], f = m[5];
  const g = m[6], h = m[7], i = m[8];

  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const D = -(b * i - c * h);
  const E = a * i - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const H = -(a * f - c * d);
  const I = a * e - b * d;

  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) {
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }

  const invDet = 1.0 / det;
  return [
    A * invDet, D * invDet, G * invDet,
    B * invDet, E * invDet, H * invDet,
    C * invDet, F * invDet, I * invDet
  ];
}

/**
 * Perspective unwarp (deskew / straighten / crop background)
 * Uses high-quality bilinear interpolation for crisp text and clean edges.
 */
export function warpPerspectiveCrop(
  sourceCanvasOrImage: HTMLCanvasElement | HTMLImageElement,
  corners: [Point, Point, Point, Point],
  targetAspectRatio?: number,
  outputMaxDimension: number = 2000,
  aspectMode: 'standard' | 'portrait' | 'free' = 'standard'
): HTMLCanvasElement {
  let [tl, tr, br, bl] = corners;

  let topW = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  let botW = Math.hypot(br.x - bl.x, br.y - bl.y);
  let leftH = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  let rightH = Math.hypot(br.x - tr.x, br.y - tr.y);

  let avgW = (topW + botW) / 2;
  let avgH = (leftH + rightH) / 2;

  // If standard ID card mode is requested, ensure the card unwarps in horizontal Landscape
  // If the photo was clicked vertically (avgW < avgH), cyclically shift corners so long side becomes width!
  if (aspectMode === 'standard') {
    if (avgW < avgH) {
      // Rotate 90° clockwise so vertical becomes horizontal with proper upright top:
      // [bl, tl, tr, br] maps old left side to new top side
      const rotated: [Point, Point, Point, Point] = [bl, tl, tr, br];
      tl = rotated[0];
      tr = rotated[1];
      br = rotated[2];
      bl = rotated[3];

      topW = Math.hypot(tr.x - tl.x, tr.y - tl.y);
      botW = Math.hypot(br.x - bl.x, br.y - bl.y);
      leftH = Math.hypot(bl.x - tl.x, bl.y - tl.y);
      rightH = Math.hypot(br.x - tr.x, br.y - tr.y);
      avgW = (topW + botW) / 2;
      avgH = (leftH + rightH) / 2;
    }
  } else if (aspectMode === 'portrait') {
    if (avgW > avgH) {
      // Rotate 90 deg counter-clockwise: tr becomes tl, br becomes tr, bl becomes br, tl becomes bl
      const rotated: [Point, Point, Point, Point] = [tr, br, bl, tl];
      tl = rotated[0];
      tr = rotated[1];
      br = rotated[2];
      bl = rotated[3];

      topW = Math.hypot(tr.x - tl.x, tr.y - tl.y);
      botW = Math.hypot(br.x - bl.x, br.y - bl.y);
      leftH = Math.hypot(bl.x - tl.x, bl.y - tl.y);
      rightH = Math.hypot(br.x - tr.x, br.y - tr.y);
      avgW = (topW + botW) / 2;
      avgH = (leftH + rightH) / 2;
    }
  }

  let targetW = Math.round(Math.max(topW, botW));
  let targetH = Math.round(Math.max(leftH, rightH));

  if (targetAspectRatio && targetAspectRatio > 0) {
    let ratio = targetAspectRatio;
    if (aspectMode === 'standard') {
      ratio = Math.max(targetAspectRatio, 1 / targetAspectRatio); // Always horizontal landscape >= 1
    } else if (aspectMode === 'portrait') {
      ratio = Math.min(targetAspectRatio, 1 / targetAspectRatio); // Always vertical portrait <= 1
    } else {
      const isLandscape = avgW >= avgH;
      ratio = isLandscape
        ? Math.max(targetAspectRatio, 1 / targetAspectRatio)
        : Math.min(targetAspectRatio, 1 / targetAspectRatio);
    }
    targetH = Math.round(targetW / ratio);
  }

  if (Math.max(targetW, targetH) > outputMaxDimension) {
    const scale = outputMaxDimension / Math.max(targetW, targetH);
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }

  targetW = Math.max(120, targetW);
  targetH = Math.max(120, targetH);

  let srcCanvas: HTMLCanvasElement;
  let srcCtx: CanvasRenderingContext2D;
  const srcW = 'naturalWidth' in sourceCanvasOrImage ? sourceCanvasOrImage.naturalWidth : sourceCanvasOrImage.width;
  const srcH = 'naturalHeight' in sourceCanvasOrImage ? sourceCanvasOrImage.naturalHeight : sourceCanvasOrImage.height;

  if (sourceCanvasOrImage instanceof HTMLCanvasElement) {
    srcCanvas = sourceCanvasOrImage;
    srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })!;
  } else {
    srcCanvas = document.createElement('canvas');
    srcCanvas.width = srcW;
    srcCanvas.height = srcH;
    srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })!;
    srcCtx.drawImage(sourceCanvasOrImage, 0, 0);
  }

  const srcImgData = srcCtx.getImageData(0, 0, srcW, srcH);
  const srcPixels = srcImgData.data;

  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = targetW;
  dstCanvas.height = targetH;
  const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true })!;
  const dstImgData = dstCtx.createImageData(targetW, targetH);
  const dstPixels = dstImgData.data;

  const dstCorners: [Point, Point, Point, Point] = [
    { x: 0, y: 0 },
    { x: targetW - 1, y: 0 },
    { x: targetW - 1, y: targetH - 1 },
    { x: 0, y: targetH - 1 },
  ];

  const H_forward = getPerspectiveTransform([tl, tr, br, bl], dstCorners);
  const H_inv = invert3x3(H_forward);

  const h0 = H_inv[0], h1 = H_inv[1], h2 = H_inv[2];
  const h3 = H_inv[3], h4 = H_inv[4], h5 = H_inv[5];
  const h6 = H_inv[6], h7 = H_inv[7], h8 = H_inv[8];

  const maxSrcX = srcW - 1;
  const maxSrcY = srcH - 1;

  for (let dy = 0; dy < targetH; dy++) {
    const rowIdx = dy * targetW * 4;
    for (let dx = 0; dx < targetW; dx++) {
      const denom = h6 * dx + h7 * dy + h8;
      if (Math.abs(denom) < 1e-10) continue;
      const invDenom = 1.0 / denom;

      const sx = (h0 * dx + h1 * dy + h2) * invDenom;
      const sy = (h3 * dx + h4 * dy + h5) * invDenom;

      if (sx < 0 || sx > maxSrcX || sy < 0 || sy > maxSrcY) {
        continue;
      }

      // Bilinear interpolation
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, maxSrcX);
      const y1 = Math.min(y0 + 1, maxSrcY);

      const fx = sx - x0;
      const fy = sy - y0;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const i00 = (y0 * srcW + x0) * 4;
      const i10 = (y0 * srcW + x1) * 4;
      const i01 = (y1 * srcW + x0) * 4;
      const i11 = (y1 * srcW + x1) * 4;

      const dIdx = rowIdx + dx * 4;

      dstPixels[dIdx] = Math.round(
        srcPixels[i00] * w00 +
        srcPixels[i10] * w10 +
        srcPixels[i01] * w01 +
        srcPixels[i11] * w11
      );
      dstPixels[dIdx + 1] = Math.round(
        srcPixels[i00 + 1] * w00 +
        srcPixels[i10 + 1] * w10 +
        srcPixels[i01 + 1] * w01 +
        srcPixels[i11 + 1] * w11
      );
      dstPixels[dIdx + 2] = Math.round(
        srcPixels[i00 + 2] * w00 +
        srcPixels[i10 + 2] * w10 +
        srcPixels[i01 + 2] * w01 +
        srcPixels[i11 + 2] * w11
      );
      dstPixels[dIdx + 3] = 255;
    }
  }

  dstCtx.putImageData(dstImgData, 0, 0);
  return dstCanvas;
}
