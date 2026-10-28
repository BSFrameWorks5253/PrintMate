import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  RotateCw, 
  RotateCcw, 
  Sparkles, 
  Printer, 
  Download, 
  Check, 
  RefreshCw, 
  Sun, 
  Contrast, 
  Sliders,
  Palette,
  FileCheck, 
  Maximize2, 
  X, 
  Eye, 
  Plus, 
  Layers,
  FileText,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Save,
  Archive
} from 'lucide-react';
import JSZip from 'jszip';
import { useAuth } from '../../context/AuthContext';
import { userStorageService } from '../../services/userStorageService';
import type { 
  Point, 
  DocumentTypeId, 
  ImageAdjustments, 
  PrintQueueItem 
} from '../../types';
import { DOCUMENT_TYPES } from '../../utils/constants';
import { analytics } from '../../services/analyticsService';
import { createSampleIdCard, createSamplePaperDocument } from '../../utils/sampleImages';
import { 
  autoDetectDocumentCorners, 
  warpPerspectiveCrop, 
  applyAdjustments,
  rotateCanvas,
  rotatePoint,
  rotateCornersCyclic,
  snapCornersToClickPoint
} from '../../utils/imageProcessing';
import './Scanner.css';

export interface ScannedCardItem {
  id: string;
  name: string;
  rawFileName?: string;
  fileHandle?: any;
  cardSide: 'front' | 'back' | 'single';
  docType: DocumentTypeId;
  sourceImage: HTMLImageElement;
  corners: [Point, Point, Point, Point];
  adjustments: ImageAdjustments;
  aspectMode: 'standard' | 'portrait' | 'free';
  processedCanvas: HTMLCanvasElement | null;
  processedDataUrl?: string; // Cache base64 dataUrl so JSX render is instant
}

interface ScannerViewProps {
  onSendToPrint: (item: Omit<PrintQueueItem, 'id' | 'createdAt'>) => void;
  onSendMultipleToPrint?: (items: Omit<PrintQueueItem, 'id' | 'createdAt'>[]) => void;
  externalImage?: string | null;
  onClearExternalImage?: () => void;
  isVisible?: boolean;
}

const defaultAdjustments: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  exposure: 0,
  saturation: 0,
  sharpness: 20,
  rotation: 0,
  fineAngle: 0,
  filter: 'none',
};

