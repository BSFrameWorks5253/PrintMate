import React, { useState, useRef, useEffect } from 'react';
import { 
  CreditCard, 
  Upload, 
  Download, 
  Printer, 
  Sparkles, 
  ZoomIn, 
  Move, 
  Palette, 
  FileText, 
  Grid, 
  Scissors 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { PrintQueueItem } from '../../types';
import './PassportMaker.css';

interface PassportMakerViewProps {
  onSendToPrint?: (item: Omit<PrintQueueItem, 'id' | 'createdAt'>) => void;
}

export type BorderStyleType = 'studio_classic' | 'black_border' | 'white_margin' | 'borderless';
export type PaperSizeKey = '4x6' | 'a4' | '5x7';

interface PaperDef {
  id: PaperSizeKey;
  name: string;
  widthMm: number;
  heightMm: number;
  widthPx300Dpi: number;
  heightPx300Dpi: number;
}

const PAPERS: Record<PaperSizeKey, PaperDef> = {
  '4x6': {
    id: '4x6',
    name: '4 × 6 in Photo Paper (Standard 4R)',
    widthMm: 152.4,
    heightMm: 101.6,
    widthPx300Dpi: 1800,
    heightPx300Dpi: 1200,
  },
  'a4': {
    id: 'a4',
    name: 'A4 Document Sheet (210 × 297 mm)',
    widthMm: 210,
    heightMm: 297,
    widthPx300Dpi: 2480,
    heightPx300Dpi: 3508,
  },
  '5x7': {
    id: '5x7',
    name: '5 × 7 in Photo Paper (5R)',
    widthMm: 177.8,
    heightMm: 127.0,
    widthPx300Dpi: 2100,
    heightPx300Dpi: 1500,
  },
};

export const PassportMakerView: React.FC<PassportMakerViewProps> = ({ onSendToPrint }) => {
  // Photo source state
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string>('Passport_Photo');
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  // Framing & Crop state
  const [zoom, setZoom] = useState<number>(1.15);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGuidelines, setShowGuidelines] = useState<boolean>(true);

  // Sheet configuration
  const [paperSize, setPaperSize] = useState<PaperSizeKey>('4x6');
  const [photoCount, setPhotoCount] = useState<number>(8); // Default 8 photos on 4x6 (matching Image 2!)
  const [borderStyle, setBorderStyle] = useState<BorderStyleType>('studio_classic');
  const [backgroundColor, setBackgroundColor] = useState<string>('original');
  const [showCutDividers, setShowCutDividers] = useState<boolean>(true);

  // Adjustments
  const [adjustments, setAdjustments] = useState({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpness: 15,
  });

  const [activeTab, setActiveTab] = useState<'sheet' | 'editor'>('sheet');
  const [toastNotice, setToastNotice] = useState<string>('');

  // Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const printSheetRef = useRef<HTMLDivElement | null>(null);

  const selectedPaper = PAPERS[paperSize];

  // Load image object when photoUrl changes
  useEffect(() => {
    if (!photoUrl) {
      setImageObj(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageObj(img);
      setPan({ x: 0, y: 0 });
      setZoom(1.15);
    };
    img.src = photoUrl;
  }, [photoUrl]);

  // Load default demo image on click
  const loadDemoPhoto = () => {
    setPhotoUrl('/sample_passport.jpg');
    setPhotoName('Sample_Passport_Photo');
    setToastNotice('Loaded demo passport portrait photo');
    setTimeout(() => setToastNotice(''), 2500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPhotoUrl(event.target.result as string);
        setPhotoName(file.name.replace(/\.[^/.]+$/, ''));
        setToastNotice('Photo loaded • Ready to format into 35×45mm passport sheet');
        setTimeout(() => setToastNotice(''), 2500);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Drag and drop photo
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoUrl(event.target.result as string);
          setPhotoName(file.name.replace(/\.[^/.]+$/, ''));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // MATHEMATICS OF DYNAMIC SHRINKING & TILING
  // Standard Passport Dimensions: 35mm x 45mm
  // When count <= 8 on 4x6: 35mm x 45mm full size
  // When count > 8: automatically shrink proportionally to fit 4x6 sheet
  const computeGridLayout = () => {
    const count = Math.max(1, photoCount);
    const paperW = selectedPaper.widthMm;
    const paperH = selectedPaper.heightMm;

    let cols = 4;
    let rows = 2;

    if (paperSize === '4x6') {
      // 4x6 landscape is 152.4 x 101.6 mm
      if (count <= 2) {
        cols = count;
        rows = 1;
      } else if (count <= 4) {
        cols = 2;
        rows = 2;
      } else if (count <= 6) {
        cols = 3;
        rows = 2;
      } else if (count <= 8) {
        cols = 4;
        rows = 2; // 8 photos (Image 2 standard!)
      } else if (count <= 10) {
        cols = 5;
        rows = 2;
      } else if (count <= 12) {
        cols = 4;
        rows = 3;
      } else if (count <= 16) {
        cols = 4;
        rows = 4;
      } else {
        cols = Math.ceil(Math.sqrt(count * 1.5));
        rows = Math.ceil(count / cols);
      }
    } else {
      // A4 portrait is 210 x 297 mm
      if (count <= 6) {
        cols = 2;
        rows = 3;
      } else if (count <= 8) {
        cols = 2;
        rows = 4;
      } else if (count <= 12) {
        cols = 3;
        rows = 4;
      } else if (count <= 16) {
        cols = 4;
        rows = 4;
      } else {
        cols = Math.ceil(Math.sqrt(count * 0.7));
        rows = Math.ceil(count / cols);
      }
    }

    const marginMm = count > 8 ? 4 : 6;
    const gapMm = count > 8 ? 0 : 0.5; // Divider lines between cells like Image 2

    const availW = paperW - (marginMm * 2) - ((cols - 1) * gapMm);
    const availH = paperH - (marginMm * 2) - ((rows - 1) * gapMm);

    const maxCellW = availW / cols;
    const maxCellH = availH / rows;

    const standardW = 35; // 35mm
    const standardH = 45; // 45mm
    const passportRatio = standardW / standardH; // 0.7778

    let finalPhotoW = standardW;
    let finalPhotoH = standardH;
    let isShrunk = false;

    // SHRINK LOGIC: If count > 8 (or if standard 35x45mm doesn't fit on this paper)
    if (count > 8 || maxCellW < standardW || maxCellH < standardH) {
      isShrunk = true;
      // Fit proportionally within maxCellW and maxCellH maintaining 35:45 ratio
      const fitW = Math.min(maxCellW, maxCellH * passportRatio);
      finalPhotoW = Math.round(fitW * 10) / 10;
      finalPhotoH = Math.round((finalPhotoW / passportRatio) * 10) / 10;
    }

    return {
      cols,
      rows,
      photoWidthMm: finalPhotoW,
      photoHeightMm: finalPhotoH,
      isShrunk,
      marginMm,
      gapMm,
    };
  };

  const layout = computeGridLayout();

  // Draw the cropped/framed passport photo onto a canvas
  // Standard 35 x 45 mm at 300 DPI = 413 x 531 pixels
  const renderSinglePassportCanvas = (
    wPx: number = 413, 
    hPx: number = 531, 
    includeBorders: boolean = true
  ): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = wPx;
    canvas.height = hPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Fill background
    const bgFill = backgroundColor === 'white' 
      ? '#ffffff' 
      : backgroundColor === 'blue' 
      ? '#dbeafe' 
      : backgroundColor === 'grey' 
      ? '#e2e8f0' 
      : backgroundColor === 'offwhite' 
      ? '#f8fafc' 
      : '#ffffff';

    ctx.fillStyle = bgFill;
    ctx.fillRect(0, 0, wPx, hPx);

    // Border and margin calculation matching Image 1 & Image 2
    // Outer white margin: ~2mm (approx 5% of width)
    // Thin black border: ~1.5px
    let insetX = 0;
    let insetY = 0;
    let borderWidth = 0;

    if (includeBorders) {
      if (borderStyle === 'studio_classic') {
        // Classic Studio Border (Image 1 & Image 2):
        // White margin around photo + thin black border
        insetX = Math.round(wPx * 0.05); // ~20px at 413px
        insetY = Math.round(hPx * 0.05); // ~26px at 531px
        borderWidth = Math.max(1, Math.round(wPx * 0.005)); // ~2px
      } else if (borderStyle === 'black_border') {
        borderWidth = Math.max(1, Math.round(wPx * 0.005));
      } else if (borderStyle === 'white_margin') {
        insetX = Math.round(wPx * 0.05);
        insetY = Math.round(hPx * 0.05);
      }
    }

    const photoAreaW = wPx - insetX * 2;
    const photoAreaH = hPx - insetY * 2;

    // Draw photo inside photoArea
    if (imageObj) {
      ctx.save();
      // Clip to inner photo area
      ctx.beginPath();
      ctx.rect(insetX, insetY, photoAreaW, photoAreaH);
      ctx.clip();

      // Apply brightness & contrast filters
      ctx.filter = `brightness(${100 + adjustments.brightness}%) contrast(${100 + adjustments.contrast}%) saturate(${100 + adjustments.saturation}%)`;

      // Draw image with pan and zoom centered
      const imgAspect = imageObj.width / imageObj.height;
      const targetAspect = photoAreaW / photoAreaH;

      let drawW: number;
      let drawH: number;

      if (imgAspect > targetAspect) {
        drawH = photoAreaH * zoom;
        drawW = drawH * imgAspect;
      } else {
        drawW = photoAreaW * zoom;
        drawH = drawW / imgAspect;
      }

      const drawX = insetX + (photoAreaW - drawW) / 2 + (pan.x * photoAreaW);
      const drawY = insetY + (photoAreaH - drawH) / 2 + (pan.y * photoAreaH);

      ctx.drawImage(imageObj, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    // Draw borders over photo if requested
    if (includeBorders) {
      if (borderStyle === 'studio_classic') {
        // 1. Draw thin black rectangular border around the photo
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(insetX, insetY, photoAreaW, photoAreaH);

        // 2. Clear outer margins to pure white (Image 1 style)
        ctx.fillStyle = '#ffffff';
        // Top margin
        ctx.fillRect(0, 0, wPx, insetY);
        // Bottom margin
        ctx.fillRect(0, hPx - insetY, wPx, insetY);
        // Left margin
        ctx.fillRect(0, 0, insetX, hPx);
        // Right margin
        ctx.fillRect(wPx - insetX, 0, insetX, hPx);

        // Outer thin bounding stroke
        ctx.strokeStyle = '#2b2b2b';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, wPx, hPx);
      } else if (borderStyle === 'black_border') {
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(0, 0, wPx, hPx);
      }
    }

    return canvas;
  };

  // Render crop editor canvas
  useEffect(() => {
    const canvas = cropCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 413;
    const h = 531;
    canvas.width = w;
    canvas.height = h;

    const rendered = renderSinglePassportCanvas(w, h, true);
    ctx.drawImage(rendered, 0, 0);

    // Biometric Guideline Overlays (ICAO & Indian Passport standards)
    if (showGuidelines) {
      ctx.save();
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);

      // Eye Level Line (~42% from top)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.beginPath();
      ctx.moveTo(30, h * 0.42);
      ctx.lineTo(w - 30, h * 0.42);
      ctx.stroke();

      // Chin Line (~80% from top)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.beginPath();
      ctx.moveTo(60, h * 0.80);
      ctx.lineTo(w - 60, h * 0.80);
      ctx.stroke();

      // Crown / Top of head line (~15% from top)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.beginPath();
      ctx.moveTo(60, h * 0.15);
      ctx.lineTo(w - 60, h * 0.15);
      ctx.stroke();

      // Face Oval Guide
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.75)';
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.48, w * 0.30, h * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Center vertical guide
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.beginPath();
      ctx.moveTo(w / 2, 20);
      ctx.lineTo(w / 2, h - 20);
      ctx.stroke();

      // Text labels
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(14, 165, 233, 0.95)';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('EYE LEVEL', 35, h * 0.40);
      ctx.fillText('CHIN LINE', 65, h * 0.78);
      ctx.fillText('CROWN', 65, h * 0.13);

      ctx.restore();
    }
  }, [imageObj, zoom, pan, showGuidelines, borderStyle, backgroundColor, adjustments]);

  // Pointer panning handler for face positioning
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsPanning(true);
    setStartPan({ x: e.clientX, y: e.clientY });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPanning) return;
    const deltaX = (e.clientX - startPan.x) / 300;
    const deltaY = (e.clientY - startPan.y) / 300;
    setPan((prev) => ({
      x: Math.max(-0.6, Math.min(0.6, prev.x + deltaX)),
      y: Math.max(-0.6, Math.min(0.6, prev.y + deltaY)),
    }));
    setStartPan({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsPanning(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Generate 300 DPI High-Res Canvas Sheet (1800 x 1200 px for 4x6 inch)
  const generate300DpiSheetCanvas = (): HTMLCanvasElement => {
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = selectedPaper.widthPx300Dpi;
    sheetCanvas.height = selectedPaper.heightPx300Dpi;
    const ctx = sheetCanvas.getContext('2d');
    if (!ctx) return sheetCanvas;

    // Pure white photo paper background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

    const pxPerMm = sheetCanvas.width / selectedPaper.widthMm;
    const { cols, rows, photoWidthMm, photoHeightMm } = layout;

    const photoPxW = Math.round(photoWidthMm * pxPerMm);
    const photoPxH = Math.round(photoHeightMm * pxPerMm);

    const totalGridW = cols * photoPxW;
    const totalGridH = rows * photoPxH;

    const startX = Math.round((sheetCanvas.width - totalGridW) / 2);
    const startY = Math.round((sheetCanvas.height - totalGridH) / 2);

    // Pre-render a single passport photo at 300 DPI
    const singlePhoto = renderSinglePassportCanvas(photoPxW, photoPxH, true);

    const count = Math.min(cols * rows, photoCount);

    for (let i = 0; i < count; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = startX + (c * photoPxW);
      const y = startY + (r * photoPxH);

      ctx.drawImage(singlePhoto, x, y, photoPxW, photoPxH);

      // Draw thin cutting divider lines on sheet (Image 2 style)
      if (showCutDividers) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, photoPxW, photoPxH);
      }
    }

    return sheetCanvas;
  };

  // 1. Download 300 DPI Print Sheet
  const handleDownloadSheet = () => {
    const sheetCanvas = generate300DpiSheetCanvas();
    const link = document.createElement('a');
    link.download = `Passport_${photoCount}up_${selectedPaper.id.toUpperCase()}_300DPI.jpg`;
    link.href = sheetCanvas.toDataURL('image/jpeg', 0.98);
    link.click();
    confetti({ particleCount: 35, spread: 50, origin: { y: 0.8 } });
  };

  // 2. Download Single 35x45mm Passport Photo
  const handleDownloadSingle = () => {
    // 35mm x 45mm at 300 DPI is exactly 413 x 531 px
    const single = renderSinglePassportCanvas(413, 531, true);
    const link = document.createElement('a');
    link.download = `${photoName}_35x45mm_300DPI.jpg`;
    link.href = single.toDataURL('image/jpeg', 0.98);
    link.click();
  };

  // 3. Print Sheet directly
  const handlePrint = () => {
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // 4. Send to Main Print Studio Queue
  const handleSendToPrintStudio = () => {
    if (!onSendToPrint) return;
    const single = renderSinglePassportCanvas(413, 531, true);
    onSendToPrint({
      dataUrl: single.toDataURL('image/jpeg', 0.98),
      name: `${photoName} (Passport 35×45mm)`,
      docType: 'id_standard',
      cardSide: 'single',
      aspectRatio: 35 / 45,
    });
    setToastNotice('Passport photo dispatched to Print Studio queue!');
    setTimeout(() => setToastNotice(''), 2500);
  };

  // Single photo data URL for sheet preview
  const previewPhotoDataUrl = cropCanvasRef.current?.toDataURL() || photoUrl;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* STUDIO HEADER BANNER */}
      <div className="no-print bg-[#161b22] border border-[#30363d] rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-blue-500/10 text-cyan-400 border border-cyan-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Passport Size Photo Studio (35 × 45 mm • 300 DPI)
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              4×6 Photo Paper (Image 2 Layout)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Convert any portrait into a 300 DPI 35×45mm passport layout with studio borders, cutting grids, and automatic proportional shrinking when exceeding 8 photos.
          </p>
        </div>

        {/* Quick Demo & Upload Buttons */}
        <div className="flex items-center gap-2">
          {!photoUrl ? (
            <button
              onClick={loadDemoPhoto}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Use Demo Photo (Image 1)</span>
            </button>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-xl bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Different Photo</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Notice */}
      {toastNotice && (
        <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg animate-fade-in">
          <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastNotice}</span>
        </div>
      )}

      {/* If no photo uploaded yet: Dropzone */}
      {!photoUrl ? (
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-[#30363d] hover:border-cyan-500/60 bg-[#161b22]/70 rounded-2xl p-12 text-center transition-all cursor-pointer group shadow-xl"
        >
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 flex items-center justify-center mx-auto mb-4 border border-cyan-500/20 transition-all">
            <Upload className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Upload Passport Portrait Photo
          </h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Drag & drop your portrait photo here, click to browse, or try the 1-click demo photo.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Browse Photo</span>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); loadDemoPhoto(); }}
              className="px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold text-xs flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Load Image 1 (Sample Portrait)</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: CONTROLS & PHOTO ADJUSTMENTS (5 Cols) */}
          <div className="no-print lg:col-span-5 space-y-4">
            {/* 1. PHOTO COUNT & AUTO-SHRINK CONTROLLER */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Grid className="w-4 h-4 text-cyan-400" />
                  <span>Number of Photos on Page</span>
                </h4>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                  layout.isShrunk 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                }`}>
                  {photoCount} Photos ({layout.cols} × {layout.rows})
                </span>
              </div>

              {/* Stepper & Preset Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPhotoCount((c) => Math.max(1, c - 1))}
                  className="w-9 h-9 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-white font-bold flex items-center justify-center border border-[#30363d] transition-all"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="32"
                  value={photoCount}
                  onChange={(e) => setPhotoCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 h-9 bg-[#0d1117] border border-[#30363d] rounded-xl text-center text-sm font-bold text-white focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => setPhotoCount((c) => c + 1)}
                  className="w-9 h-9 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-white font-bold flex items-center justify-center border border-[#30363d] transition-all"
                >
                  +
                </button>

                <div className="flex items-center gap-1 ml-auto">
                  {[4, 6, 8, 10, 12, 16].map((num) => (
                    <button
                      key={num}
                      onClick={() => setPhotoCount(num)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        photoCount === num
                          ? 'bg-cyan-500 text-black shadow-md'
                          : 'bg-[#21262d] text-slate-300 hover:bg-[#30363d]'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Physical Dimension Banner (Showing Exact Size / Shrink Status) */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                layout.isShrunk 
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-300' 
                  : 'bg-[#0d1117] border-[#30363d] text-cyan-300'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${layout.isShrunk ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                  <span className="font-medium">
                    {layout.isShrunk 
                      ? `Shrunk to fit ${photoCount} on 4×6 sheet:` 
                      : 'Standard Passport Size (ISO/ICAO):'}
                  </span>
                </div>
                <span className="font-mono font-bold text-white">
                  {layout.photoWidthMm.toFixed(1)} × {layout.photoHeightMm.toFixed(1)} mm
                </span>
              </div>
            </div>

            {/* 2. BORDER STYLE CONTROLS (MATCHING IMAGE 1 & IMAGE 2) */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-emerald-400" />
                  <span>Border & Cutting Layout</span>
                </h4>
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCutDividers}
                    onChange={(e) => setShowCutDividers(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-blue-600 bg-[#0d1117] border-[#30363d] cursor-pointer"
                  />
                  <span>Grid Cut Lines</span>
                </label>
              </div>

              {/* Border Styles */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    id: 'studio_classic',
                    label: 'Studio Classic (Image 1 & 2)',
                    desc: 'White inset margin + thin black border frame',
                  },
                  {
                    id: 'black_border',
                    label: 'Thin Black Border',
                    desc: 'Single sharp border around photo',
                  },
                  {
                    id: 'white_margin',
                    label: 'White Inset Margin',
                    desc: 'Clean white border without frame',
                  },
                  {
                    id: 'borderless',
                    label: 'Borderless (Edge-to-Edge)',
                    desc: 'Full bleed without margin',
                  },
                ].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBorderStyle(b.id as BorderStyleType)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      borderStyle === b.id
                        ? 'bg-blue-600/20 border-cyan-400 text-white shadow-sm ring-1 ring-cyan-400/50'
                        : 'bg-[#21262d] border-[#30363d] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-semibold">{b.label}</div>
                    <div className="text-[10px] text-slate-400 truncate">{b.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. PAPER SIZE & BACKGROUND COLOR */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Print Paper & Background</span>
              </h4>

              <div className="grid grid-cols-3 gap-2">
                {(['4x6', 'a4', '5x7'] as PaperSizeKey[]).map((pkey) => (
                  <button
                    key={pkey}
                    onClick={() => setPaperSize(pkey)}
                    className={`p-2 rounded-xl border text-center transition-all ${
                      paperSize === pkey
                        ? 'bg-blue-600 text-white font-bold border-blue-400 shadow-md'
                        : 'bg-[#21262d] border-[#30363d] text-slate-300 hover:bg-[#30363d]'
                    }`}
                  >
                    <div className="text-xs">{pkey === '4x6' ? '4 × 6 in (4R)' : pkey === 'a4' ? 'A4 Sheet' : '5 × 7 in (5R)'}</div>
                    <div className="text-[9px] opacity-80">{PAPERS[pkey].widthMm}×{PAPERS[pkey].heightMm}mm</div>
                  </button>
                ))}
              </div>

              {/* Background Color Palette */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Background Color:</span>
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { id: 'original', label: 'Original', color: 'transparent', border: 'border-slate-500' },
                    { id: 'white', label: 'White', color: '#ffffff', border: 'border-slate-300' },
                    { id: 'blue', label: 'Light Blue', color: '#dbeafe', border: 'border-blue-300' },
                    { id: 'grey', label: 'Light Grey', color: '#e2e8f0', border: 'border-slate-300' },
                    { id: 'offwhite', label: 'Off-White', color: '#f8fafc', border: 'border-slate-300' },
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setBackgroundColor(bg.id)}
                      className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 text-[10px] font-medium transition-all ${
                        backgroundColor === bg.id
                          ? 'bg-blue-600/20 border-cyan-400 text-white'
                          : 'bg-[#21262d] border-[#30363d] text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border ${bg.border}`}
                        style={{ backgroundColor: bg.color === 'transparent' ? '#334155' : bg.color }}
                      />
                      <span className="truncate">{bg.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. FACE FRAMING & ZOOM SLIDERS */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Move className="w-4 h-4 text-amber-400" />
                  <span>Face Framing & Zoom</span>
                </h4>
                <label className="flex items-center gap-1 text-xs text-cyan-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGuidelines}
                    onChange={(e) => setShowGuidelines(e.target.checked)}
                    className="w-3 h-3 rounded"
                  />
                  <span>Biometric Guides</span>
                </label>
              </div>

              {/* Zoom Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><ZoomIn className="w-3 h-3" /> Zoom Scale:</span>
                  <span className="font-mono text-cyan-400">{Math.round(zoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="2.5"
                  step="0.02"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#21262d] rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Brightness & Contrast */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Brightness:</span>
                    <span className="font-mono text-cyan-400">{adjustments.brightness}</span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={adjustments.brightness}
                    onChange={(e) => setAdjustments((a) => ({ ...a, brightness: parseInt(e.target.value) }))}
                    className="w-full h-1.5 bg-[#21262d] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Contrast:</span>
                    <span className="font-mono text-cyan-400">{adjustments.contrast}</span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={adjustments.contrast}
                    onChange={(e) => setAdjustments((a) => ({ ...a, contrast: parseInt(e.target.value) }))}
                    className="w-full h-1.5 bg-[#21262d] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: INTERACTIVE VIEWPORT & PRINT SHEET PREVIEW (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* View Switcher Tabs & Print Actions */}
            <div className="no-print bg-[#161b22] border border-[#30363d] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('sheet')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'sheet'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-[#21262d] text-slate-300 hover:text-white'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>4×6 Sheet Output ({photoCount} Photos)</span>
                </button>

                <button
                  onClick={() => setActiveTab('editor')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'editor'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-[#21262d] text-slate-300 hover:text-white'
                  }`}
                >
                  <Move className="w-3.5 h-3.5" />
                  <span>Crop & Face Position</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadSingle}
                  className="px-3 py-2 rounded-xl bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
                  title="Download 1 single 35x45mm 300 DPI photo with border"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Single (35×45mm)</span>
                  <span className="sm:hidden">Single</span>
                </button>

                <button
                  onClick={handleDownloadSheet}
                  className="px-3.5 py-2 rounded-xl bg-[#21262d] hover:bg-[#30363d] border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                  title="Download whole 300 DPI photo print sheet"
                >
                  <Download className="w-4 h-4" />
                  <span>Download 300 DPI Sheet</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all transform active:scale-98"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Sheet</span>
                </button>
              </div>
            </div>

            {/* MAIN PREVIEW CONTAINER */}
            <div className="bg-[#090d13] p-4 sm:p-6 rounded-2xl border border-[#30363d] flex flex-col items-center justify-center min-h-[560px] overflow-auto">
              {activeTab === 'editor' ? (
                /* TAB 1: CROP & FACE POSITIONING (Interactive Pan & Zoom) */
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5 bg-[#161b22] px-3 py-1.5 rounded-xl border border-[#30363d]">
                    <Move className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Click and drag photo to align eyes & chin inside guidelines</span>
                  </div>

                  <div className="relative shadow-2xl rounded-lg overflow-hidden border-2 border-cyan-500/50">
                    <canvas
                      ref={cropCanvasRef}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      className="cursor-move touch-none block"
                      style={{
                        width: '280px',
                        height: `${Math.round(280 * (45 / 35))}px`,
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={() => setPan({ x: 0, y: 0 })}
                      className="text-xs px-3 py-1 bg-[#21262d] hover:bg-[#30363d] text-slate-300 rounded-lg border border-[#30363d]"
                    >
                      Reset Position
                    </button>
                    <button
                      onClick={() => setActiveTab('sheet')}
                      className="text-xs px-4 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow"
                    >
                      View 4×6 Sheet Output →
                    </button>
                  </div>
                </div>
              ) : (
                /* TAB 2: 4x6 INCH SHEET OUTPUT (MATCHING IMAGE 2 EXACTLY!) */
                <div className="w-full flex flex-col items-center justify-center">
                  {/* Screen-only dimension info */}
                  <div className="no-print pb-3 text-center text-xs text-slate-400 flex items-center gap-2">
                    <span className="font-semibold text-white">4×6 in Photo Paper Sheet</span>
                    <span>•</span>
                    <span className="text-cyan-400 font-mono font-bold">
                      {photoCount} Photos ({layout.cols} × {layout.rows} Grid)
                    </span>
                    <span>•</span>
                    <span>300 DPI High Resolution</span>
                  </div>

                  {/* PRINT-AREA DIV (Rendered on paper via @media print) */}
                  <div
                    ref={printSheetRef}
                    className="print-area bg-white text-black shadow-2xl relative transition-all"
                    style={{
                      // 4x6 landscape photo paper ratio (152.4mm / 101.6mm = 1.500)
                      width: selectedPaper.id === '4x6' ? '640px' : '520px',
                      aspectRatio: `${selectedPaper.widthMm} / ${selectedPaper.heightMm}`,
                      padding: `${layout.marginMm * 2}px`,
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* The Grid of Passport Photos */}
                    <div
                      className="w-full h-full grid"
                      style={{
                        gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                        gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
                        gap: `${layout.gapMm}px`,
                        alignItems: 'center',
                        justifyItems: 'center',
                      }}
                    >
                      {Array.from({ length: Math.min(layout.cols * layout.rows, photoCount) }).map((_, idx) => (
                        <div
                          key={idx}
                          className="w-full h-full flex items-center justify-center relative"
                          style={{
                            border: showCutDividers ? '0.75px solid #000000' : 'none',
                            boxSizing: 'border-box',
                            padding: borderStyle === 'studio_classic' ? '3px' : '0px',
                          }}
                        >
                          {/* Inner photo container with Studio Border (Image 1 & 2) */}
                          <div
                            className="w-full h-full relative overflow-hidden flex items-center justify-center bg-white"
                            style={{
                              border: borderStyle === 'studio_classic' || borderStyle === 'black_border' ? '1.5px solid #000000' : 'none',
                              boxSizing: 'border-box',
                            }}
                          >
                            <img
                              src={previewPhotoDataUrl || ''}
                              alt={`Passport ${idx + 1}`}
                              className="w-full h-full object-cover block"
                              style={{
                                transform: 'scale(1.01)', // prevent subpixel gaps
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Quick Action: Push to Print Studio Queue */}
            {onSendToPrint && (
              <div className="no-print bg-[#161b22] border border-[#30363d] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-cyan-400 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Need multi-page duplex or custom document sizing?</div>
                    <div className="text-[11px] text-slate-400">Push this passport photo into the multi-layout Print Studio queue</div>
                  </div>
                </div>
                <button
                  onClick={handleSendToPrintStudio}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Send to Print Studio Queue</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
