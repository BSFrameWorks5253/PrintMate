import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

export interface TextAnnotation {
  id: string;
  type: 'text';
  pageIndex: number;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  fontFamily?: 'Helvetica' | 'Times' | 'Courier';
  isBold?: boolean;
  isItalic?: boolean;
  backgroundColor?: string;
  width?: number;
  height?: number;
}

export interface FreehandAnnotation {
  id: string;
  type: 'freehand';
  pageIndex: number;
  points: Array<{ x: number; y: number }>;
  color: string;
  strokeWidth: number;
}

export interface SignatureAnnotation {
  id: string;
  type: 'signature';
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  imageDataUrl: string;
}

export interface WhiteoutAnnotation {
  id: string;
  type: 'whiteout';
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface HighlightAnnotation {
  id: string;
  type: 'highlight';
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
}

export interface ShapeAnnotation {
  id: string;
  type: 'rectangle' | 'circle' | 'line' | 'arrow';
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  strokeWidth: number;
  fillColor?: string;
}

export interface StampAnnotation {
  id: string;
  type: 'stamp';
  pageIndex: number;
  x: number;
  y: number;
  stampType: 'check' | 'cross' | 'star' | 'date';
  size: number;
  color: string;
  text?: string;
}

export interface ImageAnnotation {
  id: string;
  type: 'image';
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  imageDataUrl: string;
}

export type PdfAnnotation =
  | TextAnnotation
  | FreehandAnnotation
  | SignatureAnnotation
  | WhiteoutAnnotation
  | HighlightAnnotation
  | ShapeAnnotation
  | StampAnnotation
  | ImageAnnotation;

/**
 * Utility to convert Hex color strings like #0284c7 to rgb(r, g, b)
 */
function hexToRgbColor(hex: string) {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16) / 255;
    const g = parseInt(cleanHex[1] + cleanHex[1], 16) / 255;
    const b = parseInt(cleanHex[2] + cleanHex[2], 16) / 255;
    return rgb(r, g, b);
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

export class PdfAnnotationService {
  /**
   * Permanently burns all annotations (in-place text edits, freehand drawings, signatures, whiteouts, highlights, shapes, stamps)
   * into the PDF document streams using exact page coordinate geometry.
   */
  static async burnAnnotations(
    originalBytes: Uint8Array,
    annotations: PdfAnnotation[],
    pageRenderDimensions: Record<number, { width: number; height: number }>
  ): Promise<Uint8Array> {
    const safeBytes = new Uint8Array(originalBytes.slice());
    const pdfDoc = await PDFDocument.load(safeBytes);
    const pages = pdfDoc.getPages();

    // Embed standard fonts
    const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontHelveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const fontHelveticaBoldOblique = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

    const fontTimes = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontTimesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontTimesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    const fontTimesBoldItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);

    const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);
    const fontCourierBold = await pdfDoc.embedFont(StandardFonts.CourierBold);

    // Group annotations by page
    const byPage: Record<number, PdfAnnotation[]> = {};
    for (const ann of annotations) {
      if (!byPage[ann.pageIndex]) byPage[ann.pageIndex] = [];
      byPage[ann.pageIndex].push(ann);
    }

