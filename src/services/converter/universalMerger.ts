import { PDFDocument } from 'pdf-lib';
import type { QueueItem } from './types';
import { OfficeConverter } from './officeConverter';
import { CadConverter } from './cadConverter';
import { ImageConverter } from './imageConverter';

export class UniversalMerger {
  /**
   * Convert any single item (Word, Excel, CAD DXF, Images, Text, PDF) into standardized PDF bytes
   */
  static async convertItemToPdf(item: QueueItem): Promise<Uint8Array> {
    const ext = item.name.split('.').pop()?.toLowerCase() || '';

    // 1. PDF - direct bytes
    if (ext === 'pdf') {
      return item.bytes;
    }

    // 2. Word documents (.docx)
    if (ext === 'docx') {
      return await OfficeConverter.docxToPdf(item.bytes, item.name);
    }

    // 3. Excel spreadsheets (.xlsx, .xls)
    if (ext === 'xlsx' || ext === 'xls') {
      return await OfficeConverter.xlsxToPdf(item.bytes, item.name);
    }

    // 4. CAD Drawings (.dwg, .dxf)
    if (ext === 'dxf' || ext === 'dwg') {
      return await CadConverter.cadToPdf(item.bytes, item.name);
    }

    // 5. Images (.jpg, .jpeg, .png, .webp, .bmp)
    if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'svg'].includes(ext)) {
      return await ImageConverter.singleImageToPdf(item.bytes, item.name);
    }

    // 6. Plain text, markdown, csv, json
    if (['txt', 'md', 'json', 'csv', 'log'].includes(ext)) {
      return await OfficeConverter.textToPdf(item.bytes, item.name);
    }

    throw new Error(`Unsupported document extension .${ext} for file "${item.name}"`);
  }

  /**
   * Universal Multi-Document Staggered Fusion:
   * Takes an arbitrary array of heterogeneous items:
   * (e.g. 2 Word docs + 3 JPGs + 2 PNGs + 1 Excel + 3 Word docs + existing PDFs)
   * Converts each one in-memory and merges them all into one Master PDF in the exact order requested!
   */
  static async fuseMultipleDocuments(
    items: QueueItem[],
    onProgress?: (current: number, total: number, name: string) => void
  ): Promise<Uint8Array> {
    const masterDoc = await PDFDocument.create();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (onProgress) onProgress(i + 1, items.length, item.name);

      const pdfBytes = await this.convertItemToPdf(item);

      try {
        const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const copiedPages = await masterDoc.copyPages(doc, doc.getPageIndices());
        copiedPages.forEach((p) => masterDoc.addPage(p));
      } catch (err: any) {
        console.error(`Error copying pages for item ${item.name}:`, err);
        throw new Error(`Failed to append converted PDF for "${item.name}": ${err.message}`);
      }
    }

    return await masterDoc.save();
  }
}
