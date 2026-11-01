import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Upload,
  Lock,
  Eye,
  EyeOff,
  Printer,
  Download,
  RotateCw,
  RefreshCw,
  Sparkles,
  Scissors,
  Check,
  FileCheck2,
  AlertCircle,
  Copy,
  Layers,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import {
  IdCardAutoDetectorService,
  ID_CARD_PRESETS,
  PVC_CARD_SPEC,
  type SupportedIdCardType,
  type IdCardPresetDef
} from '../../services/idCardAutoDetector';
import jsPDF from 'jspdf';
import type { PrintQueueItem } from '../../types';

interface IdCardStudioViewProps {
  onSendToPrintStudio?: (items: PrintQueueItem[]) => void;
}

interface CropBox {
  x: number; // 0 to 1
  y: number; // 0 to 1
  w: number; // 0 to 1
  h: number; // 0 to 1
}

export const IdCardStudioView: React.FC<IdCardStudioViewProps> = ({ onSendToPrintStudio }) => {
  const [selectedCardType, setSelectedCardType] = useState<SupportedIdCardType>('aadhaar');
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [rotationAngle, setRotationAngle] = useState<number>(0);

  // Password Unlock Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);

  // Crop Coordinates (Normalized 0..1)
  const [frontCrop, setFrontCrop] = useState<CropBox>(ID_CARD_PRESETS.aadhaar.defaultFrontCrop);
  const [backCrop, setBackCrop] = useState<CropBox>(ID_CARD_PRESETS.aadhaar.defaultBackCrop);
  const [activeSide, setActiveSide] = useState<'both' | 'front' | 'back'>('both');

  // Print & Sheet Options
  const [paperFormat, setPaperFormat] = useState<'4x6' | 'a4' | 'pvc_tray'>('4x6');
  const [layoutOrientation, setLayoutOrientation] = useState<'side_by_side' | 'stacked'>('side_by_side');
  const [addBorder, setAddBorder] = useState<boolean>(true);
  const [addRoundedCorners, setAddRoundedCorners] = useState<boolean>(false);
  const [isSharpened, setIsSharpened] = useState<boolean>(true);

  // Rendered Previews
  const [frontPreviewUrl, setFrontPreviewUrl] = useState<string | null>(null);
  const [backPreviewUrl, setBackPreviewUrl] = useState<string | null>(null);
  const [sheetPreviewUrl, setSheetPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Dragging crop box on canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [draggingTarget, setDraggingTarget] = useState<'front' | 'back' | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [initialBox, setInitialBox] = useState<CropBox | null>(null);

  // Reset crops when card type changes
  const handleSelectCardType = (type: SupportedIdCardType) => {
    setSelectedCardType(type);
    const preset = ID_CARD_PRESETS[type];
    if (preset) {
      setFrontCrop({ ...preset.defaultFrontCrop });
      setBackCrop({ ...preset.defaultBackCrop });
    }
  };

  // Process Document File (PDF or Image)
  const handleFileUpload = async (file: File) => {
    setFileName(file.name);
    setIsProcessing(true);
    setPasswordError(null);

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      setPdfBytes(bytes);

      try {
        const result = await IdCardAutoDetectorService.renderPdfPage(bytes, undefined, 2.5);
        if (result.isEncrypted) {
          setIsPasswordModalOpen(true);
          setIsProcessing(false);
          return;
        }

        // Auto-detect card type from text if available
        if (result.detectedText) {
          const detected = IdCardAutoDetectorService.detectCardType(result.detectedText);
          handleSelectCardType(detected);
        }

        setSourceCanvas(result.canvas);
        setSourceImage(null);
        setRotationAngle(0);
      } catch (err: any) {
        console.error('Failed to render PDF page:', err);
        setIsPasswordModalOpen(true);
      }
    } else {
      // Image upload (JPG/PNG scan)
      setPdfBytes(null);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0);

        setSourceImage(img);
        setSourceCanvas(canvas);
        setRotationAngle(0);
        setIsProcessing(false);
      };
      img.src = URL.createObjectURL(file);
    }
    setIsProcessing(false);
  };

  // Handle PDF Unlock with Password
  const handleUnlockPdf = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pdfBytes || !password) return;

    setIsUnlocking(true);
    setPasswordError(null);

    try {
      const result = await IdCardAutoDetectorService.renderPdfPage(pdfBytes, password.trim(), 2.5);
      if (result.isEncrypted) {
        setPasswordError('Incorrect password. For Aadhaar, use: First 4 letters of name in CAPITAL + 4 digit Year of Birth (e.g., AMIT1992)');
        setIsUnlocking(false);
        return;
      }

      if (result.detectedText) {
        const detected = IdCardAutoDetectorService.detectCardType(result.detectedText);
        handleSelectCardType(detected);
      }

      setSourceCanvas(result.canvas);
      setSourceImage(null);
      setIsPasswordModalOpen(false);
      setPassword('');
    } catch (err: any) {
      console.error('PDF unlock error:', err);
      setPasswordError('Invalid password. Please verify and try again.');
    } finally {
      setIsUnlocking(false);
    }
  };

  // Rotate canvas 90 degrees clockwise
  const handleRotate = () => {
    if (!sourceCanvas) return;
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const rotated = document.createElement('canvas');
    rotated.width = h;
    rotated.height = w;
    const ctx = rotated.getContext('2d');
    if (!ctx) return;

    ctx.translate(h / 2, w / 2);
    ctx.rotate((90 * Math.PI) / 180);
    ctx.drawImage(sourceCanvas, -w / 2, -h / 2);

    setSourceCanvas(rotated);
    setRotationAngle((prev) => (prev + 90) % 360);
  };

  // Generate ISO CR80 PVC Canvases
  const generatePvcCanvases = useCallback(() => {
    if (!sourceCanvas) return null;

    const front = IdCardAutoDetectorService.cropToPvcCanvas(
      sourceCanvas,
      frontCrop,
      PVC_CARD_SPEC.widthPx300Dpi,
      PVC_CARD_SPEC.heightPx300Dpi,
      addRoundedCorners
    );

    const back = IdCardAutoDetectorService.cropToPvcCanvas(
      sourceCanvas,
      backCrop,
      PVC_CARD_SPEC.widthPx300Dpi,
      PVC_CARD_SPEC.heightPx300Dpi,
      addRoundedCorners
    );

    return { front, back };
  }, [sourceCanvas, frontCrop, backCrop, addRoundedCorners]);

  // Generate Print Sheet Canvas based on paperFormat and layoutOrientation
  const generatePrintSheetCanvas = useCallback(() => {
    const cards = generatePvcCanvases();
    if (!cards) return null;

    const { front, back } = cards;
    const cardW = PVC_CARD_SPEC.widthPx300Dpi; // 1011 px @ 300 DPI
    const cardH = PVC_CARD_SPEC.heightPx300Dpi; // 638 px @ 300 DPI

    let sheetW: number;
    let sheetH: number;

    if (paperFormat === '4x6') {
      // 4×6 inches at 300 DPI = 1200 × 1800 px (or 1800 × 1200 landscape)
      if (layoutOrientation === 'side_by_side') {
        sheetW = 1800;
        sheetH = 1200;
      } else {
        sheetW = 1200;
        sheetH = 1800;
      }
    } else if (paperFormat === 'a4') {
      // A4 at 300 DPI = 2480 × 3508 px
      sheetW = 2480;
      sheetH = 3508;
    } else {
      // PVC Tray Single Card = 1011 × 638 px
      sheetW = cardW;
      sheetH = cardH;
    }

    const sheet = document.createElement('canvas');
    sheet.width = sheetW;
    sheet.height = sheetH;
    const ctx = sheet.getContext('2d');
    if (!ctx) return null;

    // Crisp white sheet background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sheetW, sheetH);

    const gap = Math.round(300 * (4 / 25.4)); // 4mm gap between cards

    if (paperFormat === 'pvc_tray') {
      // Only draw the front card (or active side)
      ctx.drawImage(activeSide === 'back' ? back : front, 0, 0, cardW, cardH);
    } else if (paperFormat === '4x6') {
      if (layoutOrientation === 'side_by_side') {
        // Center side-by-side horizontally
        const totalW = cardW * 2 + gap;
        const startX = Math.round((sheetW - totalW) / 2);
        const startY = Math.round((sheetH - cardH) / 2);

        ctx.drawImage(front, startX, startY, cardW, cardH);
        ctx.drawImage(back, startX + cardW + gap, startY, cardW, cardH);

        // Cutting guides (hairlines)
        if (addBorder) {
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;
          ctx.setLineDash([8, 8]);
          // Middle cut divider line
          const midX = startX + cardW + gap / 2;
          ctx.beginPath();
          ctx.moveTo(midX, startY - 40);
          ctx.lineTo(midX, startY + cardH + 40);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else {
        // Stacked vertically
        const totalH = cardH * 2 + gap;
        const startX = Math.round((sheetW - cardW) / 2);
        const startY = Math.round((sheetH - totalH) / 2);

        ctx.drawImage(front, startX, startY, cardW, cardH);
        ctx.drawImage(back, startX, startY + cardH + gap, cardW, cardH);

        if (addBorder) {
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;
          ctx.setLineDash([8, 8]);
          const midY = startY + cardH + gap / 2;
          ctx.beginPath();
          ctx.moveTo(startX - 40, midY);
          ctx.lineTo(startX + cardW + 40, midY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    } else {
      // A4 Sheet: Placed at top with generous margin for cutting and thermal pouch lamination
      const marginX = Math.round(300 * (15 / 25.4)); // 15mm margin
      const marginY = Math.round(300 * (20 / 25.4)); // 20mm margin from top

      if (layoutOrientation === 'side_by_side') {
        ctx.drawImage(front, marginX, marginY, cardW, cardH);
        ctx.drawImage(back, marginX + cardW + gap, marginY, cardW, cardH);
      } else {
        ctx.drawImage(front, marginX, marginY, cardW, cardH);
        ctx.drawImage(back, marginX, marginY + cardH + gap, cardW, cardH);
      }
    }

    return sheet;
  }, [generatePvcCanvases, paperFormat, layoutOrientation, addBorder, activeSide]);

  // Update Preview URLs when source or crops change
  useEffect(() => {
    if (!sourceCanvas) {
      setFrontPreviewUrl(null);
      setBackPreviewUrl(null);
      setSheetPreviewUrl(null);
      return;
    }

    const cards = generatePvcCanvases();
    if (cards) {
      setFrontPreviewUrl(cards.front.toDataURL('image/png'));
      setBackPreviewUrl(cards.back.toDataURL('image/png'));
    }

    const sheet = generatePrintSheetCanvas();
    if (sheet) {
      setSheetPreviewUrl(sheet.toDataURL('image/png'));
    }
  }, [sourceCanvas, frontCrop, backCrop, paperFormat, layoutOrientation, addBorder, addRoundedCorners, generatePvcCanvases, generatePrintSheetCanvas]);

  // Draw interactive crop boxes on the source document canvas
  useEffect(() => {
    if (!sourceCanvas || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw base source document
    ctx.drawImage(sourceCanvas, 0, 0);

    // Dim the non-selected background slightly for high clarity
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawCropBox = (box: CropBox, label: string, color: string, isActive: boolean) => {
      const bx = box.x * canvas.width;
      const by = box.y * canvas.height;
      const bw = box.w * canvas.width;
      const bh = box.h * canvas.height;

      // Reveal original image inside the crop box
      ctx.drawImage(sourceCanvas, bx, by, bw, bh, bx, by, bw, bh);

      // Stroke border
      ctx.strokeStyle = color;
      ctx.lineWidth = isActive ? 4 : 2;
      ctx.strokeRect(bx, by, bw, bh);

      // Corner handles
      const handleSize = 14;
      ctx.fillStyle = color;
      ctx.fillRect(bx - handleSize / 2, by - handleSize / 2, handleSize, handleSize);
      ctx.fillRect(bx + bw - handleSize / 2, by - handleSize / 2, handleSize, handleSize);
      ctx.fillRect(bx - handleSize / 2, by + bh - handleSize / 2, handleSize, handleSize);
      ctx.fillRect(bx + bw - handleSize / 2, by + bh - handleSize / 2, handleSize, handleSize);

      // Label badge
      ctx.font = 'bold 22px sans-serif';
      const labelMetrics = ctx.measureText(label);
      const badgeW = labelMetrics.width + 20;
      const badgeH = 34;

      ctx.fillStyle = color;
      ctx.fillRect(bx, Math.max(0, by - badgeH), badgeW, badgeH);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, bx + 10, Math.max(24, by - 8));
    };

    // Draw Front Box (Blue)
    drawCropBox(frontCrop, '1. FRONT SIDE', '#2563eb', activeSide === 'both' || activeSide === 'front');

    // Draw Back Box (Emerald)
    drawCropBox(backCrop, '2. BACK SIDE', '#059669', activeSide === 'both' || activeSide === 'back');
  }, [sourceCanvas, frontCrop, backCrop, activeSide]);

  // Interactive Dragging on Document Canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const clickX = ((e.clientX - rect.left) * scaleX) / canvasRef.current.width;
    const clickY = ((e.clientY - rect.top) * scaleY) / canvasRef.current.height;

    // Check hit on Front box
    if (
      clickX >= frontCrop.x &&
      clickX <= frontCrop.x + frontCrop.w &&
      clickY >= frontCrop.y &&
      clickY <= frontCrop.y + frontCrop.h
    ) {
      setDraggingTarget('front');
      setDragStart({ x: clickX, y: clickY });
      setInitialBox({ ...frontCrop });
      return;
    }

    // Check hit on Back box
    if (
      clickX >= backCrop.x &&
      clickX <= backCrop.x + backCrop.w &&
      clickY >= backCrop.y &&
      clickY <= backCrop.y + backCrop.h
    ) {
      setDraggingTarget('back');
      setDragStart({ x: clickX, y: clickY });
      setInitialBox({ ...backCrop });
      return;
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingTarget || !dragStart || !initialBox || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const currX = ((e.clientX - rect.left) * scaleX) / canvasRef.current.width;
    const currY = ((e.clientY - rect.top) * scaleY) / canvasRef.current.height;

    const dx = currX - dragStart.x;
    const dy = currY - dragStart.y;

    const newX = Math.max(0, Math.min(1 - initialBox.w, initialBox.x + dx));
    const newY = Math.max(0, Math.min(1 - initialBox.h, initialBox.y + dy));

    if (draggingTarget === 'front') {
      setFrontCrop({ ...initialBox, x: newX, y: newY });
    } else if (draggingTarget === 'back') {
      setBackCrop({ ...initialBox, x: newX, y: newY });
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingTarget(null);
    setDragStart(null);
    setInitialBox(null);
  };

  // Direct Print
  const handlePrint = () => {
    const sheetCanvas = generatePrintSheetCanvas();
    if (!sheetCanvas) return;

    const printWin = window.open('', '_blank');
    if (!printWin) return;

    const dataUrl = sheetCanvas.toDataURL('image/png');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>PrintMate - PVC ID Card Print</title>
          <style>
            @page {
              size: ${paperFormat === '4x6' ? '4in 6in' : paperFormat === 'a4' ? 'A4 portrait' : '85.6mm 53.98mm'};
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #fff;
            }
            img {
              max-width: 100%;
              height: auto;
              display: block;
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <img src="${dataUrl}" />
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // Download High-Resolution Printable PDF (300 DPI true millimeter scale)
  const handleDownloadPdf = () => {
    const sheetCanvas = generatePrintSheetCanvas();
    if (!sheetCanvas) return;

    const imgData = sheetCanvas.toDataURL('image/jpeg', 0.98);

    let doc: jsPDF;
    if (paperFormat === '4x6') {
      const isLandscape = layoutOrientation === 'side_by_side';
      doc = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'in',
        format: [4, 6],
      });
      doc.addImage(imgData, 'JPEG', 0, 0, isLandscape ? 6 : 4, isLandscape ? 4 : 6);
    } else if (paperFormat === 'a4') {
      doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    } else {
      // PVC Tray Single
      doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [PVC_CARD_SPEC.widthMm, PVC_CARD_SPEC.heightMm],
      });
      doc.addImage(imgData, 'JPEG', 0, 0, PVC_CARD_SPEC.widthMm, PVC_CARD_SPEC.heightMm);
    }

    doc.save(`PrintMate_PVC_${selectedCardType}_${Date.now()}.pdf`);
  };

  // Download Individual PNGs
  const handleDownloadPng = (target: 'sheet' | 'front' | 'back') => {
    const cards = generatePvcCanvases();
    if (!cards) return;

    let targetData: string | null = null;
    let name = `PVC_${selectedCardType}`;

    if (target === 'sheet') {
      const sheet = generatePrintSheetCanvas();
      if (sheet) targetData = sheet.toDataURL('image/png');
      name += '_Sheet';
    } else if (target === 'front') {
      targetData = cards.front.toDataURL('image/png');
      name += '_Front';
    } else if (target === 'back') {
      targetData = cards.back.toDataURL('image/png');
      name += '_Back';
    }

    if (!targetData) return;
    const a = document.createElement('a');
    a.href = targetData;
    a.download = `${name}.png`;
    a.click();
  };

  // Send directly to Print Studio Queue
  const handleSendToPrint = () => {
    const cards = generatePvcCanvases();
    if (!cards || !onSendToPrintStudio) return;

    const frontItem: PrintQueueItem = {
      id: `pvc_front_${Date.now()}`,
      dataUrl: cards.front.toDataURL('image/png'),
      name: `${selectedCardType.toUpperCase()} - Front`,
      docType: 'id_standard',
      cardSide: 'front',
      aspectRatio: PVC_CARD_SPEC.aspectRatio,
      createdAt: Date.now(),
      copies: 1,
    };

    const backItem: PrintQueueItem = {
      id: `pvc_back_${Date.now()}`,
      dataUrl: cards.back.toDataURL('image/png'),
      name: `${selectedCardType.toUpperCase()} - Back`,
      docType: 'id_standard',
      cardSide: 'back',
      aspectRatio: PVC_CARD_SPEC.aspectRatio,
      createdAt: Date.now() + 1,
      copies: 1,
    };

    onSendToPrintStudio([frontItem, backItem]);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">
                  ID Card & PVC Studio
                </h1>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase tracking-wider">
                  ISO CR80 Ready
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                1-Click e-Aadhaar, PAN, Voter ID & Driving License to perfect 85.6 × 53.98 mm PVC printing
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {sourceCanvas && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRotate}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Rotate 90 degrees"
            >
              <RotateCw className="w-4 h-4" />
              <span>Rotate</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
              className="px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-blue-500/25 flex items-center gap-2 transition-all hover:bg-blue-500 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Sheet</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Download PDF</span>
            </button>

            {onSendToPrintStudio && (
              <button
                type="button"
                onClick={handleSendToPrint}
                className="px-3.5 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Layers className="w-4 h-4" />
                <span className="hidden sm:inline">Add to Multi-Card Studio</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Preset Card Type Selector */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
          Select Document Format Preset:
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {(Object.keys(ID_CARD_PRESETS) as SupportedIdCardType[]).map((type) => {
            const preset = ID_CARD_PRESETS[type];
            const isSelected = selectedCardType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleSelectCardType(type)}
                className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 dark:text-blue-100 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="font-extrabold text-xs truncate">{preset.name}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                  {preset.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Grid */}
      {!sourceCanvas ? (
        /* Empty State / Upload Dropzone */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-12 text-center shadow-xs">
          <input
            type="file"
            id="pvc-upload-input"
            accept=".pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          <label
            htmlFor="pvc-upload-input"
            className="flex flex-col items-center justify-center cursor-pointer group"
          >
            <div className="w-20 h-20 rounded-3xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-xs">
              <Upload className="w-10 h-10" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-2">
              Upload e-Aadhaar PDF or Scanned ID Image
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
              Drag & drop your downloaded Aadhaar PDF, PAN PDF, or scanned photo here. Password-protected PDFs are unlocked directly on your device.
            </p>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20">
              <CreditCard className="w-4 h-4" />
              <span>Select File from Computer</span>
            </div>
          </label>
        </div>
      ) : (
        /* Interactive Dual-Side Editor & Layout Workspace */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Interactive Document Canvas (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Document Viewport & Crop Frames</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Drag the <strong className="text-blue-600">Blue (Front)</strong> and <strong className="text-emerald-600">Green (Back)</strong> boxes to fit your card exactly.
                  </p>
                </div>

                {/* Reset to Preset Default */}
                <button
                  type="button"
                  onClick={() => {
                    const preset = ID_CARD_PRESETS[selectedCardType];
                    setFrontCrop({ ...preset.defaultFrontCrop });
                    setBackCrop({ ...preset.defaultBackCrop });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Box</span>
                </button>
              </div>

              {/* Canvas viewport container */}
              <div className="relative border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center p-2 min-h-[420px]">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  className="max-w-full max-h-[560px] object-contain rounded-lg cursor-move shadow-md"
                />
              </div>

              {/* Side Switch Tabs */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveSide('both')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      activeSide === 'both'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Both Sides
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSide('front')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      activeSide === 'front'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Front Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSide('back')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      activeSide === 'back'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Back Only
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  CR80 Ratio: <strong>85.6 × 53.98 mm</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Print Sheet Configuration & Live Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Sheet Settings */}
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Print Sheet & Paper Layout
              </h3>

              {/* Paper Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Target Paper:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaperFormat('4x6')}
                    className={`p-2.5 rounded-xl text-center border font-bold text-xs transition-all cursor-pointer ${
                      paperFormat === '4x6'
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    4×6" (4R Photo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperFormat('a4')}
                    className={`p-2.5 rounded-xl text-center border font-bold text-xs transition-all cursor-pointer ${
                      paperFormat === 'a4'
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    A4 Sheet
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperFormat('pvc_tray')}
                    className={`p-2.5 rounded-xl text-center border font-bold text-xs transition-all cursor-pointer ${
                      paperFormat === 'pvc_tray'
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    PVC Tray Single
                  </button>
                </div>
              </div>

              {/* Orientation if 4x6 or A4 */}
              {paperFormat !== 'pvc_tray' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Cards Arrangement:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLayoutOrientation('side_by_side')}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        layoutOrientation === 'side_by_side'
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Side by Side
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayoutOrientation('stacked')}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        layoutOrientation === 'stacked'
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Stacked (Vertical)
                    </button>
                  </div>
                </div>
              )}

              {/* Toggles */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center justify-between text-xs cursor-pointer py-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Cutting Hairlines & Marker
                  </span>
                  <input
                    type="checkbox"
                    checked={addBorder}
                    onChange={(e) => setAddBorder(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between text-xs cursor-pointer py-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Simulate CR80 Rounded Corners (3.18mm)
                  </span>
                  <input
                    type="checkbox"
                    checked={addRoundedCorners}
                    onChange={(e) => setAddRoundedCorners(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                  />
                </label>
              </div>

              {/* Live Print Sheet Thumbnail Preview */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Live Printable Sheet Preview
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">300 DPI</span>
                </div>
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-2 bg-slate-100 dark:bg-slate-800 flex items-center justify-center min-h-[160px] overflow-hidden">
                  {sheetPreviewUrl ? (
                    <img
                      src={sheetPreviewUrl}
                      alt="Print Sheet Preview"
                      className="max-h-[160px] w-auto object-contain rounded-md shadow-xs bg-white"
                    />
                  ) : (
                    <div className="text-xs text-slate-400">Rendering preview...</div>
                  )}
                </div>
              </div>

              {/* Quick Individual Card Downloads */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPng('front')}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Front PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPng('back')}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Back PNG</span>
                </button>
              </div>

              {/* Change/Re-upload file */}
              <div className="pt-2 text-center">
                <label
                  htmlFor="pvc-reupload-input"
                  className="text-xs text-blue-600 hover:underline cursor-pointer font-semibold"
                >
                  Upload different document
                </label>
                <input
                  type="file"
                  id="pvc-reupload-input"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </div>

            </div>

          </div>

        </div>
      )}

      {/* Password Prompt Modal for Encrypted PDFs (e.g. e-Aadhaar) */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-950 dark:text-white">
                Password Protected PDF
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This PDF is encrypted. Enter the password to unlock and crop the card.
              </p>
            </div>

            {/* Aadhaar Format Hint */}
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-800 dark:text-blue-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>e-Aadhaar Password Rule:</span>
              </div>
              <p>
                First 4 letters of your Name in <strong>CAPITAL</strong> + 4 digit <strong>Year of Birth</strong>.
                <br />
                <em>Example: Name <strong>AMIT SHARMA</strong>, Birth Year <strong>1992</strong> &rarr; <strong>AMIT1992</strong></em>
              </p>
            </div>

            <form onSubmit={handleUnlockPdf} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Document Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="e.g. AMIT1992"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold pt-1">
                    {passwordError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUnlocking || !password}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                  className="px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 hover:bg-blue-500 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isUnlocking ? 'Unlocking...' : 'Unlock & Crop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
