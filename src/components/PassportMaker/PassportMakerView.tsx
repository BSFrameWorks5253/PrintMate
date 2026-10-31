import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Scissors,
  RotateCw,
  RotateCcw,
  RefreshCw,
  Trash2,
  Eye
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { analytics } from '../../services/analyticsService';
import { useAuth } from '../../context/AuthContext';
import { userStorageService } from '../../services/userStorageService';
import type { PrintQueueItem } from '../../types';
import './PassportMaker.css';

interface PassportMakerViewProps {
  onSendToPrint?: (item: Omit<PrintQueueItem, 'id' | 'createdAt'>) => void;
}

export type BorderStyleType = 'studio_classic' | 'black_border' | 'white_margin' | 'borderless';
export type PaperSizeKey = '5x7' | 'a4' | '4x6';
export type PassportStandardKey = '34x45' | '35x45' | '51x51' | '30x40' | '33x48';

export interface PassportStandardDef {
  id: PassportStandardKey;
  name: string;
  widthMm: number;
  heightMm: number;
  country: string;
  widthPx300Dpi: number;
  heightPx300Dpi: number;
}

export const PASSPORT_STANDARDS: Record<PassportStandardKey, PassportStandardDef> = {
  '34x45': {
    id: '34x45',
    name: '34 × 45 mm (Standard Studio)',
    widthMm: 34,
    heightMm: 45,
    country: 'India Studio, Passport & Visa (With Crisp Borders)',
    widthPx300Dpi: 402,
    heightPx300Dpi: 531,
  },
  '35x45': {
    id: '35x45',
    name: '35 × 45 mm (Standard)',
    widthMm: 35,
    heightMm: 45,
    country: 'India, UK, Europe, Schengen, Australia, Canada Visa',
    widthPx300Dpi: 413,
    heightPx300Dpi: 531,
  },
  '51x51': {
    id: '51x51',
    name: '2 × 2 in (51 × 51 mm)',
    widthMm: 50.8,
    heightMm: 50.8,
    country: 'US Passport / Visa, OCI Card, India Visa',
    widthPx300Dpi: 600,
    heightPx300Dpi: 600,
  },
  '30x40': {
    id: '30x40',
    name: '30 × 40 mm (Mini ID)',
    widthMm: 30,
    heightMm: 40,
    country: 'College ID, Employee Badge, Library Card',
    widthPx300Dpi: 354,
    heightPx300Dpi: 472,
  },
  '33x48': {
    id: '33x48',
    name: '33 × 48 mm (Visa)',
    widthMm: 33,
    heightMm: 48,
    country: 'China Visa, East Asian Embassies',
    widthPx300Dpi: 390,
    heightPx300Dpi: 567,
  },
};

interface PaperDef {
  id: PaperSizeKey;
  name: string;
  widthMm: number;
  heightMm: number;
  widthPx300Dpi: number;
  heightPx300Dpi: number;
}

const PAPERS: Record<PaperSizeKey, PaperDef> = {
  '5x7': {
    id: '5x7',
    name: '5 × 7 in Photo Paper (5R)',
    widthMm: 177.8,
    heightMm: 127.0,
    widthPx300Dpi: 2100,
    heightPx300Dpi: 1500,
  },
  'a4': {
    id: 'a4',
    name: 'A4 Document Sheet (210 × 297 mm)',
    widthMm: 210,
    heightMm: 297,
    widthPx300Dpi: 2480,
    heightPx300Dpi: 3508,
  },
  '4x6': {
    id: '4x6',
    name: '4 × 6 in Photo Paper (Standard 4R)',
    widthMm: 152.4,
    heightMm: 101.6,
    widthPx300Dpi: 1800,
    heightPx300Dpi: 1200,
  },
};

