import type { Point } from '../types';

/**
 * Robust cyclic corner ordering:
 * Orders 4 points clockwise starting from Top-Left
 */
export function orderCorners(pts: Point[]): [Point, Point, Point, Point] {
  if (pts.length !== 4) {
    throw new Error('Must provide exactly 4 points');
  }

  // 1. Calculate centroid
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;

  // 2. Sort points by polar angle relative to centroid (clockwise)
  const sorted = [...pts].sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx);
    const angleB = Math.atan2(b.y - cy, b.x - cx);
    return angleA - angleB;
  });

  // 3. Find the corner closest to Top-Left (minimizing x + 1.3*y)
  let bestIdx = 0;
  let minScore = Infinity;

  sorted.forEach((p, i) => {
    const score = p.x + p.y * 1.3;
    if (score < minScore) {
      minScore = score;
      bestIdx = i;
    }
  });

  // 4. Shift array so bestIdx is index 0 (Top-Left), then TR, BR, BL
  const tl = sorted[bestIdx];
  const tr = sorted[(bestIdx + 1) % 4];
  const br = sorted[(bestIdx + 2) % 4];
  const bl = sorted[(bestIdx + 3) % 4];

  return [tl, tr, br, bl];
}

/**
 * Finds the minimum area rotated bounding box for an array of points
 */
export function findMinimumBoundingBox(points: Point[]): { corners: Point[]; angle: number } {
  if (points.length === 0) {
    return { corners: [], angle: 0 };
  }

  // Subsample for high speed
  const pts: Point[] = [];
  const step = Math.max(1, Math.floor(points.length / 500));
  for (let i = 0; i < points.length; i += step) {
    pts.push(points[i]);
  }

  let minArea = Infinity;
  let bestAngle = 0;
  let bestBox: Point[] = [];

  for (let deg = -89; deg <= 90; deg += 1) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const u = p.x * cos + p.y * sin;
      const v = -p.x * sin + p.y * cos;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }

    const area = (maxU - minU) * (maxV - minV);
    if (area < minArea) {
      minArea = area;
      bestAngle = rad;

      bestBox = [
        { x: minU * cos - minV * sin, y: minU * sin + minV * cos },
        { x: maxU * cos - minV * sin, y: maxU * sin + minV * cos },
        { x: maxU * cos - maxV * sin, y: maxU * sin + maxV * cos },
        { x: minU * cos - maxV * sin, y: minU * sin + maxV * cos },
      ];
    }
  }

  return { corners: bestBox, angle: bestAngle };
}

/**
 * High-Precision Document & ID Card Boundary Detector
 * Combines Adaptive Local Contrast (via Integral Image Box Filtering) to overcome
 * uneven lighting, shadows, floor reflections, and glare, plus Otsu Thresholding,
 * 3x3 Morphological Erosion, Connected Component Labeling, and Minimum Area Rotated Bounding Boxes.
 */
/**
 * High-Precision Document & ID Card Boundary Detector
 * Combines Multi-Radius Adaptive Local Contrast (via Integral Image Box Filtering) to overcome
 * uneven lighting, shadows, floor reflections, and glare. Features automatic background edge rejection
 * so light cards on light/marble floors and desks are detected reliably.
 */
