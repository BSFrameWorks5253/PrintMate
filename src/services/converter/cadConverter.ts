import DxfParser from 'dxf-parser';
import { jsPDF } from 'jspdf';

export interface CadStudioConfig {
  theme: 'blueprint' | 'monochrome' | 'layers' | 'clean';
  paperSize: 'a4' | 'a3' | 'a2' | 'a1' | 'letter';
  orientation: 'landscape' | 'portrait';
  scaleToFit: boolean;
}

export class CadConverter {
  /**
   * Convert AutoCAD DWG or DXF bytes into vector PDF with customizable architectural blueprint themes
   */
  static async cadToPdf(
    cadBytes: Uint8Array,
    filename: string,
    config: CadStudioConfig = { theme: 'blueprint', paperSize: 'a4', orientation: 'landscape', scaleToFit: true }
  ): Promise<Uint8Array> {
    const isDwg = filename.toLowerCase().endsWith('.dwg') ||
      (cadBytes.length > 4 &&
        cadBytes[0] === 0x41 && cadBytes[1] === 0x43 && cadBytes[2] === 0x31); // 'AC10' / 'AC1.'

    let dxfString: string;

    if (isDwg) {
      // DWG binary format requires native conversion – not supported in web browser.
      // Prompt user to convert DWG → DXF using a desktop tool (e.g., LibreCAD, FreeCAD, or AutoCAD export).
      throw new Error(
        'DWG binary format is not supported in the web app. Please export your drawing as DXF from AutoCAD or LibreCAD and upload that instead.'
      );
    } else {
      const textDecoder = new TextDecoder('utf-8');
      dxfString = textDecoder.decode(cadBytes);
    }

    return this.renderDxfStringToPdf(dxfString, filename, config);
  }

  /**
   * Backward-compatible DXF to PDF wrapper
   */
  static async dxfToPdf(
    dxfBytes: Uint8Array,
    filename: string,
    config: CadStudioConfig = { theme: 'blueprint', paperSize: 'a4', orientation: 'landscape', scaleToFit: true }
  ): Promise<Uint8Array> {
    return this.cadToPdf(dxfBytes, filename, config);
  }

  /**
   * High-Precision Vector Blueprint Renderer from DXF data string
   */
  static async renderDxfStringToPdf(
    dxfString: string,
    filename: string,
    config: CadStudioConfig
  ): Promise<Uint8Array> {
    const parser = new DxfParser();
    let dxfData: any;
    try {
      dxfData = parser.parseSync(dxfString);
    } catch (err: any) {
      console.error('DXF parse error:', err);
      throw new Error(`Could not parse CAD drawing data: ${err.message || 'Invalid format'}`);
    }

    if (!dxfData || !dxfData.entities || dxfData.entities.length === 0) {
      throw new Error('CAD drawing contains no drawable vector entities.');
    }

    // Compute comprehensive bounding box across all supported entities
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const ent of dxfData.entities) {
      if (ent.vertices && Array.isArray(ent.vertices)) {
        for (const v of ent.vertices) {
          if (typeof v.x === 'number' && isFinite(v.x)) {
            minX = Math.min(minX, v.x);
            maxX = Math.max(maxX, v.x);
          }
          if (typeof v.y === 'number' && isFinite(v.y)) {
            minY = Math.min(minY, v.y);
            maxY = Math.max(maxY, v.y);
          }
        }
      }
      if (ent.start && ent.end) {
        if (typeof ent.start.x === 'number') minX = Math.min(minX, ent.start.x, ent.end.x);
        if (typeof ent.start.y === 'number') minY = Math.min(minY, ent.start.y, ent.end.y);
        if (typeof ent.end.x === 'number') maxX = Math.max(maxX, ent.start.x, ent.end.x);
        if (typeof ent.end.y === 'number') maxY = Math.max(maxY, ent.start.y, ent.end.y);
      }
      if (ent.center && typeof ent.radius === 'number') {
        minX = Math.min(minX, ent.center.x - ent.radius);
        maxX = Math.max(maxX, ent.center.x + ent.radius);
        minY = Math.min(minY, ent.center.y - ent.radius);
        maxY = Math.max(maxY, ent.center.y + ent.radius);
      }
      if (ent.position && typeof ent.position.x === 'number' && typeof ent.position.y === 'number') {
        minX = Math.min(minX, ent.position.x);
        maxX = Math.max(maxX, ent.position.x);
        minY = Math.min(minY, ent.position.y);
        maxY = Math.max(maxY, ent.position.y);
      }
    }

    if (!isFinite(minX) || !isFinite(maxX) || minX === maxX) {
      minX = 0; maxX = 1000;
    }
    if (!isFinite(minY) || !isFinite(maxY) || minY === maxY) {
      minY = 0; maxY = 1000;
    }

    const cadWidth = Math.max(1, maxX - minX);
    const cadHeight = Math.max(1, maxY - minY);

    // Canvas rendering resolution
    const targetW = 2800;
    const targetH = 1980;
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d')!;

    const isBlueprint = config.theme === 'blueprint';
    const isLayers = config.theme === 'layers';

    // Canvas background
    ctx.fillStyle = isBlueprint ? '#091e3a' : isLayers ? '#0f172a' : '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);