    for (const pageIndexStr of Object.keys(byPage)) {
      const pageIdx = parseInt(pageIndexStr, 10);
      if (pageIdx < 0 || pageIdx >= pages.length) continue;

      const page = pages[pageIdx];
      const { width: pdfWidth, height: pdfHeight } = page.getSize();
      const renderDim = pageRenderDimensions[pageIdx] || { width: pdfWidth, height: pdfHeight };

      const scaleX = pdfWidth / renderDim.width;
      const scaleY = pdfHeight / renderDim.height;

      const pageAnnotations = byPage[pageIdx];

      for (const ann of pageAnnotations) {
        if (ann.type === 'text') {
          let chosenFont = fontHelvetica;
          if (ann.fontFamily === 'Times') {
            if (ann.isBold && ann.isItalic) chosenFont = fontTimesBoldItalic;
            else if (ann.isBold) chosenFont = fontTimesBold;
            else if (ann.isItalic) chosenFont = fontTimesItalic;
            else chosenFont = fontTimes;
          } else if (ann.fontFamily === 'Courier') {
            chosenFont = ann.isBold ? fontCourierBold : fontCourier;
          } else {
            if (ann.isBold && ann.isItalic) chosenFont = fontHelveticaBoldOblique;
            else if (ann.isBold) chosenFont = fontHelveticaBold;
            else if (ann.isItalic) chosenFont = fontHelveticaOblique;
            else chosenFont = fontHelvetica;
          }

          const pdfFontSize = ann.fontSize * scaleY;
          const pdfX = ann.x * scaleX;
          const pdfY = pdfHeight - (ann.y + ann.fontSize) * scaleY;

          // In-Place replacement whiteout background if specified
          if (ann.backgroundColor) {
            const boxW = (ann.width || ann.text.length * ann.fontSize * 0.6) * scaleX + 4;
            const boxH = (ann.height || ann.fontSize * 1.3) * scaleY;
            const boxY = pdfHeight - (ann.y + (ann.height || ann.fontSize * 1.15)) * scaleY;
            page.drawRectangle({
              x: Math.max(0, pdfX - 2),
              y: Math.max(0, boxY),
              width: boxW,
              height: boxH,
              color: hexToRgbColor(ann.backgroundColor)
            });
          }

          page.drawText(ann.text, {
            x: pdfX,
            y: Math.max(0, pdfY),
            size: pdfFontSize,
            font: chosenFont,
            color: hexToRgbColor(ann.color || '#000000')
          });
        } else if (ann.type === 'freehand') {
          if (ann.points && ann.points.length > 1) {
            for (let i = 1; i < ann.points.length; i++) {
              const p1 = ann.points[i - 1];
              const p2 = ann.points[i];
              page.drawLine({
                start: { x: p1.x * scaleX, y: pdfHeight - p1.y * scaleY },
                end: { x: p2.x * scaleX, y: pdfHeight - p2.y * scaleY },
                thickness: (ann.strokeWidth || 2) * scaleX,
                color: hexToRgbColor(ann.color || '#0f172a')
              });
            }
          }
        } else if (ann.type === 'stamp') {
          const sX = ann.x * scaleX;
          const sY = pdfHeight - (ann.y + ann.size) * scaleY;
          const sSize = ann.size * scaleY;

          if (ann.stampType === 'check') {
            // Draw checkmark path
            page.drawLine({
              start: { x: sX, y: sY + sSize * 0.4 },
              end: { x: sX + sSize * 0.35, y: sY },
              thickness: Math.max(2, sSize * 0.12),
              color: hexToRgbColor(ann.color || '#16a34a')
            });
            page.drawLine({
              start: { x: sX + sSize * 0.35, y: sY },
              end: { x: sX + sSize, y: sY + sSize * 0.85 },
              thickness: Math.max(2, sSize * 0.12),
              color: hexToRgbColor(ann.color || '#16a34a')
            });
          } else if (ann.stampType === 'cross') {
            // Draw X
            page.drawLine({
              start: { x: sX, y: sY },
              end: { x: sX + sSize, y: sY + sSize },
              thickness: Math.max(2, sSize * 0.12),
              color: hexToRgbColor(ann.color || '#dc2626')
            });
            page.drawLine({
              start: { x: sX, y: sY + sSize },
              end: { x: sX + sSize, y: sY },
              thickness: Math.max(2, sSize * 0.12),
              color: hexToRgbColor(ann.color || '#dc2626')
            });
          } else if (ann.stampType === 'date' && ann.text) {
            page.drawText(ann.text, {
              x: sX,
              y: sY,
              size: Math.max(10, sSize * 0.6),
              font: fontHelveticaBold,
              color: hexToRgbColor(ann.color || '#0284c7')
            });
          }
        } else if (ann.type === 'signature' || ann.type === 'image') {
          try {
            const dataUrl = ann.imageDataUrl;
            let embeddedImage;
            if (dataUrl.includes('image/png') || dataUrl.includes('image/webp')) {
              embeddedImage = await pdfDoc.embedPng(dataUrl);
            } else {
              embeddedImage = await pdfDoc.embedJpg(dataUrl);
            }

            const pdfX = ann.x * scaleX;
            const pdfW = ann.width * scaleX;
            const pdfH = ann.height * scaleY;
            const pdfY = pdfHeight - (ann.y + ann.height) * scaleY;

            page.drawImage(embeddedImage, {
              x: pdfX,
              y: pdfY,
              width: pdfW,
              height: pdfH
            });
          } catch (err) {
            console.error('Failed to embed signature/image annotation:', err);
          }
        } else if (ann.type === 'whiteout') {
          const pdfX = ann.x * scaleX;
          const pdfW = ann.width * scaleX;
          const pdfH = ann.height * scaleY;
          const pdfY = pdfHeight - (ann.y + ann.height) * scaleY;

          page.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: pdfW,
            height: pdfH,
            color: hexToRgbColor(ann.color || '#FFFFFF')
          });
        } else if (ann.type === 'highlight') {
          const pdfX = ann.x * scaleX;
          const pdfW = ann.width * scaleX;
          const pdfH = ann.height * scaleY;
          const pdfY = pdfHeight - (ann.y + ann.height) * scaleY;

          page.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: pdfW,
            height: pdfH,
            color: hexToRgbColor(ann.color || '#FDE047'),
            opacity: ann.opacity ?? 0.35
          });
        } else if (ann.type === 'rectangle') {
          const pdfX = ann.x * scaleX;
          const pdfW = ann.width * scaleX;
          const pdfH = ann.height * scaleY;
          const pdfY = pdfHeight - (ann.y + ann.height) * scaleY;

          page.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: pdfW,
            height: pdfH,
            borderColor: hexToRgbColor(ann.strokeColor || '#0284c7'),
            borderWidth: (ann.strokeWidth || 2) * scaleX,
            color: ann.fillColor ? hexToRgbColor(ann.fillColor) : undefined
          });
        } else if (ann.type === 'circle') {
          const pdfX = (ann.x + ann.width / 2) * scaleX;
          const pdfY = pdfHeight - (ann.y + ann.height / 2) * scaleY;
          const radiusX = (ann.width / 2) * scaleX;
          const radiusY = (ann.height / 2) * scaleY;

          page.drawEllipse({
            x: pdfX,
            y: pdfY,
            xScale: radiusX,
            yScale: radiusY,
            borderColor: hexToRgbColor(ann.strokeColor || '#0284c7'),
            borderWidth: (ann.strokeWidth || 2) * scaleX,
            color: ann.fillColor ? hexToRgbColor(ann.fillColor) : undefined
          });
        } else if (ann.type === 'line' || ann.type === 'arrow') {
          const startX = ann.x * scaleX;
          const startY = pdfHeight - ann.y * scaleY;
          const endX = (ann.x + ann.width) * scaleX;
          const endY = pdfHeight - (ann.y + ann.height) * scaleY;

          page.drawLine({
            start: { x: startX, y: startY },
            end: { x: endX, y: endY },
            thickness: (ann.strokeWidth || 2) * scaleX,
            color: hexToRgbColor(ann.strokeColor || '#0284c7')
          });

          if (ann.type === 'arrow') {
            // Draw arrowhead
            const angle = Math.atan2(endY - startY, endX - startX);
            const headLen = 10 * scaleX;
            page.drawLine({
              start: { x: endX, y: endY },
              end: {
                x: endX - headLen * Math.cos(angle - Math.PI / 6),
                y: endY - headLen * Math.sin(angle - Math.PI / 6)
              },
              thickness: (ann.strokeWidth || 2) * scaleX,
              color: hexToRgbColor(ann.strokeColor || '#0284c7')
            });
            page.drawLine({
              start: { x: endX, y: endY },
              end: {
                x: endX - headLen * Math.cos(angle + Math.PI / 6),
                y: endY - headLen * Math.sin(angle + Math.PI / 6)
              },
              thickness: (ann.strokeWidth || 2) * scaleX,
              color: hexToRgbColor(ann.strokeColor || '#0284c7')
            });
          }
        }
      }
    }

    return await pdfDoc.save();
  }

  /**
   * Rotate a specific page 90 degrees clockwise
   */
  static async rotatePage(pdfBytes: Uint8Array, pageIndex: number): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes.slice());
    const pages = pdfDoc.getPages();
    if (pageIndex >= 0 && pageIndex < pages.length) {
      const page = pages[pageIndex];
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees((currentRotation + 90) % 360));
    }
    return await pdfDoc.save();
  }

  /**
   * Delete a page from the PDF
   */
  static async deletePage(pdfBytes: Uint8Array, pageIndex: number): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes.slice());
    if (pdfDoc.getPageCount() <= 1) {
      throw new Error('Cannot delete the only page in the document.');
    }
    pdfDoc.removePage(pageIndex);
    return await pdfDoc.save();
  }

  /**
   * Duplicate a page in the PDF
   */
  static async duplicatePage(pdfBytes: Uint8Array, pageIndex: number): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes.slice());
    const [copiedPage] = await pdfDoc.copyPages(pdfDoc, [pageIndex]);
    pdfDoc.insertPage(pageIndex + 1, copiedPage);
    return await pdfDoc.save();
  }

  /**
   * Insert a blank page after the given index
   */
  static async insertBlankPage(pdfBytes: Uint8Array, insertAfterIndex: number): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes.slice());
    const refPage = pdfDoc.getPage(Math.max(0, Math.min(insertAfterIndex, pdfDoc.getPageCount() - 1)));
    const { width, height } = refPage.getSize();
    pdfDoc.insertPage(insertAfterIndex + 1, [width, height]);
    return await pdfDoc.save();
  }
}
