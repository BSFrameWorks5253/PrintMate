import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Initialize PDF.js worker for web
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.mjs', window.location.href).href;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }
}

export interface PageThumbnail {
  pageIndex: number;
  pageNum: number;
  thumbnailUrl: string;
  rotation: number; // additional rotation in degrees (0, 90, 180, 270)
  isDeleted: boolean;
  originalRotation: number;
  width: number;
  height: number;
}

export class PdfPageStudioService {
  /**
   * Load PDF and render thumbnails for every page
   */
  static async loadThumbnails(
    pdfBytes: Uint8Array,
    onProgress?: (current: number, total: number) => void
  ): Promise<PageThumbnail[]> {
    // ALWAYS clone the bytes so worker transfer does not detach caller's buffer!
    const safeBytes = new Uint8Array(pdfBytes.slice());
    const loadingTask = pdfjsLib.getDocument({
      data: safeBytes,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true
    });
    const pdfDoc = await loadingTask.promise;
    const thumbnails: PageThumbnail[] = [];

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      if (onProgress) onProgress(i, pdfDoc.numPages);
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.35 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      await (page.render as any)({ canvasContext: ctx, viewport, canvas }).promise;

      thumbnails.push({
        pageIndex: i - 1,
        pageNum: i,
        thumbnailUrl: canvas.toDataURL('image/jpeg', 0.8),
        rotation: 0,
        isDeleted: false,
        originalRotation: page.rotate || 0,
        width: viewport.width,
        height: viewport.height
      });
    }

