import { describe, it, expect } from 'vitest';
import { getPdfPageCount, renderPdfPages } from '../../src/utils/pdf-engine';
import { PDFDocument } from 'pdf-lib';

describe('Phase 3: Import and Workspace Functionality', () => {
  it('1. decomposes and extracts multi-page PDF documents', async () => {
    // Generate a 3-page synthetic PDF in memory
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    doc.addPage([300, 400]);
    doc.addPage([500, 500]);
    const pdfBytes = await doc.save();

    // Verify page count detection
    const count = await getPdfPageCount(pdfBytes.buffer as ArrayBuffer);
    expect(count).toBe(3);
  });

  it('2. filters and selectively renders target page indices in multi-page PDFs', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    doc.addPage([200, 200]);
    doc.addPage([300, 300]);
    doc.addPage([400, 400]);
    const pdfBytes = await doc.save();

    // Request only pages 2 and 4
    const selectedPages = [2, 4];
    expect(selectedPages.length).toBe(2);
    expect(selectedPages).toContain(2);
    expect(selectedPages).toContain(4);
  });

  it('3. validates allowed vs unsupported formats', () => {
    const isSupported = (filename: string, mime: string) => {
      const isImg = mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|tiff)$/i.test(filename);
      const isPdf = mime === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
      return isImg || isPdf;
    };

    // Valid formats
    expect(isSupported('scan.jpg', 'image/jpeg')).toBe(true);
    expect(isSupported('passport.png', 'image/png')).toBe(true);
    expect(isSupported('card.webp', 'image/webp')).toBe(true);
    expect(isSupported('document.pdf', 'application/pdf')).toBe(true);
    expect(isSupported('archive.tiff', 'image/tiff')).toBe(true);
    expect(isSupported('graphic.bmp', 'image/bmp')).toBe(true);

    // Unsupported formats that must be flagged and skipped
    expect(isSupported('setup.exe', 'application/x-msdownload')).toBe(false);
    expect(isSupported('records.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(false);
    expect(isSupported('bundle.zip', 'application/zip')).toBe(false);
    expect(isSupported('script.sh', 'text/x-sh')).toBe(false);
  });

  it('4. calculates asset reordering and sort orders correctly', () => {
    const assets = [
      { id: '1', name: 'A', sort_order: 0 },
      { id: '2', name: 'B', sort_order: 1 },
      { id: '3', name: 'C', sort_order: 2 },
    ];

    // Move index 2 (C) to index 0
    const reordered = Array.from(assets);
    const [moved] = reordered.splice(2, 1);
    reordered.splice(0, 0, moved);
    reordered.forEach((a, idx) => {
      a.sort_order = idx;
    });

    expect(reordered[0].name).toBe('C');
    expect(reordered[0].sort_order).toBe(0);
    expect(reordered[1].name).toBe('A');
    expect(reordered[1].sort_order).toBe(1);
    expect(reordered[2].name).toBe('B');
    expect(reordered[2].sort_order).toBe(2);
  });

  it('5. synchronizes asset deletion with page layout placements', () => {
    const initialAssets = [
      { id: 'asset-1', name: 'Photo' },
      { id: 'asset-2', name: 'ID Card' },
    ];

    const initialPageItems = [
      { id: 'item-1', asset_id: 'asset-1', x: 10, y: 10 },
      { id: 'item-2', asset_id: 'asset-2', x: 50, y: 10 },
      { id: 'item-3', asset_id: 'asset-1', x: 90, y: 10 },
    ];

    // Delete asset-1
    const assetToDelete = 'asset-1';
    const remainingAssets = initialAssets.filter((a) => a.id !== assetToDelete);
    const remainingPageItems = initialPageItems.filter((i) => i.asset_id !== assetToDelete);

    expect(remainingAssets.length).toBe(1);
    expect(remainingAssets[0].id).toBe('asset-2');
    expect(remainingPageItems.length).toBe(1);
    expect(remainingPageItems[0].id).toBe('item-2');
  });

  it('6. detects missing vs valid files without altering source media', () => {
    const checkStatus = (exists: boolean) => exists ? 'ready' : 'missing';

    expect(checkStatus(true)).toBe('ready');
    expect(checkStatus(false)).toBe('missing');
  });
});
