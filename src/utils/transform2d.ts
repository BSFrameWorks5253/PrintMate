import type { Point } from '../types';

/**
 * Rotates an image or canvas by degrees (90, 180, 270)
 */
export function rotateCanvas(
  source: HTMLCanvasElement | HTMLImageElement,
  angleDeg: number
): HTMLCanvasElement {
  const normDeg = ((angleDeg % 360) + 360) % 360;
  const srcW = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const srcH = 'naturalHeight' in source ? source.naturalHeight : source.height;

  const isPerp = normDeg === 90 || normDeg === 270;
  const dstW = isPerp ? srcH : srcW;
  const dstH = isPerp ? srcW : srcH;

  const canvas = document.createElement('canvas');
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext('2d')!;

  ctx.translate(dstW / 2, dstH / 2);
  ctx.rotate((normDeg * Math.PI) / 180);
  ctx.drawImage(source, -srcW / 2, -srcH / 2);

  return canvas;
}

/**
 * Transforms a point when an image of (srcW, srcH) is rotated by angleDeg (90, -90, 180)
 */
export function rotatePoint(p: Point, srcW: number, srcH: number, angleDeg: number): Point {
  const normDeg = ((angleDeg % 360) + 360) % 360;
  if (normDeg === 90) {
    return { x: srcH - 1 - p.y, y: p.x };
  } else if (normDeg === 180) {
    return { x: srcW - 1 - p.x, y: srcH - 1 - p.y };
  } else if (normDeg === 270) {
    return { x: p.y, y: srcW - 1 - p.x };
  }
  return { ...p };
}

/**
 * Cyclically shifts corner pins by 90 degrees clockwise or counter-clockwise
 */
export function rotateCornersCyclic(
  corners: [Point, Point, Point, Point],
  direction: 'cw' | 'ccw'
): [Point, Point, Point, Point] {
  const [c0, c1, c2, c3] = corners;
  return direction === 'cw'
    ? [c3, c0, c1, c2] // [bl, tl, tr, br] -> rotated 90 CW
    : [c1, c2, c3, c0]; // [tr, br, bl, tl] -> rotated 90 CCW
}
