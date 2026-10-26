import React, { useState, useRef } from 'react';
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
  Lock,
  Clock,
  Check,
  Grid2X2,
  Rows2,
  Columns2,
  LayoutGrid,
  Maximize2,
  FileText
} from 'lucide-react';
import type { 
  PrintQueueItem, 
  PrintSettings, 
  PrintLayoutType,
  PageSizeId
} from '../../types';
import { PAGE_SIZES, PRINT_LAYOUT_OPTIONS } from '../../utils/constants';
import { analytics } from '../../services/analyticsService';
import { useAuth } from '../../context/AuthContext';
import './PrintStudio.css';

interface PrintStudioViewProps {
  queue: PrintQueueItem[];
  onAddItem?: (item: Omit<PrintQueueItem, 'id' | 'createdAt'>) => void;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
  onDuplicateItem: (id: string) => void;
  onRotateItem?: (id: string) => void;
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
  onNavigateToScanner,
  onOpenRecents,
}) => {
  const { isAuthenticated, openAuthModal } = useAuth();
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
  const [layoutCategory, setLayoutCategory] = useState<'id_duo' | 'multi' | 'single' | 'all'>('id_duo');

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

  // Handle printing (Clean paper print without confetti interference)
  const handlePrint = () => {
    if (!isAuthenticated) {
      openAuthModal('print documents');
      return;
    }
    analytics.trackPrint({
      pageSize: settings.pageSize,
      itemCount: queue.length,
      page: 'print',
    });
    window.print();
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

  // Generate expanded list of items based on copies setting
  const getExpandedQueue = (): PrintQueueItem[] => {
    if (queue.length === 0) return [];
    const list: PrintQueueItem[] = [];
    for (let c = 0; c < settings.copies; c++) {
      queue.forEach((item) => list.push(item));
    }
    return list;
  };

  const expandedQueue = getExpandedQueue();

  // Helper to get image for a slot (Does NOT automatically duplicate images unless user specifies copies)
  const getImageForSlot = (slotIdx: number): PrintQueueItem | undefined => {
    // Check manual override first
    if (slotOverrides[slotIdx]) {
      const found = queue.find((q) => q.id === slotOverrides[slotIdx]);
      if (found) return found;
    }

    if (slotIdx < expandedQueue.length) {
      return expandedQueue[slotIdx];
    }
    return undefined;
  };

  // Download high-resolution sheet with ONLY the pure edited images
  const handleDownloadSheet = () => {
    if (!isAuthenticated) {
      openAuthModal('download high-resolution sheets');
      return;
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

    const renderedSlots = Array.from({ length: slotCount }).map((_, i) => getImageForSlot(i));
    
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
        });
      }

      const link = document.createElement('a');
      link.download = `PrintMate_${settings.pageSize.toUpperCase()}_Clean_Output.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.98);
      link.click();
      analytics.trackDownload({
        type: `Clean Sheet (${settings.pageSize.toUpperCase()})`,
        page: 'print',
      });
    });
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
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-2xl mx-auto space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto border border-cyan-200">
            <Printer className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Your Print Queue is Clean & Ready</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Scan and straighten your ID card (Front & Back), or upload images directly to configure multi-up layouts, copies, and back-and-forth prints.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onNavigateToScanner}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/30 inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Go to Scan & Straighten</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-cyan-700 font-semibold text-sm border border-cyan-200 inline-flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Image Directly</span>
            </button>
            {onOpenRecents && (
              <button
                type="button"
                onClick={onOpenRecents}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm border border-slate-200 inline-flex items-center gap-2 cursor-pointer"
              >
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Pick from Recents</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT CONTROLS: 4 Cols */}
          <div className="no-print lg:col-span-4 space-y-4">
            {/* 1. COPIES SELECTOR */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Copy className="w-4 h-4 text-cyan-600" />
                  <span>Number of Copies</span>
                </h4>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200">
                  {settings.copies} {settings.copies === 1 ? 'Copy' : 'Copies'}
                </span>
              </div>

              {/* Stepper & Quick Pills */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSettings((s) => ({ ...s, copies: Math.max(1, s.copies - 1) }))}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-white font-bold flex items-center justify-center border border-slate-200 transition-all text-base"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.copies}
                  onChange={(e) => setSettings((s) => ({ ...s, copies: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="w-16 h-9 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-bold text-slate-900 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => setSettings((s) => ({ ...s, copies: s.copies + 1 }))}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-white font-bold flex items-center justify-center border border-slate-200 transition-all text-base"
                >
                  +
                </button>

                <div className="flex items-center gap-1 ml-auto">
                  {[1, 2, 4, 8].map((c) => (
                    <button
                      key={c}
                      onClick={() => setSettings((s) => ({ ...s, copies: c }))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        settings.copies === c
                          ? 'bg-cyan-500 text-black font-bold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {c}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. MULTI-UP SHEET LAYOUTS & DUO OPTIONS */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>Multi-Up Sheet Layouts</span>
                </h4>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                  {PRINT_LAYOUT_OPTIONS.find((l) => l.id === settings.layout)?.name.split('(')[0].trim() || 'Selected'}
                </span>
              </div>

              {/* Category Filter Tabs */}
              <div className="grid grid-cols-4 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold gap-1">
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
                    className={`py-1.5 px-2 rounded-lg text-center transition-all truncate cursor-pointer ${
                      layoutCategory === cat.id
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Layout Selection Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {filteredLayouts.map((layout) => {
                  const isSelected = settings.layout === layout.id;
                  return (
                    <button
                      key={layout.id}
                      type="button"
                      onClick={() => setSettings((prev) => ({ ...prev, layout: layout.id as PrintLayoutType }))}
                      className={`text-left p-2.5 rounded-xl transition-all border flex items-start gap-2.5 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/90 border-blue-600 text-slate-900 shadow-sm ring-2 ring-blue-500/20'
                          : 'bg-slate-50/70 border-slate-200 text-slate-800 hover:bg-slate-100/90 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${
                        isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white text-slate-600 border-slate-200'
                      }`}>
                        {isSelected ? <Check className="w-4 h-4 text-white" /> : getLayoutIcon(layout.id)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-xs font-bold truncate ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                            {layout.name.split('(')[0].trim()}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                            isSelected ? 'bg-blue-200 text-blue-900' : 'bg-slate-200/70 text-slate-600'
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
                      <span>Custom Grid Dimensions</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {settings.customCols} × {settings.customRows} ({settings.customCols * settings.customRows} total slots)
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

            {/* 4. PAPER SIZE, ORIENTATION & ALIGNMENT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                <span>Paper Size & Alignment</span>
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={settings.pageSize}
                  onChange={(e) => setSettings((prev) => ({ ...prev, pageSize: e.target.value as any }))}
                  className="bg-slate-100 border border-slate-200 text-xs font-medium rounded-xl p-2.5 text-slate-900 focus:outline-none"
                >
                  {PAGE_SIZES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name.split('(')[0]}
                    </option>
                  ))}
                </select>

                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  <button
                    onClick={() => setSettings((s) => ({ ...s, orientation: 'portrait' }))}
                    className={`flex-1 py-1 text-xs rounded-lg font-semibold transition-all ${
                      settings.orientation === 'portrait' ? 'bg-blue-600 text-white' : 'text-slate-500'
                    }`}
                  >
                    Portrait
                  </button>
                  <button
                    onClick={() => setSettings((s) => ({ ...s, orientation: 'landscape' }))}
                    className={`flex-1 py-1 text-xs rounded-lg font-semibold transition-all ${
                      settings.orientation === 'landscape' ? 'bg-blue-600 text-white' : 'text-slate-500'
                    }`}
                  >
                    Landscape
                  </button>
                </div>
              </div>

              {/* Sheet Placement Alignment */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100 border border-slate-200">
                <span className="text-xs font-semibold text-slate-700">Placement:</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setSettings((s) => ({ ...s, alignment: 'top_center' }))}
                    className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all ${
                      settings.alignment === 'top_center' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Top (Save Paper)
                  </button>
                  <button
                    onClick={() => setSettings((s) => ({ ...s, alignment: 'center' }))}
                    className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all ${
                      settings.alignment === 'center' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Center
                  </button>
                </div>
              </div>

              {/* Card Scale Mode */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                <div>
                  <div className="text-xs font-semibold text-slate-900">100% Real ID Scale</div>
                  <div className="text-[10px] text-slate-500">CR80 (85.60 × 53.98 mm)</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.scaleMode === 'exact_id'}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      scaleMode: e.target.checked ? 'exact_id' : 'fit_cell',
                    }))
                  }
                  className="w-4 h-4 rounded text-blue-600 bg-slate-50 border-slate-200 cursor-pointer"
                />
              </div>

              {/* Margin & Spacing Sliders */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Margin:</span>
                    <span className="font-mono text-cyan-600">{settings.marginMm}mm</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    value={settings.marginMm}
                    onChange={(e) => setSettings((s) => ({ ...s, marginMm: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Card Gap:</span>
                    <span className="font-mono text-cyan-600">{settings.spacingMm}mm</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={settings.spacingMm}
                    onChange={(e) => setSettings((s) => ({ ...s, spacingMm: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* 5. QUEUE ITEMS */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <span>Queue Items ({queue.length})</span>
                </h4>
                <div className="flex items-center gap-2">
                  {onOpenRecents && (
                    <button
                      type="button"
                      onClick={onOpenRecents}
                      className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                      title="Load image from your recent documents"
                    >
                      <Clock className="w-3 h-3" />
                      <span>Recents</span>
                    </button>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] text-cyan-600 hover:text-cyan-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                  <button
                    onClick={onClearQueue}
                    className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear All</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-3"
                  >
                    <img
                      src={item.dataUrl}
                      alt={item.name}
                      className="w-12 h-8 object-cover rounded bg-black border border-slate-700"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-900 truncate">{item.name}</div>
                      <div className="text-[10px] text-cyan-600 uppercase font-bold">
                        {item.cardSide || 'single'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {onRotateItem && (
                        <button
                          onClick={() => onRotateItem(item.id)}
                          className="p-1 rounded text-cyan-600 hover:text-white hover:bg-cyan-600/30 transition-all"
                          title="Rotate 90° CW"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onDuplicateItem(item.id)}
                        className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-200"
                        title="Duplicate in Queue"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-200"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-cyan-700 text-xs font-medium border border-cyan-200 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Image</span>
                </button>
                <button
                  onClick={onNavigateToScanner}
                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium border border-slate-200 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-400" />
                  <span>Scan More</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: PAPER CANVAS PREVIEW & PRINT ACTION: 8 Cols */}
          <div className="lg:col-span-8 space-y-4">
            {/* Top Toolbar */}
            <div className="no-print bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Print Sheet Output</span>
                  <span className="text-xs font-normal text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
                    {selectedPageDef.name.split('(')[0]} • {settings.orientation.toUpperCase()} • {settings.copies} {settings.copies === 1 ? 'Copy' : 'Copies'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Zero guides or labels on printed paper • 100% clean images only
                </p>
              </div>

              {/* Actions & Zoom Controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                  <button
                    onClick={() => setPreviewZoom((z) => Math.max(50, z - 15))}
                    className="p-1.5 text-slate-500 hover:text-white rounded-lg"
                    title="Zoom Out Preview"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono px-2 text-slate-700">{previewZoom}%</span>
                  <button
                    onClick={() => setPreviewZoom((z) => Math.min(150, z + 15))}
                    className="p-1.5 text-slate-500 hover:text-white rounded-lg"
                    title="Zoom In Preview"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={handleDownloadSheet}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
                  title={isAuthenticated ? 'Download clean printable high-res image' : 'Sign in required to download'}
                >
                  {!isAuthenticated ? (
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Download Clean Sheet</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all transform active:scale-98 cursor-pointer"
                  title={isAuthenticated ? 'Print clean paper page' : 'Sign in required to print'}
                >
                  {!isAuthenticated ? (
                    <Lock className="w-4 h-4 text-amber-300" />
                  ) : (
                    <Printer className="w-4 h-4" />
                  )}
                  <span>Print Page</span>
                </button>
              </div>
            </div>

            {/* PHYSICAL PAPER SHEET PREVIEW (Zoomable / Scaled to fit container) */}
            <div className="print-page-wrapper bg-slate-100 p-4 sm:p-8 rounded-2xl border border-slate-200 flex justify-center items-center overflow-auto min-h-[580px]">
              {/* Dynamic print-media page size injection */}
              <style>{`
                @media print {
                  @page {
                    size: ${getPrintPageSizeRule(selectedPageDef.id, settings.orientation)};
                    margin: 0 !important;
                  }
                }
              `}</style>

              {/* This DIV is what gets printed directly via @media print!
                  CRITICAL: All UI labels, slot badges, scissors icons, and guides HAVE 'no-print'
                  so ONLY the pure images appear on the paper! */}
              <div
                ref={printSheetRef}
                className="print-studio-sheet bg-white text-black shadow-2xl relative transition-all duration-300"
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
                {/* 1. LAYOUT: FRONT & BACK DUPLEX (2-Sided Printing) */}
                {settings.layout === 'front_back_duplex' ? (
                  <div className="h-full flex flex-col justify-center items-center">
                    {/* Screen-only page indicator */}
                    <div className="no-print absolute top-2 right-2 text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      Duplex Page {settings.duplexActivePage}: {settings.duplexActivePage === 1 ? 'FRONT' : 'BACK'}
                    </div>

                    {(() => {
                      const activeItem = getImageForSlot(settings.duplexActivePage === 1 ? 0 : 1) || getImageForSlot(0);
                      if (!activeItem) return null;
                      const isItemPortrait = activeItem && activeItem.aspectRatio < 1;
                      const screenW = isItemPortrait ? '164px' : '280px';
                      const printW = isItemPortrait ? '53.98mm' : '85.6mm';
                      const printH = isItemPortrait ? '85.6mm' : '53.98mm';

                      return (
                        <div
                          className="card-exact-id-slot relative group flex items-center justify-center"
                          style={{
                            width: settings.scaleMode === 'exact_id' ? screenW : '90%',
                            aspectRatio: activeItem.aspectRatio || 85.6 / 53.98,
                            '--card-print-w': settings.scaleMode === 'exact_id' ? printW : '90%',
                            '--card-print-h': settings.scaleMode === 'exact_id' ? printH : 'auto',
                          } as React.CSSProperties}
                        >
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
                        const frontItem = getImageForSlot(0);
                        if (!frontItem) return null;
                        const isFrontPortrait = frontItem && frontItem.aspectRatio < 1;
                        const screenW = isFrontPortrait ? '140px' : '210px';
                        const printW = isFrontPortrait ? '53.98mm' : '85.6mm';
                        const printH = isFrontPortrait ? '85.6mm' : '53.98mm';

                        return (
                          <div
                            className="card-exact-id-slot relative group flex items-center justify-center"
                            style={{
                              width: settings.scaleMode === 'exact_id' ? screenW : '45%',
                              aspectRatio: frontItem.aspectRatio || 85.6 / 53.98,
                              '--card-print-w': settings.scaleMode === 'exact_id' ? printW : '45%',
                              '--card-print-h': settings.scaleMode === 'exact_id' ? printH : 'auto',
                            } as React.CSSProperties}
                          >
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
                        const backItem = getImageForSlot(1);
                        if (!backItem) return null;
                        const isBackPortrait = backItem && backItem.aspectRatio < 1;
                        const screenW = isBackPortrait ? '140px' : '210px';
                        const printW = isBackPortrait ? '53.98mm' : '85.6mm';
                        const printH = isBackPortrait ? '85.6mm' : '53.98mm';

                        return (
                          <div
                            className="card-exact-id-slot relative group flex items-center justify-center"
                            style={{
                              width: settings.scaleMode === 'exact_id' ? screenW : '45%',
                              aspectRatio: backItem.aspectRatio || 85.6 / 53.98,
                              '--card-print-w': settings.scaleMode === 'exact_id' ? printW : '45%',
                              '--card-print-h': settings.scaleMode === 'exact_id' ? printH : 'auto',
                            } as React.CSSProperties}
                          >
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
                      const item = getImageForSlot(slotIdx);
                      if (!item) return null;
                      const isItemPortrait = item && item.aspectRatio < 1;
                      const screenW = isItemPortrait ? '164px' : '260px';
                      const printW = isItemPortrait ? '53.98mm' : '85.6mm';
                      const printH = isItemPortrait ? '85.6mm' : '53.98mm';

                      return (
                        <div
                          key={slotIdx}
                          onClick={() => setActiveSlotModal(slotIdx)}
                          className="card-exact-id-slot relative cursor-pointer group flex items-center justify-center"
                          style={{
                            width: settings.scaleMode === 'exact_id' ? screenW : '88%',
                            aspectRatio: item.aspectRatio || 85.6 / 53.98,
                            '--card-print-w': settings.scaleMode === 'exact_id' ? printW : '88%',
                            '--card-print-h': settings.scaleMode === 'exact_id' ? printH : 'auto',
                          } as React.CSSProperties}
                        >
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
                              onClick={() => setActiveSlotModal(slotIdx)}
                              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 hover:text-white text-[10px]"
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
                      const item = getImageForSlot(slotIdx);
                      if (!item) return null;
                      const isItemPortrait = item && item.aspectRatio < 1;
                      const screenW = isItemPortrait ? '150px' : '210px';
                      const printW = isItemPortrait ? '53.98mm' : '85.6mm';
                      const printH = isItemPortrait ? '85.6mm' : '53.98mm';

                      return (
                        <div
                          key={slotIdx}
                          onClick={() => setActiveSlotModal(slotIdx)}
                          className="card-exact-id-slot relative cursor-pointer group flex items-center justify-center"
                          style={{
                            width: settings.scaleMode === 'exact_id' ? screenW : '47%',
                            aspectRatio: item.aspectRatio || 85.6 / 53.98,
                            '--card-print-w': settings.scaleMode === 'exact_id' ? printW : '47%',
                            '--card-print-h': settings.scaleMode === 'exact_id' ? printH : 'auto',
                          } as React.CSSProperties}
                        >
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
                              onClick={() => setActiveSlotModal(slotIdx)}
                              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 hover:text-white text-[10px]"
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
                      const item = getImageForSlot(0);
                      if (!item) return null;
                      const isItemPortrait = item.aspectRatio < 1;
                      const isRealSize = settings.layout === '1_real_size';
                      const screenW = isItemPortrait ? '176px' : '280px';
                      const printW = isItemPortrait ? '53.98mm' : '85.6mm';
                      const printH = isItemPortrait ? '85.6mm' : '53.98mm';

                      return (
                        <div
                          className={isRealSize ? "card-exact-id-slot relative" : "relative"}
                          style={{
                            width: isRealSize ? screenW : '96%',
                            aspectRatio: item.aspectRatio || 85.6 / 53.98,
                            ...(isRealSize ? {
                              '--card-print-w': printW,
                              '--card-print-h': printH,
                            } : {}),
                          } as React.CSSProperties}
                        >
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
                          const item = getImageForSlot(slotIdx);
                          if (!item) return null;
                          const isItemPortrait = item && item.aspectRatio < 1;
                          return (
                            <div
                              key={slotIdx}
                              onClick={() => setActiveSlotModal(slotIdx)}
                              className="relative cursor-pointer group flex items-center justify-center w-full h-full p-1"
                              style={{ boxSizing: 'border-box' }}
                            >
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
            </div>
          </div>
        </div>
      )}

      {/* SLOT ASSIGNMENT MODAL (Click slot to choose which card appears there) */}
      {activeSlotModal !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                Choose Card for Slot {activeSlotModal + 1}
              </h3>
              <button
                onClick={() => setActiveSlotModal(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-white"
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
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-blue-600/20 border border-slate-200 hover:border-blue-500 cursor-pointer flex items-center gap-3 transition-all"
                >
                  <img
                    src={item.dataUrl}
                    alt={item.name}
                    className="w-14 h-9 object-cover rounded bg-black"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">{item.name}</div>
                    <div className="text-[10px] text-cyan-600 font-bold uppercase">{item.cardSide}</div>
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
              className="w-full py-2 text-xs text-slate-500 hover:text-white bg-slate-50 rounded-xl border border-slate-200"
            >
              Reset to Automatic Queue Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
