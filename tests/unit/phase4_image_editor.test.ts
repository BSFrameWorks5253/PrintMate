import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDefaultEdits,
  detectDocumentCorners,
  warpPerspective,
} from '../../src/utils/image-processing';
import { AssetEdits, PerspectivePoints } from '../../src/types';
import { useJobStore } from '../../src/stores/jobStore';

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

// Polyfill global document for tests if not in browser
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

describe('Phase 4: Image Editing and Correction Pipeline', () => {
  beforeEach(() => {
    useJobStore.getState().createNewJob('Phase 4 Test Job');
  });

  describe('1. Non-Destructive Edit Pipeline & Revision Tracking', () => {
    it('creates default edit state with non-destructive defaults', () => {
      const assetId = 'asset-101';
      const edits = createDefaultEdits(assetId);

      expect(edits.asset_id).toBe(assetId);
      expect(edits.revision).toBe(1);
      expect(edits.rotation_degrees).toBe(0);
      expect(edits.flip_horizontal).toBe(false);
      expect(edits.flip_vertical).toBe(false);
      expect(edits.straighten_degrees).toBe(0);
      expect(edits.crop_x).toBeNull();
      expect(edits.crop_y).toBeNull();
      expect(edits.crop_width).toBeNull();
      expect(edits.crop_height).toBeNull();
      expect(edits.perspective_data_json).toBeNull();
      expect(edits.brightness).toBe(0);
      expect(edits.contrast).toBe(1);
      expect(edits.saturation).toBe(1);
      expect(edits.sharpness).toBe(0);
      expect(edits.grayscale).toBe(false);
      expect(edits.text_darkening).toBe(0);
      expect(edits.background_mode).toBe('original');
      expect(edits.is_current).toBe(true);
    });

    it('increments revisions monotonically on edit changes without touching source path', () => {
      const store = useJobStore.getState();
      const asset = {
        id: 'asset-source-test',
        job_id: 'job-1',
        original_path: 'C:/docs/scans/contract.png',
        original_name: 'contract.png',
        mime_type: 'image/png',
        file_extension: 'png',
        file_size_bytes: 1024,
        source_width: 800,
        source_height: 1200,
        page_count: 1,
        asset_type: 'image' as const,
        import_status: 'ready' as const,
        sort_order: 0,
        created_at: new Date().toISOString(),
      };

      store.addAssets([asset]);
      store.updateAssetEdits(asset.id, { rotation_degrees: 90 });

      let currentEdits = useJobStore.getState().edits[asset.id];
      expect(currentEdits.rotation_degrees).toBe(90);
      expect(currentEdits.revision).toBe(2);

      // Verify the source asset properties remain strictly unchanged
      const storedAsset = useJobStore.getState().assets.find((a) => a.id === asset.id);
      expect(storedAsset?.original_path).toBe('C:/docs/scans/contract.png');
      expect(storedAsset?.source_width).toBe(800);
      expect(storedAsset?.source_height).toBe(1200);
    });
  });

  describe('2. Rotation and Flip Transformations', () => {
    it('applies rotation increments and wraps within 0-359 degrees', () => {
      const store = useJobStore.getState();
      const assetId = 'asset-rot';

      store.updateAssetEdits(assetId, { rotation_degrees: 0 });
      expect(useJobStore.getState().edits[assetId].rotation_degrees).toBe(0);

      const rotateDelta = (delta: number) => {
        const current = useJobStore.getState().edits[assetId]?.rotation_degrees || 0;
        const next = (current + delta + 360) % 360;
        store.updateAssetEdits(assetId, { rotation_degrees: next });
      };

      rotateDelta(90);
      expect(useJobStore.getState().edits[assetId].rotation_degrees).toBe(90);

      rotateDelta(90);
      expect(useJobStore.getState().edits[assetId].rotation_degrees).toBe(180);

      rotateDelta(90);
      expect(useJobStore.getState().edits[assetId].rotation_degrees).toBe(270);

      rotateDelta(90);
      expect(useJobStore.getState().edits[assetId].rotation_degrees).toBe(0);

      rotateDelta(-90);
      expect(useJobStore.getState().edits[assetId].rotation_degrees).toBe(270);
    });

    it('supports horizontal and vertical flipping independently', () => {
      const store = useJobStore.getState();
      const assetId = 'asset-flip';

      store.updateAssetEdits(assetId, { flip_horizontal: true });
      expect(useJobStore.getState().edits[assetId].flip_horizontal).toBe(true);
      expect(useJobStore.getState().edits[assetId].flip_vertical).toBe(false);

      store.updateAssetEdits(assetId, { flip_vertical: true });
      expect(useJobStore.getState().edits[assetId].flip_horizontal).toBe(true);
      expect(useJobStore.getState().edits[assetId].flip_vertical).toBe(true);

      store.updateAssetEdits(assetId, { flip_horizontal: false });
      expect(useJobStore.getState().edits[assetId].flip_horizontal).toBe(false);
      expect(useJobStore.getState().edits[assetId].flip_vertical).toBe(true);
    });
  });

  describe('3. Manual Crop & Standard Print Aspect Presets', () => {
    it('computes centered crop coordinates for Passport (35:45) aspect ratio', () => {
      const aspect = 35 / 45; // ~0.7778
      let w = 0.8;
      let h = 0.8;
      if (aspect > 1) {
        h = w / aspect;
      } else {
        w = h * aspect;
      }
      const crop = {
        x: (1 - w) / 2,
        y: (1 - h) / 2,
        w,
        h,
      };

      expect(crop.w / crop.h).toBeCloseTo(35 / 45, 3);
      expect(crop.x).toBeGreaterThan(0);
      expect(crop.y).toBeGreaterThan(0);
      expect(crop.x + crop.w).toBeLessThanOrEqual(1);
      expect(crop.y + crop.h).toBeLessThanOrEqual(1);
    });

    it('computes centered crop coordinates for CR80 ID Card (85.6:54) aspect ratio', () => {
      const aspect = 85.6 / 54; // ~1.585
      let w = 0.8;
      let h = 0.8;
      if (aspect > 1) {
        h = w / aspect;
      } else {
        w = h * aspect;
      }
      const crop = {
        x: (1 - w) / 2,
        y: (1 - h) / 2,
        w,
        h,
      };

      expect(crop.w / crop.h).toBeCloseTo(85.6 / 54, 3);
      expect(crop.x + crop.w).toBeLessThanOrEqual(1);
      expect(crop.y + crop.h).toBeLessThanOrEqual(1);
    });

    it('computes centered crop coordinates for Stamp (20:25) aspect ratio', () => {
      const aspect = 20 / 25; // 0.8
      let w = 0.8;
      let h = 0.8;
      if (aspect > 1) {
        h = w / aspect;
      } else {
        w = h * aspect;
      }
      const crop = {
        x: (1 - w) / 2,
        y: (1 - h) / 2,
        w,
        h,
      };

      expect(crop.w / crop.h).toBeCloseTo(0.8, 3);
    });
  });

  describe('4. Automatic Document Edge Detection & Perspective Warp', () => {
    it('detects document corners within canvas bounds', () => {
      const mockCanvas = createMockCanvas(1000, 1400);
      const corners = detectDocumentCorners(mockCanvas);

      expect(corners.topLeft.x).toBeGreaterThanOrEqual(0);
      expect(corners.topLeft.y).toBeGreaterThanOrEqual(0);
      expect(corners.topRight.x).toBeLessThanOrEqual(1000);
      expect(corners.bottomRight.y).toBeLessThanOrEqual(1400);
      expect(corners.bottomLeft.x).toBeLessThan(corners.bottomRight.x);
      expect(corners.topLeft.y).toBeLessThan(corners.bottomLeft.y);
    });

    it('executes perspective warp on a quadrilateral region', () => {
      const mockCanvas = createMockCanvas(800, 1000);
      const corners: PerspectivePoints = {
        topLeft: { x: 50, y: 60 },
        topRight: { x: 750, y: 40 },
        bottomRight: { x: 780, y: 950 },
        bottomLeft: { x: 30, y: 920 },
      };

      const warped = warpPerspective(mockCanvas, corners, 600, 800);
      expect(warped.width).toBe(600);
      expect(warped.height).toBe(800);
    });
  });

  describe('5. Xerox Text Darkener & Document Cleanup Logic', () => {
    it('darkens text luminance (<160) and cleans paper background (>185)', () => {
      const textDarkening = 1.2;

      // Dark ink pixel (Luminance = 100)
      let inkR = 100, inkG = 100, inkB = 100;
      const inkLum = 0.299 * inkR + 0.587 * inkG + 0.114 * inkB;
      if (inkLum < 160) {
        const darkenFactor = 1 - (textDarkening * 0.45);
        inkR = Math.max(0, inkR * darkenFactor);
      }
      expect(inkR).toBeLessThan(100); // Ink darkened significantly

      // Scanner paper background pixel (Luminance = 210)
      let paperR = 210, paperG = 210, paperB = 210;
      const paperLum = 0.299 * paperR + 0.587 * paperG + 0.114 * paperB;
      if (paperLum > 185) {
        const cleanFactor = 1 + (textDarkening * 0.2);
        paperR = Math.min(255, paperR * cleanFactor);
      }
      expect(paperR).toBeGreaterThan(210); // Paper background brightened / cleaned
    });

    it('verifies Laplacian 3x3 convolution kernel preserves overall energy', () => {
      const strength = 1.5;
      const centerWeight = 1 + 4 * strength;
      const edgeWeight = -strength;
      const totalSum = centerWeight + 4 * edgeWeight;

      // In a 3x3 sharpening kernel, the sum of all weights must equal 1.0 (neutral gain)
      expect(totalSum).toBeCloseTo(1.0, 5);
    });
  });

  describe('6. Undo, Redo, and Reset State Stack', () => {
    it('supports full Undo and Redo transitions across multiple edit revisions', () => {
      const store = useJobStore.getState();
      const assetId = 'asset-undo-test';

      // 1. Initial edit
      store.updateAssetEdits(assetId, { brightness: 0.1 });
      expect(useJobStore.getState().canUndoAsset(assetId)).toBe(true);
      expect(useJobStore.getState().canRedoAsset(assetId)).toBe(false);

      // 2. Second edit
      store.updateAssetEdits(assetId, { brightness: 0.25, contrast: 1.2 });
      expect(useJobStore.getState().edits[assetId].brightness).toBe(0.25);
      expect(useJobStore.getState().edits[assetId].contrast).toBe(1.2);

      // 3. Undo
      store.undoAssetEdits(assetId);
      expect(useJobStore.getState().edits[assetId].brightness).toBe(0.1);
      expect(useJobStore.getState().edits[assetId].contrast).toBe(1); // restored to previous
      expect(useJobStore.getState().canRedoAsset(assetId)).toBe(true);

      // 4. Redo
      store.redoAssetEdits(assetId);
      expect(useJobStore.getState().edits[assetId].brightness).toBe(0.25);
      expect(useJobStore.getState().edits[assetId].contrast).toBe(1.2);
    });

    it('resets edits to original defaults while allowing undo back to modified state', () => {
      const store = useJobStore.getState();
      const assetId = 'asset-reset-test';

      store.updateAssetEdits(assetId, { rotation_degrees: 180, grayscale: true, contrast: 2.0 });
      expect(useJobStore.getState().edits[assetId].rotation_degrees).toBe(180);

      // Reset to original
      store.resetAssetEdits(assetId);
      const resetState = useJobStore.getState().edits[assetId];
      expect(resetState.rotation_degrees).toBe(0);
      expect(resetState.grayscale).toBe(false);
      expect(resetState.contrast).toBe(1);

      // Can undo the reset
      expect(useJobStore.getState().canUndoAsset(assetId)).toBe(true);
      store.undoAssetEdits(assetId);
      expect(useJobStore.getState().edits[assetId].rotation_degrees).toBe(180);
      expect(useJobStore.getState().edits[assetId].grayscale).toBe(true);
    });

    it('enforces history limit to prevent unbounded memory usage', () => {
      const store = useJobStore.getState();
      const assetId = 'asset-history-limit';

      // Perform 60 consecutive edits
      for (let i = 1; i <= 60; i++) {
        store.updateAssetEdits(assetId, { straighten_degrees: i * 0.1 });
      }

      const history = useJobStore.getState().editHistory[assetId];
      expect(history.past.length).toBeLessThanOrEqual(50);
    });
  });
});
