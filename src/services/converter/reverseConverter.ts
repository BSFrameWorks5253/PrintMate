import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';

if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.mjs', window.location.href).href;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }
}

export class ReverseConverter {
  /**
   * Load PDF proxy safely without detaching the caller's ArrayBuffer
   */
  static async loadPdf(bytes: Uint8Array): Promise<pdfjsLib.PDFDocumentProxy> {
    // ALWAYS clone the bytes so worker transfer does not detach caller's buffer!
    const safeBytes = new Uint8Array(bytes.slice());
    const loadingTask = pdfjsLib.getDocument({
      data: safeBytes,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true
    });
    return await loadingTask.promise;
  }

  /**
   * Convert PDF to Word (.docx)
   */
  static async pdfToDocx(pdfBytes: Uint8Array, _baseName?: string): Promise<Uint8Array> {
    const pdfDoc = await this.loadPdf(pdfBytes);
    const zip = new JSZip();

    let docXmlBody = '';

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();

      docXmlBody += `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0284C7"/></w:rPr><w:t>Page ${i}</w:t></w:r></w:p>`;

      let currentParagraph = '';
      for (const item of textContent.items as any[]) {
        const str = (item.str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (str.trim().length > 0) {
          currentParagraph += str + ' ';
        }
        if (item.hasEOL || currentParagraph.length > 200) {
          docXmlBody += `<w:p><w:r><w:t>${currentParagraph.trim()}</w:t></w:r></w:p>`;
          currentParagraph = '';
        }
      }
      if (currentParagraph.trim().length > 0) {
        docXmlBody += `<w:p><w:r><w:t>${currentParagraph.trim()}</w:t></w:r></w:p>`;
      }

      if (i < pdfDoc.numPages) {
        docXmlBody += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      }
    }

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${docXmlBody}
    <w:sectPr/>
  </w:body>
</w:document>`;

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    zip.file('[Content_Types].xml', contentTypesXml);
    zip.file('_rels/.rels', relsXml);
    zip.file('word/document.xml', documentXml);

    return await zip.generateAsync({ type: 'uint8array' });
  }

  /**
   * Convert PDF to an array of high-res image files
   * If 1 page: named <PdfName>.jpg
   * If >1 pages: named <PdfName>_Page_001.jpg, <PdfName>_Page_002.jpg
   */
  static async renderPdfPagesToImages(
    pdfBytes: Uint8Array,
    baseName: string,
    scale: number = 2.0,
    format: 'jpg' | 'png' = 'jpg',
    onProgress?: (current: number, total: number) => void
  ): Promise<{ totalPages: number; images: Array<{ name: string; bytes: Uint8Array }> }> {
    const pdfDoc = await this.loadPdf(pdfBytes);
    const totalPages = pdfDoc.numPages;
    const images: Array<{ name: string; bytes: Uint8Array }> = [];
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpg' ? 'jpg' : 'png';

    for (let i = 1; i <= totalPages; i++) {
      if (onProgress) onProgress(i, totalPages);
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      await (page.render as any)({ canvasContext: ctx, viewport, canvas }).promise;

      // Ultra-fast native C++ image encoding via canvas.toBlob (no main-thread JS base64 freezing)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92));
      const arrayBuffer = blob ? await blob.arrayBuffer() : new ArrayBuffer(0);
      const bytes = new Uint8Array(arrayBuffer);

      const filename = totalPages === 1 
        ? `${baseName}.${ext}`
        : `${baseName}_Page_${String(i).padStart(3, '0')}.${ext}`;

      images.push({ name: filename, bytes });
      // Clear canvas size to free GPU buffer immediately
      canvas.width = 0;
      canvas.height = 0;
    }

    return { totalPages, images };
  }

  /**
   * Convert PDF to ZIP archive of high-res page images
   */
  static async pdfToImagesZip(
    pdfBytes: Uint8Array,
    baseName: string,
    scale: number = 2.0,
    format: 'png' | 'jpeg' = 'png',
    onProgress?: (current: number, total: number) => void
  ): Promise<Uint8Array> {
    const pdfDoc = await this.loadPdf(pdfBytes);
    const zip = new JSZip();
    const folder = zip.folder(`${baseName}_Images`) || zip;

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      if (onProgress) onProgress(i, pdfDoc.numPages);
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      await (page.render as any)({ canvasContext: ctx, viewport, canvas }).promise;

      const dataUrl = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.92);
      const base64Data = dataUrl.split(',')[1];
      const pageNumStr = String(i).padStart(3, '0');
      folder.file(`Page_${pageNumStr}.${format}`, base64Data, { base64: true });
    }

    return await zip.generateAsync({ type: 'uint8array' });
  }

  /**
   * Convert PDF text content into an Excel spreadsheet
   */
  static async pdfToExcel(pdfBytes: Uint8Array, _baseName?: string): Promise<Uint8Array> {
    const pdfDoc = await this.loadPdf(pdfBytes);
    const workbook = XLSX.utils.book_new();

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();

      const rows: string[][] = [];
      let currentRow: string[] = [];
      let lastY = -1;

      for (const item of textContent.items as any[]) {
        const text = (item.str || '').trim();
        if (!text) continue;

        const y = Math.round(item.transform[5]);
        if (lastY === -1 || Math.abs(y - lastY) < 6) {
          currentRow.push(text);
        } else {
          if (currentRow.length > 0) rows.push(currentRow);
          currentRow = [text];
        }
        lastY = y;
      }
      if (currentRow.length > 0) rows.push(currentRow);

      const worksheet = XLSX.utils.aoa_to_sheet(rows.length > 0 ? rows : [['No text content extracted']]);
      XLSX.utils.book_append_sheet(workbook, worksheet, `Page_${i}`);
    }

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Uint8Array(excelBuffer);
  }

  /**
   * Extract plain text across all pages
   */
  static async pdfToText(pdfBytes: Uint8Array): Promise<string> {
    const pdfDoc = await this.loadPdf(pdfBytes);
    let fullText = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageLines = textContent.items.map((item: any) => item.str || '').join(' ');
      fullText += `=== Page ${i} ===\n${pageLines}\n\n`;
    }
    return fullText;
  }
  /**
   * Perform Optical Character Recognition (OCR) on scanned PDF pages or image PDFs
   */
  static async pdfToOcrText(
    pdfBytes: Uint8Array,
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<string> {
    const pdfDoc = await this.loadPdf(pdfBytes);
    let fullOcrText = '';

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      if (onProgress) onProgress(i, pdfDoc.numPages, `OCR scanning page ${i} of ${pdfDoc.numPages}...`);
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      await (page.render as any)({ canvasContext: ctx, viewport, canvas }).promise;

      const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
      fullOcrText += `=== Page ${i} (OCR Extracted) ===\n${text.trim()}\n\n`;
    }

    return fullOcrText;
  }
}

export async function convertPdfToDocx(
  buffer: ArrayBuffer,
  onProgress?: (percent: number, msg: string) => void
): Promise<Blob> {
  if (onProgress) onProgress(20, 'Parsing PDF text structure...');
  const bytes = new Uint8Array(buffer);
  const docxBytes = await ReverseConverter.pdfToDocx(bytes, 'Document');
  if (onProgress) onProgress(100, 'Word document generated!');
  return new Blob([docxBytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export async function convertPdfToImagesZip(
  buffer: ArrayBuffer,
  onProgress?: (percent: number, msg: string) => void
): Promise<Blob> {
  const bytes = new Uint8Array(buffer);
  const zipBytes = await ReverseConverter.pdfToImagesZip(
    bytes,
    'Document_Pages',
    2.0,
    'png',
    (curr, tot) => {
      const pct = Math.round((curr / tot) * 90);
      if (onProgress) onProgress(pct, `Rendering page ${curr} of ${tot}...`);
    }
  );
  if (onProgress) onProgress(100, 'ZIP packaging complete!');
  return new Blob([zipBytes as BlobPart], { type: 'application/zip' });
}

export async function convertPdfToExcel(
  buffer: ArrayBuffer,
  onProgress?: (percent: number, msg: string) => void
): Promise<Blob> {
  if (onProgress) onProgress(30, 'Parsing tabular contents...');
  const bytes = new Uint8Array(buffer);
  const xlsxBytes = await ReverseConverter.pdfToExcel(bytes, 'Spreadsheet');
  if (onProgress) onProgress(100, 'Excel workbook generated!');
  return new Blob([xlsxBytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function convertPdfToText(
  buffer: ArrayBuffer,
  onProgress?: (percent: number, msg: string) => void
): Promise<Blob> {
  if (onProgress) onProgress(40, 'Extracting unicode strings...');
  const bytes = new Uint8Array(buffer);
  const textStr = await ReverseConverter.pdfToText(bytes);
  if (onProgress) onProgress(100, 'Text extraction complete!');
  return new Blob([textStr], { type: 'text/plain;charset=utf-8' });
}

export async function convertPdfWithOcr(
  buffer: ArrayBuffer,
  onProgress?: (percent: number, msg: string) => void
): Promise<Blob> {
  const bytes = new Uint8Array(buffer);
  const textStr = await ReverseConverter.pdfToOcrText(bytes, (curr, tot, msg) => {
    const pct = Math.round((curr / tot) * 100);
    if (onProgress) onProgress(pct, msg);
  });
  if (onProgress) onProgress(100, 'OCR scanning complete!');
  return new Blob([textStr], { type: 'text/plain;charset=utf-8' });
}

