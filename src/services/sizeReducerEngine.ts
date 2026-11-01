export interface PortalPreset {
  id: string;
  name: string;
  category: 'UPSC / SSC' | 'NTA (NEET/JEE)' | 'PAN Card' | 'Passport Seva' | 'Custom';
  description: string;
  type: 'photo' | 'signature' | 'document' | 'custom';
  minKb: number;
  maxKb: number;
  targetKb: number;
  recommendedWidth?: number;
  recommendedHeight?: number;
  enforceDimensions?: boolean;
}

export const PORTAL_PRESETS: PortalPreset[] = [
  {
    id: 'upsc_photo',
    name: 'UPSC / SSC Photo',
    category: 'UPSC / SSC',
    description: 'White background, 350×450px, 20 KB - 50 KB limit',
    type: 'photo',
    minKb: 20,
    maxKb: 50,
    targetKb: 45,
    recommendedWidth: 350,
    recommendedHeight: 450,
    enforceDimensions: true,
  },
  {
    id: 'upsc_signature',
    name: 'UPSC / SSC Signature',
    category: 'UPSC / SSC',
    description: 'Black ink on white paper, 400×200px, 10 KB - 20 KB limit',
    type: 'signature',
    minKb: 10,
    maxKb: 20,
    targetKb: 18,
    recommendedWidth: 400,
    recommendedHeight: 200,
    enforceDimensions: true,
  },
  {
    id: 'upsc_document',
    name: 'UPSC / SSC Document / Certificate',
    category: 'UPSC / SSC',
    description: 'ID proof or certificate PDF/JPG, 100 KB - 300 KB limit',
    type: 'document',
    minKb: 100,
    maxKb: 300,
    targetKb: 280,
  },
  {
    id: 'neet_photo',
    name: 'NTA NEET / JEE Passport Photo',
    category: 'NTA (NEET/JEE)',
    description: 'Passport photo with name & date, 10 KB - 200 KB limit',
    type: 'photo',
    minKb: 10,
    maxKb: 200,
    targetKb: 180,
    recommendedWidth: 413,
    recommendedHeight: 531,
  },
  {
    id: 'neet_postcard',
    name: 'NTA NEET Postcard Photo (4×6")',
    category: 'NTA (NEET/JEE)',
    description: 'Postcard size photo, 10 KB - 200 KB limit',
    type: 'photo',
    minKb: 10,
    maxKb: 200,
    targetKb: 180,
    recommendedWidth: 1200,
    recommendedHeight: 1800,
  },
  {
    id: 'neet_signature',
    name: 'NTA NEET / JEE Signature',
    category: 'NTA (NEET/JEE)',
    description: 'Running handwriting signature, 4 KB - 30 KB limit',
    type: 'signature',
    minKb: 4,
    maxKb: 30,
    targetKb: 25,
    recommendedWidth: 400,
    recommendedHeight: 150,
  },
  {
    id: 'pan_photo',
    name: 'PAN Card Photo (NSDL / UTIITSL)',
    category: 'PAN Card',
    description: '300 DPI, 2.5 × 3.5 cm, strictly under 50 KB',
    type: 'photo',
    minKb: 10,
    maxKb: 50,
    targetKb: 45,
    recommendedWidth: 295,
    recommendedHeight: 413,
    enforceDimensions: true,
  },
  {
    id: 'pan_signature',
    name: 'PAN Card Signature (NSDL / UTIITSL)',
    category: 'PAN Card',
    description: '600 DPI, 2 × 4.5 cm, strictly under 20 KB',
    type: 'signature',
    minKb: 5,
    maxKb: 20,
    targetKb: 18,
    recommendedWidth: 472,
    recommendedHeight: 236,
    enforceDimensions: true,
  },
  {
    id: 'passport_seva_photo',
    name: 'Passport Seva Photo (MEA)',
    category: 'Passport Seva',
    description: '35 × 45 mm, light background, max 200 KB',
    type: 'photo',
    minKb: 10,
    maxKb: 200,
    targetKb: 150,
    recommendedWidth: 413,
    recommendedHeight: 531,
  },
  {
    id: 'custom_preset',
    name: 'Custom Target Size',
    category: 'Custom',
    description: 'Set your own custom max KB and dimensions',
    type: 'custom',
    minKb: 10,
    maxKb: 100,
    targetKb: 80,
  },
];

export interface CompressionResult {
  blob: Blob;
  dataUrl: string;
  sizeBytes: number;
  sizeKb: number;
  width: number;
  height: number;
  qualityUsed: number;
  reductionPercentage: number;
}

