import { PDFDocument, degrees, StandardFonts, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import type { ImageGalleryItem } from './types';

export interface GalleryToPdfOptions {
  orientation?: 'auto' | 'portrait' | 'landscape';
  margin?: number;
  quality?: 'max' | 'balanced' | 'compact';
  filter?: 'none' | 'grayscale' | 'bw';
  layout?: 1 | 2 | 4;
  watermark?: string;
}

export class ImageConverter {
  /**
   * Robust image embedder with support for formats (JPG, PNG, WEBP, BMP, SVG),
   * image filtering (grayscale, clean document B&W scan), and smart compression levels.
   */
  private static async embedAnyImage(
    pdfDoc: PDFDocument,
    bytes: Uint8Array,
    previewUrl?: string,
    options?: { quality?: 'max' | 'balanced' | 'compact'; filter?: 'none' | 'grayscale' | 'bw' }
  ) {
    const filter = options?.filter || 'none';
    const quality = options?.quality || 'max';

    // If no filter and max quality, attempt direct native embed first
    if (filter === 'none' && quality === 'max') {
      try {
        return await pdfDoc.embedJpg(bytes);
      } catch {}
      try {
        return await pdfDoc.embedPng(bytes);
      } catch {}
    }

    // Canvas Processing Pipeline (Decodes, applies B&W/Grayscale filters, scales resolution, and compresses)
    let blob: Blob;
    if (previewUrl && previewUrl.startsWith('blob:')) {
      try {
        const res = await fetch(previewUrl);
        blob = await res.blob();
      } catch {
        blob = new Blob([bytes.slice() as BlobPart]);
      }
    } else {
      blob = new Blob([bytes.slice() as BlobPart]);
    }

    let bmp: ImageBitmap | null = null;
    let origW = 1200;
    let origH = 800;

    try {
      bmp = await createImageBitmap(blob);
      origW = bmp.width;
      origH = bmp.height;
    } catch {
      const img = new Image();
      const objUrl = URL.createObjectURL(blob);
      img.src = objUrl;
      await new Promise((res, rej) => {
        img.onload = () => res(null);
        img.onerror = () => rej(new Error('Image decoding failed'));
      });
      URL.revokeObjectURL(objUrl);
      origW = img.naturalWidth || 1200;
      origH = img.naturalHeight || 800;
    }

    // Scale resolution based on compression quality
    let targetW = origW;
    let targetH = origH;
    const maxDim = quality === 'compact' ? 1280 : quality === 'balanced' ? 1920 : 3840;

    if (targetW > maxDim || targetH > maxDim) {
      if (targetW > targetH) {
        targetH = Math.round((targetH * maxDim) / targetW);
        targetW = maxDim;
      } else {
        targetW = Math.round((targetW * maxDim) / targetH);
        targetH = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d')!;

    if (bmp) {
      ctx.drawImage(bmp, 0, 0, targetW, targetH);
      bmp.close();
    } else {
      const img = new Image();
      const objUrl = URL.createObjectURL(blob);
      img.src = objUrl;
      await new Promise((res) => { img.onload = res; });
      ctx.drawImage(img, 0, 0, targetW, targetH);
      URL.revokeObjectURL(objUrl);
    }

    // Apply document scan filters
    if (filter === 'grayscale' || filter === 'bw') {
      const imgData = ctx.getImageData(0, 0, targetW, targetH);
      const d = imgData.data;

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (filter === 'bw') {
          // CamScanner-style clean document enhancement:
          // Removes grayish/yellow background shadows and renders crisp text
          const val = lum > 168 ? 255 : Math.max(0, Math.min(255, (lum - 28) * 1.35));
          d[i] = val;
          d[i + 1] = val;
          d[i + 2] = val;
        } else {
          d[i] = lum;
          d[i + 1] = lum;
          d[i + 2] = lum;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const jpegQuality = quality === 'compact' ? 0.65 : quality === 'balanced' ? 0.82 : 0.94;
    const outBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', jpegQuality));
    if (!outBlob) throw new Error('Canvas JPEG encoding failed');

    const outBuffer = await outBlob.arrayBuffer();
    return await pdfDoc.embedJpg(new Uint8Array(outBuffer));
  }

  /**
   * Convert an image byte array to a high-quality PDF page
   */
  static async singleImageToPdf(
    imageBytes: Uint8Array,
    _filename?: string,
    options: { orientation?: 'auto' | 'portrait' | 'landscape'; margin?: number } = {}
  ): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const embeddedImg = await this.embedAnyImage(pdfDoc, imageBytes);

    const { width, height } = embeddedImg;

    const a4W = 595.28;
    const a4H = 841.89;

    let pageW = a4W;
    let pageH = a4H;

    const orientation = options.orientation || 'auto';
    if (orientation === 'landscape' || (orientation === 'auto' && width > height)) {
      pageW = a4H;
      pageH = a4W;
    }

    const margin = options.margin != null ? options.margin : 20;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const scale = Math.min(maxW / width, maxH / height, 1);

    const scaledW = width * scale;
    const scaledH = height * scale;

    const page = pdfDoc.addPage([pageW, pageH]);
    page.drawImage(embeddedImg, {
      x: (pageW - scaledW) / 2,
      y: (pageH - scaledH) / 2,
      width: scaledW,
      height: scaledH
    });

    return await pdfDoc.save();
  }

  /**
   * Convert multiple gallery items into a single unified multi-page PDF,
   * supporting layout grids (1, 2, or 4 photos per page), compression levels,
   * document scan filters, and diagonal security watermarking.
   */
  static async galleryToPdf(
    items: ImageGalleryItem[],
    options: GalleryToPdfOptions = {}
  ): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const layout = options.layout || 1;
    const a4W = 595.28;
    const a4H = 841.89;
    const margin = options.margin != null ? options.margin : 20;

    // Helper to embed diagonal security watermark
    const applyWatermark = async (page: any, pageW: number, pageH: number) => {
      if (!options.watermark || !options.watermark.trim()) return;
      const font = await pdfDoc.embedStandardFont(StandardFonts.HelveticaBold);
      const text = options.watermark.trim().toUpperCase();
      const textSize = Math.min(pageW, pageH) * 0.085;
      const textWidth = font.widthOfTextAtSize(text, textSize);
      page.drawText(text, {
        x: (pageW - textWidth * 0.7) / 2,
        y: pageH / 2,
        size: textSize,
        font,
        color: rgb(0.7, 0.7, 0.7),
        opacity: 0.22,
        rotate: degrees(45)
      });
    };

    if (layout === 1) {
      // 1 Photo per Page
      for (const item of items) {
        const embeddedImage = await this.embedAnyImage(pdfDoc, item.bytes, item.previewUrl, {
          quality: options.quality,
          filter: options.filter
        });

        let pageW = a4W;
        let pageH = a4H;

        const orientation = options.orientation || 'auto';
        if (orientation === 'landscape' || (orientation === 'auto' && embeddedImage.width > embeddedImage.height)) {
          pageW = a4H;
          pageH = a4W;
        }

        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;
        const scale = Math.min(maxW / embeddedImage.width, maxH / embeddedImage.height, 1);

        const scaledW = embeddedImage.width * scale;
        const scaledH = embeddedImage.height * scale;

        const page = pdfDoc.addPage([pageW, pageH]);

        if (item.rotation) {
          page.setRotation(degrees(item.rotation));
        }

        page.drawImage(embeddedImage, {
          x: (pageW - scaledW) / 2,
          y: (pageH - scaledH) / 2,
          width: scaledW,
          height: scaledH
        });

        await applyWatermark(page, pageW, pageH);
      }
    } else if (layout === 2) {
      // 2 Photos per Page (Side-by-Side in Landscape or Top/Bottom in Portrait)
      const orientation = options.orientation || 'portrait';
      const pageW = orientation === 'landscape' ? a4H : a4W;
      const pageH = orientation === 'landscape' ? a4W : a4H;

      for (let i = 0; i < items.length; i += 2) {
        const page = pdfDoc.addPage([pageW, pageH]);
        const chunk = items.slice(i, i + 2);

        for (let slot = 0; slot < chunk.length; slot++) {
          const item = chunk[slot];
          const embeddedImage = await this.embedAnyImage(pdfDoc, item.bytes, item.previewUrl, {
            quality: options.quality,
            filter: options.filter
          });

          let slotX = margin;
          let slotY = margin;
          let slotW = pageW - margin * 2;
          let slotH = (pageH - margin * 3) / 2;

          if (orientation === 'landscape') {
            slotW = (pageW - margin * 3) / 2;
            slotH = pageH - margin * 2;
            slotX = slot === 0 ? margin : margin * 2 + slotW;
            slotY = margin;
          } else {
            // In PDF coordinates, (0,0) is bottom-left
            slotY = slot === 0 ? margin * 2 + slotH : margin;
          }

          const scale = Math.min(slotW / embeddedImage.width, slotH / embeddedImage.height, 1);
          const scaledW = embeddedImage.width * scale;
          const scaledH = embeddedImage.height * scale;

          page.drawImage(embeddedImage, {
            x: slotX + (slotW - scaledW) / 2,
            y: slotY + (slotH - scaledH) / 2,
            width: scaledW,
            height: scaledH
          });
        }

        await applyWatermark(page, pageW, pageH);
      }
    } else if (layout === 4) {
      // 4 Photos per Page (2x2 Grid)
      const orientation = options.orientation || 'portrait';
      const pageW = orientation === 'landscape' ? a4H : a4W;
      const pageH = orientation === 'landscape' ? a4W : a4H;

      for (let i = 0; i < items.length; i += 4) {
        const page = pdfDoc.addPage([pageW, pageH]);
        const chunk = items.slice(i, i + 4);

        const slotW = (pageW - margin * 3) / 2;
        const slotH = (pageH - margin * 3) / 2;

        for (let slot = 0; slot < chunk.length; slot++) {
          const item = chunk[slot];
          const embeddedImage = await this.embedAnyImage(pdfDoc, item.bytes, item.previewUrl, {
            quality: options.quality,
            filter: options.filter
          });

          const col = slot % 2;
          const row = Math.floor(slot / 2); // 0 = top, 1 = bottom

          const slotX = margin + col * (slotW + margin);
          // row 0 is top half, row 1 is bottom half
          const slotY = row === 0 ? margin * 2 + slotH : margin;

          const scale = Math.min(slotW / embeddedImage.width, slotH / embeddedImage.height, 1);
          const scaledW = embeddedImage.width * scale;
          const scaledH = embeddedImage.height * scale;

          page.drawImage(embeddedImage, {
            x: slotX + (slotW - scaledW) / 2,
            y: slotY + (slotH - scaledH) / 2,
            width: scaledW,
            height: scaledH
          });
        }

        await applyWatermark(page, pageW, pageH);
      }
    }

    return await pdfDoc.save();
  }

  /**
   * Convert an ordered gallery of images into a Microsoft Word (.docx) document
   */
  static async imagesToDocx(items: ImageGalleryItem[], title = 'Images Collection'): Promise<Uint8Array> {
    const zip = new JSZip();

    let docXmlBody = `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0284C7"/></w:rPr><w:t>${title}</w:t></w:r></w:p>`;
    let relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    let docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;

    let contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const relId = `rIdImg${i + 1}`;
      const ext = item.name.split('.').pop()?.toLowerCase() || 'jpg';
      const imgFileName = `image_${i + 1}.${ext === 'png' ? 'png' : 'jpeg'}`;

      zip.file(`word/media/${imgFileName}`, item.bytes.slice());

      docRelsXml += `\n  <Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imgFileName}"/>`;

      // Accurately measure natural dimensions so aspect ratio is 100% preserved
      let naturalW = item.width || 1200;
      let naturalH = item.height || 800;

      try {
        const blob = new Blob([item.bytes.slice() as BlobPart]);
        const bmp = await createImageBitmap(blob);
        naturalW = bmp.width;
        naturalH = bmp.height;
        bmp.close();
      } catch {}

      if (item.rotation === 90 || item.rotation === 270) {
        const temp = naturalW;
        naturalW = naturalH;
        naturalH = temp;
      }

      // Word printable bounds in EMUs (1 inch = 914,400 EMUs, 1 pt = 12,700 EMUs)
      // Standard page printable width with margins: ~6.0 inches (5,486,400 EMUs)
      // Max height per page: ~7.5 inches (6,858,000 EMUs)
      const maxPrintableWidthEmu = 5486400;
      const maxPrintableHeightEmu = 6858000;

      const scale = Math.min(
        maxPrintableWidthEmu / naturalW,
        maxPrintableHeightEmu / naturalH
      );

      const emuW = Math.round(naturalW * scale);
      const emuH = Math.round(naturalH * scale);

      docXmlBody += `
      <w:p>
        <w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/></w:pPr>
        <w:r>
          <w:drawing>
            <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
              <wp:extent cx="${emuW}" cy="${emuH}"/>
              <wp:docPr id="${i + 1}" name="Picture ${i + 1}"/>
              <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                    <pic:nvPicPr>
                      <pic:cNvPr id="${i + 1}" name="${item.name}"/>
                      <pic:cNvPicPr/>
                    </pic:nvPicPr>
                    <pic:blipFill>
                      <a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                      <a:stretch><a:fillRect/></a:stretch>
                    </pic:blipFill>
                    <pic:spPr>
                      <a:xfrm><a:off x="0" y="0"/><a:ext cx="${emuW}" cy="${emuH}"/></a:xfrm>
                      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                    </pic:spPr>
                  </pic:pic>
                </a:graphicData>
              </a:graphic>
            </wp:inline>
          </w:drawing>
        </w:r>
      </w:p>
      <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="64748B"/></w:rPr><w:t>Page ${i + 1}: ${item.name}</w:t></w:r></w:p>`;

      if (i < items.length - 1) {
        docXmlBody += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      }
    }

    docRelsXml += '\n</Relationships>';

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${docXmlBody}
    <w:sectPr/>
  </w:body>
</w:document>`;

    zip.file('[Content_Types].xml', contentTypesXml);
    zip.file('_rels/.rels', relsXml);
    zip.file('word/_rels/document.xml.rels', docRelsXml);
    zip.file('word/document.xml', documentXml);

    return await zip.generateAsync({ type: 'uint8array' });
  }
}