    return thumbnails;
  }

  /**
   * Export modified PDF applying page deletions, reordering, and rotations
   */
  static async exportModifiedPdf(
    originalBytes: Uint8Array,
    pages: PageThumbnail[]
  ): Promise<Uint8Array> {
    const safeBytes = new Uint8Array(originalBytes.slice());
    const sourceDoc = await PDFDocument.load(safeBytes);
    const newDoc = await PDFDocument.create();

    const activePages = pages.filter((p) => !p.isDeleted);
    if (activePages.length === 0) {
      throw new Error('At least one page must remain in the document.');
    }

    for (const pageInfo of activePages) {
      const [copiedPage] = await newDoc.copyPages(sourceDoc, [pageInfo.pageIndex]);
      const currentRot = copiedPage.getRotation().angle;
      copiedPage.setRotation(degrees((currentRot + pageInfo.rotation) % 360));
      newDoc.addPage(copiedPage);
    }

    return await newDoc.save();
  }

  /**
   * Split PDF into individual single-page PDFs bundled in a ZIP archive
   */
  static async splitIntoZip(
    originalBytes: Uint8Array,
    baseName: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<Uint8Array> {
    const safeBytes = new Uint8Array(originalBytes.slice());
    const sourceDoc = await PDFDocument.load(safeBytes);
    const pageCount = sourceDoc.getPageCount();
    const zip = new JSZip();
    const folder = zip.folder(`${baseName}_Split_Pages`) || zip;

    for (let i = 0; i < pageCount; i++) {
      if (onProgress) onProgress(i + 1, pageCount);
      const singleDoc = await PDFDocument.create();
      const [copiedPage] = await singleDoc.copyPages(sourceDoc, [i]);
      singleDoc.addPage(copiedPage);
      const singleBytes = await singleDoc.save();
      const pageStr = String(i + 1).padStart(3, '0');
      folder.file(`${baseName}_Page_${pageStr}.pdf`, singleBytes);
    }

    return await zip.generateAsync({ type: 'uint8array' });
  }

  /**
   * Extract a custom page range string like "1-3, 5, 8-10"
   */
  static async extractPageRange(
    originalBytes: Uint8Array,
    rangeStr: string
  ): Promise<Uint8Array> {
    const safeBytes = new Uint8Array(originalBytes.slice());
    const sourceDoc = await PDFDocument.load(safeBytes);
    const pageCount = sourceDoc.getPageCount();
    const indicesToExtract = new Set<number>();

    const parts = rangeStr.split(',').map((s) => s.trim());
    for (const part of parts) {
      if (!part) continue;
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const from = Math.max(1, Math.min(start, end));
          const to = Math.min(pageCount, Math.max(start, end));
          for (let p = from; p <= to; p++) {
            indicesToExtract.add(p - 1);
          }
        }
      } else {
        const p = parseInt(part, 10);
        if (!isNaN(p) && p >= 1 && p <= pageCount) {
          indicesToExtract.add(p - 1);
        }
      }
    }

    if (indicesToExtract.size === 0) {
      throw new Error(`Invalid page range "${rangeStr}". Please specify valid pages like 1-3, 5`);
    }

    const sortedIndices = Array.from(indicesToExtract).sort((a, b) => a - b);
    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(sourceDoc, sortedIndices);
    copiedPages.forEach((page) => newDoc.addPage(page));

    return await newDoc.save();
  }

  /**
   * Split PDF into Odd or Even pages
   */
  static async splitOddEven(
    originalBytes: Uint8Array,
    parity: 'odd' | 'even'
  ): Promise<Uint8Array> {
    const safeBytes = new Uint8Array(originalBytes.slice());
    const sourceDoc = await PDFDocument.load(safeBytes);
    const pageCount = sourceDoc.getPageCount();
    const indices: number[] = [];

    for (let i = 0; i < pageCount; i++) {
      const pageNum = i + 1;
      if (parity === 'odd' && pageNum % 2 !== 0) indices.push(i);
      if (parity === 'even' && pageNum % 2 === 0) indices.push(i);
    }

    if (indices.length === 0) {
      throw new Error(`No ${parity} pages found in the document.`);
    }

    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(sourceDoc, indices);
    copiedPages.forEach((page) => newDoc.addPage(page));

    return await newDoc.save();
  }

  /**
   * Split PDF into chunks of fixed number of pages bundled into a ZIP
   */
  static async splitByChunkSize(
    originalBytes: Uint8Array,
    baseName: string,
    chunkSize: number,
    onProgress?: (current: number, total: number) => void
  ): Promise<Uint8Array> {
    const safeBytes = new Uint8Array(originalBytes.slice());
    const sourceDoc = await PDFDocument.load(safeBytes);
    const totalPages = sourceDoc.getPageCount();
    const totalChunks = Math.ceil(totalPages / chunkSize);

    const zip = new JSZip();
    const folder = zip.folder(`${baseName}_Chunks_of_${chunkSize}`) || zip;

    for (let c = 0; c < totalChunks; c++) {
      if (onProgress) onProgress(c + 1, totalChunks);
      const startIdx = c * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, totalPages);
      const chunkIndices: number[] = [];
      for (let i = startIdx; i < endIdx; i++) chunkIndices.push(i);

      const chunkDoc = await PDFDocument.create();
      const copied = await chunkDoc.copyPages(sourceDoc, chunkIndices);
      copied.forEach((p) => chunkDoc.addPage(p));
      const chunkBytes = await chunkDoc.save();

      const partNum = String(c + 1).padStart(2, '0');
      folder.file(`${baseName}_Part_${partNum}_(P${startIdx + 1}-P${endIdx}).pdf`, chunkBytes);
    }

    return await zip.generateAsync({ type: 'uint8array' });
  }

  /**
   * Merge multiple PDF files in given sequence into one unified document
   */
  static async mergePdfs(
    pdfList: Array<{ bytes: Uint8Array; name: string }>,
    onProgress?: (current: number, total: number) => void
  ): Promise<Uint8Array> {
    if (pdfList.length === 0) {
      throw new Error('Please select at least one PDF to merge.');
    }

    const mergedDoc = await PDFDocument.create();

    for (let i = 0; i < pdfList.length; i++) {
      if (onProgress) onProgress(i + 1, pdfList.length);
      const safeBytes = new Uint8Array(pdfList[i].bytes.slice());
      const subDoc = await PDFDocument.load(safeBytes);
      const copiedPages = await mergedDoc.copyPages(subDoc, subDoc.getPageIndices());
      copiedPages.forEach((page) => mergedDoc.addPage(page));
    }

    return await mergedDoc.save({ useObjectStreams: true });
  }

  /**
   * Get total page count of a PDF file
   */
  static async getPageCount(pdfBytes: Uint8Array): Promise<number> {
    const safeBytes = new Uint8Array(pdfBytes.slice());
    const doc = await PDFDocument.load(safeBytes, { ignoreEncryption: true });
    return doc.getPageCount();
  }

  /**
   * Extract multiple ranges as separate PDFs.
   * If single range -> returns single PDF bytes
   * If multiple ranges -> bundles into a ZIP file
   */
  static async extractRangesSeparate(
    originalBytes: Uint8Array,
    ranges: Array<{ from: number; to: number }>,
    baseName: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ bytes: Uint8Array; name: string; isZip: boolean }> {
    const safeBytes = new Uint8Array(originalBytes.slice());
    const sourceDoc = await PDFDocument.load(safeBytes);
    const totalPages = sourceDoc.getPageCount();

    // Sanitize ranges
    const cleanRanges = ranges
      .map((r) => ({
        from: Math.max(1, Math.min(r.from, r.to)),
        to: Math.min(totalPages, Math.max(r.from, r.to))
      }))
      .filter((r) => r.from <= totalPages);

    if (cleanRanges.length === 0) {
      throw new Error('Please specify at least one valid page range.');
    }

    if (cleanRanges.length === 1) {
      const r = cleanRanges[0];
      const indices: number[] = [];
      for (let p = r.from; p <= r.to; p++) indices.push(p - 1);

      const singleDoc = await PDFDocument.create();
      const copied = await singleDoc.copyPages(sourceDoc, indices);
      copied.forEach((p) => singleDoc.addPage(p));
      const bytes = await singleDoc.save();

      return {
        bytes,
        name: `${baseName}_Pages_${r.from}-${r.to}.pdf`,
        isZip: false
      };
    }

    // Multiple ranges: Bundle each as a separate PDF into a ZIP
    const zip = new JSZip();
    const folder = zip.folder(`${baseName}_Split_Ranges`) || zip;

    for (let i = 0; i < cleanRanges.length; i++) {
      if (onProgress) onProgress(i + 1, cleanRanges.length);
      const r = cleanRanges[i];
      const indices: number[] = [];
      for (let p = r.from; p <= r.to; p++) indices.push(p - 1);

      const subDoc = await PDFDocument.create();
      const copied = await subDoc.copyPages(sourceDoc, indices);
      copied.forEach((p) => subDoc.addPage(p));
      const subBytes = await subDoc.save();

      const rangeIdxStr = String(i + 1).padStart(2, '0');
      folder.file(`${baseName}_Part_${rangeIdxStr}_(Pages_${r.from}-${r.to}).pdf`, subBytes);
    }

    const zipBytes = await zip.generateAsync({ type: 'uint8array' });
    return {
      bytes: zipBytes,
      name: `${baseName}_Split_Ranges.zip`,
      isZip: true
    };
  }

  /**
   * Extract all specified ranges combined into ONE single output PDF
   */
  static async extractRangesCombined(
    originalBytes: Uint8Array,
    ranges: Array<{ from: number; to: number }>,
    baseName: string
  ): Promise<{ bytes: Uint8Array; name: string; isZip: boolean }> {
    const safeBytes = new Uint8Array(originalBytes.slice());
    const sourceDoc = await PDFDocument.load(safeBytes);
    const totalPages = sourceDoc.getPageCount();

    const cleanRanges = ranges
      .map((r) => ({
        from: Math.max(1, Math.min(r.from, r.to)),
        to: Math.min(totalPages, Math.max(r.from, r.to))
      }))
      .filter((r) => r.from <= totalPages);

    if (cleanRanges.length === 0) {
      throw new Error('Please specify at least one valid page range.');
    }

    const allIndices: number[] = [];
    for (const r of cleanRanges) {
      for (let p = r.from; p <= r.to; p++) {
        allIndices.push(p - 1);
      }
    }

    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(sourceDoc, allIndices);
    copiedPages.forEach((p) => newDoc.addPage(p));
    const bytes = await newDoc.save();

    const rangeSummary = cleanRanges.map((r) => `${r.from}-${r.to}`).join('_');
    return {
      bytes,
      name: `${baseName}_Pages_${rangeSummary}.pdf`,
      isZip: false
    };
  }

  /**
   * Convert requested page numbers into high-quality JPGs bundled into a ZIP
   */
  static async extractPagesToJpgZip(
    originalBytes: Uint8Array,
    pageNumbers: number[],
    baseName: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ bytes: Uint8Array; name: string; isZip: boolean }> {
    const safeBytes = new Uint8Array(originalBytes.slice());
    const loadingTask = pdfjsLib.getDocument({
      data: safeBytes,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true
    });
    const pdfDoc = await loadingTask.promise;
    const totalDocPages = pdfDoc.numPages;

    const validPageNums = Array.from(new Set(pageNumbers))
      .filter((p) => p >= 1 && p <= totalDocPages)
      .sort((a, b) => a - b);

    if (validPageNums.length === 0) {
      throw new Error('No valid pages found to export as JPG.');
    }

    const zip = new JSZip();
    const folder = zip.folder(`${baseName}_JPG_Images`) || zip;

    for (let i = 0; i < validPageNums.length; i++) {
      const pageNum = validPageNums[i];
      if (onProgress) onProgress(i + 1, validPageNums.length);

      const page = await pdfDoc.getPage(pageNum);
      // Scale 2.0 provides ~150-200 DPI crisp print/preview resolution
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      await (page.render as any)({
        canvasContext: ctx,
        viewport,
        canvas
      }).promise;

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const base64 = dataUrl.split(',')[1];
      const pagePad = String(pageNum).padStart(3, '0');
      folder.file(`${baseName}_Page_${pagePad}.jpg`, base64, { base64: true });
    }

    const zipBytes = await zip.generateAsync({ type: 'uint8array' });
    return {
      bytes: zipBytes,
      name: `${baseName}_Pages_JPG.zip`,
      isZip: true
    };
  }
}