export class SizeReducerEngine {
  /**
   * Cleans up mobile photos of signatures: removes shadows/yellow tint, turns background pure white,
   * and darkens pen ink (black/blue) to make it crisp for portal uploads.
   */
  static enhanceSignature(
    canvas: HTMLCanvasElement,
    contrastMultiplier: number = 1.3,
    whitenessThreshold: number = 180
  ): HTMLCanvasElement {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return canvas;

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Luminance computation
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (lum > whitenessThreshold) {
        // Background paper whitening
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      } else {
        // Darken ink strokes
        const factor = Math.max(0, 1 - (contrastMultiplier * (whitenessThreshold - lum)) / whitenessThreshold);
        data[i] = Math.round(r * factor);
        data[i + 1] = Math.round(g * factor);
        data[i + 2] = Math.round(b * factor);
      }
    }

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = w;
    outputCanvas.height = h;
    const outCtx = outputCanvas.getContext('2d');
    if (outCtx) {
      outCtx.putImageData(imgData, 0, 0);
    }
    return outputCanvas;
  }

  /**
   * Resizes an image or canvas maintaining aspect ratio or clamping to target dimensions.
   */
  static resizeCanvas(
    source: HTMLCanvasElement | HTMLImageElement,
    targetWidth?: number,
    targetHeight?: number,
    enforceExact: boolean = false
  ): HTMLCanvasElement {
    const sw = (source as any).naturalWidth || (source as HTMLCanvasElement).width;
    const sh = (source as any).naturalHeight || (source as HTMLCanvasElement).height;

    let finalW = sw;
    let finalH = sh;

    if (targetWidth && targetHeight) {
      if (enforceExact) {
        finalW = targetWidth;
        finalH = targetHeight;
      } else {
        const ratio = Math.min(targetWidth / sw, targetHeight / sh, 1);
        finalW = Math.round(sw * ratio);
        finalH = Math.round(sh * ratio);
      }
    } else if (targetWidth) {
      finalW = targetWidth;
      finalH = Math.round((sh * targetWidth) / sw);
    } else if (targetHeight) {
      finalH = targetHeight;
      finalW = Math.round((sw * targetHeight) / sh);
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, finalW);
    canvas.height = Math.max(1, finalH);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    }
    return canvas;
  }

  /**
   * Binary search compression engine that guarantees file size <= maxKb and as close to targetKb as possible.
   */
  static async compressToTargetKb(
    canvas: HTMLCanvasElement,
    targetKb: number,
    maxKb: number,
    minKb: number = 0,
    format: 'image/jpeg' | 'image/png' = 'image/jpeg'
  ): Promise<CompressionResult> {
    const maxBytes = maxKb * 1024;
    const targetBytes = targetKb * 1024;
    const minBytes = minKb * 1024;

    let currentCanvas = canvas;
    let bestBlob: Blob | null = null;
    let bestQuality = 0.85;

    // Helper to get blob from canvas at given quality
    const getCanvasBlob = (c: HTMLCanvasElement, q: number): Promise<Blob> => {
      return new Promise((resolve) => {
        c.toBlob((blob) => resolve(blob || new Blob()), format, q);
      });
    };

    // First, test with standard high quality
    let blob = await getCanvasBlob(currentCanvas, 0.92);

    // If already under target and within range, check if it's too small
    if (blob.size <= maxBytes && (minBytes === 0 || blob.size >= minBytes)) {
      bestBlob = blob;
      bestQuality = 0.92;
    }

    // Binary search on quality if size is larger than maxBytes
    if (blob.size > maxBytes || (format === 'image/jpeg' && Math.abs(blob.size - targetBytes) > 5120)) {
      let lowQ = 0.05;
      let highQ = 0.98;
      let iterations = 0;

      while (lowQ <= highQ && iterations < 9) {
        iterations++;
        const midQ = (lowQ + highQ) / 2;
        const testBlob = await getCanvasBlob(currentCanvas, midQ);

        if (testBlob.size <= maxBytes) {
          bestBlob = testBlob;
          bestQuality = midQ;
          // If we are very close to targetKb, accept
          if (Math.abs(testBlob.size - targetBytes) <= 2048) {
            break;
          }
          // Try to increase quality slightly to get closer to target
          lowQ = midQ + 0.05;
        } else {
          // Exceeds max limit; must reduce quality
          highQ = midQ - 0.05;
        }
      }
    }

    // If even quality 0.05 is still larger than maxBytes, downscale dimensions progressively
    let downscaleScale = 0.9;
    let downscaleLoops = 0;
    while ((!bestBlob || bestBlob.size > maxBytes) && downscaleLoops < 6) {
      downscaleLoops++;
      const newW = Math.max(100, Math.round(currentCanvas.width * downscaleScale));
      const newH = Math.max(100, Math.round(currentCanvas.height * downscaleScale));
      currentCanvas = this.resizeCanvas(currentCanvas, newW, newH, false);

      const testBlob = await getCanvasBlob(currentCanvas, 0.7);
      if (testBlob.size <= maxBytes) {
        bestBlob = testBlob;
        bestQuality = 0.7;
        break;
      }
      downscaleScale *= 0.85;
    }

    // Fallback if no candidate satisfied condition
    if (!bestBlob) {
      bestBlob = await getCanvasBlob(currentCanvas, 0.5);
    }

    // Read back as DataURL
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(bestBlob!);
    });

    const origBytes = canvas.width * canvas.height * 4;
    const reduction = Math.max(0, Math.round(((origBytes - bestBlob.size) / origBytes) * 100));

    return {
      blob: bestBlob,
      dataUrl,
      sizeBytes: bestBlob.size,
      sizeKb: Number((bestBlob.size / 1024).toFixed(1)),
      width: currentCanvas.width,
      height: currentCanvas.height,
      qualityUsed: Math.round(bestQuality * 100),
      reductionPercentage: reduction,
    };
  }

  /**
   * Helper to load an image file into an HTMLImageElement
   */
  static loadImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Convert an image to an HTMLCanvasElement
   */
  static imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
    }
    return canvas;
  }
}