export const ScannerView: React.FC<ScannerViewProps> = ({
  onSendToPrint,
  onSendMultipleToPrint,
  externalImage,
  onClearExternalImage,
  isVisible = true,
}) => {
  const { user } = useAuth();
  // Multi-image state
  const [cards, setCards] = useState<ScannedCardItem[]>([]);
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);

  // Interaction handles
  const [activeHandle, setActiveHandle] = useState<{ type: 'corner' | 'edge'; index: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Loupe magnifier state
  const [loupePos, setLoupePos] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });

  // Notifications & UI states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [autoDetectNotice, setAutoDetectNotice] = useState<string>('');
  const [fullPreviewOpen, setFullPreviewOpen] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);

  // Refs
  const editorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addMoreFileInputRef = useRef<HTMLInputElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // High-performance cache for perspective warp unwarping (drastically speeds up Tone Setter sliders)
  const unwarpedCacheRef = useRef<{
    cardId: string;
    sourceW: number;
    sourceH: number;
    cornersKey: string;
    aspectMode: string;
    docType: string;
    canvas: HTMLCanvasElement;
  } | null>(null);

  // Current active card
  const currentCard = cards[activeCardIndex] || null;

  // Helper to switch to another card cleanly
  const selectCard = (index: number) => {
    if (index < 0 || index >= cards.length) return;
    setActiveHandle(null);
    setIsDragging(false);
    setLoupePos((prev) => ({ ...prev, visible: false }));
    setActiveCardIndex(index);
    const target = cards[index];
    const sideName = target.cardSide === 'front' ? 'Front Side' : target.cardSide === 'back' ? 'Back Side' : `Image ${index + 1}`;
    setAutoDetectNotice(`Editing ${sideName} (${target.name})`);
    setTimeout(() => setAutoDetectNotice(''), 2000);
  };

  // Helper to update active card fields
  const updateCurrentCard = useCallback((updater: (prev: ScannedCardItem) => ScannedCardItem) => {
    setCards((prev) => {
      if (!prev[activeCardIndex]) return prev;
      const updated = [...prev];
      updated[activeCardIndex] = updater(updated[activeCardIndex]);
      return updated;
    });
  }, [activeCardIndex]);

  // Reset entire scan session back to clean initial state
  const handleResetSession = () => {
    setCards([]);
    setActiveCardIndex(0);
    unwarpedCacheRef.current = null;
    setShowResetModal(false);
    setAutoDetectNotice('Session cleared. Ready for new scan.');
    setTimeout(() => setAutoDetectNotice(''), 2500);
  };

  // 1-Click reset for all Tone Setter adjustments on current card
  const handleResetTone = () => {
    if (!currentCard) return;
    updateCurrentCard((c) => ({
      ...c,
      adjustments: {
        ...c.adjustments,
        brightness: 0,
        contrast: 0,
        exposure: 0,
        saturation: 0,
        filter: 'none',
      },
    }));
    setAutoDetectNotice('Tone & lighting reset to defaults');
    setTimeout(() => setAutoDetectNotice(''), 2000);
  };

  // Helper: process image URL into a ScannedCardItem
  const createCardFromImage = (
    img: HTMLImageElement, 
    name: string, 
    side: 'front' | 'back' | 'single' = 'front',
    docType: DocumentTypeId = 'id_standard',
    rawFileName?: string,
    fileHandle?: any
  ): ScannedCardItem => {
    const detected = autoDetectDocumentCorners(img, 'auto');
    const docDef = DOCUMENT_TYPES.find((d) => d.id === docType);
    const targetRatio = docDef?.aspectRatio || 85.6 / 53.98;

    let processed: HTMLCanvasElement | null = null;
    let dataUrl: string | undefined = undefined;
    try {
      const unwarped = warpPerspectiveCrop(img, detected, targetRatio, 2000, 'standard');
      processed = applyAdjustments(unwarped, defaultAdjustments);
      dataUrl = processed.toDataURL('image/jpeg', 0.94);
    } catch (e) {
      console.warn('Initial warp error:', e);
    }

    return {
      id: `card-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.replace(/\.[^/.]+$/, ''),
      rawFileName: rawFileName || name,
      fileHandle,
      cardSide: side,
      docType,
      sourceImage: img,
      corners: detected,
      adjustments: { ...defaultAdjustments },
      aspectMode: 'standard',
      processedCanvas: processed,
      processedDataUrl: dataUrl,
    };
  };

  // Load external image (e.g. from header sample)
  useEffect(() => {
    if (externalImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setCards((prev) => {
          const side: 'front' | 'back' | 'single' = prev.length === 0 ? 'front' : (prev.length === 1 ? 'back' : 'single');
          const newCard = createCardFromImage(img, 'Sample_Document.jpg', side);
          setActiveCardIndex(prev.length);
          return [...prev, newCard];
        });
        setAutoDetectNotice('Document auto-detected & ready');
        setTimeout(() => setAutoDetectNotice(''), 2500);
      };
      img.src = externalImage;
      if (onClearExternalImage) onClearExternalImage();
    }
  }, [externalImage, onClearExternalImage]);

  // Handle Clipboard Paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            if (blob) {
              const reader = new FileReader();
              reader.onload = (event) => {
                if (event.target?.result) {
                  const img = new Image();
                  img.onload = () => {
                    const side = cards.length === 0 ? 'front' : (cards.length === 1 ? 'back' : 'single');
                    const newCard = createCardFromImage(img, `Pasted_Image_${cards.length + 1}.png`, side);
                    setCards((prev) => [...prev, newCard]);
                    setActiveCardIndex(cards.length);
                    setAutoDetectNotice('Pasted image imported & borders detected');
                    setTimeout(() => setAutoDetectNotice(''), 2500);
                  };
                  img.src = event.target.result as string;
                }
              };
              reader.readAsDataURL(blob);
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [cards.length]);

  // Batch process uploaded files
  const processFiles = (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (filesArray.length === 0) return;

    let processedCount = 0;
    const newCards: ScannedCardItem[] = [];

    filesArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const img = new Image();
          img.onload = () => {
            const totalExisting = cards.length + newCards.length;
            const side: 'front' | 'back' | 'single' = 
              totalExisting === 0 ? 'front' : (totalExisting === 1 ? 'back' : 'single');
            const card = createCardFromImage(img, file.name, side, 'id_standard', file.name, (file as any).handle);
            newCards.push(card);
            processedCount++;

            if (processedCount === filesArray.length) {
              setCards((prev) => [...prev, ...newCards]);
              selectCard(cards.length);
              setAutoDetectNotice(
                filesArray.length > 1 
                  ? `${filesArray.length} images added (Front & Back)` 
                  : 'Image added & borders detected'
              );
              setTimeout(() => setAutoDetectNotice(''), 3000);
            }
          };
          img.src = event.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Open files with direct File System Access API if supported, or trigger file input
  const openWithFilePicker = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const handles = await (window as any).showOpenFilePicker({
          multiple: true,
          types: [{
            description: 'Images',
            accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }
          }]
        });
        if (!handles || handles.length === 0) return;
        const newCards: ScannedCardItem[] = [];
        for (let i = 0; i < handles.length; i++) {
          const handle = handles[i];
          const file = await handle.getFile();
          const dataUrl = await new Promise<string>((res) => {
            const reader = new FileReader();
            reader.onload = (e) => res(e.target?.result as string);
            reader.readAsDataURL(file);
          });
          const img = await new Promise<HTMLImageElement>((res) => {
            const image = new Image();
            image.onload = () => res(image);
            image.src = dataUrl;
          });
          const totalExisting = cards.length + newCards.length;
          const side: 'front' | 'back' | 'single' = 
            totalExisting === 0 ? 'front' : (totalExisting === 1 ? 'back' : 'single');
          const card = createCardFromImage(img, file.name, side, 'id_standard', file.name, handle);
          newCards.push(card);
        }
        if (newCards.length > 0) {
          setCards((prev) => [...prev, ...newCards]);
          selectCard(cards.length);
          setAutoDetectNotice(`${newCards.length} image(s) loaded with direct overwrite access`);
          setTimeout(() => setAutoDetectNotice(''), 3000);
        }
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('showOpenFilePicker error, falling back:', err);
      }
    }
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Remove a card from session
  const handleRemoveCard = (index: number) => {
    setCards((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (activeCardIndex >= next.length) {
        setActiveCardIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  // Re-run auto detect on current card
  const runAutoDetect = (mode: 'auto' | 'inner_card' | 'outer_border') => {
    if (!currentCard) return;
    const detected = autoDetectDocumentCorners(currentCard.sourceImage, mode);
    updateCurrentCard((c) => ({ ...c, corners: detected }));
    const label =
      mode === 'inner_card'
        ? 'Snapped tightly to card edge'
        : mode === 'outer_border'
        ? 'Expanded to clear lamination border'
        : 'Card borders auto-detected & straightened';
    setAutoDetectNotice(label);
    setTimeout(() => setAutoDetectNotice(''), 2500);
  };

  // Rotate original source image 90° CW / CCW while accurately transforming corners
  const rotateSourceImage = (deg: number) => {
    if (!currentCard) return;
    const origW = currentCard.sourceImage.naturalWidth;
    const origH = currentCard.sourceImage.naturalHeight;
    const rotated = rotateCanvas(currentCard.sourceImage, deg);

    // Accurately transform existing corner coordinates onto rotated canvas
    const transformedCorners = currentCard.corners.map((p) =>
      rotatePoint(p, origW, origH, deg)
    ) as [Point, Point, Point, Point];
    const newCorners = rotateCornersCyclic(transformedCorners, deg > 0 ? 'cw' : 'ccw');

    const newImg = new Image();
    newImg.onload = () => {
      updateCurrentCard((c) => ({
        ...c,
        sourceImage: newImg,
        corners: newCorners,
      }));
      setAutoDetectNotice(`Source rotated ${deg > 0 ? '90° CW' : '90° CCW'}`);
      setTimeout(() => setAutoDetectNotice(''), 2500);
    };
    newImg.src = rotated.toDataURL('image/jpeg', 0.98);
  };

  // Cyclically rotate corner pins 90° or 180°
  const handleRotatePins = (direction: 'cw' | 'ccw' | '180') => {
    if (!currentCard) return;
    const newCorners = rotateCornersCyclic(currentCard.corners, direction);
    updateCurrentCard((c) => ({
      ...c,
      corners: newCorners,
    }));
    setAutoDetectNotice(direction === '180' ? 'Pins flipped 180°' : `Pins shifted 90° ${direction.toUpperCase()}`);
    setTimeout(() => setAutoDetectNotice(''), 2000);
  };

  // Rotate the deskewed card output 90° CW / CCW or 180°
  const handleRotateOutput = (deg: number) => {
    if (!currentCard) return;
    const nextRot = (((currentCard.adjustments.rotation || 0) + deg) % 360 + 360) % 360;
    updateCurrentCard((c) => ({
      ...c,
      adjustments: {
        ...c.adjustments,
        rotation: nextRot,
      },
    }));
    setAutoDetectNotice(deg === 180 ? `Card flipped 180° (${nextRot}°)` : `Card rotated ${deg > 0 ? '+90°' : '-90°'} (${nextRot}°)`);
    setTimeout(() => setAutoDetectNotice(''), 2000);
  };

  // Toggle card between Horizontal (Standard Card) and Vertical (Portrait)
  const handleToggleOrientation = () => {
    if (!currentCard) return;
    const nextMode = currentCard.aspectMode === 'portrait' ? 'standard' : 'portrait';
    updateCurrentCard((c) => ({
      ...c,
      aspectMode: nextMode,
    }));
    setAutoDetectNotice(`Orientation set to ${nextMode === 'standard' ? 'Landscape (Horizontal)' : 'Portrait (Vertical)'}`);
    setTimeout(() => setAutoDetectNotice(''), 2500);
  };

  // Reset corners to standard margins
  const handleResetCorners = () => {
    if (!currentCard) return;
    const w = currentCard.sourceImage.naturalWidth;
    const h = currentCard.sourceImage.naturalHeight;
    const insetX = Math.round(w * 0.06);
    const insetY = Math.round(h * 0.06);
    updateCurrentCard((c) => ({
      ...c,
      corners: [
        { x: insetX, y: insetY },
        { x: w - insetX, y: insetY },
        { x: w - insetX, y: h - insetY },
        { x: insetX, y: h - insetY },
      ],
    }));
  };

  // Render original image + quad on editor canvas
  useEffect(() => {
    const canvas = editorCanvasRef.current;
    if (!canvas || !currentCard) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sourceImage = currentCard.sourceImage;
    const corners = currentCard.corners;
    const imgW = sourceImage.naturalWidth;
    const imgH = sourceImage.naturalHeight;

    const displayScale = Math.min(1, 1000 / Math.max(imgW, imgH));
    const dispW = Math.round(imgW * displayScale);
    const dispH = Math.round(imgH * displayScale);

    if (canvas.width !== dispW || canvas.height !== dispH) {
      canvas.width = dispW;
      canvas.height = dispH;
    }

    // Draw base image
    ctx.drawImage(sourceImage, 0, 0, dispW, dispH);

    // Dim ONLY the region OUTSIDE the quad (leaving the inside image 100% visible and crystal-clear)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.60)';
    ctx.beginPath();
    // Outer rect covers entire canvas
    ctx.rect(0, 0, dispW, dispH);
    // Inner quad path
    ctx.moveTo(corners[0].x * displayScale, corners[0].y * displayScale);
    ctx.lineTo(corners[1].x * displayScale, corners[1].y * displayScale);
    ctx.lineTo(corners[2].x * displayScale, corners[2].y * displayScale);
    ctx.lineTo(corners[3].x * displayScale, corners[3].y * displayScale);
    ctx.closePath();
    // 'evenodd' rule: fills outside the quad and leaves inside completely untouched
    ctx.fill('evenodd');
    ctx.restore();

    // Quad borders
    ctx.save();
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0, 242, 254, 0.7)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(corners[0].x * displayScale, corners[0].y * displayScale);
    ctx.lineTo(corners[1].x * displayScale, corners[1].y * displayScale);
    ctx.lineTo(corners[2].x * displayScale, corners[2].y * displayScale);
    ctx.lineTo(corners[3].x * displayScale, corners[3].y * displayScale);
    ctx.closePath();
    ctx.stroke();

    // 4 Edge Midpoint Handles
    const edgeMidpoints = [
      { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 },
      { x: (corners[1].x + corners[2].x) / 2, y: (corners[1].y + corners[2].y) / 2 },
      { x: (corners[2].x + corners[3].x) / 2, y: (corners[2].y + corners[3].y) / 2 },
      { x: (corners[3].x + corners[0].x) / 2, y: (corners[3].y + corners[0].y) / 2 },
    ];

    edgeMidpoints.forEach((mid, idx) => {
      const isSelected = activeHandle?.type === 'edge' && activeHandle.index === idx;
      const mx = mid.x * displayScale;
      const my = mid.y * displayScale;
      ctx.beginPath();
      ctx.arc(mx, my, 6, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#38bdf8' : '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#0284c7';
      ctx.stroke();
    });

    // 4 Corner Handles (TL, TR, BR, BL)
    const handleRadius = 14;
    const cornerLabels = ['TL', 'TR', 'BR', 'BL'];

    corners.forEach((pt, idx) => {
      const isSelected = activeHandle?.type === 'corner' && activeHandle.index === idx;
      const px = pt.x * displayScale;
      const py = pt.y * displayScale;

      ctx.beginPath();
      ctx.arc(px, py, handleRadius * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.6)' : 'rgba(56, 189, 248, 0.25)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, handleRadius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#38bdf8' : '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#0284c7';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(px, py, handleRadius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();

      // Text label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      const offsetX = idx === 0 || idx === 3 ? -handleRadius * 1.7 : handleRadius * 1.2;
      const offsetY = idx === 0 || idx === 1 ? -handleRadius * 0.9 : handleRadius * 1.4;
      ctx.fillText(cornerLabels[idx], px + offsetX, py + offsetY);
      ctx.shadowBlur = 0;
    });

    ctx.restore();
  }, [currentCard, activeHandle, isVisible]);

  // Loupe magnifier
  useEffect(() => {
    if (!loupePos.visible || !activeHandle || activeHandle.type !== 'corner' || !currentCard) return;

    const loupe = loupeCanvasRef.current;
    if (!loupe) return;
    const ctx = loupe.getContext('2d');
    if (!ctx) return;

    const pt = currentCard.corners[activeHandle.index];
    const zoom = 3.2;
    const size = 140;
    loupe.width = size;
    loupe.height = size;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.drawImage(
      currentCard.sourceImage,
      pt.x - (size / (2 * zoom)),
      pt.y - (size / (2 * zoom)),
      size / zoom,
      size / zoom,
      0,
      0,
      size,
      size
    );

    // Crosshair target
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }, [currentCard, activeHandle, loupePos]);

  const currentCorners = currentCard?.corners;
  const currentDocType = currentCard?.docType;
  const currentAdjustments = currentCard?.adjustments;
  const currentAspectMode = currentCard?.aspectMode;
  const currentSourceImage = currentCard?.sourceImage;

  // Perspective Warp & Adjustments (Optimized with unwarped canvas caching)
  useEffect(() => {
    if (!currentSourceImage || !currentCorners || isDragging) return;

    const timer = setTimeout(() => {
      setIsProcessing(true);
      try {
        const docDef = DOCUMENT_TYPES.find((d) => d.id === currentDocType);
        let targetRatio = docDef?.aspectRatio || 85.6 / 53.98;

        if (currentAspectMode === 'free') {
          targetRatio = 0;
        } else if (currentAspectMode === 'portrait' && targetRatio > 0) {
          targetRatio = 1 / Math.max(targetRatio, 1 / targetRatio);
        } else if (currentAspectMode === 'standard' && targetRatio > 0) {
          targetRatio = Math.max(targetRatio, 1 / targetRatio);
        }

        const cornersKey = `${currentCorners.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join('_')}`;
        let unwarped: HTMLCanvasElement;

        if (
          unwarpedCacheRef.current &&
          unwarpedCacheRef.current.cardId === currentCard?.id &&
          unwarpedCacheRef.current.cornersKey === cornersKey &&
          unwarpedCacheRef.current.aspectMode === (currentAspectMode || 'standard') &&
          unwarpedCacheRef.current.docType === (currentDocType || 'id_standard') &&
          unwarpedCacheRef.current.sourceW === currentSourceImage.naturalWidth &&
          unwarpedCacheRef.current.sourceH === currentSourceImage.naturalHeight
        ) {
          // Fast path: Reuse unwarped canvas when adjusting brightness/contrast/tone
          unwarped = unwarpedCacheRef.current.canvas;
        } else {
          // Perspective crop changed
          unwarped = warpPerspectiveCrop(
            currentSourceImage, 
            currentCorners, 
            targetRatio,
            2000,
            currentAspectMode
          );
          unwarpedCacheRef.current = {
            cardId: currentCard?.id || '',
            cornersKey,
            aspectMode: currentAspectMode || 'standard',
            docType: currentDocType || 'id_standard',
            sourceW: currentSourceImage.naturalWidth,
            sourceH: currentSourceImage.naturalHeight,
            canvas: unwarped,
          };
        }

        const adjusted = applyAdjustments(unwarped, currentAdjustments);
        const dataUrl = adjusted.toDataURL('image/jpeg', 0.94);

        updateCurrentCard((c) => ({
          ...c,
          processedCanvas: adjusted,
          processedDataUrl: dataUrl,
        }));
      } catch (err) {
        console.error('Processing error:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 25);

    return () => clearTimeout(timer);
  }, [
    currentCorners, 
    currentDocType, 
    currentAdjustments, 
    currentAspectMode, 
    currentSourceImage,
    updateCurrentCard,
    isDragging,
  ]);

  // Pointer interactions
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = editorCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!currentCard) return;
    const pt = getCanvasCoords(e);
    const corners = currentCard.corners;
    const imgW = currentCard.sourceImage.naturalWidth;
    const imgH = currentCard.sourceImage.naturalHeight;
    const displayScale = Math.min(1, 1000 / Math.max(imgW, imgH));

    const hitRadius = 24;

    // Check corners
    for (let i = 0; i < 4; i++) {
      const c = corners[i];
      const dist = Math.hypot(pt.x - c.x * displayScale, pt.y - c.y * displayScale);
      if (dist <= hitRadius) {
        setActiveHandle({ type: 'corner', index: i });
        setIsDragging(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setLoupePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          visible: true,
        });
        return;
      }
    }

    // Check edges
    for (let i = 0; i < 4; i++) {
      const c1 = corners[i];
      const c2 = corners[(i + 1) % 4];
      const midX = ((c1.x + c2.x) / 2) * displayScale;
      const midY = ((c1.y + c2.y) / 2) * displayScale;
      const dist = Math.hypot(pt.x - midX, pt.y - midY);
      if (dist <= hitRadius * 0.9) {
        setActiveHandle({ type: 'edge', index: i });
        setIsDragging(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
    }

    // Tap to snap
    const snapped = snapCornersToClickPoint(currentCard.sourceImage, pt.x / displayScale, pt.y / displayScale);
    if (snapped) {
      updateCurrentCard((c) => ({ ...c, corners: snapped }));
      setAutoDetectNotice('Snapped pins to tapped card');
      setTimeout(() => setAutoDetectNotice(''), 2000);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || !activeHandle || !currentCard) return;

    const pt = getCanvasCoords(e);
    const imgW = currentCard.sourceImage.naturalWidth;
    const imgH = currentCard.sourceImage.naturalHeight;
    const displayScale = Math.min(1, 1000 / Math.max(imgW, imgH));

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    animFrameRef.current = requestAnimationFrame(() => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setLoupePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        visible: activeHandle.type === 'corner',
      });

      const invScale = 1 / displayScale;
      const clampedX = Math.round(Math.max(0, Math.min(imgW, pt.x * invScale)));
      const clampedY = Math.round(Math.max(0, Math.min(imgH, pt.y * invScale)));

      const newCorners = [...currentCard.corners] as [Point, Point, Point, Point];

      if (activeHandle.type === 'corner') {
        newCorners[activeHandle.index] = { x: clampedX, y: clampedY };
      } else {
        const edgeIdx = activeHandle.index;
        const c1Idx = edgeIdx;
        const c2Idx = (edgeIdx + 1) % 4;
        const midX = (newCorners[c1Idx].x + newCorners[c2Idx].x) / 2;
        const midY = (newCorners[c1Idx].y + newCorners[c2Idx].y) / 2;
        const deltaX = clampedX - midX;
        const deltaY = clampedY - midY;

        newCorners[c1Idx] = {
          x: Math.round(Math.max(0, Math.min(imgW, newCorners[c1Idx].x + deltaX))),
          y: Math.round(Math.max(0, Math.min(imgH, newCorners[c1Idx].y + deltaY))),
        };
        newCorners[c2Idx] = {
          x: Math.round(Math.max(0, Math.min(imgW, newCorners[c2Idx].x + deltaX))),
          y: Math.round(Math.max(0, Math.min(imgH, newCorners[c2Idx].y + deltaY))),
        };
      }

      updateCurrentCard((c) => ({ ...c, corners: newCorners }));
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (isDragging) {
      setIsDragging(false);
      setActiveHandle(null);
      setLoupePos((prev) => ({ ...prev, visible: false }));
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Push Active Card to Print Studio
  const handlePushCurrentToPrint = (autoPrint: boolean = false) => {
    if (!currentCard) return;
    let canvas = currentCard.processedCanvas;
    if (!canvas) {
      const docDef = DOCUMENT_TYPES.find((d) => d.id === currentCard.docType);
      const targetRatio = docDef?.aspectRatio || 85.6 / 53.98;
      const unwarped = warpPerspectiveCrop(currentCard.sourceImage, currentCard.corners, targetRatio, 2000, currentCard.aspectMode);
      canvas = applyAdjustments(unwarped, currentCard.adjustments);
    }
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    // Save to user's isolated recent documents
    userStorageService.addRecent(user?.id, {
      name: `${currentCard.name} (${currentCard.cardSide.toUpperCase()})`,
      dataUrl,
      docType: currentCard.docType,
      source: 'scanner',
      aspectRatio: canvas.width / canvas.height,
    });

    onSendToPrint({
      dataUrl,
      name: `${currentCard.name} (${currentCard.cardSide.toUpperCase()})`,
      docType: currentCard.docType,
      cardSide: currentCard.cardSide,
      aspectRatio: canvas.width / canvas.height,
    });

    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2200);

    if (autoPrint) {
      setTimeout(() => {
        window.print();
      }, 450);
    }
  };

  // Push ALL Cards to Print Studio (e.g. Front & Back)
  const handlePushAllToPrint = () => {
    if (cards.length === 0) return;

    const itemsToSend: Omit<PrintQueueItem, 'id' | 'createdAt'>[] = [];

    cards.forEach((card) => {
      let canvas = card.processedCanvas;
      if (!canvas) {
        const docDef = DOCUMENT_TYPES.find((d) => d.id === card.docType);
        const targetRatio = docDef?.aspectRatio || 85.6 / 53.98;
        const unwarped = warpPerspectiveCrop(card.sourceImage, card.corners, targetRatio, 2000, card.aspectMode);
        canvas = applyAdjustments(unwarped, card.adjustments);
      }

      if (canvas) {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        itemsToSend.push({
          dataUrl,
          name: `${card.name} (${card.cardSide.toUpperCase()})`,
          docType: card.docType,
          cardSide: card.cardSide,
          aspectRatio: canvas.width / canvas.height,
        });

        // Save to user's isolated recent documents
        userStorageService.addRecent(user?.id, {
          name: `${card.name} (${card.cardSide.toUpperCase()})`,
          dataUrl,
          docType: card.docType,
          source: 'scanner',
          aspectRatio: canvas.width / canvas.height,
        });
      }
    });

    if (onSendMultipleToPrint && itemsToSend.length > 0) {
      onSendMultipleToPrint(itemsToSend);
    } else {
      itemsToSend.forEach((item) => onSendToPrint(item));
    }

    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2200);
  };

  // Save & Overwrite raw file on PC (Downloads section) using File System Access API or exact filename
  const handleSaveOverwrite = async (cardToSave: ScannedCardItem | null = currentCard) => {
    if (!cardToSave) return;
    let canvas = cardToSave.processedCanvas;
    if (!canvas) {
      const docDef = DOCUMENT_TYPES.find((d) => d.id === cardToSave.docType);
      const targetRatio = docDef?.aspectRatio || 85.6 / 53.98;
      const unwarped = warpPerspectiveCrop(cardToSave.sourceImage, cardToSave.corners, targetRatio, 2000, cardToSave.aspectMode);
      canvas = applyAdjustments(unwarped, cardToSave.adjustments);
    }
    if (!canvas) return;

    const rawName = cardToSave.rawFileName || `${cardToSave.name}.jpg`;

    // 1. Direct in-place overwrite if fileHandle exists
    if (cardToSave.fileHandle && 'createWritable' in cardToSave.fileHandle) {
      try {
        const blob: Blob = await new Promise((res) => canvas!.toBlob((b) => res(b!), 'image/jpeg', 0.96));
        const writable = await cardToSave.fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        setAutoDetectNotice(`✓ Successfully overwritten "${rawName}" directly on PC!`);
        setTimeout(() => setAutoDetectNotice(''), 3500);
        return;
      } catch (err: any) {
        console.warn('File handle write error, falling back:', err);
      }
    }

    // 2. Open native Save dialog pre-populated with rawFileName to overwrite in Downloads folder
    if ('showSaveFilePicker' in window) {
      try {
        const blob: Blob = await new Promise((res) => canvas!.toBlob((b) => res(b!), 'image/jpeg', 0.96));
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: rawName,
          types: [{
            description: 'JPEG Image',
            accept: { 'image/jpeg': ['.jpg', '.jpeg'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        updateCurrentCard((c) => ({ ...c, fileHandle: handle, rawFileName: handle.name }));
        setAutoDetectNotice(`✓ Saved & overwritten "${handle.name}"!`);
        setTimeout(() => setAutoDetectNotice(''), 3500);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('showSaveFilePicker cancelled or error:', err);
      }
    }

    // 3. Fallback: standard download matching raw file name so browser replaces file in Downloads folder
    const link = document.createElement('a');
    link.download = rawName;
    link.href = canvas.toDataURL('image/jpeg', 0.96);
    link.click();
    setAutoDetectNotice(`✓ Saved as "${rawName}" in Downloads folder`);
    setTimeout(() => setAutoDetectNotice(''), 3500);
  };

  // Direct download of single card
  const handleDownload = () => {
    let canvas = currentCard?.processedCanvas;
    if (!canvas && currentCard) {
      const docDef = DOCUMENT_TYPES.find((d) => d.id === currentCard.docType);
      const targetRatio = docDef?.aspectRatio || 85.6 / 53.98;
      const unwarped = warpPerspectiveCrop(currentCard.sourceImage, currentCard.corners, targetRatio, 2000, currentCard.aspectMode);
      canvas = applyAdjustments(unwarped, currentCard.adjustments);
    }
    if (!canvas || !currentCard) return;

    const link = document.createElement('a');
    link.download = `${currentCard.name}_${currentCard.cardSide}_straightened.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.96);
    link.click();
    try {
      analytics.trackDownload({
        type: 'Straightened Document JPG',
        fileName: currentCard.name,
        page: 'scanner',
      });
    } catch (e) {
      console.warn('Analytics tracking failed', e);
    }
  };

  // Download All Cards as a unified ZIP file
  const handleDownloadZip = async () => {
    if (cards.length === 0) return;
    setIsZipping(true);
    setAutoDetectNotice(`Packaging all ${cards.length} images into a ZIP file...`);

    try {
      const zip = new JSZip();

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        let canvas = card.processedCanvas;
        if (!canvas) {
          const docDef = DOCUMENT_TYPES.find((d) => d.id === card.docType);
          const targetRatio = docDef?.aspectRatio || 85.6 / 53.98;
          const unwarped = warpPerspectiveCrop(card.sourceImage, card.corners, targetRatio, 2000, card.aspectMode);
          canvas = applyAdjustments(unwarped, card.adjustments);
        }
        if (!canvas) continue;

        const blob: Blob = await new Promise((res) => canvas!.toBlob((b) => res(b!), 'image/jpeg', 0.96));

        // Format clean filename for inside zip
        let cleanName = card.rawFileName 
          ? card.rawFileName.replace(/\.[^/.]+$/, '') 
          : `${card.name}_${card.cardSide}`;
        if (!cleanName.toLowerCase().endsWith('_straightened') && !cleanName.toLowerCase().endsWith('_clean')) {
          cleanName += `_${card.cardSide}`;
        }
        const fileNameInZip = `${cleanName}.jpg`;

        zip.file(fileNameInZip, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      const baseName = cards[0]?.rawFileName 
        ? cards[0].rawFileName.replace(/\.[^/.]+$/, '') 
        : (cards[0]?.name || 'PrintMate_Documents');
      const zipName = `${baseName}_all_${cards.length}_images.zip`;
      link.download = zipName;
      link.click();
      URL.revokeObjectURL(url);

      setAutoDetectNotice(`✓ Successfully downloaded ${zipName}!`);
      setTimeout(() => setAutoDetectNotice(''), 3500);

      try {
        analytics.trackDownload({
          type: 'Straightened Document ZIP Archive',
          fileName: zipName,
          page: 'scanner',
        });
      } catch (e) {
        console.warn('Analytics tracking failed', e);
      }
    } catch (err) {
      console.error('Error generating zip:', err);
      setAutoDetectNotice('Failed to create ZIP, falling back to batch download...');
      await handleDownloadAllSequential();
    } finally {
      setIsZipping(false);
    }
  };

  // Sequential individual downloads (fallback if needed)
  const handleDownloadAllSequential = async (preferRawName: boolean = false) => {
    if (cards.length === 0) return;
    setAutoDetectNotice(`Downloading all ${cards.length} processed images...`);

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      let canvas = card.processedCanvas;
      if (!canvas) {
        const docDef = DOCUMENT_TYPES.find((d) => d.id === card.docType);
        const targetRatio = docDef?.aspectRatio || 85.6 / 53.98;
        const unwarped = warpPerspectiveCrop(card.sourceImage, card.corners, targetRatio, 2000, card.aspectMode);
        canvas = applyAdjustments(unwarped, card.adjustments);
      }
      if (!canvas) continue;

      const filename = preferRawName && card.rawFileName 
        ? card.rawFileName 
        : `${card.name}_${card.cardSide}_straightened.jpg`;

      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/jpeg', 0.96);
      link.click();

      if (i < cards.length - 1) {
        await new Promise((res) => setTimeout(res, 350));
      }
    }

    setAutoDetectNotice(`✓ Successfully downloaded all ${cards.length} images!`);
    setTimeout(() => setAutoDetectNotice(''), 3000);
  };

  const loadSampleDirectly = (type: 'id_front' | 'id_back' | 'paper') => {
    const dataUrl = type === 'id_front' 
      ? createSampleIdCard('front') 
      : type === 'id_back' 
      ? createSampleIdCard('back') 
      : createSamplePaperDocument();
    const img = new Image();
    img.onload = () => {
      const side = type === 'id_front' ? 'front' : (type === 'id_back' ? 'back' : 'single');
      const name = type === 'id_front' ? 'Sample_ID_Front.jpg' : (type === 'id_back' ? 'Sample_ID_Back.jpg' : 'Certificate_Paper.jpg');
      const docType: DocumentTypeId = type === 'paper' ? 'paper_a4' : 'id_standard';
      const card = createCardFromImage(img, name, side, docType);
      setCards([card]);
      setActiveCardIndex(0);
      setAutoDetectNotice('Sample document loaded & borders detected');
      setTimeout(() => setAutoDetectNotice(''), 2500);
    };
    img.src = dataUrl;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Hidden file inputs for main and add-more */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        multiple
        className="hidden"
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={addMoreFileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        multiple
        className="hidden"
        style={{ display: 'none' }}
      />

      {/* SCANNER VIEW TITLE & REFRESH ACTION BAR (ALWAYS PROMINENTLY VISIBLE) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Document Scanner & Straightener
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              AI AUTO-DESKEW
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {cards.length > 0 
              ? `Session active: ${cards.length} image${cards.length > 1 ? 's' : ''} loaded. Edits persist across tab switches until you click Refresh.`
              : 'Auto-detect 4 corners, straighten slanted perspective, and balance lighting for crisp printing.'}
          </p>
        </div>

        {/* ALWAYS-VISIBLE PROMINENT REFRESH BUTTON */}
        <div className="flex items-center gap-2">
          {cards.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold transition-all shadow-xs cursor-pointer group"
              title="Clear current scan session and start fresh"
            >
              <RefreshCw className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover:rotate-180 transition-transform duration-300" />
              <span>Refresh / New Scan</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadSampleDirectly('id_front')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Try Demo ID Card</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* If no images uploaded yet */}
      {cards.length === 0 ? (
        <div className="max-w-4xl mx-auto my-6">
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-blue-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-12 text-center transition-all shadow-xl hover:shadow-2xl relative overflow-hidden"
          >
            {/* Subtle radial glow */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div 
                onClick={openWithFilePicker}
                className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/30 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
              >
                <Upload className="w-10 h-10" />
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                Upload ID Card or Document Images
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto mb-6 leading-relaxed">
                Take a photo from your phone at any angle. PrintMate automatically detects the 4 corners, deskews slanted perspective, and adjusts scale for flawless printing.
              </p>

              {/* Browse CTA Button */}
              <button
                type="button"
                onClick={openWithFilePicker}
                style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-white text-sm font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-500 transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-5 h-5" />
                <span>Browse Images from Computer</span>
              </button>

              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">
                or drag & drop files here • paste with <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono text-slate-600 dark:text-slate-300">Ctrl+V</kbd>
              </p>

              {/* 1-Click Studio Samples Direct Launch */}
              <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
                  Or test immediately with 1-click studio samples
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); loadSampleDirectly('id_front'); }}
                    className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-600 text-left transition-all group cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 group-hover:scale-110 transition-transform">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300">Slanted ID Front</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Angled on wooden desk</div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); loadSampleDirectly('id_back'); }}
                    className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-600 text-left transition-all group cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 group-hover:scale-110 transition-transform">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300">ID Back Side</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Barcode & details</div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); loadSampleDirectly('paper'); }}
                    className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-amber-50/60 dark:hover:bg-amber-950/40 hover:border-amber-300 dark:hover:border-amber-600 text-left transition-all group cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 group-hover:scale-110 transition-transform">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300">Paper Document</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">A4 Certificate sheet</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Feature Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-6 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium">
                  ✓ Auto-Crop & Perspective Deskew
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium">
                  ✓ Front & Back 2-Card Batching
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium">
                  ✓ Direct In-Place Raw Image Overwrite
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* UNIFIED CLEAN TOP NAVIGATION BAR */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            {/* Left: Multi-card Selector Pills & Add More */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mr-1 shrink-0">
                <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Images ({cards.length}):</span>
              </span>

              {cards.map((card, idx) => {
                const isActive = idx === activeCardIndex;
                return (
                  <div
                    key={card.id}
                    onClick={() => selectCard(idx)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition-all shrink-0 ${
                      isActive
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-300 dark:ring-blue-500/40'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive ? 'bg-white text-blue-600' : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="font-bold">
                      {card.cardSide === 'front' 
                        ? '🪪 Front' 
                        : card.cardSide === 'back' 
                        ? '🪪 Back' 
                        : `Side ${idx + 1}`}
                    </span>
                    {cards.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCard(idx);
                        }}
                        className={`p-0.5 rounded transition-all ${
                          isActive ? 'hover:bg-blue-700 text-blue-200 hover:text-white' : 'hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'
                        }`}
                        title="Remove image"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Add 1 More Image Button */}
              <button
                type="button"
                onClick={() => addMoreFileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all text-xs font-semibold shrink-0 cursor-pointer shadow-2xs"
                title="Add second image (e.g. Back side of ID card)"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add {cards.length === 1 ? 'Back Side' : 'Image'}</span>
              </button>
            </div>

            {/* Center/Right: Document Standard & Session Controls */}
            <div className="flex items-center gap-2 flex-wrap ml-auto">
              {/* Document Standard Type Pills */}
              {currentCard && (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  {DOCUMENT_TYPES.slice(0, 3).map((dt) => (
                    <button
                      key={dt.id}
                      onClick={() => updateCurrentCard((c) => ({ ...c, docType: dt.id }))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        currentCard.docType === dt.id
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                      title={dt.description}
                    >
                      {dt.name.replace('Standard ', '')}
                    </button>
                  ))}
                </div>
              )}

              {/* Multi-image Send Both Button */}
              {cards.length > 1 && (
                <button
                  type="button"
                  onClick={handlePushAllToPrint}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-sm shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Send Both ({cards.length}) to Print</span>
                </button>
              )}

              {/* Session Refresh / Start New Scan Button */}
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-300 dark:hover:border-rose-800 text-slate-700 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer group"
                title="Clear session and start fresh with new image"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 group-hover:rotate-180 transition-transform" />
                <span>Refresh / New Scan</span>
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {autoDetectNotice && (
            <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg animate-fade-in">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{autoDetectNotice}</span>
            </div>
          )}

          {/* MAIN 2-COLUMN WORKSPACE: LEFT = CROP & PINS, RIGHT = STRAIGHTENED & TONE SETTER */}
          {currentCard && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT COLUMN: CROP & CORNER PIN DETECTOR */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col space-y-3 shadow-xs">
                {/* Header Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Crop & Corner Pins ({currentCard.cardSide.toUpperCase()})
                    </h4>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Primary 1-Click Auto-Detect */}
                    <button
                      type="button"
                      onClick={() => runAutoDetect('auto')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-xs cursor-pointer active:scale-95"
                      title="Run automatic 4-corner document detection"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Auto-Detect</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => runAutoDetect('inner_card')}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
                      title="Trim transparent lamination plastic and snap to card interior"
                    >
                      Snap Tight
                    </button>

                    <button
                      type="button"
                      onClick={() => runAutoDetect('outer_border')}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
                      title="Include outer laminated plastic border"
                    >
                      With Border
                    </button>

                    <button
                      type="button"
                      onClick={() => rotateSourceImage(90)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all text-xs cursor-pointer shadow-2xs"
                      title="Rotate Original Source 90° Clockwise"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRotatePins('cw')}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all text-xs cursor-pointer shadow-2xs"
                      title="Shift Pin Top-Edge 90° Clockwise"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    </button>

                    <button
                      type="button"
                      onClick={handleResetCorners}
                      className="p-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
                      title="Reset pins to full outer boundary"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Canvas Viewport */}
                <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-800 select-none">
                  <canvas
                    ref={editorCanvasRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className="max-w-full max-h-full object-contain cursor-crosshair touch-none"
                  />

                  {/* 140px High-Precision Loupe Magnifier Bubble */}
                  {loupePos.visible && (
                    <div
                      className="absolute pointer-events-none rounded-full border-2 border-cyan-400 shadow-2xl bg-black overflow-hidden z-30 ring-4 ring-cyan-500/20"
                      style={{
                        width: '140px',
                        height: '140px',
                        left: `${Math.max(10, Math.min(window.innerWidth > 768 ? 420 : 250, loupePos.x - 70))}px`,
                        top: `${Math.max(10, Math.min(320, loupePos.y - 150))}px`,
                      }}
                    >
                      <canvas ref={loupeCanvasRef} className="w-full h-full block" />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  <span>💡 Drag pins or edge midpoints to frame document boundary.</span>
                  <span className="font-mono text-slate-600 dark:text-slate-400 font-semibold">
                    {currentCard.sourceImage.naturalWidth} × {currentCard.sourceImage.naturalHeight} px
                  </span>
                </div>
              </div>

              {/* RIGHT COLUMN: STRAIGHTENED OUTPUT & TONE SETTER STUDIO */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col space-y-4 shadow-xs">
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Deskewed Result ({currentCard.cardSide.toUpperCase()})
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    {isProcessing && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 animate-pulse">
                        <Sparkles className="w-3.5 h-3.5" /> Applying Tone...
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setFullPreviewOpen(true)}
                      className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors shadow-2xs"
                      title="View Fullscreen High Resolution"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Straightened Result Preview Canvas / Image */}
                <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-800 p-3">
                  {currentCard.processedDataUrl || currentCard.processedCanvas ? (
                    <img
                      src={currentCard.processedDataUrl || currentCard.processedCanvas?.toDataURL('image/jpeg', 0.94) || ''}
                      alt="Straightened Result"
                      className="max-w-full max-h-full object-contain rounded-md shadow-lg transition-all"
                    />
                  ) : (
                    <div className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 animate-spin text-blue-500" />
                      <span>Generating preview...</span>
                    </div>
                  )}

                  <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-mono text-cyan-300 border border-cyan-500/30">
                    {currentCard.cardSide.toUpperCase()} • {DOCUMENT_TYPES.find((d) => d.id === currentCard.docType)?.name}
                    {currentCard.processedCanvas && ` • ${currentCard.processedCanvas.width}×${currentCard.processedCanvas.height}px`}
                  </div>
                </div>

                {/* 1. ORIENTATION & TILT DESKEW (CLEAN & COMPACT) */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5 shadow-2xs">
                  {/* Rotation Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <RotateCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Orientation:</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleRotateOutput(-90)}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
                        title="Rotate -90° CCW"
                      >
                        -90°
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRotateOutput(90)}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
                        title="Rotate +90° CW"
                      >
                        +90°
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRotateOutput(180)}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
                        title="Flip 180°"
                      >
                        Flip 180°
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleOrientation}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-xs font-bold border border-blue-200 dark:border-blue-800 transition-all cursor-pointer"
                        title="Toggle Landscape / Portrait format"
                      >
                        {currentCard.aspectMode === 'standard' ? 'Flip to Portrait' : 'Make Landscape (ID)'}
                      </button>
                    </div>
                  </div>

                  {/* Fine Tilt Angle Slider */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">Tilt Deskew:</span>
                    <button
                      type="button"
                      onClick={() => updateCurrentCard((c) => ({
                        ...c,
                        adjustments: { ...c.adjustments, fineAngle: Math.max(-25, Math.round(((c.adjustments.fineAngle || 0) - 1) * 10) / 10) }
                      }))}
                      className="px-1.5 py-0.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
                      title="Tilt -1°"
                    >
                      -1°
                    </button>
                    <input
                      type="range"
                      min="-25"
                      max="25"
                      step="0.5"
                      value={currentCard.adjustments.fineAngle || 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        updateCurrentCard((c) => ({
                          ...c,
                          adjustments: { ...c.adjustments, fineAngle: val }
                        }));
                      }}
                      className="flex-1 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => updateCurrentCard((c) => ({
                        ...c,
                        adjustments: { ...c.adjustments, fineAngle: Math.min(25, Math.round(((c.adjustments.fineAngle || 0) + 1) * 10) / 10) }
                      }))}
                      className="px-1.5 py-0.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
                      title="Tilt +1°"
                    >
                      +1°
                    </button>
                    <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 min-w-[45px] text-center">
                      {(currentCard.adjustments.fineAngle || 0) > 0 
                        ? `+${(currentCard.adjustments.fineAngle || 0).toFixed(1)}°` 
                        : `${(currentCard.adjustments.fineAngle || 0).toFixed(1)}°`}
                    </span>
                    {(currentCard.adjustments.fineAngle || 0) !== 0 && (
                      <button
                        type="button"
                        onClick={() => updateCurrentCard((c) => ({
                          ...c,
                          adjustments: { ...c.adjustments, fineAngle: 0 }
                        }))}
                        className="px-1.5 py-0.5 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded text-xs font-bold border border-rose-200 dark:border-rose-800 cursor-pointer"
                        title="Reset tilt to 0°"
                      >
                        0°
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. TONE SETTER & COLOR FILTERS (PROMINENT, CLEAN & HIGH CONTRAST) */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3 shadow-2xs">
                  {/* Tone Setter Title & Reset */}
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Tone Setter & Filters</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleResetTone}
                      className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Reset all tone adjustments back to normal defaults"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reset Tones</span>
                    </button>
                  </div>

                  {/* Filter Color Presets */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { id: 'none', label: 'Original' },
                      { id: 'id_pop', label: 'ID Pop' },
                      { id: 'auto_enhance', label: 'Enhanced' },
                      { id: 'scan_bw', label: 'Clean B&W' },
                      { id: 'grayscale', label: 'Grayscale' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => updateCurrentCard((c) => ({
                          ...c,
                          adjustments: { ...c.adjustments, filter: f.id as any }
                        }))}
                        className={`py-1.5 px-1 rounded-lg text-xs font-semibold transition-all text-center cursor-pointer ${
                          currentCard.adjustments.filter === f.id
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* 4 Tone Sliders (2x2 Grid) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Brightness Slider */}
                    <div className="tone-slider-container">
                      <div className="tone-slider-header">
                        <span className="text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1">
                          <Sun className="w-3.5 h-3.5 text-amber-500" /> Brightness
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400">
                            {currentCard.adjustments.brightness > 0 ? `+${currentCard.adjustments.brightness}` : currentCard.adjustments.brightness}
                          </span>
                          {currentCard.adjustments.brightness !== 0 && (
                            <button
                              type="button"
                              onClick={() => updateCurrentCard((c) => ({
                                ...c,
                                adjustments: { ...c.adjustments, brightness: 0 }
                              }))}
                              className="text-[10px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-bold px-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                              title="Reset brightness to 0"
                            >
                              0
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-80"
                        max="80"
                        value={currentCard.adjustments.brightness}
                        onChange={(e) => updateCurrentCard((c) => ({
                          ...c,
                          adjustments: { ...c.adjustments, brightness: Number(e.target.value) }
                        }))}
                        className="w-full cursor-pointer"
                      />
                    </div>

                    {/* Contrast Slider */}
                    <div className="tone-slider-container">
                      <div className="tone-slider-header">
                        <span className="text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1">
                          <Contrast className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> Contrast
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400">
                            {currentCard.adjustments.contrast > 0 ? `+${currentCard.adjustments.contrast}` : currentCard.adjustments.contrast}
                          </span>
                          {currentCard.adjustments.contrast !== 0 && (
                            <button
                              type="button"
                              onClick={() => updateCurrentCard((c) => ({
                                ...c,
                                adjustments: { ...c.adjustments, contrast: 0 }
                              }))}
                              className="text-[10px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-bold px-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                              title="Reset contrast to 0"
                            >
                              0
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-80"
                        max="80"
                        value={currentCard.adjustments.contrast}
                        onChange={(e) => updateCurrentCard((c) => ({
                          ...c,
                          adjustments: { ...c.adjustments, contrast: Number(e.target.value) }
                        }))}
                        className="w-full cursor-pointer"
                      />
                    </div>

                    {/* Exposure Slider */}
                    <div className="tone-slider-container">
                      <div className="tone-slider-header">
                        <span className="text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1">
                          <Sliders className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" /> Exposure
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400">
                            {(currentCard.adjustments.exposure || 0) > 0 ? `+${currentCard.adjustments.exposure}` : (currentCard.adjustments.exposure || 0)}
                          </span>
                          {(currentCard.adjustments.exposure || 0) !== 0 && (
                            <button
                              type="button"
                              onClick={() => updateCurrentCard((c) => ({
                                ...c,
                                adjustments: { ...c.adjustments, exposure: 0 }
                              }))}
                              className="text-[10px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-bold px-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                              title="Reset exposure to 0"
                            >
                              0
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={currentCard.adjustments.exposure || 0}
                        onChange={(e) => updateCurrentCard((c) => ({
                          ...c,
                          adjustments: { ...c.adjustments, exposure: Number(e.target.value) }
                        }))}
                        className="w-full cursor-pointer"
                      />
                    </div>

                    {/* Saturation Slider */}
                    <div className="tone-slider-container">
                      <div className="tone-slider-header">
                        <span className="text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1">
                          <Palette className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" /> Saturation
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400">
                            {(currentCard.adjustments.saturation || 0) > 0 ? `+${currentCard.adjustments.saturation}` : (currentCard.adjustments.saturation || 0)}
                          </span>
                          {(currentCard.adjustments.saturation || 0) !== 0 && (
                            <button
                              type="button"
                              onClick={() => updateCurrentCard((c) => ({
                                ...c,
                                adjustments: { ...c.adjustments, saturation: 0 }
                              }))}
                              className="text-[10px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-bold px-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                              title="Reset saturation to 0"
                            >
                              0
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={currentCard.adjustments.saturation || 0}
                        onChange={(e) => updateCurrentCard((c) => ({
                          ...c,
                          adjustments: { ...c.adjustments, saturation: Number(e.target.value) }
                        }))}
                        className="w-full cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. PRIMARY & SECONDARY ACTION BUTTONS */}
                <div className="space-y-2.5 pt-1">
                  {/* Primary CTA: Send to Print Studio */}
                  <button
                    type="button"
                    onClick={() => handlePushCurrentToPrint(false)}
                    className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer transform active:scale-98"
                  >
                    {copiedSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>Added to Print Queue!</span>
                      </>
                    ) : (
                      <>
                        <Printer className="w-4 h-4" />
                        <span>Send {currentCard.cardSide === 'front' ? 'Front Side' : currentCard.cardSide === 'back' ? 'Back Side' : 'Image'} to Print Studio →</span>
                      </>
                    )}
                  </button>

                  {/* Secondary Actions Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Multi-card Prev / Next */}
                    {cards.length > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => selectCard(activeCardIndex - 1)}
                          disabled={activeCardIndex === 0}
                          className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Prev</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => selectCard(activeCardIndex + 1)}
                          disabled={activeCardIndex >= cards.length - 1}
                          className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Download JPG or ZIP */}
                    {cards.length > 1 && activeCardIndex === cards.length - 1 ? (
                      <button
                        type="button"
                        onClick={handleDownloadZip}
                        disabled={isZipping}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <Archive className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{isZipping ? 'Zipping...' : `Download All (${cards.length}) .ZIP`}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Download JPG</span>
                      </button>
                    )}

                    {/* Immediate Print */}
                    <button
                      type="button"
                      onClick={() => handlePushCurrentToPrint(true)}
                      className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                      title="Send to Print Studio and open print dialog immediately"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Now</span>
                    </button>

                    {/* Overwrite PC File if available */}
                    {currentCard.fileHandle && (
                      <button
                        type="button"
                        onClick={() => handleSaveOverwrite()}
                        className="py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                        title="Directly overwrite source image on PC"
                      >
                        <Save className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Overwrite</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION MODAL: REFRESH / CLEAR SCAN SESSION */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center justify-center shrink-0">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Start New Scan Session?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  This will clear {cards.length} edited image{cards.length > 1 ? 's' : ''} in this session and return to the upload screen.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer border border-transparent dark:border-slate-700"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleResetSession}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/25 transition-all cursor-pointer"
              >
                Clear & Start New
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen High-Resolution Preview Modal */}
      {fullPreviewOpen && currentCard?.processedCanvas && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Full Resolution Preview ({currentCard.name})</h3>
              </div>
              <button
                onClick={() => setFullPreviewOpen(false)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-6 overflow-auto flex items-center justify-center bg-slate-100 dark:bg-slate-950">
              <img
                src={currentCard.processedCanvas.toDataURL()}
                alt="Full Preview"
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
              />
            </div>
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 text-xs text-slate-500 dark:text-slate-400">
              <span>{currentCard.processedCanvas.width} × {currentCard.processedCanvas.height} px • High Resolution</span>
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Output</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
