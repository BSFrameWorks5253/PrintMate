import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  Type,
  PenTool,
  Eraser,
  Highlighter,
  Square,
  Circle,
  ArrowRight,
  Minus,
  Calendar,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  Download,
  Eye,
  Check,
  X,
  UploadCloud,
  FileCheck,
  RefreshCw,
  Sparkles,
  RotateCw,
  Copy,
  Plus,
  Star,
  CheckCircle2,
  PanelLeftClose,
  PanelLeftOpen,
  MousePointer,
  Pencil,
  Undo2
} from 'lucide-react';
import {
  PdfAnnotationService,
  PdfAnnotation,
  TextAnnotation,
  FreehandAnnotation,
  SignatureAnnotation,
  WhiteoutAnnotation,
  HighlightAnnotation,
  ShapeAnnotation,
  StampAnnotation,
  ImageAnnotation
} from '../../../services/converter/pdfAnnotationService';
import { PdfPreviewModal } from '../ui/PdfPreviewModal';

interface PdfEditorStudioProps {
  initialFile?: { name: string; bytes: Uint8Array } | null;
  onClose?: () => void;
}

type ActiveTool =
  | 'select'
  | 'text'
  | 'pen'
  | 'sign'
  | 'whiteout'
  | 'highlight'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'image'
  | 'stamp-check'
  | 'stamp-cross'
  | 'stamp-star'
  | 'stamp-date';

