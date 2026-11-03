export type SupportedIdCardType =
  | 'aadhaar'
  | 'pan'
  | 'voter'
  | 'ayushman'
  | 'abha'
  | 'driving_license'
  | 'apaar'
  | 'eshram'
  | 'custom';

export interface IdCardPresetDef {
  id: SupportedIdCardType;
  name: string;
  description: string;
  // Normalized bounding boxes [x, y, w, h] from 0 to 1 relative to document canvas
  defaultFrontCrop: { x: number; y: number; w: number; h: number };
  defaultBackCrop: { x: number; y: number; w: number; h: number };
}

// ISO/IEC 7810 ID-1 standard (CR80 PVC card)
export const PVC_CARD_SPEC = {
  widthMm: 85.6,
  heightMm: 53.98,
  aspectRatio: 85.6 / 53.98, // ~1.5858
  widthPx300Dpi: 1011,
  heightPx300Dpi: 638,
  cornerRadiusMm: 3.18, // standard CR80 rounded corner
};

export const ID_CARD_PRESETS: Record<SupportedIdCardType, IdCardPresetDef> = {
  aadhaar: {
    id: 'aadhaar',
    name: 'Aadhaar Card (UIDAI)',
    description: 'Standard e-Aadhaar PDF. Front & Back positioned at bottom section.',
    // Standard e-Aadhaar PDF bottom cards:
    // Left side = Front card, Right side = Back card
    defaultFrontCrop: { x: 0.05, y: 0.69, w: 0.44, h: 0.28 },
    defaultBackCrop: { x: 0.51, y: 0.69, w: 0.44, h: 0.28 },
  },
  pan: {
    id: 'pan',
    name: 'PAN Card (NSDL / UTIITSL)',
    description: 'e-PAN PDF format with pre-formatted card at bottom or center.',
    defaultFrontCrop: { x: 0.08, y: 0.66, w: 0.42, h: 0.30 },
    defaultBackCrop: { x: 0.52, y: 0.66, w: 0.42, h: 0.30 },
  },
  voter: {
    id: 'voter',
    name: 'Voter ID (e-EPIC / NVSP)',
    description: 'Election Commission of India Voter ID card layout.',
    defaultFrontCrop: { x: 0.08, y: 0.15, w: 0.42, h: 0.34 },
    defaultBackCrop: { x: 0.52, y: 0.15, w: 0.42, h: 0.34 },
  },
  ayushman: {
    id: 'ayushman',
    name: 'Ayushman Bharat (PM-JAY)',
    description: 'National Health Authority golden card with QR and beneficiary details.',
    defaultFrontCrop: { x: 0.06, y: 0.60, w: 0.43, h: 0.35 },
    defaultBackCrop: { x: 0.51, y: 0.60, w: 0.43, h: 0.35 },
  },
  abha: {
    id: 'abha',
    name: 'ABHA Card (Health ID)',
    description: 'Ayushman Bharat Digital Mission 14-digit Health Account card.',
    defaultFrontCrop: { x: 0.10, y: 0.58, w: 0.80, h: 0.36 },
    defaultBackCrop: { x: 0.10, y: 0.58, w: 0.80, h: 0.36 },
  },
  driving_license: {
    id: 'driving_license',
    name: 'Driving License / RC (Sarathi)',
    description: 'Ministry of Road Transport & Highways DL smart card.',
    defaultFrontCrop: { x: 0.06, y: 0.25, w: 0.43, h: 0.32 },
    defaultBackCrop: { x: 0.51, y: 0.25, w: 0.43, h: 0.32 },
  },
  apaar: {
    id: 'apaar',
    name: 'APAAR Card / ABC ID (One Nation One Student)',
    description: 'Ministry of Education Student ID card format.',
    defaultFrontCrop: { x: 0.08, y: 0.55, w: 0.42, h: 0.36 },
    defaultBackCrop: { x: 0.52, y: 0.55, w: 0.42, h: 0.36 },
  },
  eshram: {
    id: 'eshram',
    name: 'E-Shram Card (UAN)',
    description: 'Ministry of Labour & Employment universal account card.',
    defaultFrontCrop: { x: 0.06, y: 0.55, w: 0.43, h: 0.35 },
    defaultBackCrop: { x: 0.51, y: 0.55, w: 0.43, h: 0.35 },
  },
  custom: {
    id: 'custom',
    name: 'Custom ID Card',
    description: 'School, College, Corporate, or Employee badge.',
    defaultFrontCrop: { x: 0.05, y: 0.2, w: 0.44, h: 0.4 },
    defaultBackCrop: { x: 0.51, y: 0.2, w: 0.44, h: 0.4 },
  },
};

