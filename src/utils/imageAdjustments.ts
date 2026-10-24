import type { ImageAdjustments } from '../types';

/**
 * Applies brightness, contrast, exposure, saturation, sharpness, rotation, and photo filters
 */
export function applyAdjustments(
  inputCanvas: HTMLCanvasElement,
  adj: ImageAdjustments
): HTMLCanvasElement {
  const totalAngle = (adj.rotation + (adj.fineAngle || 0)) % 360;
  const radians = (totalAngle * Math.PI) / 180;

  const origW = inputCanvas.width;
  const origH = inputCanvas.height;

  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const rotW = Math.round(origW * cos + origH * sin);
  const rotH = Math.round(origW * sin + origH * cos);

  const stageCanvas = document.createElement('canvas');
  stageCanvas.width = rotW;
  stageCanvas.height = rotH;
  const ctx = stageCanvas.getContext('2d', { willReadFrequently: true })!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, rotW, rotH);

  ctx.save();
  ctx.translate(rotW / 2, rotH / 2);
  ctx.rotate(radians);
  ctx.drawImage(inputCanvas, -origW / 2, -origH / 2);
  ctx.restore();

  const imgData = ctx.getImageData(0, 0, rotW, rotH);
  const data = imgData.data;

  const bDelta = adj.brightness * 1.5;
  const cFactor = (259 * (adj.contrast * 1.5 + 255)) / (255 * (259 - adj.contrast * 1.5));
  const expFactor = Math.pow(2, adj.exposure / 50);
  const satFactor = (adj.saturation + 100) / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (adj.exposure !== 0) {
      r *= expFactor;
      g *= expFactor;
      b *= expFactor;
    }

    if (adj.brightness !== 0) {
      r += bDelta;
      g += bDelta;
      b += bDelta;
    }

    if (adj.contrast !== 0) {
      r = cFactor * (r - 128) + 128;
      g = cFactor * (g - 128) + 128;
      b = cFactor * (b - 128) + 128;
    }

    if (adj.saturation !== 0) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * satFactor;
      g = gray + (g - gray) * satFactor;
      b = gray + (g - gray) * satFactor;
    }

    if (adj.filter === 'grayscale') {
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      r = gray;
      g = gray;
      b = gray;
    } else if (adj.filter === 'scan_bw') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      if (gray > 140) {
        r = 255;
        g = 255;
        b = 255;
      } else {
        const darkVal = Math.max(0, (gray - 15) * 1.25);
        r = darkVal;
        g = darkVal;
        b = darkVal;
      }
    } else if (adj.filter === 'auto_enhance') {
      r = Math.min(255, (r - 10) * 1.15 + 10);
      g = Math.min(255, (g - 10) * 1.15 + 10);
      b = Math.min(255, (b - 10) * 1.15 + 10);
    } else if (adj.filter === 'id_pop') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = Math.min(255, gray + (r - gray) * 1.35 + 8);
      g = Math.min(255, gray + (g - gray) * 1.35 + 8);
      b = Math.min(255, gray + (g - gray) * 1.35 + 8);
    }

    data[i] = Math.min(255, Math.max(0, Math.round(r)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(b)));
  }

  ctx.putImageData(imgData, 0, 0);

  if (adj.sharpness > 0) {
    const sharpCanvas = document.createElement('canvas');
    sharpCanvas.width = rotW;
    sharpCanvas.height = rotH;
    const sharpCtx = sharpCanvas.getContext('2d', { willReadFrequently: true })!;
    const srcCopy = ctx.getImageData(0, 0, rotW, rotH);
    const sharpData = sharpCtx.createImageData(rotW, rotH);
    const srcP = srcCopy.data;
    const dstP = sharpData.data;

    const amount = (adj.sharpness / 100) * 0.75;

    for (let y = 1; y < rotH - 1; y++) {
      for (let x = 1; x < rotW - 1; x++) {
        const idx = (y * rotW + x) * 4;
        const up = ((y - 1) * rotW + x) * 4;
        const down = ((y + 1) * rotW + x) * 4;
        const left = (y * rotW + (x - 1)) * 4;
        const right = (y * rotW + (x + 1)) * 4;

        for (let c = 0; c < 3; c++) {
          const val =
            srcP[idx + c] * (1 + 4 * amount) -
            (srcP[up + c] + srcP[down + c] + srcP[left + c] + srcP[right + c]) * amount;
          dstP[idx + c] = Math.min(255, Math.max(0, Math.round(val)));
        }
        dstP[idx + 3] = srcP[idx + 3];
      }
    }
    sharpCtx.putImageData(sharpData, 0, 0);
    return sharpCanvas;
  }

  return stageCanvas;
}
