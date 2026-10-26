import React, { useState, useRef, useEffect } from 'react';
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
  FileCheck, 
  Maximize2, 
  X, 
  Target, 
  Eye, 
  Plus, 
  Layers,
  FileText,
  CreditCard,
  Lock
} from 'lucide-react';
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
  cardSide: 'front' | 'back' | 'single';
  docType: DocumentTypeId;
  sourceImage: HTMLImageElement;
  corners: [Point, Point, Point, Point];
  adjustments: ImageAdjustments;
  aspectMode: 'standard' | 'portrait' | 'free';
  processedCanvas: HTMLCanvasElement | null;
}

interface ScannerViewProps {
  onSendToPrint: (item: Omit<PrintQueueItem, 'id' | 'createdAt'>) => void;
  onSendMultipleToPrint?: (items: Omit<PrintQueueItem, 'id' | 'createdAt'>[]) => void;
  externalImage?: string | null;
  onClearExternalImage?: () => void;
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
}) => {
  const { user, isAuthenticated, openAuthModal } = useAuth();
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

  // Refs
  const editorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addMoreFileInputRef = useRef<HTMLInputElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Current active card
  const currentCard = cards[activeCardIndex] || null;

  // Helper to update active card fields
  const updateCurrentCard = (updater: (prev: ScannedCardItem) => ScannedCardItem) => {
    setCards((prev) => {
      if (!prev[activeCardIndex]) return prev;
      const updated = [...prev];
      updated[activeCardIndex] = updater(updated[activeCardIndex]);
      return updated;
    });
  };

  // Helper: process image URL into a ScannedCardItem
  const createCardFromImage = (
    img: HTMLImageElement, 
    name: string, 
    side: 'front' | 'back' | 'single' = 'front',
    docType: DocumentTypeId = 'id_standard'
  ): ScannedCardItem => {
    const detected = autoDetectDocumentCorners(img, 'auto');
    const docDef = DOCUMENT_TYPES.find((d) => d.id === docType);
    const targetRatio = docDef?.aspectRatio || 85.6 / 53.98;

    let processed: HTMLCanvasElement | null = null;
    try {
      const unwarped = warpPerspectiveCrop(img, detected, targetRatio, 2000, 'standard');
      processed = applyAdjustments(unwarped, defaultAdjustments);
    } catch (e) {
      console.warn('Initial warp error:', e);
    }

    return {
      id: `card-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.replace(/\.[^/.]+$/, ''),
      cardSide: side,
      docType,
      sourceImage: img,
      corners: detected,
      adjustments: { ...defaultAdjustments },
      aspectMode: 'standard',
      processedCanvas: processed,
    };
  };

  // Load external image (e.g. from header sample)
  useEffect(() => {
    if (externalImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const side: 'front' | 'back' | 'single' = cards.length === 0 ? 'front' : (cards.length === 1 ? 'back' : 'single');
        const newCard = createCardFromImage(img, 'Sample_Document.jpg', side);
        setCards((prev) => [...prev, newCard]);
        setActiveCardIndex(cards.length);
        setAutoDetectNotice('Document auto-detected & ready');
        setTimeout(() => setAutoDetectNotice(''), 2500);
      };
      img.src = externalImage;
      if (onClearExternalImage) onClearExternalImage();
    }
  }, [externalImage]);

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
            const card = createCardFromImage(img, file.name, side);
            newCards.push(card);
            processedCount++;

            if (processedCount === filesArray.length) {
              setCards((prev) => [...prev, ...newCards]);
              setActiveCardIndex(cards.length);
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
  }, [currentCard, activeHandle]);

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

  // Perspective Warp & Adjustments
  useEffect(() => {
    if (!currentCard || isDragging) return;

    setIsProcessing(true);
    const timer = setTimeout(() => {
      try {
        const docDef = DOCUMENT_TYPES.find((d) => d.id === currentCard.docType);
        let targetRatio = docDef?.aspectRatio || 85.6 / 53.98;

        if (currentCard.aspectMode === 'free') {
          targetRatio = 0;
        } else if (currentCard.aspectMode === 'portrait' && targetRatio > 0) {
          targetRatio = 1 / Math.max(targetRatio, 1 / targetRatio);
        } else if (currentCard.aspectMode === 'standard' && targetRatio > 0) {
          targetRatio = Math.max(targetRatio, 1 / targetRatio);
        }

        const unwarped = warpPerspectiveCrop(
          currentCard.sourceImage, 
          currentCard.corners, 
          targetRatio,
          2000,
          currentCard.aspectMode
        );
        const adjusted = applyAdjustments(unwarped, currentCard.adjustments);

        updateCurrentCard((c) => ({ ...c, processedCanvas: adjusted }));
      } catch (err) {
        console.error('Processing error:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 40);

    return () => clearTimeout(timer);
  }, [
    currentCard?.corners, 
    currentCard?.docType, 
    currentCard?.adjustments, 
    currentCard?.aspectMode, 
    isDragging,
    activeCardIndex
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
      } catch (err) {
        // ignore
      }
    }
  };

  // Push Active Card to Print Studio
  const handlePushCurrentToPrint = () => {
    if (!currentCard?.processedCanvas) return;
    const canvas = currentCard.processedCanvas;
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

  // Direct download
  const handleDownload = () => {
    if (!isAuthenticated) {
      openAuthModal('download straightened document');
      return;
    }
    if (!currentCard?.processedCanvas) return;
    const link = document.createElement('a');
    link.download = `${currentCard.name}_${currentCard.cardSide}_straightened.jpg`;
    link.href = currentCard.processedCanvas.toDataURL('image/jpeg', 0.96);
    link.click();
    analytics.trackDownload({
      type: 'Straightened Document JPG',
      fileName: currentCard.name,
      page: 'scanner',
    });
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

      {/* If no images uploaded yet */}
      {cards.length === 0 ? (
        <div className="max-w-4xl mx-auto my-6">
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-white rounded-3xl p-8 sm:p-12 text-center transition-all shadow-xl hover:shadow-2xl relative overflow-hidden"
          >
            {/* Subtle radial glow */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/30 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
              >
                <Upload className="w-10 h-10" />
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
                Upload ID Card or Document Images
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto mb-6 leading-relaxed">
                Take a photo from your phone at any angle. PrintMate automatically detects the 4 corners, deskews slanted perspective, and adjusts scale for flawless printing.
              </p>

              {/* Browse CTA Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-white text-sm font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-500 transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-5 h-5" />
                <span>Browse Images from Computer</span>
              </button>

              <p className="text-[11px] text-slate-400 mt-3">
                or drag & drop files here • paste with <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-slate-600">Ctrl+V</kbd>
              </p>

              {/* 1-Click Studio Samples Direct Launch */}
              <div className="mt-8 pt-8 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                  Or test immediately with 1-click studio samples
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); loadSampleDirectly('id_front'); }}
                    className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 hover:bg-blue-50/60 hover:border-blue-300 text-left transition-all group cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-100 text-blue-700 group-hover:scale-110 transition-transform">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700">Slanted ID Front</div>
                        <div className="text-[10px] text-slate-500">Angled on wooden desk</div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); loadSampleDirectly('id_back'); }}
                    className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 hover:bg-emerald-50/60 hover:border-emerald-300 text-left transition-all group cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 group-hover:scale-110 transition-transform">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">ID Back Side</div>
                        <div className="text-[10px] text-slate-500">Barcode & details</div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); loadSampleDirectly('paper'); }}
                    className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 hover:bg-amber-50/60 hover:border-amber-300 text-left transition-all group cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-amber-100 text-amber-700 group-hover:scale-110 transition-transform">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 group-hover:text-amber-700">Paper Document</div>
                        <div className="text-[10px] text-slate-500">A4 Certificate sheet</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Feature Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-6 text-[11px] text-slate-500">
                <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 font-medium">
                  ✓ Auto-Crop & Perspective Deskew
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 font-medium">
                  ✓ Front & Back 2-Card Batching
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 font-medium">
                  ✓ CR80 ID & A4 Document Scale
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* MULTI-IMAGE TRAY & CARD SELECTOR */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mr-1 flex-shrink-0">
                <Layers className="w-4 h-4 text-cyan-600" />
                <span>Images ({cards.length}):</span>
              </span>

              {cards.map((card, idx) => {
                const isActive = idx === activeCardIndex;
                return (
                  <div
                    key={card.id}
                    onClick={() => setActiveCardIndex(idx)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition-all flex-shrink-0 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border-cyan-400 text-white shadow-md shadow-cyan-500/10'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
                    <span className="font-semibold">
                      {card.cardSide === 'front' 
                        ? '🪪 Front Side' 
                        : card.cardSide === 'back' 
                        ? '🪪 Back Side' 
                        : `Image ${idx + 1}`}
                    </span>
                    <span className="text-[10px] text-slate-500 max-w-[100px] truncate">
                      {card.name}
                    </span>
                    {cards.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCard(idx);
                        }}
                        className="p-0.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all"
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
                onClick={() => addMoreFileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 border border-cyan-300 text-cyan-700 hover:bg-cyan-500/25 transition-all text-xs font-semibold flex-shrink-0 shadow-sm"
                title="Add second image (e.g. Back side of Aadhaar card)"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add 1 More Image {cards.length === 1 ? '(Back Side)' : ''}</span>
              </button>
            </div>

            {/* Quick Actions for All Cards */}
            <div className="flex items-center gap-2">
              {cards.length > 1 && (
                <button
                  onClick={handlePushAllToPrint}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Send Both ({cards.length}) to Print Studio</span>
                </button>
              )}
            </div>
          </div>

          {/* Toast Notification */}
          {autoDetectNotice && (
            <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg animate-fade-in">
              <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{autoDetectNotice}</span>
            </div>
          )}

          {/* Active Card Configuration Bar */}
          {currentCard && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
                  ID Standard:
                </span>
                {DOCUMENT_TYPES.map((dt) => (
                  <button
                    key={dt.id}
                    onClick={() => updateCurrentCard((c) => ({ ...c, docType: dt.id }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      currentCard.docType === dt.id
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-1 ring-blue-400'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                    title={dt.description}
                  >
                    {dt.name}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Card Side:
                </span>
                {(['front', 'back', 'single'] as const).map((side) => (
                  <button
                    key={side}
                    onClick={() => updateCurrentCard((c) => ({ ...c, cardSide: side }))}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                      currentCard.cardSide === side
                        ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                        : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {side}
                  </button>
                ))}
                <button
                  onClick={() => addMoreFileInputRef.current?.click()}
                  className="ml-auto md:ml-2 px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-cyan-700 rounded-lg border border-cyan-200 flex items-center gap-1.5"
                  title="Add another image"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another</span>
                </button>
              </div>
            </div>
          )}

          {/* MAIN 2-COLUMN WORKSPACE: LEFT = DETECTOR & PINS, RIGHT = STRAIGHTENED & ADJUSTMENTS */}
          {currentCard && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT: SOURCE IMAGE WITH CROP HANDLES */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
                    <h4 className="text-sm font-semibold text-slate-900">
                      Border Detection & Crop Pins ({currentCard.cardSide.toUpperCase()})
                    </h4>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => rotateSourceImage(-90)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-white transition-all flex items-center gap-1 text-xs"
                      title="Rotate Source 90° CCW"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Rotate Left</span>
                    </button>

                    <button
                      onClick={() => rotateSourceImage(90)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-white transition-all flex items-center gap-1 text-xs"
                      title="Rotate Source 90° CW"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Rotate Right</span>
                    </button>

                    <button
                      onClick={() => handleRotatePins('cw')}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-amber-700 hover:text-white transition-all flex items-center gap-1 text-xs"
                      title="Shift Pin Top-Edge 90° CW"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-amber-600" />
                      <span className="hidden sm:inline">Shift Pins</span>
                    </button>

                    <button
                      onClick={() => handleRotatePins('180')}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-amber-700 hover:text-white transition-all flex items-center gap-1 text-xs"
                      title="Flip Pins 180°"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                      <span className="hidden sm:inline">Flip 180°</span>
                    </button>

                    <button
                      onClick={() => runAutoDetect('auto')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-300 hover:bg-cyan-500/25 transition-all shadow-sm"
                      title="Run auto border detection"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Auto-Detect</span>
                    </button>

                    <button
                      onClick={handleResetCorners}
                      className="p-1.5 text-xs text-slate-500 hover:text-white rounded-lg hover:bg-slate-100 transition-all"
                      title="Reset to outer margins"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Snap Quick Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5 text-cyan-600 font-medium">
                    <Target className="w-3.5 h-3.5" />
                    <span>💡 Click anywhere on card to snap pins instantly</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => runAutoDetect('inner_card')}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-cyan-700 border border-slate-200 transition-all"
                      title="Trim transparent lamination plastic and snap to card"
                    >
                      Snap to Card
                    </button>
                    <button
                      onClick={() => runAutoDetect('outer_border')}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-cyan-700 border border-slate-200 transition-all"
                      title="Expand to outer laminated plastic margin"
                    >
                      Include Border
                    </button>
                  </div>
                </div>

                {/* Canvas Viewport */}
                <div className="relative w-full aspect-[4/3] bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 select-none">
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

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Drag corners • Drag edge midpoints to slide sides</span>
                  <span className="font-mono text-cyan-600">
                    {currentCard.sourceImage.naturalWidth} × {currentCard.sourceImage.naturalHeight} px
                  </span>
                </div>
              </div>

              {/* RIGHT: STRAIGHTENED RESULT & IMAGE ADJUSTMENTS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-semibold text-slate-900">
                      Deskewed Result & Filters
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    {isProcessing && (
                      <span className="text-xs text-amber-600 flex items-center gap-1 animate-pulse">
                        <Sparkles className="w-3 h-3" /> Processing...
                      </span>
                    )}
                    <button
                      onClick={() => setFullPreviewOpen(true)}
                      className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-100"
                      title="View Fullscreen"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Preview Canvas */}
                <div className="relative w-full aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 p-4">
                  {currentCard.processedCanvas ? (
                    <img
                      src={currentCard.processedCanvas.toDataURL()}
                      alt="Straightened Result"
                      className="max-w-full max-h-full object-contain rounded-md shadow-2xl transition-all"
                    />
                  ) : (
                    <div className="text-slate-500 text-xs">Generating preview...</div>
                  )}

                  <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-mono text-cyan-700 border border-cyan-200">
                    {currentCard.cardSide.toUpperCase()} • {DOCUMENT_TYPES.find((d) => d.id === currentCard.docType)?.name}
                    {currentCard.processedCanvas && ` • ${currentCard.processedCanvas.width}×${currentCard.processedCanvas.height}px`}
                  </div>
                </div>

                {/* 1-Click Direct Rotation & Orientation Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                    <span>Card Orientation:</span>
                    <span className="text-[10px] font-mono text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                      {currentCard.processedCanvas && currentCard.processedCanvas.width >= currentCard.processedCanvas.height
                        ? 'Landscape (Horizontal)'
                        : 'Portrait (Vertical)'}
                      {currentCard.adjustments.rotation ? ` • ${currentCard.adjustments.rotation}°` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleRotateOutput(-90)}
                      className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 hover:text-white text-xs font-medium border border-slate-200 flex items-center gap-1 transition-all"
                      title="Rotate Deskewed Card 90° CCW"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-cyan-600" />
                      <span>-90°</span>
                    </button>

                    <button
                      onClick={() => handleRotateOutput(90)}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all"
                      title="Rotate Deskewed Card 90° CW"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>+90°</span>
                    </button>

                    <button
                      onClick={() => handleRotateOutput(180)}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all"
                      title="Flip Deskewed Card 180° (Upright)"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Flip 180°</span>
                    </button>

                    <button
                      onClick={handleToggleOrientation}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        currentCard.aspectMode === 'standard'
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                          : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-white'
                      }`}
                      title="Switch between Horizontal Landscape (Standard ID) and Vertical Portrait"
                    >
                      {currentCard.aspectMode === 'standard' ? 'Flip to Portrait' : 'Make Horizontal (ID)'}
                    </button>
                  </div>
                </div>

                {/* Aspect Ratio Lock Mode */}
                <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="text-slate-500">Aspect Ratio:</span>
                  <div className="flex items-center gap-1">
                    {(['standard', 'portrait', 'free'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => updateCurrentCard((c) => ({ ...c, aspectMode: mode }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                          currentCard.aspectMode === mode
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-500 hover:text-white'
                        }`}
                      >
                        {mode === 'standard' ? 'Standard Card' : mode === 'portrait' ? 'Portrait' : 'Free Quad'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Filters */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Scan Filters & Modes</span>
                  </label>
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
                        onClick={() => updateCurrentCard((c) => ({
                          ...c,
                          adjustments: { ...c.adjustments, filter: f.id as any }
                        }))}
                        className={`py-1.5 px-1 rounded-lg text-[11px] font-medium transition-all text-center truncate ${
                          currentCard.adjustments.filter === f.id
                            ? 'bg-blue-600 text-white font-semibold shadow'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brightness & Contrast Sliders */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Sun className="w-3 h-3 text-amber-600" /> Brightness
                      </span>
                      <span className="font-mono text-cyan-600">{currentCard.adjustments.brightness}</span>
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
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Contrast className="w-3 h-3 text-cyan-600" /> Contrast
                      </span>
                      <span className="font-mono text-cyan-600">{currentCard.adjustments.contrast}</span>
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
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {/* Push Active Card */}
                  <button
                    onClick={handlePushCurrentToPrint}
                    className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-98"
                  >
                    {copiedSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>Added to Print Queue!</span>
                      </>
                    ) : (
                      <>
                        <Printer className="w-4 h-4" />
                        <span>Send This Card to Print</span>
                      </>
                    )}
                  </button>

                  {/* If multiple cards, also offer Send All */}
                  {cards.length > 1 && (
                    <button
                      onClick={handlePushAllToPrint}
                      className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all"
                    >
                      <Layers className="w-4 h-4" />
                      <span>Send Both ({cards.length})</span>
                    </button>
                  )}

                  <button
                    onClick={handleDownload}
                    className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium border border-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title={isAuthenticated ? 'Download Single Image File' : 'Sign in required to download'}
                  >
                    {!isAuthenticated ? (
                      <Lock className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>Download</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen High-Resolution Preview Modal */}
      {fullPreviewOpen && currentCard?.processedCanvas && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-cyan-600" />
                <h3 className="text-sm font-bold text-slate-900">Full Resolution Preview ({currentCard.name})</h3>
              </div>
              <button
                onClick={() => setFullPreviewOpen(false)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-6 overflow-auto flex items-center justify-center bg-slate-100">
              <img
                src={currentCard.processedCanvas.toDataURL()}
                alt="Full Preview"
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
              />
            </div>
            <div className="p-3 border-t border-slate-200 flex items-center justify-between bg-white text-xs text-slate-500">
              <span>{currentCard.processedCanvas.width} × {currentCard.processedCanvas.height} px • High Resolution</span>
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 flex items-center gap-1.5 cursor-pointer"
              >
                {!isAuthenticated ? <Lock className="w-3.5 h-3.5 text-amber-300" /> : <Download className="w-3.5 h-3.5" />}
                <span>Download Output</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
