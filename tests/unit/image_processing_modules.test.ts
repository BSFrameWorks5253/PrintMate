import { describe, it, expect } from 'vitest';
import {
  // Crop Module
  calculateAspectCrop,
  applyCropToCanvas,
  CROP_ASPECT_PRESETS,
  // Alignment Module
  applyRotationAndFlip,
  detectDocumentSkew,
  detectDocumentCorners,
  warpPerspective,
  // Tone Setter Module
  getLuminance,
  adjustBrightness,
  adjustContrast,
  adjustSaturation,
  applyToneAdjustments,
  // Document Enhancement Module
  applyTextDarkening,
  applySharpen,
  applyBackgroundReplacement,
  // Pipeline Module
  createDefaultEdits,
  renderProcessedCanvas,
} from '../../src/utils/image-processing';

/**
 * Lightweight mock Canvas & Context2D for node environment
 */
function createMockCanvas(initialW = 400, initialH = 300) {
  let w = initialW;
  let h = initialH;
  let buffer = new Uint8ClampedArray(w * h * 4);

  const canvasObj = {
    get width() { return w; },
    set width(val: number) {
      w = val;
      buffer = new Uint8ClampedArray(w * h * 4);
    },
    get height() { return h; },
    set height(val: number) {
      h = val;
      buffer = new Uint8ClampedArray(w * h * 4);
    },
    getContext: () => ({
      get canvas() { return canvasObj; },
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      drawImage: () => {},
      clearRect: () => {},
      createImageData: (imgW: number, imgH: number) => ({
        width: imgW,
        height: imgH,
        data: new Uint8ClampedArray(imgW * imgH * 4),
      }),
      getImageData: (x: number, y: number, imgW: number, imgH: number) => ({
        width: imgW,
        height: imgH,
        data: buffer.length === imgW * imgH * 4 ? buffer : new Uint8ClampedArray(imgW * imgH * 4),
      }),
      putImageData: (imgData: { data: Uint8ClampedArray }) => {
        if (buffer.length !== imgData.data.length) {
          buffer = new Uint8ClampedArray(imgData.data.length);
        }
        buffer.set(imgData.data);
      },
    }),
  };

  return canvasObj as unknown as HTMLCanvasElement;
}

if (typeof document === 'undefined') {
  (global as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return createMockCanvas(400, 300);
      }
      return {};
    },
  };
}

