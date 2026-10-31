import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { jsPDF } from 'jspdf';

export class OfficeConverter {
  /**
   * Convert Word (.docx) file bytes into clean vector PDF
   */
  static async docxToPdf(docxBytes: Uint8Array, filename: string): Promise<Uint8Array> {
    const arrayBuffer = docxBytes.buffer.slice(docxBytes.byteOffset, docxBytes.byteOffset + docxBytes.byteLength) as ArrayBuffer;
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const html = result.value;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(15, 23, 42);
    pdf.text(filename.replace(/\.docx$/i, ''), margin, margin + 10);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Master Document Converter Studio • ${new Date().toLocaleDateString()}`, margin, margin + 25);

    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, margin + 35, pageWidth - margin, margin + 35);

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    let y = margin + 55;
    const elements = tempDiv.querySelectorAll('h1, h2, h3, p, li, table');

    if (elements.length === 0) {
      const rawText = tempDiv.textContent || 'Empty document';
      const lines = pdf.splitTextToSize(rawText, contentWidth);
      pdf.setFontSize(11);
      pdf.setTextColor(30, 41, 59);
      pdf.text(lines, margin, y);
    } else {
      for (const el of Array.from(elements)) {
        const tagName = el.tagName.toLowerCase();
        const text = el.textContent?.trim();
        if (!text) continue;

        if (tagName === 'h1') {
          if (y > pageHeight - 60) { pdf.addPage(); y = margin + 20; }
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(15);
          pdf.setTextColor(15, 23, 42);
          const lines = pdf.splitTextToSize(text, contentWidth);
          pdf.text(lines, margin, y);
          y += lines.length * 18 + 8;
        } else if (tagName === 'h2') {
          if (y > pageHeight - 50) { pdf.addPage(); y = margin + 20; }
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(13);
          pdf.setTextColor(30, 41, 59);
          const lines = pdf.splitTextToSize(text, contentWidth);
          pdf.text(lines, margin, y);
          y += lines.length * 16 + 6;
        } else if (tagName === 'li') {
          if (y > pageHeight - 40) { pdf.addPage(); y = margin + 20; }
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          pdf.setTextColor(51, 65, 85);
          const bullet = '• ' + text;
          const lines = pdf.splitTextToSize(bullet, contentWidth - 15);
          pdf.text(lines, margin + 15, y);
          y += lines.length * 14 + 4;
        } else {
          if (y > pageHeight - 40) { pdf.addPage(); y = margin + 20; }
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10.5);
          pdf.setTextColor(30, 41, 59);
          const lines = pdf.splitTextToSize(text, contentWidth);
          pdf.text(lines, margin, y);
          y += lines.length * 14 + 6;
        }
      }
    }

    const pdfBuffer = pdf.output('arraybuffer');
    return new Uint8Array(pdfBuffer);
  }

  /**
   * Convert Excel (.xlsx, .xls) sheets into structured tabular PDF
   */
  static async xlsxToPdf(xlsxBytes: Uint8Array, filename: string): Promise<Uint8Array> {
    const workbook = XLSX.read(xlsxBytes, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!data || data.length === 0) {
      throw new Error('Excel sheet is empty');
    }

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 35;
    const contentWidth = pageWidth - margin * 2;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(5, 150, 105);
    pdf.text(`EXCEL SHEET: ${filename.toUpperCase()} [${firstSheetName}]`, margin, margin + 5);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Total Rows: ${data.length} | Columns: ${data[0]?.length || 0} | Master Converter Studio`, margin, margin + 18);

    pdf.setDrawColor(209, 250, 229);
    pdf.line(margin, margin + 26, pageWidth - margin, margin + 26);

    const maxCols = Math.min(10, Math.max(...data.slice(0, 50).map((r) => r.length)));
    const colWidth = contentWidth / Math.max(1, maxCols);
    const rowHeight = 20;
    let y = margin + 45;

    for (let r = 0; r < Math.min(data.length, 300); r++) {
      if (y + rowHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin + 25;
      }

      const row = data[r] || [];
      const isHeader = r === 0;

      if (isHeader) {
        pdf.setFillColor(236, 253, 245);
        pdf.rect(margin, y - 13, contentWidth, rowHeight, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(6, 78, 59);
      } else {
        if (r % 2 === 1) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, y - 13, contentWidth, rowHeight, 'F');
        }
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(30, 41, 59);
      }

      for (let c = 0; c < maxCols; c++) {
        const val = row[c] != null ? String(row[c]) : '';
        const cellX = margin + c * colWidth;
        pdf.setDrawColor(226, 232, 240);
        pdf.rect(cellX, y - 13, colWidth, rowHeight);
        pdf.text(val.substring(0, 25), cellX + 5, y);
      }

      y += rowHeight;
    }

    const pdfBuffer = pdf.output('arraybuffer');
    return new Uint8Array(pdfBuffer);
  }

  /**
   * Convert plain text or markdown to PDF
   */
  static async textToPdf(textBytes: Uint8Array, filename: string): Promise<Uint8Array> {
    const text = new TextDecoder('utf-8').decode(textBytes);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text(filename, margin, margin + 10);

    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, margin + 20, pageWidth - margin, margin + 20);

    pdf.setFont('courier', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(30, 41, 59);

    const lines = pdf.splitTextToSize(text, contentWidth);
    let y = margin + 40;

    for (const line of lines) {
      if (y > pageHeight - margin) {
        pdf.addPage();
        y = margin + 20;
      }
      pdf.text(line, margin, y);
      y += 13;
    }

    const pdfBuffer = pdf.output('arraybuffer');
    return new Uint8Array(pdfBuffer);
  }
}