interface DetectedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export const PdfEditorStudio: React.FC<PdfEditorStudioProps> = ({
  initialFile = null,
  onClose
}) => {
  // File State
  const [currentFile, setCurrentFile] = useState<{ name: string; bytes: Uint8Array } | null>(initialFile);
  const [pdfDocProxy, setPdfDocProxy] = useState<any>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.25);

  // Sidebar state
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [sidebarThumbnails, setSidebarThumbnails] = useState<Record<number, string>>({});

  // Tools & State
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);

  // Active Tool Styling Settings
  const [textColor, setTextColor] = useState<string>('#0f172a');
  const [textSize, setTextSize] = useState<number>(16);
  const [textFontFamily, setTextFontFamily] = useState<'Helvetica' | 'Times' | 'Courier'>('Helvetica');
  const [textBold, setTextBold] = useState<boolean>(false);
  const [textItalic, setTextItalic] = useState<boolean>(false);
  const [textBgColor, setTextBgColor] = useState<string>('#ffffff');

  // Pen Tool Settings
  const [penColor, setPenColor] = useState<string>('#2563eb');
  const [penWidth, setPenWidth] = useState<number>(2.5);
  const [isDrawingPen, setIsDrawingPen] = useState<boolean>(false);
  const [currentPenPoints, setCurrentPenPoints] = useState<Array<{ x: number; y: number }>>([]);

  // Markup & Shape Settings
  const [highlightColor, setHighlightColor] = useState<string>('#fde047');
  const [shapeStrokeColor, setShapeStrokeColor] = useState<string>('#0284c7');
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState<number>(2);

  // In-Place Text Detection Layer
  const [detectedTextItems, setDetectedTextItems] = useState<DetectedTextItem[]>([]);

  // Signature Modal
  const [showSignModal, setShowSignModal] = useState<boolean>(false);
  const [signTab, setSignTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const [typedName, setTypedName] = useState<string>('');
  const [selectedFont, setSelectedFont] = useState<string>('font-serif italic');
  const [signatureColor, setSignatureColor] = useState<string>('#000000');

  // Signature Canvas Ref
  const signCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSign, setIsDrawingSign] = useState(false);

  // Page Render Canvas & Overlay Refs
  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const pageDimensionsRef = useRef<Record<number, { width: number; height: number }>>({});

  // Dragging & Resizing Annotation State
  const [draggingAnnId, setDraggingAnnId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizingAnnId, setResizingAnnId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: 0,
    h: 0
  });

  // Processing & Export
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewPdf, setPreviewPdf] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load PDF Document Proxy
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!currentFile) {
      setPdfDocProxy(null);
      setTotalPages(0);
      setAnnotations([]);
      setSidebarThumbnails({});
      return;
    }

    let isMounted = true;
    const loadPdf = async () => {
      try {
        const safeBytes = new Uint8Array(currentFile.bytes.slice());
        const loadingTask = pdfjsLib.getDocument({
          data: safeBytes,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
          cMapPacked: true
        });
        const doc = await loadingTask.promise;
        if (isMounted) {
          setPdfDocProxy(doc);
          setTotalPages(doc.numPages);
          setCurrentPage(1);
          setAnnotations([]);
          generateThumbnails(doc);
        }
      } catch (err: any) {
        alert(`Failed to load PDF: ${err.message}`);
      }
    };

    loadPdf();
    return () => {
      isMounted = false;
    };
  }, [currentFile]);

  // ---------------------------------------------------------------------------
  // Generate Sidebar Thumbnails
  // ---------------------------------------------------------------------------
  const generateThumbnails = async (doc: any) => {
    const thumbs: Record<number, string> = {};
    for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
      try {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 0.22 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await (page.render as any)({ canvasContext: ctx, viewport, canvas }).promise;
          thumbs[i] = canvas.toDataURL('image/jpeg', 0.8);
        }
      } catch (e) {
        console.error('Thumbnail render error:', e);
      }
    }
    setSidebarThumbnails(thumbs);
  };

  // ---------------------------------------------------------------------------
  // Render Current Page & Extract Text Layer
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!pdfDocProxy || !pageCanvasRef.current) return;

    let isMounted = true;
    const renderPage = async () => {
      try {
        const page = await pdfDocProxy.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        const canvas = pageCanvasRef.current;
        if (!canvas) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        await (page.render as any)({ canvasContext: ctx, viewport, canvas }).promise;

        if (isMounted) {
          pageDimensionsRef.current[currentPage - 1] = {
            width: viewport.width,
            height: viewport.height
          };

          // Extract text items for in-place text editing
          try {
            const textContent = await page.getTextContent();
            const items: DetectedTextItem[] = [];
            for (const item of textContent.items as any[]) {
              if (item.str && item.str.trim().length > 0) {
                const tx = item.transform;
                // PDF space to viewport space
                const p = viewport.convertToViewportPoint(tx[4], tx[5]);
                const itemWidth = item.width * scale;
                const itemHeight = Math.abs(tx[0] || tx[3] || 12) * scale;
                items.push({
                  str: item.str,
                  x: p[0],
                  y: p[1] - itemHeight,
                  width: Math.max(20, itemWidth),
                  height: Math.max(14, itemHeight),
                  fontSize: Math.round(itemHeight / scale)
                });
              }
            }
            setDetectedTextItems(items);
          } catch (tErr) {
            console.error('Error extracting text content:', tErr);
          }
        }
      } catch (err) {
        console.error('Page render error:', err);
      }
    };

    renderPage();
    return () => {
      isMounted = false;
    };
  }, [pdfDocProxy, currentPage, scale]);

  // ---------------------------------------------------------------------------
  // File Drop / Browse
  // ---------------------------------------------------------------------------
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = Array.from(e.dataTransfer.files).find((f) =>
        f.name.toLowerCase().endsWith('.pdf')
      );
      if (file) {
        const buffer = await file.arrayBuffer();
        setCurrentFile({
          name: file.name,
          bytes: new Uint8Array(buffer)
        });
      }
    }
  };

  const handleBrowse = async () => {
    if (window.electronAPI) {
      const files = await window.electronAPI.openFilesDialog({
        filters: [{ name: 'PDF Documents (*.pdf)', extensions: ['pdf'] }]
      });
      if (files && files.length > 0) {
        setCurrentFile({
          name: files[0].name,
          bytes: new Uint8Array(files[0].buffer)
        });
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf';
      input.onchange = async (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          const file = target.files[0];
          const buffer = await file.arrayBuffer();
          setCurrentFile({
            name: file.name,
            bytes: new Uint8Array(buffer)
          });
        }
      };
      input.click();
    }
  };

  // ---------------------------------------------------------------------------
  // Canvas Click Handlers (Adding Elements)
  // ---------------------------------------------------------------------------
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pageIdx = currentPage - 1;

    if (activeTool === 'text') {
      const newText: TextAnnotation = {
        id: `text-${Date.now()}`,
        type: 'text',
        pageIndex: pageIdx,
        x,
        y,
        text: 'Type text here...',
        fontSize: textSize,
        color: textColor,
        fontFamily: textFontFamily,
        isBold: textBold,
        isItalic: textItalic,
        backgroundColor: '#FFFFFF',
        width: 140,
        height: textSize * 1.4
      };
      setAnnotations((prev) => [...prev, newText]);
      setSelectedAnnId(newText.id);
      setActiveTool('select');
    } else if (activeTool === 'whiteout') {
      const newWhiteout: WhiteoutAnnotation = {
        id: `whiteout-${Date.now()}`,
        type: 'whiteout',
        pageIndex: pageIdx,
        x,
        y,
        width: 140,
        height: 28,
        color: '#FFFFFF'
      };
      setAnnotations((prev) => [...prev, newWhiteout]);
      setSelectedAnnId(newWhiteout.id);
      setActiveTool('select');
    } else if (activeTool === 'highlight') {
      const newHighlight: HighlightAnnotation = {
        id: `highlight-${Date.now()}`,
        type: 'highlight',
        pageIndex: pageIdx,
        x,
        y,
        width: 160,
        height: 22,
        color: highlightColor,
        opacity: 0.35
      };
      setAnnotations((prev) => [...prev, newHighlight]);
      setSelectedAnnId(newHighlight.id);
      setActiveTool('select');
    } else if (activeTool === 'rectangle') {
      const newRect: ShapeAnnotation = {
        id: `rect-${Date.now()}`,
        type: 'rectangle',
        pageIndex: pageIdx,
        x,
        y,
        width: 120,
        height: 80,
        strokeColor: shapeStrokeColor,
        strokeWidth: shapeStrokeWidth
      };
      setAnnotations((prev) => [...prev, newRect]);
      setSelectedAnnId(newRect.id);
      setActiveTool('select');
    } else if (activeTool === 'circle') {
      const newCircle: ShapeAnnotation = {
        id: `circle-${Date.now()}`,
        type: 'circle',
        pageIndex: pageIdx,
        x,
        y,
        width: 90,
        height: 90,
        strokeColor: shapeStrokeColor,
        strokeWidth: shapeStrokeWidth
      };
      setAnnotations((prev) => [...prev, newCircle]);
      setSelectedAnnId(newCircle.id);
      setActiveTool('select');
    } else if (activeTool === 'line') {
      const newLine: ShapeAnnotation = {
        id: `line-${Date.now()}`,
        type: 'line',
        pageIndex: pageIdx,
        x,
        y,
        width: 140,
        height: 0,
        strokeColor: shapeStrokeColor,
        strokeWidth: shapeStrokeWidth
      };
      setAnnotations((prev) => [...prev, newLine]);
      setSelectedAnnId(newLine.id);
      setActiveTool('select');
    } else if (activeTool === 'arrow') {
      const newArrow: ShapeAnnotation = {
        id: `arrow-${Date.now()}`,
        type: 'arrow',
        pageIndex: pageIdx,
        x,
        y,
        width: 140,
        height: 0,
        strokeColor: shapeStrokeColor,
        strokeWidth: shapeStrokeWidth
      };
      setAnnotations((prev) => [...prev, newArrow]);
      setSelectedAnnId(newArrow.id);
      setActiveTool('select');
    } else if (activeTool === 'stamp-check') {
      const newStamp: StampAnnotation = {
        id: `stamp-${Date.now()}`,
        type: 'stamp',
        pageIndex: pageIdx,
        x: x - 12,
        y: y - 12,
        stampType: 'check',
        size: 24,
        color: '#16a34a'
      };
      setAnnotations((prev) => [...prev, newStamp]);
      setSelectedAnnId(newStamp.id);
      setActiveTool('select');
    } else if (activeTool === 'stamp-cross') {
      const newStamp: StampAnnotation = {
        id: `stamp-${Date.now()}`,
        type: 'stamp',
        pageIndex: pageIdx,
        x: x - 12,
        y: y - 12,
        stampType: 'cross',
        size: 24,
        color: '#dc2626'
      };
      setAnnotations((prev) => [...prev, newStamp]);
      setSelectedAnnId(newStamp.id);
      setActiveTool('select');
    } else if (activeTool === 'stamp-star') {
      const newStamp: StampAnnotation = {
        id: `stamp-${Date.now()}`,
        type: 'stamp',
        pageIndex: pageIdx,
        x: x - 14,
        y: y - 14,
        stampType: 'star',
        size: 28,
        color: '#eab308'
      };
      setAnnotations((prev) => [...prev, newStamp]);
      setSelectedAnnId(newStamp.id);
      setActiveTool('select');
    } else if (activeTool === 'stamp-date') {
      const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      const newDate: TextAnnotation = {
        id: `date-${Date.now()}`,
        type: 'text',
        pageIndex: pageIdx,
        x,
        y,
        text: today,
        fontSize: textSize,
        color: textColor,
        fontFamily: 'Helvetica',
        isBold: true
      };
      setAnnotations((prev) => [...prev, newDate]);
      setSelectedAnnId(newDate.id);
      setActiveTool('select');
    } else if (activeTool === 'image') {
      handleUploadImage(x, y);
      setActiveTool('select');
    }
  };

  // In-Place Click on Existing Detected Text
  const handleDetectedTextClick = (item: DetectedTextItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const newText: TextAnnotation = {
      id: `text-inplace-${Date.now()}`,
      type: 'text',
      pageIndex: currentPage - 1,
      x: item.x,
      y: item.y,
      text: item.str,
      fontSize: item.fontSize || 14,
      color: '#0f172a',
      fontFamily: 'Helvetica',
      isBold: false,
      backgroundColor: '#FFFFFF', // Clean in-place overlay replacement!
      width: item.width + 10,
      height: item.height
    };
    setAnnotations((prev) => [...prev, newText]);
    setSelectedAnnId(newText.id);
    setActiveTool('select');
  };

  // ---------------------------------------------------------------------------
  // Freehand Pen Drawing
  // ---------------------------------------------------------------------------
  const handlePenMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'pen' || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDrawingPen(true);
    setCurrentPenPoints([{ x, y }]);
  };

  const handlePenMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingPen || activeTool !== 'pen' || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentPenPoints((prev) => [...prev, { x, y }]);
  };

  const handlePenMouseUp = () => {
    if (!isDrawingPen || activeTool !== 'pen') return;
    setIsDrawingPen(false);
    if (currentPenPoints.length > 1) {
      const newFreehand: FreehandAnnotation = {
        id: `pen-${Date.now()}`,
        type: 'freehand',
        pageIndex: currentPage - 1,
        points: currentPenPoints,
        color: penColor,
        strokeWidth: penWidth
      };
      setAnnotations((prev) => [...prev, newFreehand]);
      setSelectedAnnId(newFreehand.id);
    }
    setCurrentPenPoints([]);
  };

  // ---------------------------------------------------------------------------
  // Upload Image Stamp
  // ---------------------------------------------------------------------------
  const handleUploadImage = (x: number, y: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png, image/jpeg, image/webp';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const file = target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          if (dataUrl) {
            const img = new Image();
            img.onload = () => {
              const maxDim = 150;
              const ratio = img.width / img.height;
              let w = maxDim;
              let h = maxDim / ratio;
              if (h > maxDim) {
                h = maxDim;
                w = maxDim * ratio;
              }

              const newImgAnn: ImageAnnotation = {
                id: `img-${Date.now()}`,
                type: 'image',
                pageIndex: currentPage - 1,
                x,
                y,
                width: w,
                height: h,
                imageDataUrl: dataUrl
              };
              setAnnotations((prev) => [...prev, newImgAnn]);
              setSelectedAnnId(newImgAnn.id);
            };
            img.src = dataUrl;
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  // ---------------------------------------------------------------------------
  // Signature Modal Canvas Logic
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (showSignModal && signTab === 'draw' && signCanvasRef.current) {
      const canvas = signCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = signatureColor;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [showSignModal, signTab, signatureColor]);

  const startDrawSign = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawingSign(true);
  };

  const drawSignMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingSign) return;
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const endDrawSign = () => {
    setIsDrawingSign(false);
  };

  const clearSignCanvas = () => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleApplySignature = () => {
    let dataUrl: string | null = null;

    if (signTab === 'draw') {
      const canvas = signCanvasRef.current;
      if (!canvas) return;
      dataUrl = canvas.toDataURL('image/png');
    } else if (signTab === 'type') {
      if (!typedName.trim()) return;
      const offscreen = document.createElement('canvas');
      offscreen.width = 400;
      offscreen.height = 140;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      ctx.font = 'italic 42px "Brush Script MT", cursive, serif';
      ctx.fillStyle = signatureColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedName, 200, 70);
      dataUrl = offscreen.toDataURL('image/png');
    }

    if (dataUrl) {
      const newSign: SignatureAnnotation = {
        id: `sign-${Date.now()}`,
        type: 'signature',
        pageIndex: currentPage - 1,
        x: 150,
        y: 200,
        width: 170,
        height: 60,
        imageDataUrl: dataUrl
      };
      setAnnotations((prev) => [...prev, newSign]);
      setSelectedAnnId(newSign.id);
    }

    setShowSignModal(false);
    setTypedName('');
    clearSignCanvas();
  };

  const handleUploadSignatureFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          const newSign: SignatureAnnotation = {
            id: `sign-${Date.now()}`,
            type: 'signature',
            pageIndex: currentPage - 1,
            x: 150,
            y: 200,
            width: 170,
            height: 60,
            imageDataUrl: dataUrl
          };
          setAnnotations((prev) => [...prev, newSign]);
          setSelectedAnnId(newSign.id);
          setShowSignModal(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // ---------------------------------------------------------------------------
  // Page Sidebar Actions (Rotate, Delete, Duplicate, Add Blank)
  // ---------------------------------------------------------------------------
  const handleRotatePage = async (pageIdx: number) => {
    if (!currentFile) return;
    try {
      const updated = await PdfAnnotationService.rotatePage(currentFile.bytes, pageIdx);
      setCurrentFile({ name: currentFile.name, bytes: updated });
    } catch (err: any) {
      alert(`Rotate failed: ${err.message}`);
    }
  };

  const handleDeletePage = async (pageIdx: number) => {
    if (!currentFile) return;
    if (totalPages <= 1) {
      alert('Cannot delete the only page in document.');
      return;
    }
    if (confirm(`Are you sure you want to delete page ${pageIdx + 1}?`)) {
      try {
        const updated = await PdfAnnotationService.deletePage(currentFile.bytes, pageIdx);
        setCurrentFile({ name: currentFile.name, bytes: updated });
        if (currentPage > 1) setCurrentPage((p) => p - 1);
      } catch (err: any) {
        alert(`Delete page failed: ${err.message}`);
      }
    }
  };

  const handleDuplicatePage = async (pageIdx: number) => {
    if (!currentFile) return;
    try {
      const updated = await PdfAnnotationService.duplicatePage(currentFile.bytes, pageIdx);
      setCurrentFile({ name: currentFile.name, bytes: updated });
    } catch (err: any) {
      alert(`Duplicate failed: ${err.message}`);
    }
  };

  const handleAddBlankPage = async () => {
    if (!currentFile) return;
    try {
      const updated = await PdfAnnotationService.insertBlankPage(currentFile.bytes, currentPage - 1);
      setCurrentFile({ name: currentFile.name, bytes: updated });
      setCurrentPage((p) => p + 1);
    } catch (err: any) {
      alert(`Add blank page failed: ${err.message}`);
    }
  };

  // ---------------------------------------------------------------------------
  // Drag & Resize Handlers for Annotations
  // ---------------------------------------------------------------------------
  const handleAnnMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedAnnId(id);
    setDraggingAnnId(id);
    const ann = annotations.find((a) => a.id === id);
    if (ann && 'x' in ann) {
      setDragOffset({
        x: e.clientX - ann.x,
        y: e.clientY - ann.y
      });
    }
  };

  const handleResizeHandleMouseDown = (
    e: React.MouseEvent,
    id: string,
    w: number,
    h: number
  ) => {
    e.stopPropagation();
    setResizingAnnId(id);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      w,
      h
    });
  };

  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDrawingPen && activeTool === 'pen') {
      handlePenMouseMove(e);
      return;
    }

    if (draggingAnnId && overlayRef.current) {
      const newX = Math.max(0, e.clientX - dragOffset.x);
      const newY = Math.max(0, e.clientY - dragOffset.y);

      setAnnotations((prev) =>
        prev.map((a) => {
          if (a.id === draggingAnnId && 'x' in a) {
            return { ...a, x: newX, y: newY };
          }
          return a;
        })
      );
    } else if (resizingAnnId) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      const newW = Math.max(20, resizeStart.w + deltaX);
      const newH = Math.max(14, resizeStart.h + deltaY);

      setAnnotations((prev) =>
        prev.map((a) => {
          if (a.id === resizingAnnId && 'width' in a) {
            return { ...a, width: newW, height: newH };
          }
          return a;
        })
      );
    }
  };

  const handleOverlayMouseUp = () => {
    if (isDrawingPen) {
      handlePenMouseUp();
    }
    setDraggingAnnId(null);
    setResizingAnnId(null);
  };

  const deleteAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    if (selectedAnnId === id) setSelectedAnnId(null);
  };

  const duplicateAnnotation = (id: string) => {
    const ann = annotations.find((a) => a.id === id);
    if (ann) {
      const cloned = {
        ...ann,
        id: `${ann.type}-${Date.now()}`,
        x: 'x' in ann ? ann.x + 20 : 0,
        y: 'y' in ann ? ann.y + 20 : 0
      };
      setAnnotations((prev) => [...prev, cloned as PdfAnnotation]);
      setSelectedAnnId(cloned.id);
    }
  };

  // ---------------------------------------------------------------------------
  // Save & Export Modified PDF
  // ---------------------------------------------------------------------------
  const handleSaveAndExport = async (mode: 'export' | 'preview' = 'export') => {
    if (!currentFile) return;
    setIsProcessing(true);
    setStatusMessage('Burning annotations into PDF...');

    try {
      const outBytes = await PdfAnnotationService.burnAnnotations(
        currentFile.bytes,
        annotations,
        pageDimensionsRef.current
      );

      const baseName = currentFile.name.replace(/\.pdf$/i, '');
      const outName = `${baseName}_Edited.pdf`;

      if (mode === 'preview') {
        setPreviewPdf({ bytes: outBytes, name: outName });
      } else {
        if (window.electronAPI) {
          const savedPath = await window.electronAPI.saveFileDialog({
            defaultName: outName,
            buffer: outBytes.buffer as ArrayBuffer,
            filterName: 'PDF Documents (*.pdf)',
            extension: 'pdf'
          });
          if (savedPath) {
            await window.electronAPI.revealInFolder(savedPath);
          }
        } else {
          const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = outName;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setStatusMessage(null);
    }
  };

  const currentAnnotations = annotations.filter((a) => a.pageIndex === currentPage - 1);
  const selectedAnn = annotations.find((a) => a.id === selectedAnnId);

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="h-full flex flex-col bg-[#F8FAFC] text-slate-800 select-none overflow-hidden font-sans"
    >
      {/* ------------------------------------------------------------------ */}
      {/* NO FILE SELECTED STATE                                             */}
      {/* ------------------------------------------------------------------ */}
      {!currentFile ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="max-w-xl w-full text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white border border-slate-200/90 shadow-2xs text-xs font-semibold text-slate-700">
              <span className="size-2 rounded-full bg-sky-500"></span>
              <span className="font-bold text-slate-900">PDFella Complete Editor &amp; Sign Studio</span>
            </div>

            <div className="space-y-1">
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Edit, Markup &amp; Sign PDF
              </h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                In-place text editing, freehand drawings, digital signatures, whiteout redaction, shapes, stamps, and page management.
              </p>
            </div>

            <div
              onClick={handleBrowse}
              className="p-12 border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-3xl bg-white hover:bg-sky-50/30 transition-all cursor-pointer flex flex-col items-center justify-center shadow-xs hover:shadow-md group"
            >
              <div className="size-16 rounded-2xl bg-sky-50 group-hover:bg-sky-100 text-sky-600 flex items-center justify-center mb-4 transition border border-sky-100">
                <UploadCloud className="size-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Choose a PDF or Drag &amp; Drop Here</h3>
              <p className="text-xs text-slate-400 mt-1">100% Client-Side High-Speed Vector PDF Engine</p>
              <button className="mt-5 px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-sm transition">
                Browse PDF File
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ------------------------------------------------------------------ */
        /* ACTIVE PDF EDITOR WORKSPACE (PDFELLA SUITE)                         */
        /* ------------------------------------------------------------------ */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 1. TOP MAIN TOOLBAR */}
          <div className="bg-white border-b border-slate-200/90 px-4 py-2 shadow-2xs shrink-0 flex flex-wrap items-center justify-between gap-3">
            {/* File info & Sidebar toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className={`p-2 rounded-xl transition ${
                  showSidebar ? 'bg-slate-100 text-slate-700' : 'text-slate-500 hover:bg-slate-100'
                }`}
                title="Toggle Page Thumbnails Sidebar"
              >
                {showSidebar ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
              </button>

              <div className="h-4 w-px bg-slate-200" />

              <div>
                <span className="text-xs font-bold text-slate-900 block max-w-[180px] truncate" title={currentFile.name}>
                  {currentFile.name}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Page {currentPage} of {totalPages}
                </span>
              </div>
            </div>

            {/* Core Tool Selection Ribbon */}
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-200/80">
              <button
                onClick={() => setActiveTool('select')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTool === 'select'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white'
                }`}
                title="Select & Move Tool"
              >
                <MousePointer className="size-3.5" />
                <span>Select</span>
              </button>

              <button
                onClick={() => setActiveTool('text')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTool === 'text'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white'
                }`}
                title="Edit Existing Text or Add Text Box"
              >
                <Type className="size-3.5" />
                <span>Text</span>
              </button>

              <button
                onClick={() => setActiveTool('pen')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTool === 'pen'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white'
                }`}
                title="Freehand Pen / Pencil Drawing"
              >
                <Pencil className="size-3.5" />
                <span>Draw</span>
              </button>

              <button
                onClick={() => setShowSignModal(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/70 transition flex items-center gap-1.5"
                title="Add Digital Signature"
              >
                <PenTool className="size-3.5" />
                <span>Sign</span>
              </button>

              <button
                onClick={() => setActiveTool('whiteout')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTool === 'whiteout'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white'
                }`}
                title="Whiteout / Redact Sensitive Content"
              >
                <Eraser className="size-3.5" />
                <span>Whiteout</span>
              </button>

              <button
                onClick={() => setActiveTool('highlight')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTool === 'highlight'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white'
                }`}
                title="Highlight Text or Area"
              >
                <Highlighter className="size-3.5" />
                <span>Highlight</span>
              </button>

              <div className="h-4 w-px bg-slate-300 mx-0.5" />

              {/* Shapes */}
              <button
                onClick={() => setActiveTool('rectangle')}
                className={`p-2 rounded-xl transition ${
                  activeTool === 'rectangle' ? 'bg-sky-100 text-sky-700' : 'text-slate-500 hover:bg-white'
                }`}
                title="Rectangle Shape"
              >
                <Square className="size-3.5" />
              </button>
              <button
                onClick={() => setActiveTool('circle')}
                className={`p-2 rounded-xl transition ${
                  activeTool === 'circle' ? 'bg-sky-100 text-sky-700' : 'text-slate-500 hover:bg-white'
                }`}
                title="Circle Shape"
              >
                <Circle className="size-3.5" />
              </button>
              <button
                onClick={() => setActiveTool('line')}
                className={`p-2 rounded-xl transition ${
                  activeTool === 'line' ? 'bg-sky-100 text-sky-700' : 'text-slate-500 hover:bg-white'
                }`}
                title="Straight Line"
              >
                <Minus className="size-3.5" />
              </button>
              <button
                onClick={() => setActiveTool('arrow')}
                className={`p-2 rounded-xl transition ${
                  activeTool === 'arrow' ? 'bg-sky-100 text-sky-700' : 'text-slate-500 hover:bg-white'
                }`}
                title="Arrow"
              >
                <ArrowRight className="size-3.5" />
              </button>

              <div className="h-4 w-px bg-slate-300 mx-0.5" />

              {/* Stamps */}
              <button
                onClick={() => setActiveTool('stamp-check')}
                className={`p-2 rounded-xl transition ${
                  activeTool === 'stamp-check' ? 'bg-emerald-100 text-emerald-700' : 'text-emerald-600 hover:bg-white'
                }`}
                title="Checkmark Stamp"
              >
                <Check className="size-3.5 font-bold" />
              </button>
              <button
                onClick={() => setActiveTool('stamp-cross')}
                className={`p-2 rounded-xl transition ${
                  activeTool === 'stamp-cross' ? 'bg-rose-100 text-rose-700' : 'text-rose-600 hover:bg-white'
                }`}
                title="Cross Stamp"
              >
                <X className="size-3.5 font-bold" />
              </button>
              <button
                onClick={() => setActiveTool('stamp-date')}
                className={`p-2 rounded-xl transition ${
                  activeTool === 'stamp-date' ? 'bg-sky-100 text-sky-700' : 'text-slate-500 hover:bg-white'
                }`}
                title="Date Stamp"
              >
                <Calendar className="size-3.5" />
              </button>
              <button
                onClick={() => setActiveTool('image')}
                className={`p-2 rounded-xl transition ${
                  activeTool === 'image' ? 'bg-sky-100 text-sky-700' : 'text-slate-500 hover:bg-white'
                }`}
                title="Insert Image / Logo"
              >
                <ImageIcon className="size-3.5" />
              </button>
            </div>

            {/* Right Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (confirm('Clear all unsaved annotations?')) setAnnotations([]);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                title="Clear all annotations"
              >
                Clear
              </button>

              <button
                onClick={() => handleSaveAndExport('preview')}
                disabled={isProcessing}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                title="Preview Exported PDF"
              >
                <Eye className="size-3.5" />
                <span>Preview</span>
              </button>

              <button
                onClick={() => handleSaveAndExport('export')}
                disabled={isProcessing}
                className="px-5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <Download className="size-3.5" />
                <span>Save &amp; Export</span>
              </button>
            </div>
          </div>

          {/* 2. SECONDARY CONTEXTUAL PROPERTY BAR */}
          <div className="bg-slate-50 border-b border-slate-200/80 px-5 py-2 text-xs flex items-center justify-between gap-4 shrink-0">
            {/* Tool specific configurations */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Text options */}
              {activeTool === 'text' && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-500 text-[11px]">Font:</span>
                    {(['Helvetica', 'Times', 'Courier'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setTextFontFamily(f)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                          textFontFamily === f ? 'bg-white shadow-2xs font-bold text-sky-700' : 'text-slate-600'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-500 text-[11px]">Size:</span>
                    <button
                      onClick={() => setTextSize((s) => Math.max(10, s - 2))}
                      className="px-2 py-0.5 bg-white rounded border border-slate-200 font-bold"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-mono font-bold text-slate-700">{textSize}</span>
                    <button
                      onClick={() => setTextSize((s) => Math.min(60, s + 2))}
                      className="px-2 py-0.5 bg-white rounded border border-slate-200 font-bold"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setTextBold(!textBold)}
                      className={`px-2 py-0.5 rounded font-bold border transition ${
                        textBold ? 'bg-sky-100 text-sky-800 border-sky-300' : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      B
                    </button>
                    <button
                      onClick={() => setTextItalic(!textItalic)}
                      className={`px-2 py-0.5 rounded italic font-serif border transition ${
                        textItalic ? 'bg-sky-100 text-sky-800 border-sky-300' : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      I
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-500 text-[11px]">Color:</span>
                    {['#0f172a', '#2563eb', '#dc2626', '#16a34a', '#d97706'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setTextColor(c)}
                        className={`size-4 rounded-full border transition ${
                          textColor === c ? 'ring-2 ring-sky-500 ring-offset-1' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>

                  <div className="text-[11px] text-sky-600 font-semibold bg-sky-50 px-2 py-0.5 rounded border border-sky-200/60">
                    💡 Click existing text on page to edit in-place!
                  </div>
                </>
              )}

              {/* Pen options */}
              {activeTool === 'pen' && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-500 text-[11px]">Pen Color:</span>
                    {['#2563eb', '#0f172a', '#dc2626', '#16a34a', '#9333ea', '#ea580c'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setPenColor(c)}
                        className={`size-4 rounded-full border transition ${
                          penColor === c ? 'ring-2 ring-indigo-500 ring-offset-1' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-500 text-[11px]">Thickness:</span>
                    {[
                      { label: 'Fine', w: 1.5 },
                      { label: 'Medium', w: 3 },
                      { label: 'Thick', w: 6 }
                    ].map((th) => (
                      <button
                        key={th.label}
                        onClick={() => setPenWidth(th.w)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                          penWidth === th.w ? 'bg-white shadow-2xs font-bold text-indigo-700' : 'text-slate-600'
                        }`}
                      >
                        {th.label}
                      </button>
                    ))}
                  </div>

                  <div className="text-[11px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60">
                    ✏️ Drag mouse on page to draw freehand vectors
                  </div>
                </>
              )}

              {/* Highlight options */}
              {activeTool === 'highlight' && (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-500 text-[11px]">Highlighter Color:</span>
                  {['#fde047', '#86efac', '#67e8f9', '#f472b6', '#fed7aa'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setHighlightColor(c)}
                      className={`size-4 rounded-full border transition ${
                        highlightColor === c ? 'ring-2 ring-amber-500 ring-offset-1' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              )}

              {/* Shape options */}
              {['rectangle', 'circle', 'line', 'arrow'].includes(activeTool) && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-500 text-[11px]">Outline:</span>
                    {['#0284c7', '#0f172a', '#dc2626', '#16a34a'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setShapeStrokeColor(c)}
                        className={`size-4 rounded-full border transition ${
                          shapeStrokeColor === c ? 'ring-2 ring-sky-500 ring-offset-1' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-500 text-[11px]">Width:</span>
                    {[1, 2, 4].map((w) => (
                      <button
                        key={w}
                        onClick={() => setShapeStrokeWidth(w)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                          shapeStrokeWidth === w ? 'bg-white shadow-2xs font-bold text-sky-700' : 'text-slate-600'
                        }`}
                      >
                        {w}px
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTool === 'select' && (
                <span className="text-[11px] text-slate-400">
                  Click any text, drawing, or signature on the document to select, edit, move, or resize.
                </span>
              )}
            </div>

            {/* Document Zoom Controls */}
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setScale((s) => Math.max(0.75, s - 0.15))}
                className="p-1 hover:bg-slate-100 rounded text-slate-600"
                title="Zoom Out"
              >
                <ZoomOut className="size-3.5" />
              </button>
              <span className="text-[11px] font-mono font-bold text-slate-700 px-1">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
                className="p-1 hover:bg-slate-100 rounded text-slate-600"
                title="Zoom In"
              >
                <ZoomIn className="size-3.5" />
              </button>
              <button
                onClick={() => setScale(1.25)}
                className="p-1 hover:bg-slate-100 rounded text-slate-500 ml-1"
                title="Reset Zoom"
              >
                <Maximize2 className="size-3" />
              </button>
            </div>
          </div>

          {/* 3. MAIN WORK AREA (SIDEBAR + PDF CANVAS) */}
          <div className="flex-1 flex overflow-hidden">
            {/* LEFT THUMBNAIL SIDEBAR */}
            {showSidebar && (
              <div className="w-56 bg-slate-50/80 border-r border-slate-200/90 flex flex-col shrink-0">
                <div className="p-3 border-b border-slate-200/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Pages ({totalPages})</span>
                  <button
                    onClick={handleAddBlankPage}
                    className="p-1 text-slate-600 hover:text-sky-600 hover:bg-white rounded-lg transition"
                    title="Insert Blank Page"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
                  {Array.from({ length: totalPages }, (_, idx) => {
                    const pNum = idx + 1;
                    const isCurrent = currentPage === pNum;
                    const thumbUrl = sidebarThumbnails[pNum];

                    return (
                      <div
                        key={pNum}
                        onClick={() => setCurrentPage(pNum)}
                        className={`group relative rounded-xl border-2 p-1.5 transition cursor-pointer flex flex-col items-center ${
                          isCurrent
                            ? 'border-sky-500 bg-sky-50/40 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="w-full bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center min-h-[140px] shadow-2xs">
                          {thumbUrl ? (
                            <img src={thumbUrl} alt={`Page ${pNum}`} className="w-full h-auto object-contain" />
                          ) : (
                            <span className="text-xs font-mono text-slate-400">Page {pNum}</span>
                          )}
                        </div>

                        {/* Page Number & Hover Actions */}
                        <div className="w-full mt-1.5 flex items-center justify-between px-1">
                          <span
                            className={`text-[11px] font-bold ${
                              isCurrent ? 'text-sky-700' : 'text-slate-500'
                            }`}
                          >
                            Page {pNum}
                          </span>

                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRotatePage(idx);
                              }}
                              className="p-1 hover:bg-slate-200 rounded text-slate-600"
                              title="Rotate Page"
                            >
                              <RotateCw className="size-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicatePage(idx);
                              }}
                              className="p-1 hover:bg-slate-200 rounded text-slate-600"
                              title="Duplicate Page"
                            >
                              <Copy className="size-3" />
                            </button>
                            {totalPages > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePage(idx);
                                }}
                                className="p-1 hover:bg-rose-100 text-rose-600 rounded"
                                title="Delete Page"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CENTER DOCUMENT VIEWPORT */}
            <div className="flex-1 bg-[#F1F5F9] overflow-auto custom-scrollbar flex flex-col items-center p-6 relative">
              {/* Page Navigator Bottom Floating Bar */}
              <div className="fixed bottom-12 z-30 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg px-4 py-2 flex items-center gap-3">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 rounded-lg"
                >
                  <ChevronLeft className="size-4" />
                </button>

                <span className="text-xs font-bold text-slate-800">
                  Page {currentPage} / {totalPages}
                </span>

                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 rounded-lg"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              {/* Document Canvas Container */}
              <div className="relative shadow-xl bg-white border border-slate-200/80 rounded-sm">
                <canvas ref={pageCanvasRef} className="block pointer-events-none" />

                {/* Detected Text Layer for In-Place Editing */}
                {activeTool === 'text' && (
                  <div className="absolute inset-0 pointer-events-none">
                    {detectedTextItems.map((item, i) => (
                      <div
                        key={i}
                        onClick={(e) => handleDetectedTextClick(item, e)}
                        className="absolute pointer-events-auto cursor-text border border-dashed border-sky-400/50 hover:border-sky-600 hover:bg-sky-500/10 rounded transition"
                        style={{
                          left: `${item.x}px`,
                          top: `${item.y}px`,
                          width: `${item.width}px`,
                          height: `${item.height}px`
                        }}
                        title={`Click to edit: "${item.str}"`}
                      />
                    ))}
                  </div>
                )}

                {/* Freehand Live Drawing SVG Layer */}
                <svg
                  className="absolute inset-0 pointer-events-none"
                  style={{ width: '100%', height: '100%' }}
                >
                  {/* Committed Freehand Annotations */}
                  {currentAnnotations
                    .filter((a): a is FreehandAnnotation => a.type === 'freehand')
                    .map((fa) => (
                      <path
                        key={fa.id}
                        d={fa.points.map((p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')}
                        fill="none"
                        stroke={fa.color}
                        strokeWidth={fa.strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={selectedAnnId === fa.id ? 'filter drop-shadow-md' : ''}
                      />
                    ))}

                  {/* Active Freehand In-Progress Stroke */}
                  {isDrawingPen && currentPenPoints.length > 1 && (
                    <path
                      d={currentPenPoints
                        .map((p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
                        .join(' ')}
                      fill="none"
                      stroke={penColor}
                      strokeWidth={penWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>

                {/* Interactive Annotations Overlay */}
                <div
                  ref={overlayRef}
                  onClick={handleOverlayClick}
                  onMouseDown={handlePenMouseDown}
                  onMouseMove={handleOverlayMouseMove}
                  onMouseUp={handleOverlayMouseUp}
                  className={`absolute inset-0 ${
                    activeTool === 'pen'
                      ? 'cursor-crosshair'
                      : activeTool === 'text'
                      ? 'cursor-text'
                      : activeTool === 'select'
                      ? 'cursor-default'
                      : 'cursor-crosshair'
                  }`}
                >
                  {currentAnnotations.map((ann) => {
                    const isSelected = selectedAnnId === ann.id;

                    // 1. Text Annotation
                    if (ann.type === 'text') {
                      return (
                        <div
                          key={ann.id}
                          onMouseDown={(e) => handleAnnMouseDown(e, ann.id)}
                          style={{
                            left: `${ann.x}px`,
                            top: `${ann.y}px`,
                            fontSize: `${ann.fontSize}px`,
                            color: ann.color,
                            fontFamily: ann.fontFamily === 'Times' ? 'serif' : ann.fontFamily === 'Courier' ? 'monospace' : 'sans-serif',
                            fontWeight: ann.isBold ? 'bold' : 'normal',
                            fontStyle: ann.isItalic ? 'italic' : 'normal',
                            backgroundColor: ann.backgroundColor || 'transparent'
                          }}
                          className={`absolute select-none p-1 rounded transition group ${
                            isSelected
                              ? 'ring-2 ring-sky-500 shadow-md bg-white/95'
                              : 'hover:ring-1 hover:ring-sky-300'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute -top-9 left-0 flex items-center gap-1 bg-slate-900 text-white rounded-lg p-1 shadow-md z-20">
                              <button
                                onClick={() => duplicateAnnotation(ann.id)}
                                className="p-1 hover:bg-slate-800 rounded"
                                title="Duplicate"
                              >
                                <Copy className="size-3" />
                              </button>
                              <button
                                onClick={() => deleteAnnotation(ann.id)}
                                className="p-1 hover:bg-rose-700 text-rose-300 rounded"
                                title="Delete"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          )}

                          <input
                            type="text"
                            value={ann.text}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAnnotations((prev) =>
                                prev.map((a) => (a.id === ann.id ? { ...a, text: val } : a))
                              );
                            }}
                            className="bg-transparent outline-none min-w-[60px]"
                            style={{
                              color: ann.color,
                              fontSize: `${ann.fontSize}px`,
                              fontWeight: ann.isBold ? 'bold' : 'normal',
                              fontStyle: ann.isItalic ? 'italic' : 'normal'
                            }}
                          />
                        </div>
                      );
                    }

                    // 2. Whiteout Annotation
                    if (ann.type === 'whiteout') {
                      return (
                        <div
                          key={ann.id}
                          onMouseDown={(e) => handleAnnMouseDown(e, ann.id)}
                          style={{
                            left: `${ann.x}px`,
                            top: `${ann.y}px`,
                            width: `${ann.width}px`,
                            height: `${ann.height}px`,
                            backgroundColor: ann.color
                          }}
                          className={`absolute rounded-xs shadow-xs ${
                            isSelected ? 'ring-2 ring-rose-500 shadow-md' : 'border border-dashed border-slate-300'
                          }`}
                        >
                          {isSelected && (
                            <>
                              <div className="absolute -top-8 left-0 flex items-center gap-1 bg-slate-900 text-white rounded-lg p-1 shadow-md z-20">
                                <button
                                  onClick={() => deleteAnnotation(ann.id)}
                                  className="p-1 hover:bg-rose-700 text-rose-300 rounded"
                                  title="Delete"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                              <div
                                onMouseDown={(e) => handleResizeHandleMouseDown(e, ann.id, ann.width, ann.height)}
                                className="absolute -bottom-1.5 -right-1.5 size-3 bg-rose-500 rounded-full cursor-se-resize shadow"
                              />
                            </>
                          )}
                        </div>
                      );
                    }

                    // 3. Highlight Annotation
                    if (ann.type === 'highlight') {
                      return (
                        <div
                          key={ann.id}
                          onMouseDown={(e) => handleAnnMouseDown(e, ann.id)}
                          style={{
                            left: `${ann.x}px`,
                            top: `${ann.y}px`,
                            width: `${ann.width}px`,
                            height: `${ann.height}px`,
                            backgroundColor: ann.color,
                            opacity: ann.opacity
                          }}
                          className={`absolute rounded transition ${
                            isSelected ? 'ring-2 ring-amber-500' : ''
                          }`}
                        >
                          {isSelected && (
                            <>
                              <div className="absolute -top-8 left-0 flex items-center gap-1 bg-slate-900 text-white rounded-lg p-1 shadow-md z-20">
                                <button
                                  onClick={() => deleteAnnotation(ann.id)}
                                  className="p-1 hover:bg-rose-700 text-rose-300 rounded"
                                  title="Delete"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                              <div
                                onMouseDown={(e) => handleResizeHandleMouseDown(e, ann.id, ann.width, ann.height)}
                                className="absolute -bottom-1.5 -right-1.5 size-3 bg-amber-500 rounded-full cursor-se-resize shadow"
                              />
                            </>
                          )}
                        </div>
                      );
                    }

                    // 4. Shape Annotation (Rectangle, Circle, Line, Arrow)
                    if (ann.type === 'rectangle' || ann.type === 'circle' || ann.type === 'line' || ann.type === 'arrow') {
                      return (
                        <div
                          key={ann.id}
                          onMouseDown={(e) => handleAnnMouseDown(e, ann.id)}
                          style={{
                            left: `${ann.x}px`,
                            top: `${ann.y}px`,
                            width: `${ann.width}px`,
                            height: `${Math.max(4, ann.height)}px`
                          }}
                          className={`absolute ${isSelected ? 'ring-2 ring-sky-500' : ''}`}
                        >
                          <svg className="w-full h-full overflow-visible pointer-events-none">
                            {ann.type === 'rectangle' && (
                              <rect
                                x={0}
                                y={0}
                                width={ann.width}
                                height={ann.height}
                                stroke={ann.strokeColor}
                                strokeWidth={ann.strokeWidth}
                                fill={ann.fillColor || 'transparent'}
                              />
                            )}
                            {ann.type === 'circle' && (
                              <ellipse
                                cx={ann.width / 2}
                                cy={ann.height / 2}
                                rx={ann.width / 2}
                                ry={ann.height / 2}
                                stroke={ann.strokeColor}
                                strokeWidth={ann.strokeWidth}
                                fill={ann.fillColor || 'transparent'}
                              />
                            )}
                            {(ann.type === 'line' || ann.type === 'arrow') && (
                              <line
                                x1={0}
                                y1={0}
                                x2={ann.width}
                                y2={ann.height}
                                stroke={ann.strokeColor}
                                strokeWidth={ann.strokeWidth}
                              />
                            )}
                          </svg>

                          {isSelected && (
                            <>
                              <div className="absolute -top-8 left-0 flex items-center gap-1 bg-slate-900 text-white rounded-lg p-1 shadow-md z-20">
                                <button
                                  onClick={() => duplicateAnnotation(ann.id)}
                                  className="p-1 hover:bg-slate-800 rounded"
                                  title="Duplicate"
                                >
                                  <Copy className="size-3" />
                                </button>
                                <button
                                  onClick={() => deleteAnnotation(ann.id)}
                                  className="p-1 hover:bg-rose-700 text-rose-300 rounded"
                                  title="Delete"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                              <div
                                onMouseDown={(e) => handleResizeHandleMouseDown(e, ann.id, ann.width, ann.height)}
                                className="absolute -bottom-1.5 -right-1.5 size-3 bg-sky-500 rounded-full cursor-se-resize shadow"
                              />
                            </>
                          )}
                        </div>
                      );
                    }

                    // 5. Stamp Annotation (Check, Cross, Star)
                    if (ann.type === 'stamp') {
                      return (
                        <div
                          key={ann.id}
                          onMouseDown={(e) => handleAnnMouseDown(e, ann.id)}
                          style={{
                            left: `${ann.x}px`,
                            top: `${ann.y}px`
                          }}
                          className={`absolute p-1 rounded cursor-move transition ${
                            isSelected ? 'ring-2 ring-emerald-500 shadow-md bg-white' : ''
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute -top-8 left-0 flex items-center gap-1 bg-slate-900 text-white rounded-lg p-1 shadow-md z-20">
                              <button
                                onClick={() => deleteAnnotation(ann.id)}
                                className="p-1 hover:bg-rose-700 text-rose-300 rounded"
                                title="Delete"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          )}

                          {ann.stampType === 'check' && <Check className="size-7 text-emerald-600 stroke-[3]" />}
                          {ann.stampType === 'cross' && <X className="size-7 text-rose-600 stroke-[3]" />}
                          {ann.stampType === 'star' && <Star className="size-7 text-amber-500 fill-amber-400" />}
                        </div>
                      );
                    }

                    // 6. Signature & Image Annotation
                    if (ann.type === 'signature' || ann.type === 'image') {
                      return (
                        <div
                          key={ann.id}
                          onMouseDown={(e) => handleAnnMouseDown(e, ann.id)}
                          style={{
                            left: `${ann.x}px`,
                            top: `${ann.y}px`,
                            width: `${ann.width}px`,
                            height: `${ann.height}px`
                          }}
                          className={`absolute rounded transition cursor-move ${
                            isSelected ? 'ring-2 ring-purple-500 shadow-lg' : 'hover:ring-1 hover:ring-purple-300'
                          }`}
                        >
                          <img
                            src={ann.imageDataUrl}
                            alt="Annotation"
                            className="w-full h-full object-contain pointer-events-none select-none"
                          />

                          {isSelected && (
                            <>
                              <div className="absolute -top-8 left-0 flex items-center gap-1 bg-slate-900 text-white rounded-lg p-1 shadow-md z-20">
                                <button
                                  onClick={() => duplicateAnnotation(ann.id)}
                                  className="p-1 hover:bg-slate-800 rounded"
                                  title="Duplicate"
                                >
                                  <Copy className="size-3" />
                                </button>
                                <button
                                  onClick={() => deleteAnnotation(ann.id)}
                                  className="p-1 hover:bg-rose-700 text-rose-300 rounded"
                                  title="Delete"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                              <div
                                onMouseDown={(e) => handleResizeHandleMouseDown(e, ann.id, ann.width, ann.height)}
                                className="absolute -bottom-1.5 -right-1.5 size-3 bg-purple-600 rounded-full cursor-se-resize shadow"
                              />
                            </>
                          )}
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SIGNATURE MODAL                                                    */}
      {/* ------------------------------------------------------------------ */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/90 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">Add Digital Signature</h3>
              <button
                onClick={() => setShowSignModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Signature Tabs */}
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-2xl">
              {[
                { id: 'draw', label: 'Draw with Pen' },
                { id: 'type', label: 'Type Name' },
                { id: 'upload', label: 'Upload PNG' }
              ].map((tb) => (
                <button
                  key={tb.id}
                  onClick={() => setSignTab(tb.id as any)}
                  className={`py-1.5 text-xs font-bold rounded-xl transition ${
                    signTab === tb.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tb.label}
                </button>
              ))}
            </div>

            {/* Draw Tab */}
            {signTab === 'draw' && (
              <div className="space-y-3">
                <div className="border border-slate-200 rounded-2xl p-2 bg-slate-50 flex flex-col items-center">
                  <canvas
                    ref={signCanvasRef}
                    width={440}
                    height={160}
                    onMouseDown={startDrawSign}
                    onMouseMove={drawSignMove}
                    onMouseUp={endDrawSign}
                    onMouseLeave={endDrawSign}
                    className="bg-white rounded-xl cursor-crosshair border border-slate-200 shadow-2xs"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-500">Ink Color:</span>
                    {['#000000', '#1e3a8a', '#1e293b'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setSignatureColor(c)}
                        className={`size-5 rounded-full border ${
                          signatureColor === c ? 'ring-2 ring-purple-500 ring-offset-1' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={clearSignCanvas}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                  >
                    Clear Ink
                  </button>
                </div>
              </div>
            )}

            {/* Type Tab */}
            {signTab === 'type' && (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Type your full name..."
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />

                <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50 text-center min-h-[110px] flex items-center justify-center">
                  <span
                    className="text-3xl"
                    style={{
                      fontFamily: '"Brush Script MT", cursive, serif',
                      color: signatureColor
                    }}
                  >
                    {typedName || 'Your Signature Preview'}
                  </span>
                </div>
              </div>
            )}

            {/* Upload Tab */}
            {signTab === 'upload' && (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
                <UploadCloud className="size-8 text-purple-600 mb-2" />
                <span className="text-xs font-bold text-slate-700 block">Upload Signature Image</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Transparent PNG recommended</span>
                <label className="mt-4 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition">
                  Select Image
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleUploadSignatureFile}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSignModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              {signTab !== 'upload' && (
                <button
                  onClick={handleApplySignature}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  Insert Signature
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* PDF PREVIEW MODAL                                                  */}
      {/* ------------------------------------------------------------------ */}
      {previewPdf && (
        <PdfPreviewModal
          pdfBytes={previewPdf.bytes}
          filename={previewPdf.name}
          onClose={() => setPreviewPdf(null)}
        />
      )}
    </div>
  );
};