describe('Modular Image Processing System', () => {
  describe('1. Crop Module (crop.ts)', () => {
    it('defines standard print aspect presets', () => {
      expect(CROP_ASPECT_PRESETS.PASSPORT.ratio).toBeCloseTo(35 / 45, 3);
      expect(CROP_ASPECT_PRESETS.STAMP.ratio).toBeCloseTo(20 / 25, 3);
      expect(CROP_ASPECT_PRESETS.ID_CARD.ratio).toBeCloseTo(85.6 / 54, 3);
      expect(CROP_ASPECT_PRESETS.SQUARE.ratio).toBe(1);
      expect(CROP_ASPECT_PRESETS.PHOTO_4X6.ratio).toBe(1.5);
      expect(CROP_ASPECT_PRESETS.A4_DOCUMENT.ratio).toBeCloseTo(210 / 297, 3);
    });

    it('calculates aspect crops within [0, 1] normalized boundaries', () => {
      const passportCrop = calculateAspectCrop(35 / 45);
      expect(passportCrop.x).toBeGreaterThanOrEqual(0);
      expect(passportCrop.y).toBeGreaterThanOrEqual(0);
      expect(passportCrop.w).toBeLessThanOrEqual(1);
      expect(passportCrop.h).toBeLessThanOrEqual(1);
      expect(passportCrop.w / passportCrop.h).toBeCloseTo(35 / 45, 3);
    });

    it('returns uncropped canvas when crop coordinates are null or invalid', () => {
      const canvas = createMockCanvas(500, 400);
      const result = applyCropToCanvas(canvas, null, null, null, null);
      expect(result.width).toBe(500);
      expect(result.height).toBe(400);
    });

    it('slices target pixel box correctly when valid normalized crop is provided', () => {
      const canvas = createMockCanvas(1000, 1000);
      const cropped = applyCropToCanvas(canvas, 0.1, 0.2, 0.5, 0.4);
      expect(cropped.width).toBe(500);
      expect(cropped.height).toBe(400);
    });
  });

  describe('2. Alignment & Geometry Module (alignment.ts)', () => {
    it('calculates deskew angle inverted for straightening', () => {
      const canvas = createMockCanvas(300, 300);
      const skew = detectDocumentSkew(canvas);
      expect(typeof skew).toBe('number');
      expect(skew).toBeGreaterThanOrEqual(-15);
      expect(skew).toBeLessThanOrEqual(15);
    });

    it('detects document corners within canvas bounds', () => {
      const canvas = createMockCanvas(800, 1200);
      const corners = detectDocumentCorners(canvas);
      expect(corners.topLeft.x).toBeGreaterThanOrEqual(0);
      expect(corners.topLeft.y).toBeGreaterThanOrEqual(0);
      expect(corners.topRight.x).toBeLessThanOrEqual(800);
      expect(corners.bottomRight.y).toBeLessThanOrEqual(1200);
      expect(corners.bottomLeft.x).toBeLessThan(corners.bottomRight.x);
      expect(corners.topLeft.y).toBeLessThan(corners.bottomLeft.y);
    });

    it('warps perspective region to desired target dimension', () => {
      const canvas = createMockCanvas(1000, 1000);
      const corners = {
        topLeft: { x: 50, y: 50 },
        topRight: { x: 950, y: 50 },
        bottomRight: { x: 950, y: 950 },
        bottomLeft: { x: 50, y: 950 },
      };
      const result = warpPerspective(canvas, corners, 500, 500);
      expect(result.width).toBe(500);
      expect(result.height).toBe(500);
    });
  });

  describe('3. Tone Setter Module (tone-setter.ts)', () => {
    it('calculates perceptual luminance according to BT.601 standard', () => {
      const whiteLum = getLuminance(255, 255, 255);
      expect(whiteLum).toBeCloseTo(255, 1);

      const blackLum = getLuminance(0, 0, 0);
      expect(blackLum).toBe(0);

      // Green has the highest perceptual weight (~0.587)
      const greenLum = getLuminance(0, 255, 0);
      const redLum = getLuminance(255, 0, 0);
      const blueLum = getLuminance(0, 0, 255);
      expect(greenLum).toBeGreaterThan(redLum);
      expect(redLum).toBeGreaterThan(blueLum);
    });

    it('adjusts brightness and contrast linearly', () => {
      expect(adjustBrightness(100, 0.2)).toBe(100 + 0.2 * 255);
      expect(adjustContrast(128, 1.5)).toBe(128); // Midpoint stays 128
      expect(adjustContrast(200, 1.5)).toBe((200 - 128) * 1.5 + 128);
    });

    it('applies tone adjustments batch to pixel buffer', () => {
      // 2 pixels: pixel 1 gray (128), pixel 2 white (255)
      const data = new Uint8ClampedArray([
        128, 128, 128, 255,
        200, 200, 200, 255,
      ]);

      applyToneAdjustments(data, 0.1, 1.0, 1.0, false);
      expect(data[0]).toBeGreaterThan(128); // Brightened
      expect(data[4]).toBeGreaterThan(200);
    });

    it('converts pixels to neutral grayscale when grayscale is enabled', () => {
      const data = new Uint8ClampedArray([
        255, 0, 0, 255, // Pure red
      ]);

      applyToneAdjustments(data, 0, 1.0, 1.0, true);
      // R, G, B should all equal red luminance (0.299 * 255 = ~76)
      expect(data[0]).toBe(data[1]);
      expect(data[1]).toBe(data[2]);
      expect(data[0]).toBe(Math.round(0.299 * 255));
    });
  });

  describe('4. Document Enhancement Module (document-enhancement.ts)', () => {
    it('applies Xerox text darkening specifically to dark/ink pixels', () => {
      const data = new Uint8ClampedArray([
        80, 80, 80, 255, // Dark faded ink
        220, 220, 220, 255, // Paper background
      ]);

      applyTextDarkening(data, 1.5);
      expect(data[0]).toBeLessThan(80); // Faded ink darkened
      expect(data[4]).toBeGreaterThan(220); // Paper background brightened / cleaned
    });

    it('replaces photo background with passport studio blue', () => {
      // Set corner pixel as sample background
      const data = new Uint8ClampedArray(4 * 4 * 4);
      // Populate with light gray background (240)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 240;
        data[i + 1] = 240;
        data[i + 2] = 240;
        data[i + 3] = 255;
      }

      applyBackgroundReplacement(data, 4, 4, 'blue');
      // Should replace with passport blue: R=0, G=80, B=210
      expect(data[0]).toBe(0);
      expect(data[1]).toBe(80);
      expect(data[2]).toBe(210);
    });
  });

  describe('5. Pipeline Integration (pipeline.ts)', () => {
    it('creates default edit parameters with current timestamp and revision 1', () => {
      const edits = createDefaultEdits('asset-pipe-test');
      expect(edits.asset_id).toBe('asset-pipe-test');
      expect(edits.revision).toBe(1);
      expect(edits.brightness).toBe(0);
      expect(edits.contrast).toBe(1);
      expect(edits.saturation).toBe(1);
    });
  });
});
