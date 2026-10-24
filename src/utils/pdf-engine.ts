import { PDFDocument, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { JobAsset, JobPage, AssetEdits } from '../types';
import { mmToPt } from './units';
import { loadImage, renderProcessedCanvas } from './image-processing';

// Set PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

/**
 * Generate a production-ready, physically accurate multi-page PDF using pdf-lib
 */
export async function generatePrintPdf(
  pages: JobPage[],
  assets: JobAsset[],
  editsMap: Record<string, AssetEdits>
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const assetMap = new Map<string, JobAsset>();
  assets.forEach((a) => assetMap.set(a.id, a));

  // Cache rendered image buffers so multiple copies of the same photo don't get re-rendered
  const renderedImageCache = new Map<string, { buffer: Uint8Array; isPng: boolean }>();

  for (const page of pages) {
    const pageWidthPt = mmToPt(page.width_mm);
    const pageHeightPt = mmToPt(page.height_mm);

    const pdfPage = pdfDoc.addPage([pageWidthPt, pageHeightPt]);

    // Draw page background if specified
    if (page.background_color && page.background_color.toUpperCase() !== '#FFFFFF') {
      const hex = page.background_color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      pdfPage.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidthPt,
        height: pageHeightPt,
        color: rgb(r, g, b),
      });
    }

    if (!page.items || page.items.length === 0) continue;

    for (const item of page.items) {
      const asset = assetMap.get(item.asset_id);
      if (!asset) continue;

      const cacheKey = `${item.asset_id}_${editsMap[item.asset_id]?.revision || 1}`;
      let cached = renderedImageCache.get(cacheKey);

      if (!cached) {
        // Render processed image
        const imgUrl = asset.preview_url || asset.original_path;
        if (!imgUrl) continue;

        try {
          const imgElem = await loadImage(imgUrl);
          const edits = editsMap[item.asset_id] || {
            rotation_degrees: 0,
            straighten_degrees: 0,
            crop_x: null,
            crop_y: null,
            crop_width: null,
            crop_height: null,
            brightness: 0,
            contrast: 1,
            saturation: 1,
            sharpness: 0,
            grayscale: false,
            text_darkening: 0,
            background_mode: 'original',
          };

          const canvas = await renderProcessedCanvas(imgElem, edits as any);
          const isPng = edits.background_mode === 'transparent';
          const mime = isPng ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(mime, 0.95);

          const base64Data = dataUrl.split(',')[1];
          const binaryStr = atob(base64Data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          cached = { buffer: bytes, isPng };
          renderedImageCache.set(cacheKey, cached);
        } catch (err) {
          console.error('Failed to render item for PDF:', item, err);
          continue;
        }
      }

      // Embed image in PDF
      const embeddedImage = cached.isPng
        ? await pdfDoc.embedPng(cached.buffer)
        : await pdfDoc.embedJpg(cached.buffer);

      const itemWidthPt = mmToPt(item.width_mm);
      const itemHeightPt = mmToPt(item.height_mm);
      const itemXPt = mmToPt(item.position_x_mm);
      // In PDF, origin is bottom-left, so Y = pageHeight - topPosition - itemHeight
      const itemYPt = pageHeightPt - mmToPt(item.position_y_mm) - itemHeightPt;

      pdfPage.drawImage(embeddedImage, {
        x: itemXPt,
        y: itemYPt,
        width: itemWidthPt,
        height: itemHeightPt,
      });
    }
  }

  return await pdfDoc.save();
}

/**
 * Render imported PDF document pages into high-res images using PDF.js
 */
export async function renderPdfPages(
  pdfDataUrlOrBuffer: string | ArrayBuffer
): Promise<{ pageIndex: number; dataUrl: string; width: number; height: number }[]> {
  const loadingTask = pdfjsLib.getDocument(pdfDataUrlOrBuffer);
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const results = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for crisp print preview

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx, viewport }).promise;

    results.push({
      pageIndex: i,
      dataUrl: canvas.toDataURL('image/jpeg', 0.92),
      width: Math.round(viewport.width / 2),
      height: Math.round(viewport.height / 2),
    });
  }

  return results;
}