export function autoDetectDocumentCorners(
  img: HTMLImageElement | HTMLCanvasElement,
  detectMode: 'auto' | 'inner_card' | 'outer_border' = 'auto'
): [Point, Point, Point, Point] {
  const origW = 'naturalWidth' in img ? img.naturalWidth : img.width;
  const origH = 'naturalHeight' in img ? img.naturalHeight : img.height;

  // 1. Downscale to max dimension 450px for fast, responsive calculation (< 15ms)
  const maxDim = 450;
  const scale = Math.min(1, maxDim / Math.max(origW, origH));
  const w = Math.round(origW * scale);
  const h = Math.round(origH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return defaultInsetCorners(origW, origH);

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 2. Grayscale conversion
  const rawGray = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i += 4) {
    rawGray[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  // 3. Build Integral Image for instant O(1) box-mean filtering
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += rawGray[y * w + x];
      integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + rowSum;
    }
  }

  const getLocalMean = (x: number, y: number, radius: number): number => {
    const x0 = Math.max(0, x - radius);
    const y0 = Math.max(0, y - radius);
    const x1 = Math.min(w - 1, x + radius);
    const y1 = Math.min(h - 1, y + radius);
    const count = (x1 - x0 + 1) * (y1 - y0 + 1);
    const sum =
      integral[(y1 + 1) * (w + 1) + (x1 + 1)] -
      integral[y0 * (w + 1) + (x1 + 1)] -
      integral[(y1 + 1) * (w + 1) + x0] +
      integral[y0 * (w + 1) + x0];
    return sum / count;
  };

  // 4. Sobel Edge Gradient Magnitude
  const edges = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -rawGray[(y - 1) * w + (x - 1)] + rawGray[(y - 1) * w + (x + 1)]
        - 2 * rawGray[y * w + (x - 1)] + 2 * rawGray[y * w + (x + 1)]
        - rawGray[(y + 1) * w + (x - 1)] + rawGray[(y + 1) * w + (x + 1)];
      const gy =
        -rawGray[(y - 1) * w + (x - 1)] - 2 * rawGray[(y - 1) * w + x] - rawGray[(y - 1) * w + (x + 1)]
        + rawGray[(y + 1) * w + (x - 1)] + 2 * rawGray[(y + 1) * w + x] + rawGray[(y + 1) * w + (x + 1)];
      edges[y * w + x] = Math.hypot(gx, gy);
    }
  }

  // 5. Generate Multi-Strategy Candidate Binary Masks
  const masks: { name: string; mask: Uint8Array }[] = [];

  // Strategy A: Adaptive Local Contrast with 6% window (tight card contours)
  const rad1 = Math.max(10, Math.round(w * 0.06));
  const m1 = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (rawGray[idx] > getLocalMean(x, y, rad1) + 4) m1[idx] = 1;
    }
  }
  masks.push({ name: 'Adaptive-6%', mask: m1 });

  // Strategy B: Adaptive Local Contrast with 12% window (broad card interior on floor)
  const rad2 = Math.max(16, Math.round(w * 0.12));
  const m2 = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (rawGray[idx] > getLocalMean(x, y, rad2) + 6) m2[idx] = 1;
    }
  }
  masks.push({ name: 'Adaptive-12%', mask: m2 });

  // Strategy C: Inverted Local Contrast (for darker cards on lighter desk or dark background)
  const m3 = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (rawGray[idx] < getLocalMean(x, y, rad2) - 6) m3[idx] = 1;
    }
  }
  masks.push({ name: 'Adaptive-Inv', mask: m3 });

  // Strategy D: Sobel Edge dilated mask (captures plastic lamination perimeter)
  const edgeDilated = new Uint8Array(w * h);
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      if (edges[y * w + x] > 35) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            edgeDilated[(y + dy) * w + (x + dx)] = 1;
          }
        }
      }
    }
  }
  masks.push({ name: 'EdgeDilated', mask: edgeDilated });

  // 6. Evaluate Components across masks with background border-touch rejection
  const candidates: {
    bbox: { corners: Point[]; angle: number };
    score: number;
    areaFraction: number;
    aspectRatio: number;
  }[] = [];

  for (const { mask } of masks) {
    // 3x3 Morphological cleanup
    const cleanMask = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (
          mask[y * w + x] &&
          mask[(y - 1) * w + x] &&
          mask[(y + 1) * w + x] &&
          mask[y * w + (x - 1)] &&
          mask[y * w + (x + 1)]
        ) {
          cleanMask[y * w + x] = 1;
        }
      }
    }

    // Connected Component Analysis (BFS)
    const visited = new Uint8Array(w * h);
    const minPixels = Math.round(w * h * 0.025); // At least 2.5% of photo
    const maxPixels = Math.round(w * h * 0.70);  // Cards never exceed 70% of frame

    for (let y = 3; y < h - 3; y += 2) {
      for (let x = 3; x < w - 3; x += 2) {
        const rootIdx = y * w + x;
        if (!cleanMask[rootIdx] || visited[rootIdx]) continue;

        const compPoints: Point[] = [];
        const queue: number[] = [rootIdx];
        visited[rootIdx] = 1;

        let qHead = 0;
        let compMinX = x, compMaxX = x, compMinY = y, compMaxY = y;
        let touchesBorder = 0;

        while (qHead < queue.length) {
          const curr = queue[qHead++];
          const cx = curr % w;
          const cy = Math.floor(curr / w);

          compPoints.push({ x: cx, y: cy });
          if (cx < compMinX) compMinX = cx;
          if (cx > compMaxX) compMaxX = cx;
          if (cy < compMinY) compMinY = cy;
          if (cy > compMaxY) compMaxY = cy;

          // Check if touches outer frame boundaries
          if (cx <= 2 || cx >= w - 3 || cy <= 2 || cy >= h - 3) {
            touchesBorder++;
          }

          const neighbors = [curr - 1, curr + 1, curr - w, curr + w];
          for (let n = 0; n < 4; n++) {
            const nb = neighbors[n];
            if (nb >= 0 && nb < w * h && !visited[nb] && cleanMask[nb]) {
              visited[nb] = 1;
              queue.push(nb);
            }
          }
        }

        // CRITICAL: Reject components touching outer frame borders (floor / table background)
        if (touchesBorder > 10) continue;

        if (compPoints.length >= minPixels && compPoints.length <= maxPixels) {
          const bbox = findMinimumBoundingBox(compPoints);
          if (bbox.corners.length === 4) {
            const side1 = Math.hypot(bbox.corners[1].x - bbox.corners[0].x, bbox.corners[1].y - bbox.corners[0].y);
            const side2 = Math.hypot(bbox.corners[2].x - bbox.corners[1].x, bbox.corners[2].y - bbox.corners[1].y);
            const longSide = Math.max(side1, side2);
            const shortSide = Math.min(side1, side2);
            const ratio = shortSide > 0 ? longSide / shortSide : 1;

            const area = side1 * side2;
            const areaFraction = area / (w * h);

            if (areaFraction >= 0.03 && areaFraction <= 0.70) {
              // Standard ID card ratio (CR80: 85.6mm / 53.98mm = 1.586) or A4 ratio (1.414)
              const idRatioScore = 1.0 - Math.min(1.0, Math.abs(ratio - 1.586) / 0.5);
              const paperRatioScore = 1.0 - Math.min(1.0, Math.abs(ratio - 1.414) / 0.5);
              const aspectScore = Math.max(idRatioScore, paperRatioScore);

              // Ideal card size in photo: ~15% - 30% of total image area
              const idealArea = 0.20;
              const areaScore = 1.0 - Math.min(1.0, Math.abs(areaFraction - idealArea) / 0.35);

              // Distance from image center
              const compCx = (compMinX + compMaxX) / 2;
              const compCy = (compMinY + compMaxY) / 2;
              const distFromCenter = Math.hypot(compCx - w / 2, compCy - h / 2) / Math.hypot(w / 2, h / 2);
              const centerScore = Math.max(0, 1.0 - distFromCenter);

              // Component solidity
              const solidity = Math.min(1.0, compPoints.length / (area + 1));

              const totalScore =
                aspectScore * 0.40 +
                areaScore * 0.25 +
                centerScore * 0.20 +
                solidity * 0.15;

              candidates.push({
                bbox,
                score: totalScore,
                areaFraction,
                aspectRatio: ratio,
              });
            }
          }
        }
      }
    }
  }

  // 7. Select best scored candidate
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const invScale = 1.0 / scale;

    let finalCorners = best.bbox.corners.map((p) => ({
      x: Math.round(Math.max(0, Math.min(origW, p.x * invScale))),
      y: Math.round(Math.max(0, Math.min(origH, p.y * invScale))),
    })) as [Point, Point, Point, Point];

    const cx = (finalCorners[0].x + finalCorners[1].x + finalCorners[2].x + finalCorners[3].x) / 4;
    const cy = (finalCorners[0].y + finalCorners[1].y + finalCorners[2].y + finalCorners[3].y) / 4;

    // Handle modes: outer border expands slightly for clear lamination pouches
    if (detectMode === 'outer_border') {
      finalCorners = finalCorners.map((p) => ({
        x: Math.round(Math.max(0, Math.min(origW, cx + (p.x - cx) * 1.08))),
        y: Math.round(Math.max(0, Math.min(origH, cy + (p.y - cy) * 1.08))),
      })) as [Point, Point, Point, Point];
    } else if (detectMode === 'inner_card') {
      finalCorners = finalCorners.map((p) => ({
        x: Math.round(Math.max(0, Math.min(origW, cx + (p.x - cx) * 0.98))),
        y: Math.round(Math.max(0, Math.min(origH, cy + (p.y - cy) * 0.98))),
      })) as [Point, Point, Point, Point];
    }

    return orderCorners(finalCorners);
  }

  // 8. Fallback: Center-weighted card box
  return defaultCenterCardCorners(origW, origH);
}