export class IdCardAutoDetectorService {
  /**
   * Render first page of a PDF with password support (e-Aadhaar passwords: first 4 letters name + year of birth)
   */
  static async renderPdfPage(
    bytes: Uint8Array,
    password?: string,
    scale: number = 2.5
  ): Promise<{ canvas: HTMLCanvasElement; detectedText: string; isEncrypted: boolean }> {
    const pdfjsLib = await import('pdfjs-dist');
    if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.mjs', window.location.href).href;
      } catch {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      }
    }
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: bytes.slice(),
        password: password || undefined,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
        cMapPacked: true,
      });

      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) throw new Error('Could not get 2D rendering context');

      await (page.render as any)({
        canvasContext: ctx,
        viewport,
        canvas,
      }).promise;

      // Extract text content to auto-detect card type
      let detectedText = '';
      try {
        const textContent = await page.getTextContent();
        detectedText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ')
          .toLowerCase();
      } catch {
        // Text layer optional
      }

      return { canvas, detectedText, isEncrypted: false };
    } catch (err: any) {
      if (err.name === 'PasswordException' || err.message?.includes('password')) {
        return {
          canvas: document.createElement('canvas'),
          detectedText: '',
          isEncrypted: true,
        };
      }
      throw err;
    }
  }

  /**
   * Auto-detect card type from extracted text keywords
   */
  static detectCardType(text: string): SupportedIdCardType {
    const lower = text.toLowerCase();
    if (lower.includes('unique identification') || lower.includes('aadhaar') || lower.includes('uidai') || lower.includes('mera aadhaar')) {
      return 'aadhaar';
    }
    if (lower.includes('income tax department') || lower.includes('permanent account number') || lower.includes('pan card') || lower.includes('nsdl') || lower.includes('utitsl')) {
      return 'pan';
    }
    if (lower.includes('election commission of india') || lower.includes('voter id') || lower.includes('epic') || lower.includes('elector photo')) {
      return 'voter';
    }
    if (lower.includes('ayushman') || lower.includes('pm-jay') || lower.includes('pmjay') || lower.includes('national health authority')) {
      return 'ayushman';
    }
    if (lower.includes('abha') || lower.includes('health account') || lower.includes('abdm')) {
      return 'abha';
    }
    if (lower.includes('driving licence') || lower.includes('driving license') || lower.includes('motor vehicles') || lower.includes('sarathi')) {
      return 'driving_license';
    }
    if (lower.includes('apaar') || lower.includes('academic bank of credits') || lower.includes('one nation one student')) {
      return 'apaar';
    }
    if (lower.includes('e-shram') || lower.includes('eshram') || lower.includes('ministry of labour')) {
      return 'eshram';
    }
    return 'aadhaar';
  }

  /**
   * Crop card region from source canvas and normalize to exact ISO CR80 PVC dimensions (1011 × 638 px @ 300 DPI)
   */
  static cropToPvcCanvas(
    sourceCanvas: HTMLCanvasElement,
    crop: { x: number; y: number; w: number; h: number },
    targetDpiW: number = PVC_CARD_SPEC.widthPx300Dpi,
    targetDpiH: number = PVC_CARD_SPEC.heightPx300Dpi,
    addCornerRadius: boolean = false
  ): HTMLCanvasElement {
    const sw = sourceCanvas.width;
    const sh = sourceCanvas.height;

    const sx = Math.max(0, Math.min(sw - 1, Math.round(crop.x * sw)));
    const sy = Math.max(0, Math.min(sh - 1, Math.round(crop.y * sh)));
    const sCropW = Math.max(10, Math.min(sw - sx, Math.round(crop.w * sw)));
    const sCropH = Math.max(10, Math.min(sh - sy, Math.round(crop.h * sh)));

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = targetDpiW;
    outputCanvas.height = targetDpiH;
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) return outputCanvas;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetDpiW, targetDpiH);

    // Optional rounded corner mask (CR80 standard radius)
    if (addCornerRadius) {
      const radius = Math.round((PVC_CARD_SPEC.cornerRadiusMm / PVC_CARD_SPEC.widthMm) * targetDpiW);
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(targetDpiW - radius, 0);
      ctx.quadraticCurveTo(targetDpiW, 0, targetDpiW, radius);
      ctx.lineTo(targetDpiW, targetDpiH - radius);
      ctx.quadraticCurveTo(targetDpiW, targetDpiH, targetDpiW - radius, targetDpiH);
      ctx.lineTo(radius, targetDpiH);
      ctx.quadraticCurveTo(0, targetDpiH, 0, targetDpiH - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.clip();
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, sx, sy, sCropW, sCropH, 0, 0, targetDpiW, targetDpiH);

    // Add crisp cutting border stroke
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.75, 0.75, targetDpiW - 1.5, targetDpiH - 1.5);

    return outputCanvas;
  }
}
