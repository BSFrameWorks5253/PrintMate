import React, { useState, useRef, useEffect } from 'react';
import { 
  Printer, 
  Trash2, 
  Plus, 
  Scissors, 
  Download, 
  Layers, 
  FileSpreadsheet, 
  Copy, 
  ZoomIn, 
  ZoomOut, 
  Sliders, 
  Upload,
  RotateCw,
  Clock,
  Check,
  Grid2X2,
  Rows2,
  Columns2,
  LayoutGrid,
  Maximize2,
  FileText,
  CreditCard,
  Sparkles,
  Eye
} from 'lucide-react';
import type { 
  PrintQueueItem, 
  PrintSettings, 
  PrintLayoutType,
  PageSizeId
} from '../../types';
import { PAGE_SIZES, PRINT_LAYOUT_OPTIONS } from '../../utils/constants';
import { analytics } from '../../services/analyticsService';
import { isElectronApp, exportElectronPdf, printWithElectron } from '../../services/desktopService';
import './PrintStudio.css';

interface PrintStudioViewProps {
  queue: PrintQueueItem[];
  onAddItem?: (item: Omit<PrintQueueItem, 'id' | 'createdAt'>) => void;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
  onDuplicateItem: (id: string) => void;
  onRotateItem?: (id: string) => void;
  onUpdateItemCopies?: (id: string, delta: number) => void;
  onNavigateToScanner: () => void;
  onOpenRecents?: () => void;
}