export function defaultCenterCardCorners(origW: number, origH: number): [Point, Point, Point, Point] {
  const cx = origW / 2;
  const cy = origH / 2;
  const isLandscape = origW >= origH;
  const cardW = isLandscape ? Math.round(origW * 0.55) : Math.round(origW * 0.65);
  const cardH = Math.round(cardW / 1.586);

  return [
    { x: Math.round(cx - cardW / 2), y: Math.round(cy - cardH / 2) },
    { x: Math.round(cx + cardW / 2), y: Math.round(cy - cardH / 2) },
    { x: Math.round(cx + cardW / 2), y: Math.round(cy + cardH / 2) },
    { x: Math.round(cx - cardW / 2), y: Math.round(cy + cardH / 2) },
  ];
}

export function defaultInsetCorners(w: number, h: number): [Point, Point, Point, Point] {
  const insetX = Math.round(w * 0.08);
  const insetY = Math.round(h * 0.08);
  return [
    { x: insetX, y: insetY },
    { x: w - insetX, y: insetY },
    { x: w - insetX, y: h - insetY },
    { x: insetX, y: h - insetY },
  ];
}

/**
 * Interactive "Tap on Card to Snap" Feature
 * When user taps/clicks on their card, expands with adaptive edge barriers
 * and fits 4 corners directly to the tapped card in milliseconds!
 */
