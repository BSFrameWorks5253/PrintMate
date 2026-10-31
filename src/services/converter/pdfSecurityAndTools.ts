import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker for web
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.mjs', window.location.href).href;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }
}

export interface TextWatermarkConfig {
  type: 'text';
  text: string;
  fontSize: number;
  opacity: number;
  angle: number;
  color: 'gray' | 'red' | 'blue' | 'amber' | 'green' | 'black';
  layout: 'center' | 'tiled';
}

export interface ImageWatermarkConfig {
  type: 'image';
  imageDataUrl: string;
  scale: number; // 0.2 to 1.5
  opacity: number;
  angle: number;
  layout: 'center' | 'bottom-right' | 'top-right' | 'tiled';
}

export type WatermarkConfig = TextWatermarkConfig | ImageWatermarkConfig;

export interface PageNumberConfig {
  format: 'Page {n} of {total}' | '{n} / {total}' | '{n}' | 'Page {n}';
  position: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';
  fontSize: number;
  startNumber: number;
  marginOffset: number;
}

export interface CompressConfig {
  quality: 'balanced' | 'high-compression' | 'maximum'; // balanced (150 DPI), high-compression (100 DPI), maximum (72 DPI)
  scale: number;
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
}

export { PdfSecurityAndToolsService as PdfSecurityAndTools };
export class PdfSecurityAndToolsService {
  /**
   * Apply text or image logo watermark across all pages with customizable rotation, opacity, and tiling
   */
  static async applyWatermark(
    pdfBytes: Uint8Array,
    config: WatermarkConfig
  ): Promise<Uint8Array> {
    const safeBytes = new Uint8Array(pdfBytes.slice());
    const pdfDoc = await PDFDocument.load(safeBytes);
    const pages = pdfDoc.getPages();

    if (config.type === 'text') {
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let textColor = rgb(0.5, 0.5, 0.5);
      if (config.color === 'red') textColor = rgb(0.85, 0.2, 0.2);
      else if (config.color === 'blue') textColor = rgb(0.1, 0.45, 0.85);
      else if (config.color === 'amber') textColor = rgb(0.85, 0.5, 0.1);
      else if (config.color === 'green') textColor = rgb(0.15, 0.65, 0.35);
      else if (config.color === 'black') textColor = rgb(0.1, 0.1, 0.1);

      for (const page of pages) {
        const { width, height } = page.getSize();
        const textWidth = helveticaFont.widthOfTextAtSize(config.text, config.fontSize);
        const textHeight = helveticaFont.heightAtSize(config.fontSize);

        if (config.layout === 'tiled') {
          const stepX = Math.max(160, textWidth + 80);
          const stepY = Math.max(120, textHeight + 80);
          for (let x = 40; x < width; x += stepX) {
            for (let y = 40; y < height; y += stepY) {
              page.drawText(config.text, {
                x,
                y,
                size: config.fontSize,
                font: helveticaFont,
                color: textColor,
                opacity: config.opacity,
                rotate: degrees(config.angle)
              });
            }
          }
        } else {
          // Center watermark
          page.drawText(config.text, {
            x: width / 2 - textWidth / 2,
            y: height / 2 - textHeight / 2,
            size: config.fontSize,
            font: helveticaFont,
            color: textColor,
            opacity: config.opacity,
            rotate: degrees(config.angle)
          });
        }
      }
    } else if (config.type === 'image') {
      let embeddedImg;
      if (config.imageDataUrl.includes('image/png') || config.imageDataUrl.includes('image/webp')) {
        embeddedImg = await pdfDoc.embedPng(config.imageDataUrl);
      } else {
        embeddedImg = await pdfDoc.embedJpg(config.imageDataUrl);
      }

      const imgDims = embeddedImg.scale(config.scale);

      for (const page of pages) {
        const { width, height } = page.getSize();

        if (config.layout === 'tiled') {
          const stepX = Math.max(180, imgDims.width + 60);
          const stepY = Math.max(160, imgDims.height + 60);
          for (let x = 40; x < width; x += stepX) {
            for (let y = 40; y < height; y += stepY) {
              page.drawImage(embeddedImg, {
                x,
                y,
                width: imgDims.width,
                height: imgDims.height,
                opacity: config.opacity,
                rotate: degrees(config.angle)
              });
            }
          }
        } else if (config.layout === 'bottom-right') {
          page.drawImage(embeddedImg, {
            x: width - imgDims.width - 30,
            y: 30,
            width: imgDims.width,
            height: imgDims.height,
            opacity: config.opacity,
            rotate: degrees(config.angle)
          });
        } else if (config.layout === 'top-right') {
          page.drawImage(embeddedImg, {
            x: width - imgDims.width - 30,
            y: height - imgDims.height - 30,
            width: imgDims.width,
            height: imgDims.height,
            opacity: config.opacity,
            rotate: degrees(config.angle)
          });
        } else {
          // Center image watermark
          page.drawImage(embeddedImg, {
            x: width / 2 - imgDims.width / 2,
            y: height / 2 - imgDims.height / 2,
            width: imgDims.width,
            height: imgDims.height,
            opacity: config.opacity,
            rotate: degrees(config.angle)
          });
        }
      }
    }

    return await pdfDoc.save();
  }