export const PrintStudioView: React.FC<PrintStudioViewProps> = ({
  queue,
  onAddItem,
  onRemoveItem,
  onClearQueue,
  onDuplicateItem,
  onRotateItem,
  onUpdateItemCopies,
  onNavigateToScanner,
  onOpenRecents,
}) => {
  const [settings, setSettings] = useState<PrintSettings>({
    pageSize: 'a4',
    orientation: 'portrait',
    layout: '2_vertical',
    showCutLines: false, // Default: clean preview without clutter
    printCutMarks: false, // Default: zero marks on printed paper! Pure clean image
    scaleMode: 'exact_id',
    marginMm: 12,
    spacingMm: 8,
    copies: 1,
    alignment: 'top_center',
    customCols: 2,
    customRows: 2,
    duplexActivePage: 1,
  });

  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [slotOverrides, setSlotOverrides] = useState<Record<number, string>>({});
  const [activeSlotModal, setActiveSlotModal] = useState<number | null>(null);
  const [activePreviewSheet, setActivePreviewSheet] = useState<number>(0);
  const [layoutCategory, setLayoutCategory] = useState<'id_duo' | 'multi' | 'single' | 'all'>('id_duo');
  const [sidebarTab, setSidebarTab] = useState<'layout' | 'spacing' | 'queue'>('layout');

  const filteredLayouts = PRINT_LAYOUT_OPTIONS.filter((l) => {
    if (layoutCategory === 'all') return true;
    if (layoutCategory === 'id_duo') return l.category === 'id_duo' || l.category === 'id_special';
    if (layoutCategory === 'multi') return l.category === 'multi';
    if (layoutCategory === 'single') return l.category === 'single';
    return true;
  });

  const getLayoutIcon = (id: string) => {
    switch (id) {
      case '2_vertical':
        return <Rows2 className="w-4 h-4 text-blue-600" />;
      case '2_horizontal':
        return <Columns2 className="w-4 h-4 text-indigo-600" />;
      case 'front_back_fold':
        return <Scissors className="w-4 h-4 text-emerald-600" />;
      case 'front_back_duplex':
        return <Printer className="w-4 h-4 text-purple-600" />;
      case '1_real_size':
        return <Maximize2 className="w-4 h-4 text-blue-600" />;
      case '1_fit':
        return <FileText className="w-4 h-4 text-slate-600" />;
      case '4_grid':
        return <Grid2X2 className="w-4 h-4 text-amber-600" />;
      case '6_grid':
      case '8_grid':
      case '9_grid':
        return <LayoutGrid className="w-4 h-4 text-teal-600" />;
      case 'custom_grid':
        return <Sliders className="w-4 h-4 text-pink-600" />;
      default:
        return <Layers className="w-4 h-4 text-blue-600" />;
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const printSheetRef = useRef<HTMLDivElement | null>(null);

  const renderCropTicks = () => {
    if (!settings.printCutMarks) return null;
    return (
      <>
        <div className="crop-tick crop-tick-tl" />
        <div className="crop-tick crop-tick-tr" />
        <div className="crop-tick crop-tick-bl" />
        <div className="crop-tick crop-tick-br" />
      </>
    );
  };

  const selectedPageDef = PAGE_SIZES.find((p) => p.id === settings.pageSize) || PAGE_SIZES[0];
  const isLandscape = settings.orientation === 'landscape';
  const pageWidthMm = isLandscape ? selectedPageDef.heightMm : selectedPageDef.widthMm;
  const pageHeightMm = isLandscape ? selectedPageDef.widthMm : selectedPageDef.heightMm;

  // Dynamic CSS @page size calculator adhering strictly to CSS Paged Media Module Level 3
  // This commands the browser/printer print dialog to preselect the exact matching paper tray & orientation!
  const getPrintPageSizeRule = (pageId: PageSizeId, orientation: 'portrait' | 'landscape') => {
    switch (pageId) {
      case 'a4':
        return `A4 ${orientation}`;
      case 'a3':
        return `A3 ${orientation}`;
      case 'letter':
        return `letter ${orientation}`;
      case 'legal':
        return `legal ${orientation}`;
      case '4x6':
        return orientation === 'landscape' ? '6in 4in' : '4in 6in';
      case '5x7':
        return orientation === 'landscape' ? '7in 5in' : '5in 7in';
      default:
        return orientation === 'landscape'
          ? `${Math.max(pageWidthMm, pageHeightMm)}mm ${Math.min(pageWidthMm, pageHeightMm)}mm`
          : `${Math.min(pageWidthMm, pageHeightMm)}mm ${Math.max(pageWidthMm, pageHeightMm)}mm`;
    }
  };

  const isElectron = isElectronApp();

  // Handle printing (Native hardware support in Electron, window.print fallback for web/PWA)
  const handlePrint = async () => {
    try {
      analytics.trackPrint({
        pageSize: settings.pageSize,
        itemCount: queue.length,
        page: 'print',
      });
    } catch (e) {
      console.warn('Analytics tracking failed', e);
    }

    if (isElectron) {
      await printWithElectron({
        landscape: settings.orientation === 'landscape',
        pageSize: settings.pageSize === 'letter' ? 'Letter' : settings.pageSize === 'legal' ? 'Legal' : 'A4',
      });
    } else {
      window.print();
    }
  };

  const handlePrintRef = useRef(handlePrint);
  useEffect(() => {
    handlePrintRef.current = handlePrint;
  });

  // Keyboard shortcut Ctrl+P / Cmd+P to invoke print
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

  // Direct vector PDF export in Electron
  const handleExportPdf = async () => {
    const filename = `PrintMate_Sheet_${Date.now()}.pdf`;
    await exportElectronPdf(filename, settings.orientation === 'landscape');
  };

  // Direct file upload into print queue
  const handleDirectFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !onAddItem) return;

    Array.from(files).forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onAddItem({
            dataUrl: event.target.result as string,
            name: file.name.replace(/\.[^/.]+$/, ''),
            docType: 'id_standard',
            cardSide: idx === 0 ? 'front' : (idx === 1 ? 'back' : 'single'),
            aspectRatio: 85.6 / 53.98,
          });
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // Determine slot count for selected layout
  const getSlotCount = (layout: PrintLayoutType): number => {
    switch (layout) {
      case '1_fit':
      case '1_real_size':
        return 1;
      case '2_vertical':
      case '2_horizontal':
      case 'front_back_duplex':
      case 'front_back_fold':
        return 2;
      case '3_vertical':
      case '3_triad':
        return 3;
      case '4_grid':
        return 4;
      case '6_grid':
        return 6;
      case '8_grid':
        return 8;
      case '9_grid':
        return 9;
      case 'custom_grid':
        return settings.customCols * settings.customRows;
      default:
        return 2;
    }
  };

  const slotCount = getSlotCount(settings.layout);

  // Helper to get grid dimensions (cols and rows) adapting to page orientation
  const getGridDimensions = (layout: PrintLayoutType, landscape: boolean): { cols: number; rows: number } => {
    switch (layout) {
      case '1_fit':
      case '1_real_size':
      case 'front_back_duplex':
        return { cols: 1, rows: 1 };
      case '2_vertical':
        return { cols: 1, rows: 2 };
      case '2_horizontal':
      case 'front_back_fold':
        return { cols: 2, rows: 1 };
      case '3_vertical':
        return { cols: 1, rows: 3 };
      case '3_triad':
        return { cols: 2, rows: 2 };
      case '4_grid':
        return { cols: 2, rows: 2 };
      case '6_grid':
        return landscape ? { cols: 3, rows: 2 } : { cols: 2, rows: 3 };
      case '8_grid':
        return landscape ? { cols: 4, rows: 2 } : { cols: 2, rows: 4 };
      case '9_grid':
        return { cols: 3, rows: 3 };
      case 'custom_grid':
        return { cols: Math.max(1, settings.customCols), rows: Math.max(1, settings.customRows) };
      default:
        return { cols: 2, rows: 2 };
    }
  };

  // Generate expanded list of items based on per-item copies and global copies setting
  const getExpandedQueue = (): PrintQueueItem[] => {
    if (queue.length === 0) return [];
    const list: PrintQueueItem[] = [];
    for (let c = 0; c < settings.copies; c++) {
      queue.forEach((item) => {
        const itemCopies = item.copies || 1;
        for (let i = 0; i < itemCopies; i++) {
          list.push(item);
        }
      });
    }
    return list;
  };

  const expandedQueue = getExpandedQueue();

  // Helper to get image for a slot (supports multiple sheets via sheetOffset)
  const getImageForSlot = (slotIdx: number, sheetOffset: number = 0): PrintQueueItem | undefined => {
    const absoluteSlotIdx = sheetOffset + slotIdx;
    // Check manual override first
    if (slotOverrides[absoluteSlotIdx]) {
      const found = queue.find((q) => q.id === slotOverrides[absoluteSlotIdx]);
      if (found) return found;
    }

    if (absoluteSlotIdx < expandedQueue.length) {
      return expandedQueue[absoluteSlotIdx];
    }
    return undefined;
  };

  const totalSheets = settings.layout === 'front_back_duplex'
    ? 1
    : Math.max(1, Math.ceil(expandedQueue.length / slotCount));
  const currentSheetIndex = Math.min(activePreviewSheet, totalSheets - 1);

  // Download high-resolution sheet with ONLY the pure edited images
  const handleDownloadSheet = () => {
    try {
      analytics.trackDownload({
        type: `Clean Sheet Output (${settings.pageSize.toUpperCase()})`,
        page: 'print',
      });
    } catch (e) {
      console.warn('Analytics tracking failed', e);
    }
    const scale = 3.5;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(pageWidthMm * scale * 3.7795); // 1mm = ~3.7795px at 96dpi
    canvas.height = Math.round(pageHeightMm * scale * 3.7795);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Pure white sheet background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sheetOffset = currentSheetIndex * slotCount;
    const renderedSlots = Array.from({ length: slotCount }).map((_, i) => getImageForSlot(i, sheetOffset));
    
    const imagesToLoad = renderedSlots.map((item) => {
      if (!item) return Promise.resolve(null);
      return new Promise<HTMLImageElement | null>((res) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = item.dataUrl;
      });
    });

    Promise.all(imagesToLoad).then((loadedImgs) => {
      const cardWMm = 85.6;
      const cardHMm = 53.98;
      const pxPerMm = canvas.width / pageWidthMm;

      const drawCropCornerMarks = (x: number, y: number, w: number, h: number) => {
        if (!settings.printCutMarks) return;
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        const tick = 14;
        // top-left
        ctx.beginPath();
        ctx.moveTo(x - tick, y); ctx.lineTo(x, y);
        ctx.moveTo(x, y - tick); ctx.lineTo(x, y);
        // top-right
        ctx.moveTo(x + w, y); ctx.lineTo(x + w + tick, y);
        ctx.moveTo(x + w, y - tick); ctx.lineTo(x + w, y);
        // bottom-left
        ctx.moveTo(x - tick, y + h); ctx.lineTo(x, y + h);
        ctx.moveTo(x, y + h); ctx.lineTo(x, y + h + tick);
        // bottom-right
        ctx.moveTo(x + w, y + h); ctx.lineTo(x + w + tick, y + h);
        ctx.moveTo(x + w, y + h); ctx.lineTo(x + w, y + h + tick);
        ctx.stroke();
        ctx.restore();
      };

      if (settings.layout === '2_vertical') {
        const topY1 = canvas.height * 0.18;
        let currY = topY1;

        loadedImgs.forEach((img) => {
          if (!img) return;
          const isImgPortrait = img.naturalWidth < img.naturalHeight;
          const cardPxW = (isImgPortrait ? cardHMm : cardWMm) * pxPerMm;
          const cardPxH = (isImgPortrait ? cardWMm : cardHMm) * pxPerMm;
          const x = (canvas.width - cardPxW) / 2;
          ctx.drawImage(img, x, currY, cardPxW, cardPxH);
          drawCropCornerMarks(x, currY, cardPxW, cardPxH);
          currY += cardPxH + (settings.spacingMm * pxPerMm);
        });
      } else if (settings.layout === 'front_back_fold') {
        let totalW = 0;
        const dims = loadedImgs.map((img) => {
          if (!img) return { w: 0, h: 0 };
          const isImgPortrait = img.naturalWidth < img.naturalHeight;
          const w = (isImgPortrait ? cardHMm : cardWMm) * pxPerMm;
          const h = (isImgPortrait ? cardWMm : cardHMm) * pxPerMm;
          totalW += w;
          return { w, h };
        });
        let currX = (canvas.width - totalW) / 2;
        loadedImgs.forEach((img, idx) => {
          if (!img) return;
          const { w, h } = dims[idx];
          const y = (canvas.height - h) / 2;
          ctx.drawImage(img, currX, y, w, h);
          drawCropCornerMarks(currX, y, w, h);
          currX += w;
        });
      } else {
        const gridDim = getGridDimensions(settings.layout, isLandscape);
        const cols = gridDim.cols;
        const rows = gridDim.rows;
        const marginPx = settings.marginMm * pxPerMm;
        const spacingPx = settings.spacingMm * pxPerMm;

        const availW = canvas.width - (marginPx * 2) - (spacingPx * (cols - 1));
        const availH = canvas.height - (marginPx * 2) - (spacingPx * (rows - 1));
        const cellW = availW / cols;
        const cellH = availH / rows;

        loadedImgs.forEach((img, idx) => {
          if (!img) return;
          const c = idx % cols;
          const r = Math.floor(idx / cols);

          const isImgPortrait = img.naturalWidth < img.naturalHeight;
          const cardPxW = (isImgPortrait ? cardHMm : cardWMm) * pxPerMm;
          const cardPxH = (isImgPortrait ? cardWMm : cardHMm) * pxPerMm;

          const targetW = settings.scaleMode === 'exact_id' ? cardPxW : cellW;
          const targetH = settings.scaleMode === 'exact_id' ? cardPxH : (cellW / (img.naturalWidth / img.naturalHeight));
          
          const x = marginPx + c * (cellW + spacingPx) + (cellW - targetW) / 2;
          const y = marginPx + r * (cellH + spacingPx) + (cellH - targetH) / 2;
          ctx.drawImage(img, x, y, targetW, targetH);
          drawCropCornerMarks(x, y, targetW, targetH);
        });
      }

      const link = document.createElement('a');
      link.download = totalSheets > 1 
        ? `PrintMate_${settings.pageSize.toUpperCase()}_Sheet_${currentSheetIndex + 1}.jpg`
        : `PrintMate_${settings.pageSize.toUpperCase()}_Clean_Output.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.98);
      link.click();
      analytics.trackDownload({
        type: `Clean Sheet (${settings.pageSize.toUpperCase()})`,
        page: 'print',
      });
    });
  };

  // Download ALL sheets sequentially
  const handleDownloadAllSheets = async () => {
    const scale = 3.5;
    const pxPerMm = (Math.round(pageWidthMm * scale * 3.7795)) / pageWidthMm;

    for (let sheetIdx = 0; sheetIdx < totalSheets; sheetIdx++) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(pageWidthMm * scale * 3.7795);
      canvas.height = Math.round(pageHeightMm * scale * 3.7795);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const sheetOffset = sheetIdx * slotCount;
      const renderedSlots = Array.from({ length: slotCount }).map((_, i) => getImageForSlot(i, sheetOffset));

      const imagesToLoad = renderedSlots.map((item) => {
        if (!item) return Promise.resolve(null);
        return new Promise<HTMLImageElement | null>((res) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = () => res(null);
          img.src = item.dataUrl;
        });
      });

      const loadedImgs = await Promise.all(imagesToLoad);
      const cardWMm = 85.6;
      const cardHMm = 53.98;

      const drawCropCornerMarks = (x: number, y: number, w: number, h: number) => {
        if (!settings.printCutMarks) return;
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        const tick = 14;
        ctx.beginPath();
        ctx.moveTo(x - tick, y); ctx.lineTo(x, y);
        ctx.moveTo(x, y - tick); ctx.lineTo(x, y);
        ctx.moveTo(x + w, y); ctx.lineTo(x + w + tick, y);
        ctx.moveTo(x + w, y - tick); ctx.lineTo(x + w, y);
        ctx.moveTo(x - tick, y + h); ctx.lineTo(x, y + h);
        ctx.moveTo(x, y + h); ctx.lineTo(x, y + h + tick);
        ctx.moveTo(x + w, y + h); ctx.lineTo(x + w + tick, y + h);
        ctx.moveTo(x + w, y + h); ctx.lineTo(x + w, y + h + tick);
        ctx.stroke();
        ctx.restore();
      };

      if (settings.layout === '2_vertical') {
        const topY1 = canvas.height * 0.18;
        let currY = topY1;
        loadedImgs.forEach((img) => {
          if (!img) return;
          const isImgPortrait = img.naturalWidth < img.naturalHeight;
          const cardPxW = (isImgPortrait ? cardHMm : cardWMm) * pxPerMm;
          const cardPxH = (isImgPortrait ? cardWMm : cardHMm) * pxPerMm;
          const x = (canvas.width - cardPxW) / 2;
          ctx.drawImage(img, x, currY, cardPxW, cardPxH);
          drawCropCornerMarks(x, currY, cardPxW, cardPxH);
          currY += cardPxH + (settings.spacingMm * pxPerMm);
        });
      } else if (settings.layout === 'front_back_fold') {
        let totalW = 0;
        const dims = loadedImgs.map((img) => {
          if (!img) return { w: 0, h: 0 };
          const isImgPortrait = img.naturalWidth < img.naturalHeight;
          const w = (isImgPortrait ? cardHMm : cardWMm) * pxPerMm;
          const h = (isImgPortrait ? cardWMm : cardHMm) * pxPerMm;
          totalW += w;
          return { w, h };
        });
        let currX = (canvas.width - totalW) / 2;
        loadedImgs.forEach((img, idx) => {
          if (!img) return;
          const { w, h } = dims[idx];
          const y = (canvas.height - h) / 2;
          ctx.drawImage(img, currX, y, w, h);
          drawCropCornerMarks(currX, y, w, h);
          currX += w;
        });
      } else {
        const gridDim = getGridDimensions(settings.layout, isLandscape);
        const cols = gridDim.cols;
        const rows = gridDim.rows;
        const marginPx = settings.marginMm * pxPerMm;
        const spacingPx = settings.spacingMm * pxPerMm;
        const availW = canvas.width - (marginPx * 2) - (spacingPx * (cols - 1));
        const availH = canvas.height - (marginPx * 2) - (spacingPx * (rows - 1));
        const cellW = availW / cols;
        const cellH = availH / rows;

        loadedImgs.forEach((img, idx) => {
          if (!img) return;
          const c = idx % cols;
          const r = Math.floor(idx / cols);
          const cellX = marginPx + (c * (cellW + spacingPx));
          const cellY = marginPx + (r * (cellH + spacingPx));
          const isImgPortrait = img.naturalWidth < img.naturalHeight;
          let drawW = (isImgPortrait ? cardHMm : cardWMm) * pxPerMm;
          let drawH = (isImgPortrait ? cardWMm : cardHMm) * pxPerMm;

          if (drawW > cellW || drawH > cellH) {
            const rFit = Math.min(cellW / drawW, cellH / drawH);
            drawW *= rFit;
            drawH *= rFit;
          }
          const x = cellX + (cellW - drawW) / 2;
          const y = cellY + (cellH - drawH) / 2;
          ctx.drawImage(img, x, y, drawW, drawH);
          drawCropCornerMarks(x, y, drawW, drawH);
        });
      }

      const link = document.createElement('a');
      link.download = `PrintMate_${settings.pageSize.toUpperCase()}_Sheet_${sheetIdx + 1}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.98);
      link.click();

      if (sheetIdx < totalSheets - 1) {
        await new Promise((res) => setTimeout(res, 350));
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Hidden file input for adding image directly */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleDirectFileUpload}
        accept="image/*"
        multiple
        className="hidden"
        style={{ display: 'none' }}
      />

      {/* If queue is empty */}
      {queue.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center max-w-2xl mx-auto space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto border border-cyan-200 dark:border-cyan-800">
            <Printer className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Your Print Queue is Clean & Ready</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Scan and straighten your ID card (Front & Back), or upload images directly to configure multi-up layouts, copies, and back-and-forth prints.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onNavigateToScanner}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/30 inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Go to Scan & Edit</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 font-semibold text-sm border border-cyan-200 dark:border-cyan-800 inline-flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Image Directly</span>
            </button>
            {onOpenRecents && (
              <button
                type="button"
                onClick={onOpenRecents}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm border border-slate-200 dark:border-slate-700 inline-flex items-center gap-2 cursor-pointer"
              >
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Pick from Recents</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT CONTROLS: 4 Cols with 3 Organised Tabs */}
          <div className="no-print lg:col-span-4 space-y-3">
            {/* TAB SELECTOR HEADER */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-xs flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSidebarTab('layout')}
                className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'layout'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Layout</span>
              </button>

              <button
                type="button"
                onClick={() => setSidebarTab('spacing')}
                className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'spacing'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Spacing</span>
              </button>

              <button
                type="button"
                onClick={() => setSidebarTab('queue')}
                className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'queue'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Queue</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  sidebarTab === 'queue' ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                }`}>
                  {queue.length}
                </span>
              </button>
            </div>

            {/* TAB 1: PAGE & LAYOUT CONTROLS */}
            {sidebarTab === 'layout' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                {/* 1. QUICK SETUP PRESETS (Instant 1-Click Configuration) */}
                <div className="bg-gradient-to-br from-blue-50/70 via-indigo-50/50 to-white dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border border-blue-200/90 dark:border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Quick Presets</span>
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                      1-Click
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSettings((s) => ({
                          ...s,
                          layout: '2_vertical',
                          pageSize: 'a4',
                          orientation: 'portrait',
                          alignment: 'top_center',
                          scaleMode: 'exact_id',
                          marginMm: 10,
                          spacingMm: 5,
                        }));
                      }}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        settings.layout === '2_vertical' && settings.scaleMode === 'exact_id'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                          : 'bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          <span>ID Duo</span>
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                          settings.layout === '2_vertical' && settings.scaleMode === 'exact_id'
                            ? 'bg-white/20 text-white'
                            : 'bg-blue-50 text-blue-700'
                        }`}>
                          CR80
                        </span>
                      </div>
                      <span className={`text-[10px] leading-tight ${
                        settings.layout === '2_vertical' && settings.scaleMode === 'exact_id'
                          ? 'text-blue-100'
                          : 'text-slate-500'
                      }`}>
                        A4 Top-Stack (85.6×54mm)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSettings((s) => ({
                          ...s,
                          layout: '1_real_size',
                          pageSize: 'a4',
                          orientation: 'portrait',
                          alignment: 'center',
                          scaleMode: 'exact_id',
                          marginMm: 10,
                        }));
                      }}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        settings.layout === '1_real_size'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                          : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold flex items-center gap-1">
                          <Maximize2 className="w-3 h-3" />
                          <span>Single ID</span>
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                          settings.layout === '1_real_size'
                            ? 'bg-white/20 text-white'
                            : 'bg-blue-50 text-blue-700'
                        }`}>
                          100%
                        </span>
                      </div>
                      <span className={`text-[10px] leading-tight ${
                        settings.layout === '1_real_size'
                          ? 'text-blue-100'
                          : 'text-slate-500'
                      }`}>
                        Exact 85.60 × 53.98 mm
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSettings((s) => ({
                          ...s,
                          layout: 'front_back_fold',
                          pageSize: 'a4',
                          orientation: 'portrait',
                          alignment: 'top_center',
                          scaleMode: 'exact_id',
                          marginMm: 10,
                          spacingMm: 0,
                        }));
                      }}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        settings.layout === 'front_back_fold'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                          : 'bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold flex items-center gap-1">
                          <Scissors className="w-3 h-3" />
                          <span>Fold & Laminate</span>
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                          settings.layout === 'front_back_fold'
                            ? 'bg-white/20 text-white'
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          Pouch
                        </span>
                      </div>
                      <span className={`text-[10px] leading-tight ${
                        settings.layout === 'front_back_fold'
                          ? 'text-blue-100'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        Center fold line for pouch
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSettings((s) => ({
                          ...s,
                          layout: '1_fit',
                          pageSize: '4x6',
                          orientation: 'portrait',
                          alignment: 'center',
                          scaleMode: 'fit_cell',
                          marginMm: 5,
                        }));
                      }}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        settings.pageSize === '4x6' && settings.layout === '1_fit'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                          : 'bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold flex items-center gap-1">
                          <FileSpreadsheet className="w-3 h-3" />
                          <span>4 × 6" Photo</span>
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                          settings.pageSize === '4x6' && settings.layout === '1_fit'
                            ? 'bg-white/20 text-white'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        }`}>
                          Photo
                        </span>
                      </div>
                      <span className={`text-[10px] leading-tight ${
                        settings.pageSize === '4x6' && settings.layout === '1_fit'
                          ? 'text-blue-100'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        Glossy 4R sheet fit
                      </span>
                    </button>
                  </div>
                </div>

                {/* 2. PAPER SIZE, ORIENTATION & PHYSICAL SCALE */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Paper & Orientation</span>
                    </h4>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                      {pageWidthMm} × {pageHeightMm} mm
                    </span>
                  </div>

                  {/* Visual Paper Size Pills */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Select Paper:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {[
                        { id: 'a4', label: 'A4', desc: '210 × 297 mm' },
                        { id: '4x6', label: '4 × 6"', desc: '102 × 152 mm' },
                        { id: 'letter', label: 'US Letter', desc: '8.5 × 11 in' },
                        { id: '5x7', label: '5 × 7"', desc: '127 × 178 mm' },
                      ].map((p) => {
                        const isSelected = settings.pageSize === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSettings((s) => ({ ...s, pageSize: p.id as any }))}
                            className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold ring-1 ring-blue-500/20'
                                : 'bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            <div className="text-xs font-bold leading-tight">{p.label}</div>
                            <div className={`text-[9px] ${isSelected ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>{p.desc}</div>
                          </button>
                        );
                      })}
                    </div>

                    {/* More sizes selector */}
                    <div className="pt-1 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-500">Other Sizes:</span>
                      <select
                        value={settings.pageSize}
                        onChange={(e) => setSettings((s) => ({ ...s, pageSize: e.target.value as any }))}
                        className="bg-slate-50 border border-slate-200 text-xs font-semibold rounded-lg px-2 py-1 text-slate-800 focus:outline-none cursor-pointer"
                      >
                        {PAGE_SIZES.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Orientation & Placement Segmented Buttons */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-100">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Orientation:</label>
                      <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setSettings((s) => ({ ...s, orientation: 'portrait' }))}
                          className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                            settings.orientation === 'portrait'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          ▯ Portrait
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettings((s) => ({ ...s, orientation: 'landscape' }))}
                          className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                            settings.orientation === 'landscape'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          ▭ Landscape
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Placement:</label>
                      <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setSettings((s) => ({ ...s, alignment: 'top_center' }))}
                          className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                            settings.alignment === 'top_center'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Places cards at top, saving lower half of page for re-feeding"
                        >
                          ⬆️ Top (Save)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettings((s) => ({ ...s, alignment: 'center' }))}
                          className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                            settings.alignment === 'center'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🎯 Center
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 100% Real ID Scale Switch */}
                  <div 
                    onClick={() => setSettings((s) => ({ ...s, scaleMode: s.scaleMode === 'exact_id' ? 'fit_cell' : 'exact_id' }))}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      settings.scaleMode === 'exact_id'
                        ? 'bg-blue-50/80 border-blue-300 shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        settings.scaleMode === 'exact_id' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        🪪
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span>100% Real ID Scale (CR80)</span>
                          {settings.scaleMode === 'exact_id' && (
                            <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-bold">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Exact ISO 85.60 × 53.98 mm physical card dimensions
                        </div>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={settings.scaleMode === 'exact_id'}
                      onChange={() => {}} // handled by parent onClick
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* 3. MULTI-UP SHEET LAYOUTS */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Choose Sheet Layout</span>
                    </h4>
                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 rounded-full">
                      {PRINT_LAYOUT_OPTIONS.find((l) => l.id === settings.layout)?.name.split('(')[0].trim() || 'Selected'}
                    </span>
                  </div>

                  {/* Category Filter Tabs */}
                  <div className="grid grid-cols-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold gap-1">
                    {[
                      { id: 'id_duo', label: '🪪 ID Duo' },
                      { id: 'multi', label: '📑 Grids' },
                      { id: 'single', label: '📄 Single' },
                      { id: 'all', label: 'All (13)' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setLayoutCategory(cat.id as any)}
                        className={`py-1.5 px-1.5 rounded-lg text-center transition-all truncate cursor-pointer ${
                          layoutCategory === cat.id
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Layout Selection Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                    {filteredLayouts.map((layout) => {
                      const isSelected = settings.layout === layout.id;
                      return (
                        <button
                          key={layout.id}
                          type="button"
                          onClick={() => setSettings((prev) => ({ ...prev, layout: layout.id as PrintLayoutType }))}
                          className={`text-left p-2.5 rounded-xl transition-all border flex items-start gap-2.5 cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/90 dark:bg-blue-950/70 border-blue-600 text-slate-900 dark:text-white shadow-sm ring-2 ring-blue-500/20'
                              : 'bg-slate-50/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${
                            isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}>
                            {isSelected ? <Check className="w-4 h-4 text-white" /> : getLayoutIcon(layout.id)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-xs font-bold truncate ${isSelected ? 'text-blue-900 dark:text-blue-300' : 'text-slate-900 dark:text-white'}`}>
                                {layout.name.split('(')[0].trim()}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                                isSelected ? 'bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200' : 'bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                              }`}>
                                {layout.slots} slot{layout.slots === 1 ? '' : 's'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2">
                              {layout.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Duplex Preview Side Switcher if duplex layout is selected */}
                  {settings.layout === 'front_back_duplex' && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-xs animate-in fade-in">
                      <div className="space-y-0.5">
                        <span className="font-bold text-purple-950 flex items-center gap-1.5">
                          <Printer className="w-3.5 h-3.5 text-purple-600" />
                          <span>Duplex 2-Sided Preview</span>
                        </span>
                        <p className="text-[10px] text-purple-700">Preview front or back coordinate sheet</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSettings((s) => ({ ...s, duplexActivePage: 1 }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            settings.duplexActivePage === 1 
                              ? 'bg-purple-600 text-white shadow-sm' 
                              : 'bg-white border border-purple-200 text-purple-800 hover:bg-purple-100'
                          }`}
                        >
                          Page 1 (Front)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettings((s) => ({ ...s, duplexActivePage: 2 }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            settings.duplexActivePage === 2 
                              ? 'bg-purple-600 text-white shadow-sm' 
                              : 'bg-white border border-purple-200 text-purple-800 hover:bg-purple-100'
                          }`}
                        >
                          Page 2 (Back)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Fold & Laminate helper tip if active */}
                  {settings.layout === 'front_back_fold' && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-2 animate-in fade-in">
                      <Scissors className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Images aligned with center fold line for standard ID lamination pouches.</span>
                    </div>
                  )}

                  {/* Custom Grid Controls if custom_grid selected */}
                  {settings.layout === 'custom_grid' && (
                    <div className="p-3.5 bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-xl border border-blue-200 space-y-2.5 text-xs animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Grid2X2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>Custom Grid Matrix</span>
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                          {settings.customCols} × {settings.customRows} ({settings.customCols * settings.customRows} slots)
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-semibold">Columns:</span>
                          <div className="flex items-center gap-1.5">
                            {[1, 2, 3, 4].map((col) => (
                              <button
                                key={col}
                                type="button"
                                onClick={() => setSettings((s) => ({ ...s, customCols: col }))}
                                className={`w-7 h-7 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                                  settings.customCols === col 
                                    ? 'bg-blue-600 text-white shadow-xs' 
                                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {col}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-semibold">Rows:</span>
                          <div className="flex items-center gap-1.5">
                            {[1, 2, 3, 4].map((row) => (
                              <button
                                key={row}
                                type="button"
                                onClick={() => setSettings((s) => ({ ...s, customRows: row }))}
                                className={`w-7 h-7 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                                  settings.customRows === row 
                                    ? 'bg-blue-600 text-white shadow-xs' 
                                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {row}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: SPACING, COPIES & CUTTING MARKS */}
            {sidebarTab === 'spacing' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                {/* 1. COPIES CONTROLS */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <Copy className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Print Sheet Copies</span>
                    </h4>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                      {settings.copies} {settings.copies === 1 ? 'Sheet' : 'Sheets'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, copies: Math.max(1, s.copies - 1) }))}
                      className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-black flex items-center justify-center border border-slate-300 dark:border-slate-700 transition-all text-lg shadow-xs active:scale-95 cursor-pointer"
                      title="Decrease copies"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={settings.copies}
                      onChange={(e) => setSettings((s) => ({ ...s, copies: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className="w-16 h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, copies: s.copies + 1 }))}
                      className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-black flex items-center justify-center border border-slate-300 dark:border-slate-700 transition-all text-lg shadow-xs active:scale-95 cursor-pointer"
                      title="Increase copies"
                    >
                      +
                    </button>

                    <div className="flex items-center gap-1 ml-auto">
                      {[1, 2, 4, 8].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSettings((s) => ({ ...s, copies: c }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            settings.copies === c
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {c}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. MARGINS & GAP SLIDERS */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Page Margin (Outer Border):</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                        {settings.marginMm} mm
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {[5, 10, 15, 20].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSettings((s) => ({ ...s, marginMm: m }))}
                          className={`flex-1 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            settings.marginMm === m
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {m}mm
                        </button>
                      ))}
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      value={settings.marginMm}
                      onChange={(e) => setSettings((s) => ({ ...s, marginMm: Number(e.target.value) }))}
                      className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Card Gap (Between Items):</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                        {settings.spacingMm} mm
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {[
                        { val: 0, label: '0mm (Flush)' },
                        { val: 5, label: '5mm' },
                        { val: 10, label: '10mm' }
                      ].map((g) => (
                        <button
                          key={g.val}
                          type="button"
                          onClick={() => setSettings((s) => ({ ...s, spacingMm: g.val }))}
                          className={`flex-1 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            settings.spacingMm === g.val
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="25"
                      value={settings.spacingMm}
                      onChange={(e) => setSettings((s) => ({ ...s, spacingMm: Number(e.target.value) }))}
                      className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                </div>

                {/* 3. CUTTING & CROP MARKS (GUILLOTINE-READY) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-emerald-600" />
                      <span>Cutting & Crop Guides</span>
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Guillotine Ready
                    </span>
                  </div>

                  {/* Screen Cut Lines (Alignment Dashes) */}
                  <div 
                    onClick={() => setSettings((s) => ({ ...s, showCutLines: !s.showCutLines }))}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      settings.showCutLines
                        ? 'bg-blue-50/80 border-blue-300 shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        settings.showCutLines ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        <Eye className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span>Screen Cut Lines</span>
                          {settings.showCutLines && (
                            <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-bold">
                              Preview
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Dashed alignment guides on screen (never printed on paper)
                        </div>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={settings.showCutLines}
                      onChange={() => {}} // handled by parent onClick
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                  </div>

                  {/* Printable Hairline Corner Crop Marks */}
                  <div 
                    onClick={() => setSettings((s) => ({ ...s, printCutMarks: !s.printCutMarks }))}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      settings.printCutMarks
                        ? 'bg-emerald-50/80 border-emerald-300 shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        settings.printCutMarks ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        <Scissors className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span>Printable Corner Crop Marks</span>
                          {settings.printCutMarks && (
                            <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-bold">
                              Printed
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Sharp L-ticks at card corners for scissors & paper cutters
                        </div>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={settings.printCutMarks}
                      onChange={() => {}} // handled by parent onClick
                      className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: QUEUE ITEMS & ACTIONS */}
            {sidebarTab === 'queue' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Print Queue ({queue.length} item{queue.length !== 1 ? 's' : ''})</span>
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Produces {totalSheets} physical sheet{totalSheets !== 1 ? 's' : ''} at {settings.copies} copy
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onOpenRecents && (
                      <button
                        type="button"
                        onClick={onOpenRecents}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                        title="Load image from your recent documents"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Recents</span>
                      </button>
                    )}
                    <button
                      onClick={onClearQueue}
                      className="text-[11px] text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {queue.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-3 transition-colors"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={item.dataUrl}
                          alt={item.name}
                          className="w-14 h-9 object-cover rounded-lg bg-black border border-slate-300 dark:border-slate-700 shadow-2xs"
                        />
                        <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                            item.cardSide === 'front'
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                              : item.cardSide === 'back'
                              ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}>
                            {item.cardSide || 'single'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            CR80
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Individual Page/Card Count Stepper */}
                        <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg shadow-2xs px-1.5 py-0.5 gap-1 shrink-0" title="Copies of this particular page">
                          <button
                            type="button"
                            onClick={() => onUpdateItemCopies && onUpdateItemCopies(item.id, -1)}
                            disabled={(item.copies || 1) <= 1}
                            className="w-5 h-5 rounded flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-25 disabled:cursor-not-allowed text-xs font-bold transition-all cursor-pointer"
                            title="Decrease copies"
                          >
                            -
                          </button>
                          <span className="text-xs font-black text-blue-700 dark:text-blue-400 min-w-3 text-center">
                            {item.copies || 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateItemCopies && onUpdateItemCopies(item.id, 1)}
                            className="w-5 h-5 rounded flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition-all cursor-pointer"
                            title="Increase copies"
                          >
                            +
                          </button>
                        </div>

                        {onRotateItem && (
                          <button
                            onClick={() => onRotateItem(item.id)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
                            title="Rotate 90° CW"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onDuplicateItem(item.id)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-all cursor-pointer"
                          title="Duplicate in Queue"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onRemoveItem(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                          title="Remove from Queue"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                  </button>
                  <button
                    onClick={onNavigateToScanner}
                    className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-300" />
                    <span>Scan & Edit More</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: PAPER CANVAS PREVIEW & PRINT ACTION: 8 Cols */}
          <div className="lg:col-span-8 space-y-4">
            {/* Top Toolbar */}
            <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Print Sheet Preview
                  </h3>
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 rounded-full">
                    {selectedPageDef.name.split('(')[0]} • {pageWidthMm} × {pageHeightMm} mm
                  </span>
                  {settings.scaleMode === 'exact_id' && (
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <span>✓ 100% Real ID (CR80)</span>
                    </span>
                  )}
                  {settings.printCutMarks ? (
                    <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 px-2.5 py-0.5 rounded-full">
                      Crop Marks: ON
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full">
                      Clean Output
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {settings.printCutMarks ? 'Hairline corner ticks will be printed on physical paper for cutters' : 'Zero guides or marks on paper • 100% clean images only'}
                </p>
              </div>

              {/* Actions & Zoom Controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom((z) => Math.max(50, z - 15))}
                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    title="Zoom Out Preview"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono px-2 text-slate-800 dark:text-slate-200 font-bold">{previewZoom}%</span>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom((z) => Math.min(150, z + 15))}
                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    title="Zoom In Preview"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={handleDownloadSheet}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Download clean printable high-res image of the currently previewed sheet"
                >
                  <Download className="w-4 h-4" />
                  <span>{totalSheets > 1 ? `Sheet ${currentSheetIndex + 1}` : 'Download'}</span>
                </button>

                {totalSheets > 1 && (
                  <button
                    onClick={handleDownloadAllSheets}
                    className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    title="Download all sheets at once"
                  >
                    <Download className="w-4 h-4 text-blue-600" />
                    <span>All ({totalSheets})</span>
                  </button>
                )}

                {isElectron && (
                  <button
                    onClick={handleExportPdf}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                    title="Export high-resolution vector PDF to file"
                  >
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span>Save PDF</span>
                  </button>
                )}

                <button
                  onClick={handlePrint}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all transform active:scale-98 cursor-pointer"
                  title="Print clean paper page (Ctrl+P)"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Page</span>
                  <kbd className="hidden sm:inline-block text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded border border-white/25">
                    Ctrl+P
                  </kbd>
                </button>
              </div>
            </div>

            {/* MULTI-SHEET NAVIGATION TOOLBAR (When queue has multiple sheets) */}
            {totalSheets > 1 && (
              <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Sheet {currentSheetIndex + 1} of {totalSheets}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-medium">
                    ({expandedQueue.length} card{expandedQueue.length !== 1 ? 's' : ''} total)
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActivePreviewSheet((p) => Math.max(0, p - 1))}
                    disabled={currentSheetIndex === 0}
                    className="px-2.5 py-1 text-xs rounded-lg font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    Previous
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalSheets }).map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActivePreviewSheet(idx)}
                        className={`w-7 h-7 text-xs rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center ${
                          idx === currentSheetIndex
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActivePreviewSheet((p) => Math.min(totalSheets - 1, p + 1))}
                    disabled={currentSheetIndex >= totalSheets - 1}
                    className="px-2.5 py-1 text-xs rounded-lg font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    Next
                  </button>
                </div>

                <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-medium">
                  ✓ All {totalSheets} sheets will be printed automatically
                </div>
              </div>
            )}

            {/* PHYSICAL PAPER SHEET PREVIEW (Zoomable / Scaled to fit container) */}
            <div className="print-page-wrapper bg-slate-100 p-4 sm:p-8 rounded-2xl border border-slate-200 flex flex-col justify-center items-center overflow-auto min-h-[580px]">
              {/* Dynamic print-media page size injection */}
              <style>{`
                @media print {
                  @page {
                    size: ${getPrintPageSizeRule(selectedPageDef.id, settings.orientation)};
                    margin: 0 !important;
                  }
                }
              `}</style>

              {/* Render sheets:
                  - In screen view: only currentSheetIndex is shown (has 'block', others 'hidden')
                  - In print view: .print-studio-sheet.hidden is displayed via CSS, printing all sheets in sequence! */}
              {Array.from({ length: totalSheets }).map((_, sheetIdx) => {
                const isCurrent = sheetIdx === currentSheetIndex;
                const sheetOffset = sheetIdx * slotCount;

                return (
                  <div
                    key={sheetIdx}
                    ref={sheetIdx === 0 ? printSheetRef : undefined}
                    className={`print-studio-sheet bg-white text-black shadow-2xl relative transition-all duration-300 ${
                      isCurrent ? 'block' : 'hidden'
                    }`}
                    style={{
                      '--print-sheet-width': `${pageWidthMm}mm`,
                      '--print-sheet-height': `${pageHeightMm}mm`,
                      '--print-sheet-padding': `${settings.marginMm}mm`,
                      width: `${pageWidthMm}mm`,
                      maxWidth: `${(isLandscape ? 680 : 480) * (previewZoom / 100)}px`,
                      aspectRatio: `${pageWidthMm} / ${pageHeightMm}`,
                      padding: `${settings.marginMm}mm`,
                      boxSizing: 'border-box',
                    } as React.CSSProperties}
                  >
                    {/* Screen-only sheet badge when multi-sheet */}
                    {totalSheets > 1 && (
                      <div className="no-print absolute top-2 left-2 text-[10px] font-bold text-slate-600 bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded shadow-xs border border-slate-200 z-10">
                        Sheet {sheetIdx + 1} of {totalSheets}
                      </div>
                    )}

                    {/* 1. LAYOUT: FRONT & BACK DUPLEX (2-Sided Printing) */}
                    {settings.layout === 'front_back_duplex' ? (
                      <div className="h-full flex flex-col justify-center items-center">
                        <div className="no-print absolute top-2 right-2 text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          Duplex Page {settings.duplexActivePage}: {settings.duplexActivePage === 1 ? 'FRONT' : 'BACK'}
                        </div>

                        {(() => {
                          const activeItem = getImageForSlot(settings.duplexActivePage === 1 ? 0 : 1, sheetOffset) || getImageForSlot(0, sheetOffset);
                          if (!activeItem) return null;
                          const isItemPortrait = activeItem && activeItem.aspectRatio < 1;
                          const screenW = isItemPortrait ? '164px' : '280px';
                          const printW = isItemPortrait ? '53.98mm' : '85.6mm';
                          const printH = isItemPortrait ? '85.6mm' : '53.98mm';

                          return (
                            <div
                              className={`card-exact-id-slot relative group flex items-center justify-center ${
                                settings.showCutLines ? 'screen-cut-guide' : ''
                              } ${settings.printCutMarks ? 'print-crop-marks' : ''}`}
                              style={{
                                width: settings.scaleMode === 'exact_id' ? screenW : '90%',
                                aspectRatio: activeItem.aspectRatio || 85.6 / 53.98,
                                '--card-print-w': settings.scaleMode === 'exact_id' ? printW : '90%',
                                '--card-print-h': settings.scaleMode === 'exact_id' ? printH : 'auto',
                              } as React.CSSProperties}
                            >
                              {renderCropTicks()}
                              <img
                                src={activeItem.dataUrl}
                                alt="Duplex Card"
                                className="card-exact-id w-full h-full object-contain block rounded-none"
                              />
                              {onRotateItem && (
                                <div 
                                  className="no-print absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 z-20 bg-black/85 backdrop-blur-md p-1 rounded-lg transition-all shadow-lg"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => onRotateItem(activeItem.id)}
                                    className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold flex items-center gap-1 shadow"
                                    title="Rotate 90° CW"
                                  >
                                    <RotateCw className="w-3 h-3" />
                                    <span>Rotate</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : settings.layout === 'front_back_fold' ? (
                      /* 2. LAYOUT: FRONT & BACK FOLD (FOR LAMINATION POUCH) */
                      <div className="h-full flex items-center justify-center">
                        <div className="relative flex items-center justify-center">
                          {/* Left: Front Card */}
                          {(() => {
                            const frontItem = getImageForSlot(0, sheetOffset);
                            if (!frontItem) return null;
                            const isFrontPortrait = frontItem && frontItem.aspectRatio < 1;
                            const screenW = isFrontPortrait ? '140px' : '210px';
                            const printW = isFrontPortrait ? '53.98mm' : '85.6mm';
                            const printH = isFrontPortrait ? '85.6mm' : '53.98mm';

                            return (
                              <div
                                className={`card-exact-id-slot relative group flex items-center justify-center ${
                                  settings.showCutLines ? 'screen-cut-guide' : ''
                                } ${settings.printCutMarks ? 'print-crop-marks' : ''}`}
                                style={{
                                  width: settings.scaleMode === 'exact_id' ? screenW : '45%',
                                  aspectRatio: frontItem.aspectRatio || 85.6 / 53.98,
                                  '--card-print-w': settings.scaleMode === 'exact_id' ? printW : '45%',
                                  '--card-print-h': settings.scaleMode === 'exact_id' ? printH : 'auto',
                                } as React.CSSProperties}
                              >
                                {renderCropTicks()}
                                <img
                                  src={frontItem.dataUrl}
                                  alt="Front"
                                  className="card-exact-id w-full h-full object-contain block rounded-none"
                                />
                                {onRotateItem && (
                                  <div 
                                    className="no-print absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 z-20 bg-black/85 backdrop-blur-md p-1 rounded-lg transition-all shadow-lg"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={() => onRotateItem(frontItem.id)}
                                      className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold flex items-center gap-1 shadow"
                                      title="Rotate 90° CW"
                                    >
                                      <RotateCw className="w-3 h-3" />
                                      <span>Rotate</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Screen-only center fold guide (NO-PRINT so paper stays clean!) */}
                          <div className="no-print h-40 border-r-2 border-dashed border-rose-400 mx-2 relative flex items-center justify-center">
                            <span className="absolute -top-4 text-[8px] text-rose-500 font-bold uppercase whitespace-nowrap">
                              Fold Line
                            </span>
                          </div>

                          {/* Right: Back Card */}
                          {(() => {
                            const backItem = getImageForSlot(1, sheetOffset);
                            if (!backItem) return null;
                            const isBackPortrait = backItem && backItem.aspectRatio < 1;
                            const screenW = isBackPortrait ? '140px' : '210px';
                            const printW = isBackPortrait ? '53.98mm' : '85.6mm';
                            const printH = isBackPortrait ? '85.6mm' : '53.98mm';

                            return (
                              <div
                                className={`card-exact-id-slot relative group flex items-center justify-center ${
                                  settings.showCutLines ? 'screen-cut-guide' : ''
                                } ${settings.printCutMarks ? 'print-crop-marks' : ''}`}
                                style={{
                                  width: settings.scaleMode === 'exact_id' ? screenW : '45%',
                                  aspectRatio: backItem.aspectRatio || 85.6 / 53.98,
                                  '--card-print-w': settings.scaleMode === 'exact_id' ? printW : '45%',
                                  '--card-print-h': settings.scaleMode === 'exact_id' ? printH : 'auto',
                                } as React.CSSProperties}
                              >
                                {renderCropTicks()}
                                <img
                                  src={backItem.dataUrl}
                                  alt="Back"
                                  className="card-exact-id w-full h-full object-contain block rounded-none"
                                />
                                {onRotateItem && (
                                  <div 
                                    className="no-print absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 z-20 bg-black/85 backdrop-blur-md p-1 rounded-lg transition-all shadow-lg"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={() => onRotateItem(backItem.id)}
                                      className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold flex items-center gap-1 shadow"
                                      title="Rotate 90° CW"
                                    >
                                      <RotateCw className="w-3 h-3" />
                                      <span>Rotate</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ) : settings.layout === '2_vertical' ? (
                      /* 3. LAYOUT: 2 IMAGES VERTICAL (TOP & BOTTOM) */
                      <div 
                        className="h-full flex flex-col items-center"
                        style={{
                          justifyContent: settings.alignment === 'center' ? 'center' : 'flex-start',
                          gap: `${settings.spacingMm}mm`,
                          padding: `${settings.spacingMm}mm 0`,
                        }}
                      >
                        {[0, 1].map((slotIdx) => {
                          const item = getImageForSlot(slotIdx, sheetOffset);
                          if (!item) return null;
                          const isItemPortrait = item && item.aspectRatio < 1;
                          const screenW = isItemPortrait ? '164px' : '260px';
                          const printW = isItemPortrait ? '53.98mm' : '85.6mm';
                          const printH = isItemPortrait ? '85.6mm' : '53.98mm';

                          return (
                            <div
                              key={slotIdx}
                              onClick={() => setActiveSlotModal(sheetOffset + slotIdx)}
                              className={`card-exact-id-slot relative cursor-pointer group flex items-center justify-center ${
                                settings.showCutLines ? 'screen-cut-guide' : ''
                              } ${settings.printCutMarks ? 'print-crop-marks' : ''}`}
                              style={{
                                width: settings.scaleMode === 'exact_id' ? screenW : '88%',
                                aspectRatio: item.aspectRatio || 85.6 / 53.98,
                                '--card-print-w': settings.scaleMode === 'exact_id' ? printW : '88%',
                                '--card-print-h': settings.scaleMode === 'exact_id' ? printH : 'auto',
                              } as React.CSSProperties}
                            >
                              {renderCropTicks()}
                              <img
                                src={item.dataUrl}
                                alt={`Slot ${slotIdx + 1}`}
                                className="card-exact-id w-full h-full object-contain block rounded-none"
                              />

                              {/* Screen-only hover actions */}
                              <div 
                                className="no-print absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 z-20 bg-black/85 backdrop-blur-md p-1 rounded-lg transition-all shadow-lg"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {onRotateItem && (
                                  <button
                                    onClick={() => onRotateItem(item.id)}
                                    className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold flex items-center gap-1 shadow"
                                    title="Rotate 90° CW"
                                  >
                                    <RotateCw className="w-3 h-3" />
                                    <span>Rotate</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => setActiveSlotModal(sheetOffset + slotIdx)}
                                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white text-[10px] font-medium border border-slate-700 shadow"
                                  title="Change Card in this slot"
                                >
                                  Change
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : settings.layout === '2_horizontal' ? (
                      /* 4. LAYOUT: 2 IMAGES HORIZONTAL (SIDE BY SIDE) */
                      <div 
                        className="h-full flex items-center justify-center"
                        style={{ gap: `${settings.spacingMm}mm` }}
                      >
                        {[0, 1].map((slotIdx) => {
                          const item = getImageForSlot(slotIdx, sheetOffset);
                          if (!item) return null;
                          const isItemPortrait = item && item.aspectRatio < 1;
                          const screenW = isItemPortrait ? '150px' : '210px';
                          const printW = isItemPortrait ? '53.98mm' : '85.6mm';
                          const printH = isItemPortrait ? '85.6mm' : '53.98mm';

                          return (
                            <div
                              key={slotIdx}
                              onClick={() => setActiveSlotModal(sheetOffset + slotIdx)}
                              className={`card-exact-id-slot relative cursor-pointer group flex items-center justify-center ${
                                settings.showCutLines ? 'screen-cut-guide' : ''
                              } ${settings.printCutMarks ? 'print-crop-marks' : ''}`}
                              style={{
                                width: settings.scaleMode === 'exact_id' ? screenW : '47%',
                                aspectRatio: item.aspectRatio || 85.6 / 53.98,
                                '--card-print-w': settings.scaleMode === 'exact_id' ? printW : '47%',
                                '--card-print-h': settings.scaleMode === 'exact_id' ? printH : 'auto',
                              } as React.CSSProperties}
                            >
                              {renderCropTicks()}
                              <img
                                src={item.dataUrl}
                                alt={`Slot ${slotIdx + 1}`}
                                className="card-exact-id w-full h-full object-contain block rounded-none"
                              />

                              {/* Screen-only hover actions */}
                              <div 
                                className="no-print absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 z-20 bg-black/85 backdrop-blur-md p-1 rounded-lg transition-all shadow-lg"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {onRotateItem && (
                                  <button
                                    onClick={() => onRotateItem(item.id)}
                                    className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold flex items-center gap-1 shadow"
                                    title="Rotate 90° CW"
                                  >
                                    <RotateCw className="w-3 h-3" />
                                    <span>Rotate</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => setActiveSlotModal(sheetOffset + slotIdx)}
                                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white text-[10px] font-medium border border-slate-700 shadow"
                                  title="Change Card in this slot"
                                >
                                  Change
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : settings.layout === '1_fit' || settings.layout === '1_real_size' ? (
                      /* 5. LAYOUT: 1 IMAGE */
                      <div className="h-full flex items-center justify-center">
                        {(() => {
                          const item = getImageForSlot(0, sheetOffset);
                          if (!item) return null;
                          const isItemPortrait = item.aspectRatio < 1;
                          const isRealSize = settings.layout === '1_real_size';
                          const screenW = isItemPortrait ? '176px' : '280px';
                          const printW = isItemPortrait ? '53.98mm' : '85.6mm';
                          const printH = isItemPortrait ? '85.6mm' : '53.98mm';

                          return (
                            <div
                              className={`${isRealSize ? "card-exact-id-slot" : ""} relative flex items-center justify-center ${
                                settings.showCutLines ? 'screen-cut-guide' : ''
                              } ${settings.printCutMarks ? 'print-crop-marks' : ''}`}
                              style={{
                                width: isRealSize ? screenW : '96%',
                                aspectRatio: item.aspectRatio || 85.6 / 53.98,
                                ...(isRealSize ? {
                                  '--card-print-w': printW,
                                  '--card-print-h': printH,
                                } : {}),
                              } as React.CSSProperties}
                            >
                              {renderCropTicks()}
                              <img
                                src={item.dataUrl}
                                alt="Single"
                                className="card-exact-id w-full h-full object-contain block rounded-none"
                              />
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      /* 6. LAYOUT: MULTI-GRID (3, 4, 6, 8, 9 OR CUSTOM) */
                      (() => {
                        const gridDim = getGridDimensions(settings.layout, isLandscape);
                        return (
                          <div
                            className="h-full w-full grid"
                            style={{
                              gap: `${settings.spacingMm}mm`,
                              gridTemplateColumns: `repeat(${gridDim.cols}, 1fr)`,
                              gridTemplateRows: `repeat(${gridDim.rows}, 1fr)`,
                              justifyItems: 'center',
                              alignItems: 'center',
                            }}
                          >
                            {Array.from({ length: slotCount }).map((_, slotIdx) => {
                              const item = getImageForSlot(slotIdx, sheetOffset);
                              if (!item) return null;
                              const isItemPortrait = item && item.aspectRatio < 1;
                              return (
                                <div
                                  key={slotIdx}
                                  onClick={() => setActiveSlotModal(sheetOffset + slotIdx)}
                                  className={`relative cursor-pointer group flex items-center justify-center w-full h-full p-1 ${
                                    settings.showCutLines ? 'screen-cut-guide' : ''
                                  } ${settings.printCutMarks ? 'print-crop-marks' : ''}`}
                                  style={{ boxSizing: 'border-box' }}
                                >
                                  {renderCropTicks()}
                                  <img
                                    src={item.dataUrl}
                                    alt={`Card ${slotIdx + 1}`}
                                    className="card-exact-id max-w-full max-h-full object-contain block rounded-none"
                                    style={{
                                      width: settings.scaleMode === 'exact_id'
                                        ? (isItemPortrait ? '53.98mm' : '85.6mm')
                                        : '95%',
                                      aspectRatio: item.aspectRatio || 85.6 / 53.98,
                                    }}
                                  />

                                  {/* Screen-only hover actions */}
                                  {onRotateItem && (
                                    <div 
                                      className="no-print absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 z-20 bg-black/85 backdrop-blur-md p-1 rounded-lg transition-all shadow-lg"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        onClick={() => onRotateItem(item.id)}
                                        className="px-1.5 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold flex items-center gap-1 shadow"
                                        title="Rotate 90° CW"
                                      >
                                        <RotateCw className="w-3 h-3" />
                                        <span>Rotate</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SLOT ASSIGNMENT MODAL (Click slot to choose which card appears there) */}
      {activeSlotModal !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Choose Card for Slot {activeSlotModal + 1}
              </h3>
              <button
                onClick={() => setActiveSlotModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {queue.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setSlotOverrides((prev) => ({ ...prev, [activeSlotModal]: item.id }));
                    setActiveSlotModal(null);
                  }}
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600/20 dark:hover:bg-blue-600/30 border border-slate-200 dark:border-slate-700 hover:border-blue-500 cursor-pointer flex items-center gap-3 transition-all"
                >
                  <img
                    src={item.dataUrl}
                    alt={item.name}
                    className="w-14 h-9 object-cover rounded bg-black"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{item.name}</div>
                    <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold uppercase">{item.cardSide}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setSlotOverrides((prev) => {
                  const copy = { ...prev };
                  delete copy[activeSlotModal];
                  return copy;
                });
                setActiveSlotModal(null);
              }}
              className="w-full py-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-300 transition-colors cursor-pointer"
            >
              Reset to Automatic Queue Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