export const PassportMakerView: React.FC<PassportMakerViewProps> = ({ onSendToPrint }) => {
  const { user } = useAuth();

  // Photo source state
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string>('Passport_Photo');
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  // Passport Standard Preset & Rotation
  const [presetStandard, setPresetStandard] = useState<PassportStandardKey>('34x45');
  const [rotation, setRotation] = useState<number>(0);
  const [straightenAngle, setStraightenAngle] = useState<number>(0);

  // Framing & Crop state
  const [zoom, setZoom] = useState<number>(1.15);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showEditorGuidelines, setShowEditorGuidelines] = useState<boolean>(false);
  const [keepGuidelinesInExport, setKeepGuidelinesInExport] = useState<boolean>(false); // Default OFF/closed as requested

  // Sheet configuration
  const [paperSize, setPaperSize] = useState<PaperSizeKey>('4x6');
  const [photoCount, setPhotoCount] = useState<number>(8); // Default 8 photos on 4x6 (matching Image 2!)
  const [borderStyle, setBorderStyle] = useState<BorderStyleType>('studio_classic');
  const [backgroundColor, setBackgroundColor] = useState<string>('original');
  const [showCutDividers, setShowCutDividers] = useState<boolean>(true);
  const [cleanSinglePhotoUrl, setCleanSinglePhotoUrl] = useState<string>('');

  // Adjustments
  const [adjustments, setAdjustments] = useState({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpness: 15,
  });

  const [activeTab, setActiveTab] = useState<'sheet' | 'editor'>('editor');
  const [toastNotice, setToastNotice] = useState<string>('');

  // Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const printSheetRef = useRef<HTMLDivElement | null>(null);

  const selectedPaper = PAPERS[paperSize];

  // Helper to auto-rotate image upright if it's uploaded in landscape orientation
  const applyImageWithAutoOrientation = (img: HTMLImageElement) => {
    setImageObj(img);
    setPan({ x: 0, y: 0 });
    setZoom(1.15);
    setStraightenAngle(0);

    // Auto-rotate: passport photos must be vertical portrait.
    // If uploaded photo is wider than it is tall, automatically rotate 90°!
    if (img.naturalWidth > img.naturalHeight) {
      setRotation(90);
      setToastNotice('Landscape image detected: auto-rotated 90° upright to portrait');
      setTimeout(() => setToastNotice(''), 3000);
    } else {
      setRotation(0);
    }
  };

  // Keyboard shortcut: Press "Enter" to proceed from Crop (Step 1) to Page Layout (Step 2)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        // Don't intercept Enter when user is typing inside text or number inputs
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
          return;
        }
        if (activeTab === 'editor' && (photoUrl || imageObj)) {
          e.preventDefault();
          setActiveTab('sheet');
          setToastNotice('Step 2: Sheet layout generated! Ready to print or adjust grid.');
          setTimeout(() => setToastNotice(''), 3000);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, photoUrl, imageObj]);

  // Load image object when photoUrl changes
  useEffect(() => {
    if (!photoUrl) {
      setImageObj(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      applyImageWithAutoOrientation(img);
    };
    img.src = photoUrl;
  }, [photoUrl]);

  // Save to Recents on unmount if a photo was active
  useEffect(() => {
    return () => {
      if (cleanSinglePhotoUrl || photoUrl) {
        userStorageService.addRecent(user?.id, {
          name: `${photoName} (${PASSPORT_STANDARDS[presetStandard].name})`,
          dataUrl: cleanSinglePhotoUrl || photoUrl || '',
          docType: 'id_standard',
          source: 'passport',
          aspectRatio: PASSPORT_STANDARDS[presetStandard].widthMm / PASSPORT_STANDARDS[presetStandard].heightMm,
        });
      }
    };
  }, [cleanSinglePhotoUrl, photoUrl, photoName, presetStandard, user]);

  // Load default demo image on click
  const loadDemoPhoto = () => {
    setPhotoUrl('/sample_passport.jpg');
    setPhotoName('Sample_Passport_Photo');
    setActiveTab('editor');
    setToastNotice('Loaded portrait • Step 1: Crop & align face (Press Enter for Sheet Layout)');
    setTimeout(() => setToastNotice(''), 3000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPhotoUrl(event.target.result as string);
        setPhotoName(file.name.replace(/\.[^/.]+$/, ''));
        setActiveTab('editor');
        setToastNotice('Photo loaded • Step 1: Crop & align face (Press Enter for Sheet Layout)');
        setTimeout(() => setToastNotice(''), 3000);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  // Clean / Cancel Photo (archives to Recents and clears canvas)
  const handleClearPhoto = () => {
    if (photoUrl || cleanSinglePhotoUrl) {
      userStorageService.addRecent(user?.id, {
        name: `${photoName} (${PASSPORT_STANDARDS[presetStandard].name})`,
        dataUrl: cleanSinglePhotoUrl || photoUrl || '',
        docType: 'id_standard',
        source: 'passport',
        aspectRatio: PASSPORT_STANDARDS[presetStandard].widthMm / PASSPORT_STANDARDS[presetStandard].heightMm,
      });
      setPhotoUrl(null);
      setImageObj(null);
      setCleanSinglePhotoUrl('');
      setRotation(0);
      setStraightenAngle(0);
      setShowEditorGuidelines(false);
      setKeepGuidelinesInExport(false);
      setActiveTab('editor');
      setToastNotice('Photo cleared from canvas • Preserved in Recent Documents');
      setTimeout(() => setToastNotice(''), 3000);
    }
  };

  // Rotation controls
  const rotateCw = () => setRotation((r) => ((r + 90) % 360));
  const rotateCcw = () => setRotation((r) => ((r - 90 + 360) % 360));
  const autoRotate = () => {
    if (!imageObj) return;
    setStraightenAngle(0);
    if (imageObj.naturalWidth > imageObj.naturalHeight) {
      setRotation(90);
      setToastNotice('Rotated upright to portrait');
    } else {
      setRotation(0);
      setToastNotice('Restored original portrait angle');
    }
    setTimeout(() => setToastNotice(''), 2500);
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
          setActiveTab('editor');
          setToastNotice('Photo loaded • Step 1: Crop & align face (Press Enter for Sheet Layout)');
          setTimeout(() => setToastNotice(''), 3000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // MATHEMATICS OF DYNAMIC SHRINKING & TILING
  const computeGridLayout = () => {
    const count = Math.max(1, photoCount);
    const paperW = selectedPaper.widthMm;
    const paperH = selectedPaper.heightMm;

    let cols = 4;
    let rows = 2;

    if (paperSize === '4x6') {
      // 4x6 landscape photo paper is 152.4 x 101.6 mm (~1.50 landscape ratio)
      if (count <= 2) {
        cols = 2;
        rows = 1;
      } else if (count <= 4) {
        cols = 4;
        rows = 1;
      } else if (count <= 8) {
        cols = 4;
        rows = 2; // 4 cols × 2 rows = 8 photos (Standard studio layout)
      } else if (count <= 18) {
        cols = 6;
        rows = 3;
      } else {
        cols = 8;
        rows = 4;
      }
    } else if (paperSize === '5x7') {
      // 5x7 landscape photo paper is 177.8 x 127.0 mm (5R)
      if (count <= 2) {
        cols = 2;
        rows = 1;
      } else if (count <= 4) {
        cols = 4;
        rows = 1;
      } else if (count <= 8) {
        cols = 4;
        rows = 2;
      } else if (count <= 10) {
        cols = 5;
        rows = 2;
      } else if (count <= 15) {
        cols = 5;
        rows = 3;
      } else {
        cols = 6;
        rows = 4;
      }
    } else {
      // A4 portrait is 210 x 297 mm
      if (count <= 6) {
        cols = 2;
        rows = 3;
      } else if (count <= 12) {
        cols = 3;
        rows = 4;
      } else if (count <= 20) {
        cols = 4;
        rows = 5;
      } else if (count <= 30) {
        cols = 5;
        rows = 6;
      } else {
        cols = 6;
        rows = 7;
      }
    }

    const marginMm = count <= 8 ? 2.5 : 2.0;
    const gapMm = count <= 8 ? 2.0 : 1.2;

    const availW = paperW - (marginMm * 2) - ((cols - 1) * gapMm);
    const availH = paperH - (marginMm * 2) - ((rows - 1) * gapMm);

    const maxCellW = availW / cols;
    const maxCellH = availH / rows;

    const std = PASSPORT_STANDARDS[presetStandard] || PASSPORT_STANDARDS['34x45'];
    const standardW = std.widthMm;
    const standardH = std.heightMm;
    const passportRatio = standardW / standardH;

    // Fit strictly inside available cell bounds preserving standard ratio
    const fitW = Math.min(maxCellW, maxCellH * passportRatio);
    const fitH = fitW / passportRatio;

    let finalPhotoW = standardW;
    let finalPhotoH = standardH;
    let isShrunk = false;

    // Check if standard fits on sheet without expanding page
    if (count <= 8 && maxCellW >= standardW && maxCellH >= standardH) {
      finalPhotoW = standardW;
      finalPhotoH = standardH;
      isShrunk = false;
    } else {
      finalPhotoW = Math.round(fitW * 10) / 10;
      finalPhotoH = Math.round(fitH * 10) / 10;
      isShrunk = true;
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
  const renderSinglePassportCanvas = useCallback((
    wPx?: number, 
    hPx?: number, 
    includeBorders: boolean = true,
    includeGuidelines: boolean = keepGuidelinesInExport
  ): HTMLCanvasElement => {
    const std = PASSPORT_STANDARDS[presetStandard] || PASSPORT_STANDARDS['34x45'];
    const canvas = document.createElement('canvas');
    const width = wPx || std.widthPx300Dpi;
    const height = hPx || std.heightPx300Dpi;
    canvas.width = width;
    canvas.height = height;
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
    ctx.fillRect(0, 0, width, height);

    let insetX = 0;
    let insetY = 0;
    let borderWidth = 0;

    if (includeBorders) {
      if (borderStyle === 'studio_classic') {
        insetX = Math.round(width * 0.05);
        insetY = Math.round(height * 0.05);
        borderWidth = Math.max(1, Math.round(width * 0.005));
      } else if (borderStyle === 'black_border') {
        borderWidth = Math.max(1, Math.round(width * 0.005));
      } else if (borderStyle === 'white_margin') {
        insetX = Math.round(width * 0.05);
        insetY = Math.round(height * 0.05);
      }
    }

    const photoAreaW = width - insetX * 2;
    const photoAreaH = height - insetY * 2;

    // Draw photo inside photoArea with rotation and pan/zoom
    if (imageObj) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(insetX, insetY, photoAreaW, photoAreaH);
      ctx.clip();

      ctx.filter = `brightness(${100 + adjustments.brightness}%) contrast(${100 + adjustments.contrast}%) saturate(${100 + adjustments.saturation}%)`;

      const centerX = insetX + photoAreaW / 2 + (pan.x * photoAreaW);
      const centerY = insetY + photoAreaH / 2 + (pan.y * photoAreaH);

      const effectiveRotation = rotation + straightenAngle;

      ctx.translate(centerX, centerY);
      if (effectiveRotation !== 0) {
        ctx.rotate((effectiveRotation * Math.PI) / 180);
      }

      // Calculate effective bounding box after rotation so photo covers the area without gaps
      const rad = (Math.abs(effectiveRotation) * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const effectiveW = imageObj.width * cos + imageObj.height * sin;
      const effectiveH = imageObj.width * sin + imageObj.height * cos;

      const scale = Math.max(photoAreaW / (effectiveW || 1), photoAreaH / (effectiveH || 1)) * zoom;
      const drawW = imageObj.width * scale;
      const drawH = imageObj.height * scale;

      ctx.drawImage(imageObj, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }

    // Draw Biometric Face Guidelines directly inside canvas if requested (retained in print & downloads!)
    if (includeGuidelines) {
      ctx.save();
      const scale = width / (std.widthPx300Dpi || 413);
      ctx.lineWidth = Math.max(1.5, 2 * scale);
      ctx.setLineDash([6 * scale, 4 * scale]);

      // Eye Level Line (~42% from top)
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.95)'; // Vivid cyan
      ctx.beginPath();
      ctx.moveTo(15 * scale, height * 0.42);
      ctx.lineTo(width - 15 * scale, height * 0.42);
      ctx.stroke();

      // Chin Line (~80% from top)
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.95)';
      ctx.beginPath();
      ctx.moveTo(30 * scale, height * 0.80);
      ctx.lineTo(width - 30 * scale, height * 0.80);
      ctx.stroke();

      // Crown / Top of head line (~15% from top)
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.8)';
      ctx.beginPath();
      ctx.moveTo(30 * scale, height * 0.15);
      ctx.lineTo(width - 30 * scale, height * 0.15);
      ctx.stroke();

      // Face Oval Guide
      ctx.setLineDash([6 * scale, 6 * scale]);
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.9)';
      ctx.beginPath();
      ctx.ellipse(width / 2, height * 0.48, width * 0.30, height * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Center vertical guide
      ctx.setLineDash([4 * scale, 6 * scale]);
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.7)';
      ctx.beginPath();
      ctx.moveTo(width / 2, 10 * scale);
      ctx.lineTo(width / 2, height - 10 * scale);
      ctx.stroke();

      // Text labels
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(2, 132, 199, 0.98)';
      ctx.font = `bold ${Math.round(11 * scale)}px sans-serif`;
      ctx.fillText('EYE LEVEL', 20 * scale, height * 0.40);
      ctx.fillText('CHIN LINE', 35 * scale, height * 0.78);
      ctx.fillText('CROWN', 35 * scale, height * 0.13);

      ctx.restore();
    }

    // Draw borders over photo if requested
    if (includeBorders) {
      if (borderStyle === 'studio_classic') {
        // 1. Clear outer margins to pure white FIRST so photo overflow is cut clean
        ctx.fillStyle = '#ffffff';
        // Top margin
        ctx.fillRect(0, 0, width, insetY);
        // Bottom margin
        ctx.fillRect(0, height - insetY, width, insetY);
        // Left margin
        ctx.fillRect(0, 0, insetX, height);
        // Right margin
        ctx.fillRect(width - insetX, 0, insetX, height);

        // 2. Draw crisp black rectangular border around the photo portrait area
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(insetX, insetY, photoAreaW, photoAreaH);

        // 3. Outer crisp bounding stroke around entire passport card
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
      } else if (borderStyle === 'black_border') {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
      }
    }

    return canvas;
  }, [presetStandard, backgroundColor, borderStyle, imageObj, zoom, pan, rotation, straightenAngle, keepGuidelinesInExport, adjustments]);

  // Render crop editor canvas
  useEffect(() => {
    const canvas = cropCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const std = PASSPORT_STANDARDS[presetStandard] || PASSPORT_STANDARDS['34x45'];
    const w = std.widthPx300Dpi;
    const h = std.heightPx300Dpi;
    canvas.width = w;
    canvas.height = h;

    const rendered = renderSinglePassportCanvas(w, h, true, showEditorGuidelines);
    ctx.drawImage(rendered, 0, 0);
  }, [presetStandard, showEditorGuidelines, renderSinglePassportCanvas]);

  // Update clean single photo preview data URL whenever editing state changes
  useEffect(() => {
    if (!imageObj) {
      setCleanSinglePhotoUrl('');
      return;
    }
    const std = PASSPORT_STANDARDS[presetStandard] || PASSPORT_STANDARDS['34x45'];
    const canvas = renderSinglePassportCanvas(std.widthPx300Dpi, std.heightPx300Dpi, true, keepGuidelinesInExport);
    setCleanSinglePhotoUrl(canvas.toDataURL('image/jpeg', 0.95));
  }, [imageObj, presetStandard, keepGuidelinesInExport, renderSinglePassportCanvas]);

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
    const { cols, rows, photoWidthMm, photoHeightMm, gapMm } = layout;

    const photoPxW = Math.round(photoWidthMm * pxPerMm);
    const photoPxH = Math.round(photoHeightMm * pxPerMm);
    const gapPx = Math.round(gapMm * pxPerMm);

    const totalGridW = (cols * photoPxW) + ((cols - 1) * gapPx);
    const totalGridH = (rows * photoPxH) + ((rows - 1) * gapPx);

    const startX = Math.round((sheetCanvas.width - totalGridW) / 2);
    const startY = Math.round((sheetCanvas.height - totalGridH) / 2);

    // Pre-render a single passport photo at 300 DPI (with biometric guides if explicitly enabled)
    const singlePhoto = renderSinglePassportCanvas(photoPxW, photoPxH, true, keepGuidelinesInExport);

    const count = Math.min(cols * rows, photoCount);

    for (let i = 0; i < count; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = startX + (c * (photoPxW + gapPx));
      const y = startY + (r * (photoPxH + gapPx));

      ctx.drawImage(singlePhoto, x, y, photoPxW, photoPxH);
    }

    // Draw full-page dark slate dashed cutting guidelines across entire sheet
    if (showCutDividers) {
      ctx.save();
      ctx.strokeStyle = '#475569'; // Slate-600: dark, crisp, visible on physical white paper in print & downloads
      ctx.lineWidth = Math.max(2.5, Math.round(pxPerMm * 0.22)); // High-visibility ~0.22mm hairline for 300DPI
      ctx.setLineDash([14, 10]); // High-contrast dash pattern for scissors and paper trimmers

      // Vertical full-page cutting lines
      const vCutPositions = [startX - gapPx / 2];
      for (let c = 1; c < cols; c++) {
        vCutPositions.push(startX + (c * (photoPxW + gapPx)) - gapPx / 2);
      }
      vCutPositions.push(startX + (cols * (photoPxW + gapPx)) - gapPx / 2);

      vCutPositions.forEach((vx) => {
        const xPos = Math.round(vx) + 0.5;
        ctx.beginPath();
        ctx.moveTo(xPos, 0);
        ctx.lineTo(xPos, sheetCanvas.height);
        ctx.stroke();
      });

      // Horizontal full-page cutting lines
      const hCutPositions = [startY - gapPx / 2];
      for (let r = 1; r < rows; r++) {
        hCutPositions.push(startY + (r * (photoPxH + gapPx)) - gapPx / 2);
      }
      hCutPositions.push(startY + (rows * (photoPxH + gapPx)) - gapPx / 2);

      hCutPositions.forEach((hy) => {
        const yPos = Math.round(hy) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, yPos);
        ctx.lineTo(sheetCanvas.width, yPos);
        ctx.stroke();
      });

      ctx.restore();
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
    try {
      analytics.trackDownload({
        type: `Passport Sheet (${photoCount}-up, ${selectedPaper.name})`,
        page: 'passport',
      });
    } catch (e) {
      console.warn('Analytics tracking failed', e);
    }
  };

  // 2. Download Single Passport Photo (Current Standard Preset)
  const handleDownloadSingle = () => {
    const std = PASSPORT_STANDARDS[presetStandard] || PASSPORT_STANDARDS['34x45'];
    const single = renderSinglePassportCanvas(std.widthPx300Dpi, std.heightPx300Dpi, true, keepGuidelinesInExport);
    const link = document.createElement('a');
    link.download = `${photoName}_${std.widthMm}x${std.heightMm}mm_300DPI.jpg`;
    link.href = single.toDataURL('image/jpeg', 0.98);
    link.click();
    try {
      analytics.trackDownload({
        type: `Single ${std.name} Passport Photo`,
        fileName: photoName,
        page: 'passport',
      });
    } catch (e) {
      console.warn('Analytics tracking failed', e);
    }
  };

  // 3. Print Sheet directly
  const handlePrint = () => {
    setActiveTab('sheet');
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
    try {
      analytics.trackPrint({
        pageSize: selectedPaper.id,
        itemCount: photoCount,
        page: 'passport',
      });
    } catch (e) {
      console.warn('Analytics tracking failed', e);
    }
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // 4. Send to Main Print Studio Queue
  const handleSendToPrintStudio = () => {
    if (!onSendToPrint) return;
    const std = PASSPORT_STANDARDS[presetStandard] || PASSPORT_STANDARDS['34x45'];
    const single = renderSinglePassportCanvas(std.widthPx300Dpi, std.heightPx300Dpi, true, keepGuidelinesInExport);
    const singleDataUrl = single.toDataURL('image/jpeg', 0.98);
    const ratio = std.widthMm / std.heightMm;
    onSendToPrint({
      dataUrl: singleDataUrl,
      name: `${photoName} (${std.name})`,
      docType: 'id_standard',
      cardSide: 'single',
      aspectRatio: ratio,
    });
    userStorageService.addRecent(user?.id, {
      name: `${photoName} (${std.name})`,
      dataUrl: singleDataUrl,
      docType: 'id_standard',
      source: 'passport',
      aspectRatio: ratio,
    });
    setToastNotice('Passport photo dispatched to Print Studio queue!');
    setTimeout(() => setToastNotice(''), 2500);
  };


  const handlePrintRef = useRef(handlePrint);
  useEffect(() => {
    handlePrintRef.current = handlePrint;
  });

  // Global Ctrl+P / Cmd+P shortcut to trigger print sheet
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrintRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Toast Notification */}
      {toastNotice && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm animate-fade-in">
          <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{toastNotice}</span>
        </div>
      )}
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
        style={{ display: 'none' }}
      />

      {/* STUDIO HEADER BANNER */}
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-blue-500/10 dark:bg-blue-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
              <CreditCard className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Passport Size Photo Studio (35 × 45 mm • 300 DPI)
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
              4×6 Photo Paper (Image 2 Layout)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Convert any portrait into a 300 DPI 35×45mm passport layout with studio borders, cutting grids, and automatic proportional shrinking when exceeding 8 photos.
          </p>
        </div>

        {/* Quick Demo, Upload & Cancel/Clear Buttons */}
        <div className="flex items-center gap-2">
          {!photoUrl ? (
            <button
              onClick={loadDemoPhoto}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Use Demo Photo (Image 1)</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload New</span>
              </button>
              <button
                onClick={handleClearPhoto}
                className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Remove photo from canvas and archive to Recent Documents"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Cancel / Clear</span>
              </button>
            </div>
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
          className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-cyan-500/60 bg-white/70 dark:bg-slate-900/70 rounded-2xl p-12 text-center transition-all cursor-pointer group shadow-xl"
        >
          <div className="w-16 h-16 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 flex items-center justify-center mx-auto mb-4 border border-cyan-200 dark:border-cyan-800 transition-all">
            <Upload className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Upload Passport Portrait Photo
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
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
              className="px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-700 dark:text-amber-300 font-semibold text-xs flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Load Image 1 (Sample Portrait)</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* STEP WIZARD NAVIGATION BAR */}
          <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Step 1 Button */}
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'editor'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span className={`w-5 h-5 rounded-full text-center text-[11px] flex items-center justify-center font-bold ${
                  activeTab === 'editor' ? 'bg-white/25 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  1
                </span>
                <span className="hidden xs:inline">Step 1:</span>
                <span>Crop & Position</span>
                {activeTab === 'sheet' && <span className="text-[11px] text-emerald-600 ml-0.5">✓</span>}
              </button>

              <span className="text-slate-300 dark:text-slate-700 font-bold text-sm">→</span>

              {/* Step 2 Button */}
              <button
                type="button"
                onClick={() => setActiveTab('sheet')}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'sheet'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span className={`w-5 h-5 rounded-full text-center text-[11px] flex items-center justify-center font-bold ${
                  activeTab === 'sheet' ? 'bg-white/25 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  2
                </span>
                <span className="hidden xs:inline">Step 2:</span>
                <span>Page Layout & Print</span>
              </button>
            </div>

            <div>
              {activeTab === 'editor' ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('sheet')}
                  className="px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold shadow-md shadow-blue-500/25 flex items-center gap-2 transition-all transform active:scale-98 cursor-pointer"
                >
                  <span>Next: Page Layout →</span>
                  <span className="text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded border border-white/25 hidden sm:inline">
                    ↵ Enter
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveTab('editor')}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <span>← Re-Crop & Adjust</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN: CONTROLS & PHOTO ADJUSTMENTS (5 Cols) */}
            <div className="no-print lg:col-span-5 space-y-4">
              {activeTab === 'editor' ? (
                /* STEP 1 CONTROLS: CROP, PRESET, ROTATION, FACE FRAMING & ADJUSTMENTS */
                <>
                  {/* 1. PASSPORT STANDARD PRESET (35x45, 51x51, 30x40, 33x48) */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Passport & Visa Standard</span>
                      </h4>
                      <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                        {PASSPORT_STANDARDS[presetStandard].name}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(PASSPORT_STANDARDS) as PassportStandardKey[]).map((key) => {
                        const std = PASSPORT_STANDARDS[key];
                        const isSelected = presetStandard === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setPresetStandard(key)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-500 shadow-md ring-2 ring-blue-400/40'
                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            <div className="text-xs font-bold">{std.name}</div>
                            <div className={`text-[10px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                              {std.country}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. PHOTO ROTATION & ORIENTATION CONTROLS */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-md">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <RotateCw className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Photo Orientation & Rotation</span>
                      </h4>
                      <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                        {(rotation + straightenAngle).toFixed(1)}°
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={rotateCcw}
                        className="py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                        title="Rotate 90 degrees counter-clockwise"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        <span>↺ 90° Left</span>
                      </button>
                      <button
                        type="button"
                        onClick={rotateCw}
                        className="py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                        title="Rotate 90 degrees clockwise"
                      >
                        <RotateCw className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        <span>↻ 90° Right</span>
                      </button>
                      <button
                        type="button"
                        onClick={autoRotate}
                        className="py-2.5 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                        title="Auto-detect portrait upright orientation"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Auto-Upright</span>
                      </button>
                    </div>

                    {/* Fine Straightening / Deskew Slider & Nudge Buttons */}
                    <div className="pt-2.5 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 font-semibold flex items-center gap-1">
                          <span>Fine Angle Straighten / Deskew:</span>
                        </span>
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {straightenAngle > 0 ? `+${straightenAngle.toFixed(1)}°` : `${straightenAngle.toFixed(1)}°`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setStraightenAngle((a) => Math.max(-25, Math.round((a - 1) * 10) / 10))}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 cursor-pointer shadow-xs active:scale-95"
                          title="Tilt -1°"
                        >
                          -1°
                        </button>
                        <button
                          type="button"
                          onClick={() => setStraightenAngle((a) => Math.max(-25, Math.round((a - 0.5) * 10) / 10))}
                          className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 cursor-pointer shadow-xs active:scale-95"
                          title="Tilt -0.5°"
                        >
                          -0.5°
                        </button>
                        <input
                          type="range"
                          min="-25"
                          max="25"
                          step="0.5"
                          value={straightenAngle}
                          onChange={(e) => setStraightenAngle(parseFloat(e.target.value))}
                          className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <button
                          type="button"
                          onClick={() => setStraightenAngle((a) => Math.min(25, Math.round((a + 0.5) * 10) / 10))}
                          className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 cursor-pointer shadow-xs active:scale-95"
                          title="Tilt +0.5°"
                        >
                          +0.5°
                        </button>
                        <button
                          type="button"
                          onClick={() => setStraightenAngle((a) => Math.min(25, Math.round((a + 1) * 10) / 10))}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 cursor-pointer shadow-xs active:scale-95"
                          title="Tilt +1°"
                        >
                          +1°
                        </button>
                        {straightenAngle !== 0 && (
                          <button
                            type="button"
                            onClick={() => setStraightenAngle(0)}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold border border-rose-200 cursor-pointer shadow-xs"
                            title="Reset Straightening to 0°"
                          >
                            0°
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3. FACE FRAMING & ZOOM SLIDERS */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <Move className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        <span>Face Framing & Zoom</span>
                      </h4>
                      <label className="flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showEditorGuidelines}
                          onChange={(e) => setShowEditorGuidelines(e.target.checked)}
                          className="w-3 h-3 rounded"
                        />
                        <span>Biometric Guides</span>
                      </label>
                    </div>

                    {/* Zoom Slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1"><ZoomIn className="w-3 h-3" /> Zoom Scale:</span>
                        <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{Math.round(zoom * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.8"
                        max="2.5"
                        step="0.02"
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                  </div>

                  {/* 4. BORDER & BACKGROUND COLOR */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <Palette className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Background Color & Border</span>
                    </h4>

                    {/* Background Color Palette */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
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
                            type="button"
                            onClick={() => setBackgroundColor(bg.id)}
                            className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 text-[10px] font-medium transition-all ${
                              backgroundColor === bg.id
                                ? 'bg-blue-600 text-white font-bold border-blue-500 shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-400'
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

                    {/* Border Styles */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Scissors className="w-3.5 h-3.5 text-slate-500" />
                        <span>Photo Border:</span>
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'studio_classic', label: 'Studio Classic', desc: 'White margin + thin frame' },
                          { id: 'black_border', label: 'Thin Black Border', desc: 'Sharp single border' },
                          { id: 'white_margin', label: 'White Margin', desc: 'Clean white inset' },
                          { id: 'borderless', label: 'Borderless', desc: 'Full bleed edge' },
                        ].map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setBorderStyle(b.id as BorderStyleType)}
                            className={`p-2 rounded-xl border text-left transition-all ${
                              borderStyle === b.id
                                ? 'bg-blue-600 text-white font-bold border-blue-500 shadow-sm'
                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="text-xs font-semibold">{b.label}</div>
                            <div className={`text-[9px] truncate ${borderStyle === b.id ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>{b.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 5. BRIGHTNESS & CONTRAST ADJUSTMENTS */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                      Fine Lighting Adjustments
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Brightness:</span>
                          <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{adjustments.brightness}</span>
                        </div>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          value={adjustments.brightness}
                          onChange={(e) => setAdjustments((a) => ({ ...a, brightness: parseInt(e.target.value) }))}
                          className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Contrast:</span>
                          <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{adjustments.contrast}</span>
                        </div>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          value={adjustments.contrast}
                          onChange={(e) => setAdjustments((a) => ({ ...a, contrast: parseInt(e.target.value) }))}
                          className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>
                    </div>
                  </div>

                  {/* BIG CTA BUTTON AT BOTTOM OF STEP 1 */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('sheet')}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-98 cursor-pointer"
                  >
                    <span>Proceed to Page Layout →</span>
                    <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded font-mono border border-white/25">↵ Enter</span>
                  </button>
                </>
              ) : (
                /* STEP 2 CONTROLS: SHEET PAPER SIZE, PHOTO COUNT, CUTTING DIVIDERS */
                <>
                  {/* 1. PHOTO COUNT & AUTO-SHRINK CONTROLLER */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <Grid className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        <span>Number of Photos on Page</span>
                      </h4>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                        layout.isShrunk 
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40' 
                          : 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
                      }`}>
                        {photoCount} Photos ({layout.cols} × {layout.rows})
                      </span>
                    </div>

                    {/* Stepper & Preset Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPhotoCount((c) => Math.max(1, c - 1))}
                        className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="32"
                        value={photoCount}
                        onChange={(e) => setPhotoCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 h-9 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        onClick={() => setPhotoCount((c) => c + 1)}
                        className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                      >
                        +
                      </button>

                      <div className="flex items-center gap-1 ml-auto">
                        {[4, 8, 12, 16, 18].map((num) => (
                          <button
                            key={num}
                            onClick={() => setPhotoCount(num)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              photoCount === num
                                ? 'bg-cyan-500 text-black shadow-md'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
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
                        ? 'bg-amber-950/40 border-amber-500/40 text-amber-700 dark:text-amber-300' 
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-cyan-700 dark:text-cyan-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${layout.isShrunk ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                        <span className="font-medium">
                          {layout.isShrunk 
                            ? `Shrunk to fit ${photoCount} on 4×6 sheet:` 
                            : 'Standard Passport Size (ISO/ICAO):'}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {layout.photoWidthMm.toFixed(1)} × {layout.photoHeightMm.toFixed(1)} mm
                      </span>
                    </div>
                  </div>

                  {/* 2. PRINT PAPER SIZE */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Print Sheet Paper Size</span>
                    </h4>

                    <div className="grid grid-cols-3 gap-2">
                      {(['4x6', '5x7', 'a4'] as PaperSizeKey[]).map((pkey) => (
                        <button
                          key={pkey}
                          onClick={() => setPaperSize(pkey)}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                            paperSize === pkey
                              ? 'bg-blue-600 text-white font-bold border-blue-400 shadow-md ring-2 ring-blue-400/40'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          <div className="text-xs">{pkey === '4x6' ? '4 × 6 in (4R)' : pkey === '5x7' ? '5 × 7 in (5R)' : 'A4 Sheet'}</div>
                          <div className={`text-[9px] ${paperSize === pkey ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>{PAPERS[pkey].widthMm}×{PAPERS[pkey].heightMm}mm</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. CUTTING GUIDES & BIOMETRIC FACE GUIDES */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-md">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <Scissors className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Cutting Line Guides</span>
                      </h4>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showCutDividers}
                          onChange={(e) => setShowCutDividers(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-pointer"
                        />
                        <span>Print Cutting Lines</span>
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Renders high-contrast dark dashed lines around and between all photos so you can cut straight with a scissors or trimmer.
                    </p>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <Eye className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        <span>Biometric Face Guidelines</span>
                      </h4>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={keepGuidelinesInExport}
                          onChange={(e) => setKeepGuidelinesInExport(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-cyan-600 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-pointer"
                        />
                        <span>Keep in Print/Download</span>
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Keeps biometric alignment guides (Eye level, Chin, Crown, and Face Oval) visible on printed photos & single downloads. By default off to ensure clean official passport prints.
                    </p>
                  </div>

                  {/* 4. BACK TO CROP BUTTON */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('editor')}
                    className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <span>← Back to Step 1: Crop & Adjust Face</span>
                  </button>
                </>
              )}
            </div>

          {/* RIGHT COLUMN: INTERACTIVE VIEWPORT & PRINT SHEET PREVIEW (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* View Switcher Tabs & Print Actions */}
            <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
              {activeTab === 'editor' ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Move className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Step 1: Crop & Position Face</span>
                    </div>
                    <span className="text-[11px] font-mono text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md">
                      {PASSPORT_STANDARDS[presetStandard].name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadSingle}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Download 1 single cropped photo"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Single Photo</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('sheet')}
                      className="px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold shadow-md shadow-blue-500/25 flex items-center gap-2 transition-all transform active:scale-98 cursor-pointer"
                    >
                      <span>Next: Page Layout →</span>
                      <span className="text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded">↵ Enter</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('editor')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      <span>← Back to Crop</span>
                    </button>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Grid className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span className="hidden sm:inline">Step 2:</span>
                      <span>{selectedPaper.name.split('(')[0]} Sheet ({photoCount} Photos)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {onSendToPrint && (
                      <button
                        onClick={handleSendToPrintStudio}
                        className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        title="Send 1 photo to Print Studio queue for A4 multi-up / ID mix"
                      >
                        <Printer className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span className="hidden sm:inline">Add to Print Studio</span>
                      </button>
                    )}

                    <button
                      onClick={handleDownloadSingle}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Download 1 single photo with border"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Single</span>
                    </button>

                    <button
                      onClick={handleDownloadSheet}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      title="Download whole 300 DPI photo print sheet"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Sheet</span>
                    </button>

                    <button
                      onClick={handlePrint}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all transform active:scale-98 cursor-pointer"
                      title="Print physical photo sheet (Ctrl+P)"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Sheet</span>
                      <kbd className="hidden sm:inline text-[10px] font-mono bg-white/20 px-1 py-0.2 rounded border border-white/30 text-white">
                        Ctrl+P
                      </kbd>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* MAIN PREVIEW CONTAINER */}
            <div className="passport-preview-wrapper bg-slate-100 dark:bg-slate-900/60 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center min-h-[560px] overflow-auto">
              {activeTab === 'editor' ? (
                /* TAB 1: CROP & FACE POSITIONING (Interactive Pan & Zoom & Rotate) */
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <Move className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span>Drag to pan • Preset: <strong className="text-slate-800 dark:text-slate-200">{PASSPORT_STANDARDS[presetStandard]?.name}</strong></span>
                    </div>

                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <button
                        onClick={rotateCcw}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 transition-all"
                        title="Rotate 90° Left"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span className="hidden sm:inline">↺ 90°</span>
                      </button>
                      <button
                        onClick={rotateCw}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 transition-all"
                        title="Rotate 90° Right"
                      >
                        <RotateCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span className="hidden sm:inline">↻ 90°</span>
                      </button>
                      <button
                        onClick={autoRotate}
                        className="px-2 py-1 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                        title="Auto-orient to vertical portrait"
                      >
                        <span>Auto-Upright</span>
                      </button>
                    </div>
                  </div>

                  <div className="relative shadow-2xl rounded-lg overflow-hidden border-2 border-cyan-500/50 bg-white">
                    {(() => {
                      const std = PASSPORT_STANDARDS[presetStandard] || PASSPORT_STANDARDS['35x45'];
                      const canvasW = 280;
                      const canvasH = Math.round(canvasW * (std.heightMm / std.widthMm));
                      return (
                        <canvas
                          ref={cropCanvasRef}
                          onPointerDown={handlePointerDown}
                          onPointerMove={handlePointerMove}
                          onPointerUp={handlePointerUp}
                          className="cursor-move touch-none block"
                          style={{
                            width: `${canvasW}px`,
                            height: `${canvasH}px`,
                          }}
                        />
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={() => setPan({ x: 0, y: 0 })}
                      className="text-xs px-3 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm"
                    >
                      Reset Pan
                    </button>
                    <button
                      onClick={() => {
                        setPan({ x: 0, y: 0 });
                        setZoom(1.0);
                        setRotation(0);
                        setStraightenAngle(0);
                      }}
                      className="text-xs px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 shadow-sm"
                    >
                      Reset All
                    </button>
                    <button
                      onClick={() => setActiveTab('sheet')}
                      className="text-xs px-5 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all transform active:scale-98 cursor-pointer"
                    >
                      <span>Proceed to Sheet Layout →</span>
                      <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono border border-white/25">↵ Enter</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* TAB 2: 4x6 INCH SHEET OUTPUT (MATCHING IMAGE 2 EXACTLY!) */
                <div className="w-full flex flex-col items-center justify-center">
                  {/* Dynamic print-media page size injection so browser automatically selects exact matching paper size & orientation */}
                  <style>{`
                    @media print {
                      @page {
                        size: ${
                          selectedPaper.id === '4x6' ? '6in 4in' :
                          selectedPaper.id === '5x7' ? '7in 5in' :
                          'A4 portrait'
                        };
                        margin: 0 !important;
                      }
                    }
                  `}</style>

                  {/* Screen-only dimension info */}
                  <div className="no-print pb-3 text-center text-xs text-slate-500 flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{selectedPaper.name.split('(')[0]} Sheet</span>
                    <span>•</span>
                    <span className="text-cyan-600 font-mono font-bold">
                      {photoCount} Photos ({layout.cols} × {layout.rows} Grid)
                    </span>
                    <span>•</span>
                    <span>300 DPI High Resolution</span>
                  </div>

                  {/* PRINT-AREA DIV */}
                  {(() => {
                    // Preview Sheet Fixed Dimensions
                    const previewSheetW = selectedPaper.id === 'a4' ? 520 : (selectedPaper.id === '5x7' ? 680 : 640);
                    const previewSheetH = Math.round(previewSheetW * (selectedPaper.heightMm / selectedPaper.widthMm));
                    const pxPerMm = previewSheetW / selectedPaper.widthMm;

                    const previewPhotoW = Math.floor(layout.photoWidthMm * pxPerMm);
                    const previewPhotoH = Math.floor(layout.photoHeightMm * pxPerMm);
                    const previewGapPx = Math.round(layout.gapMm * pxPerMm);

                    return (
                      <div
                        ref={printSheetRef}
                        className="passport-print-sheet bg-white text-black shadow-2xl relative transition-all"
                        style={{
                          '--passport-sheet-width': `${selectedPaper.widthMm}mm`,
                          '--passport-sheet-height': `${selectedPaper.heightMm}mm`,
                          '--passport-sheet-ratio': `${selectedPaper.widthMm} / ${selectedPaper.heightMm}`,
                          '--grid-cols': layout.cols,
                          '--grid-rows': layout.rows,
                          '--photo-w-mm': `${layout.photoWidthMm}mm`,
                          '--photo-h-mm': `${layout.photoHeightMm}mm`,
                          '--gap-mm': `${layout.gapMm}mm`,
                          '--margin-mm': `${layout.marginMm}mm`,
                          width: `${previewSheetW}px`,
                          height: `${previewSheetH}px`,
                          maxWidth: '100%',
                          maxHeight: `${previewSheetH}px`,
                          aspectRatio: `${selectedPaper.widthMm} / ${selectedPaper.heightMm}`,
                          boxSizing: 'border-box',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        } as React.CSSProperties}
                      >
                        {/* The Centered Grid of Passport Photos */}
                        <div
                          className="passport-print-grid"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${layout.cols}, ${previewPhotoW}px)`,
                            gridTemplateRows: `repeat(${layout.rows}, ${previewPhotoH}px)`,
                            gap: `${previewGapPx}px`,
                            justifyContent: 'center',
                            alignContent: 'center',
                            position: 'relative',
                            zIndex: 1,
                          }}
                        >
                          {Array.from({ length: Math.min(layout.cols * layout.rows, photoCount) }).map((_, idx) => (
                            <div
                              key={idx}
                              className="passport-photo-cell relative flex items-center justify-center overflow-hidden bg-white shadow-sm"
                              style={{
                                width: `${previewPhotoW}px`,
                                height: `${previewPhotoH}px`,
                                boxSizing: 'border-box',
                              }}
                            >
                              <img
                                src={cleanSinglePhotoUrl || photoUrl || ''}
                                alt={`Passport ${idx + 1}`}
                                className="w-full h-full object-contain block"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Full-Page Light Grey Dashed Cutting Guides Overlay (Exact Millimeter Alignment for Screen & Print) */}
                        {showCutDividers && (() => {
                          const paperW = selectedPaper.widthMm;
                          const paperH = selectedPaper.heightMm;
                          const totalGridMmW = (layout.cols * layout.photoWidthMm) + ((layout.cols - 1) * layout.gapMm);
                          const totalGridMmH = (layout.rows * layout.photoHeightMm) + ((layout.rows - 1) * layout.gapMm);
                          const startMmX = (paperW - totalGridMmW) / 2;
                          const startMmY = (paperH - totalGridMmH) / 2;

                          const vLinesMm = [startMmX - layout.gapMm / 2];
                          for (let c = 1; c < layout.cols; c++) {
                            vLinesMm.push(startMmX + (c * (layout.photoWidthMm + layout.gapMm)) - layout.gapMm / 2);
                          }
                          vLinesMm.push(startMmX + (layout.cols * (layout.photoWidthMm + layout.gapMm)) - layout.gapMm / 2);

                          const hLinesMm = [startMmY - layout.gapMm / 2];
                          for (let r = 1; r < layout.rows; r++) {
                            hLinesMm.push(startMmY + (r * (layout.photoHeightMm + layout.gapMm)) - layout.gapMm / 2);
                          }
                          hLinesMm.push(startMmY + (layout.rows * (layout.photoHeightMm + layout.gapMm)) - layout.gapMm / 2);

                          return (
                            <svg
                              className="passport-cut-overlay absolute inset-0 pointer-events-none w-full h-full z-10"
                              viewBox={`0 0 ${paperW} ${paperH}`}
                              preserveAspectRatio="none"
                              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                            >
                              {/* Vertical full-page cutting lines */}
                              {vLinesMm.map((xVal, i) => (
                                <line
                                  key={`v-${i}`}
                                  x1={xVal}
                                  y1={0}
                                  x2={xVal}
                                  y2={paperH}
                                  stroke="#000000"
                                  strokeWidth="0.35"
                                  strokeDasharray="2.5 1.5"
                                />
                              ))}

                              {/* Horizontal full-page cutting lines */}
                              {hLinesMm.map((yVal, i) => (
                                <line
                                  key={`h-${i}`}
                                  x1={0}
                                  y1={yVal}
                                  x2={paperW}
                                  y2={yVal}
                                  stroke="#000000"
                                  strokeWidth="0.35"
                                  strokeDasharray="2.5 1.5"
                                />
                              ))}
                            </svg>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Bottom Quick Action: Push to Print Studio Queue */}
            {onSendToPrint && (
              <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Need multi-page duplex or custom document sizing?</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Push this passport photo into the multi-layout Print Studio queue</div>
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
      </div>
      )}
    </div>
  );
};