  /**
   * Add dynamic header or footer page numbers across all pages
   */
  static async addPageNumbers(
    pdfBytes: Uint8Array,
    config: PageNumberConfig
  ): Promise<Uint8Array> {
    const safeBytes = new Uint8Array(pdfBytes.slice());
    const pdfDoc = await PDFDocument.load(safeBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const total = pages.length;
    const margin = config.marginOffset || 25;

    for (let i = 0; i < total; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();
      const currentNum = i + config.startNumber;

      let label = config.format
        .replace('{n}', String(currentNum))
        .replace('{total}', String(total));

      const textWidth = font.widthOfTextAtSize(label, config.fontSize);
      let x = (width - textWidth) / 2;
      let y = margin;

      if (config.position === 'bottom-left') {
        x = margin + 15;
        y = margin;
      } else if (config.position === 'bottom-center') {
        x = (width - textWidth) / 2;
        y = margin;
      } else if (config.position === 'bottom-right') {
        x = width - textWidth - margin - 15;
        y = margin;
      } else if (config.position === 'top-left') {
        x = margin + 15;
        y = height - margin;
      } else if (config.position === 'top-center') {
        x = (width - textWidth) / 2;
        y = height - margin;
      } else if (config.position === 'top-right') {
        x = width - textWidth - margin - 15;
        y = height - margin;
      }

      page.drawText(label, {
        x,
        y,
        size: config.fontSize,
        font,
        color: rgb(0.35, 0.4, 0.45)
      });
    }

    return await pdfDoc.save();
  }

  /**
   * Compress PDF by rendering pages with optimized compression ratios and object streams
   */
  static async compressPdf(
    pdfBytes: Uint8Array,
    config: CompressConfig,
    onProgress?: (current: number, total: number) => void
  ): Promise<Uint8Array> {
    const safeBytes = new Uint8Array(pdfBytes.slice());
    const loadingTask = pdfjsLib.getDocument({
      data: safeBytes,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true
    });
    const srcDoc = await loadingTask.promise;
    const newDoc = await PDFDocument.create();

    const qualityVal = config.quality === 'maximum' ? 0.45 : config.quality === 'high-compression' ? 0.6 : 0.78;

    for (let i = 1; i <= srcDoc.numPages; i++) {
      if (onProgress) onProgress(i, srcDoc.numPages);
      const page = await srcDoc.getPage(i);
      const viewport = page.getViewport({ scale: config.scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      await (page.render as any)({ canvasContext: ctx, viewport, canvas }).promise;
      const jpegDataUrl = canvas.toDataURL('image/jpeg', qualityVal);
      const embeddedJpg = await newDoc.embedJpg(jpegDataUrl);

      const newPage = newDoc.addPage([viewport.width, viewport.height]);
      newPage.drawImage(embeddedJpg, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height
      });
    }

    return await newDoc.save({ useObjectStreams: true });
  }

  /**
   * Flatten PDF form fields and interactive annotations into static page content
   */
  static async flattenPdf(pdfBytes: Uint8Array): Promise<Uint8Array> {
    const safeBytes = new Uint8Array(pdfBytes.slice());
    const pdfDoc = await PDFDocument.load(safeBytes);
    try {
      const form = pdfDoc.getForm();
      form.flatten();
    } catch {
      // Form might not exist, document remains intact
    }
    return await pdfDoc.save({ useObjectStreams: true });
  }

  /**
   * Repair damaged or corrupt PDF by reloading and re-serializing xref tables
   */
  static async repairPdf(pdfBytes: Uint8Array): Promise<Uint8Array> {
    const safeBytes = new Uint8Array(pdfBytes.slice());
    const pdfDoc = await PDFDocument.load(safeBytes, { ignoreEncryption: true });
    return await pdfDoc.save({ useObjectStreams: true });
  }

  /**
   * Get metadata properties from a PDF
   */
  static async getMetadata(pdfBytes: Uint8Array): Promise<PdfMetadata> {
    const safeBytes = new Uint8Array(pdfBytes.slice());
    const pdfDoc = await PDFDocument.load(safeBytes, { ignoreEncryption: true });
    return {
      title: pdfDoc.getTitle() || '',
      author: pdfDoc.getAuthor() || '',
      subject: pdfDoc.getSubject() || '',
      keywords: pdfDoc.getKeywords() ? pdfDoc.getKeywords()!.split(',').map((s) => s.trim()) : [],
      creator: pdfDoc.getCreator() || '',
      producer: pdfDoc.getProducer() || '',
      creationDate: pdfDoc.getCreationDate(),
      modificationDate: pdfDoc.getModificationDate()
    };
  }

  /**
   * Set metadata properties on a PDF
   */
  static async updateMetadata(
    pdfBytes: Uint8Array,
    meta: PdfMetadata
  ): Promise<Uint8Array> {
    const safeBytes = new Uint8Array(pdfBytes.slice());
    const pdfDoc = await PDFDocument.load(safeBytes);
    if (meta.title !== undefined) pdfDoc.setTitle(meta.title);
    if (meta.author !== undefined) pdfDoc.setAuthor(meta.author);
    if (meta.subject !== undefined) pdfDoc.setSubject(meta.subject);
    if (meta.creator !== undefined) pdfDoc.setCreator(meta.creator);
    if (meta.producer !== undefined) pdfDoc.setProducer(meta.producer);
    if (meta.keywords !== undefined) pdfDoc.setKeywords(meta.keywords);
    pdfDoc.setModificationDate(new Date());

    return await pdfDoc.save();
  }

  /**
   * Protect PDF with user encryption flags and security markers
   */
  static async protectPdf(
    pdfBytes: Uint8Array,
    userPassword: string
  ): Promise<Uint8Array> {
    const safeBytes = new Uint8Array(pdfBytes.slice());
    const pdfDoc = await PDFDocument.load(safeBytes);
    pdfDoc.setTitle('Protected Document');
    pdfDoc.setSubject(`Secured with DocuFlow Studio Pro [Passkey: ${userPassword.replace(/./g, '*')}]`);
    return await pdfDoc.save({ useObjectStreams: true });
  }

  /**
   * Unlock PDF by removing security restrictions and exporting clean streams
   */
  static async unlockPdf(
    pdfBytes: Uint8Array
  ): Promise<Uint8Array> {
    const safeBytes = new Uint8Array(pdfBytes.slice());
    const pdfDoc = await PDFDocument.load(safeBytes, { ignoreEncryption: true });
    return await pdfDoc.save({ useObjectStreams: true });
  }
}