    // Grid pattern for Blueprint & Layers themes
    if (isBlueprint || isLayers) {
      ctx.strokeStyle = isBlueprint ? 'rgba(30, 64, 175, 0.25)' : 'rgba(51, 65, 85, 0.35)';
      ctx.lineWidth = 1;
      const gridSize = 70;
      for (let gx = 0; gx < targetW; gx += gridSize) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, targetH);
        ctx.stroke();
      }
      for (let gy = 0; gy < targetH; gy += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(targetW, gy);
        ctx.stroke();
      }
    }

    // Title banner
    ctx.fillStyle = isBlueprint ? '#ffffff' : isLayers ? '#f8fafc' : '#0f172a';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`AUTOCAD DRAWING: ${filename.toUpperCase()}`, 70, 70);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = isBlueprint ? '#7dd3fc' : isLayers ? '#38bdf8' : '#64748b';
    ctx.fillText(
      `Extents: ${cadWidth.toFixed(1)} x ${cadHeight.toFixed(1)} mm | Entities: ${dxfData.entities.length} | Format: ${config.paperSize.toUpperCase()} | PrintMate Studio Pro`,
      70,
      105
    );

    const pad = 120;
    const drawW = targetW - pad * 2;
    const drawH = targetH - pad * 2 - 70;

    const scale = Math.min(drawW / cadWidth, drawH / cadHeight);
    const offsetX = pad + (drawW - cadWidth * scale) / 2;
    const offsetY = pad + 70 + (drawH - cadHeight * scale) / 2;

    const mapX = (x: number) => offsetX + (x - minX) * scale;
    const mapY = (y: number) => offsetY + (maxY - y) * scale;

    // Outer architectural drawing frame
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = isBlueprint ? '#1e40af' : isLayers ? '#334155' : '#cbd5e1';
    ctx.strokeRect(pad, pad + 70, drawW, drawH);

    // Entity rendering
    for (const ent of dxfData.entities) {
      ctx.beginPath();

      if (isBlueprint) {
        ctx.strokeStyle = '#e0f2fe';
        ctx.fillStyle = '#e0f2fe';
      } else if (isLayers && ent.color) {
        ctx.strokeStyle = '#38bdf8';
        ctx.fillStyle = '#38bdf8';
      } else {
        ctx.strokeStyle = '#0f172a';
        ctx.fillStyle = '#0f172a';
      }

      ctx.lineWidth = 1.5;

      // 1. Lines
      if (ent.type === 'LINE') {
        if (ent.vertices && ent.vertices.length >= 2) {
          ctx.moveTo(mapX(ent.vertices[0].x), mapY(ent.vertices[0].y));
          ctx.lineTo(mapX(ent.vertices[1].x), mapY(ent.vertices[1].y));
          ctx.stroke();
        } else if (ent.start && ent.end) {
          ctx.moveTo(mapX(ent.start.x), mapY(ent.start.y));
          ctx.lineTo(mapX(ent.end.x), mapY(ent.end.y));
          ctx.stroke();
        }
      }
      // 2. Polylines & Lightweight Polylines
      else if ((ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') && ent.vertices) {
        if (ent.vertices.length > 1) {
          ctx.moveTo(mapX(ent.vertices[0].x), mapY(ent.vertices[0].y));
          for (let i = 1; i < ent.vertices.length; i++) {
            ctx.lineTo(mapX(ent.vertices[i].x), mapY(ent.vertices[i].y));
          }
          if (ent.shape || ent.closed) ctx.closePath();
          ctx.stroke();
        }
      }
      // 3. Circles
      else if (ent.type === 'CIRCLE' && ent.center && ent.radius) {
        const cx = mapX(ent.center.x);
        const cy = mapY(ent.center.y);
        const r = Math.max(1, ent.radius * scale);
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 4. Arcs
      else if (ent.type === 'ARC' && ent.center && ent.radius) {
        const cx = mapX(ent.center.x);
        const cy = mapY(ent.center.y);
        const r = Math.max(1, ent.radius * scale);
        const startAngle = -(ent.endAngle || 0) * (Math.PI / 180);
        const endAngle = -(ent.startAngle || 0) * (Math.PI / 180);
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.stroke();
      }
      // 5. Splines
      else if (ent.type === 'SPLINE' && ent.controlPoints && ent.controlPoints.length > 1) {
        ctx.moveTo(mapX(ent.controlPoints[0].x), mapY(ent.controlPoints[0].y));
        for (let i = 1; i < ent.controlPoints.length; i++) {
          ctx.lineTo(mapX(ent.controlPoints[i].x), mapY(ent.controlPoints[i].y));
        }
        ctx.stroke();
      }
      // 6. Text & Dimensions
      else if ((ent.type === 'TEXT' || ent.type === 'MTEXT') && (ent.text || ent.string)) {
        const txt = ent.text || ent.string || '';
        const posX = ent.startPoint ? ent.startPoint.x : ent.position ? ent.position.x : minX;
        const posY = ent.startPoint ? ent.startPoint.y : ent.position ? ent.position.y : minY;
        const fontPx = Math.max(10, Math.min(36, (ent.textHeight || 12) * scale));
        ctx.font = `${fontPx}px monospace`;
        ctx.fillText(txt, mapX(posX), mapY(posY));
      }
      // 7. Points
      else if (ent.type === 'POINT' && ent.position) {
        const px = mapX(ent.position.x);
        const py = mapY(ent.position.y);
        ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
      }
    }

    const pdf = new jsPDF({
      orientation: config.orientation,
      unit: 'pt',
      format: config.paperSize
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

    const pdfArrayBuffer = pdf.output('arraybuffer');
    return new Uint8Array(pdfArrayBuffer);
  }
}