export function snapCornersToClickPoint(
  img: HTMLImageElement | HTMLCanvasElement,
  clickX: number,
  clickY: number
): [Point, Point, Point, Point] | null {
  const origW = 'naturalWidth' in img ? img.naturalWidth : img.width;
  const origH = 'naturalHeight' in img ? img.naturalHeight : img.height;

  const maxDim = 400;
  const scale = Math.min(1, maxDim / Math.max(origW, origH));
  const w = Math.round(origW * scale);
  const h = Math.round(origH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const gray = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  // Compute Sobel gradients to form hard barriers at card boundaries
  // Use adaptive gradient threshold (35) suitable for low contrast cards on light floors
  const edges = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -gray[(y - 1) * w + (x - 1)] + gray[(y - 1) * w + (x + 1)]
        - 2 * gray[y * w + (x - 1)] + 2 * gray[y * w + (x + 1)]
        - gray[(y + 1) * w + (x - 1)] + gray[(y + 1) * w + (x + 1)];
      const gy =
        -gray[(y - 1) * w + (x - 1)] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + (x + 1)]
        + gray[(y + 1) * w + (x - 1)] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + (x + 1)];
      if (Math.hypot(gx, gy) > 35) {
        edges[y * w + x] = 1;
      }
    }
  }

  const seedX = Math.round(Math.max(2, Math.min(w - 3, clickX * scale)));
  const seedY = Math.round(Math.max(2, Math.min(h - 3, clickY * scale)));

  let startX = seedX;
  let startY = seedY;
  if (edges[seedY * w + seedX] === 1) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (!edges[(seedY + dy) * w + (seedX + dx)]) {
          startX = seedX + dx;
          startY = seedY + dy;
          break;
        }
      }
    }
  }

  const visited = new Uint8Array(w * h);
  const queue = [startY * w + startX];
  visited[startY * w + startX] = 1;
  const points: Point[] = [];

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const x = curr % w;
    const y = Math.floor(curr / w);
    points.push({ x, y });

    const nbs = [curr - 1, curr + 1, curr - w, curr + w];
    for (let i = 0; i < 4; i++) {
      const n = nbs[i];
      if (n >= 0 && n < w * h && !visited[n] && edges[n] === 0) {
        visited[n] = 1;
        queue.push(n);
      }
    }
  }

  if (points.length >= (w * h * 0.02) && points.length <= (w * h * 0.75)) {
    const bbox = findMinimumBoundingBox(points);
    if (bbox.corners.length === 4) {
      const invScale = 1.0 / scale;
      const scaled = bbox.corners.map((p) => ({
        x: Math.round(Math.max(0, Math.min(origW, p.x * invScale))),
        y: Math.round(Math.max(0, Math.min(origH, p.y * invScale))),
      })) as [Point, Point, Point, Point];
      return orderCorners(scaled);
    }
  }

  return autoDetectDocumentCorners(img, 'auto');
}
