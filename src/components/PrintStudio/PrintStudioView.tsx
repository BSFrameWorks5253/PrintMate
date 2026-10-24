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
  RotateCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { 
  PrintQueueItem, 
  PrintSettings, 
  PrintLayoutType 
} from '../../types';
import { PAGE_SIZES, PRINT_LAYOUT_OPTIONS } from '../../utils/constants';
import './PrintStudio.css';

interface PrintStudioViewProps {
  queue: PrintQueueItem[];
  onAddItem?: (item: Omit<PrintQueueItem, 'id' | 'createdAt'>) => void;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
  onDuplicateItem: (id: string) => void;
  onRotateItem?: (id: string) => void;
  onNavigateToScanner: () => void;
}

export const PrintStudioView: React.FC<PrintStudioViewProps> = ({
  queue,
  onAddItem,
  onRemoveItem,
  onClearQueue,
  onDuplicateItem,
  onRotateItem,
  onNavigateToScanner,
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
    alignment: 'center',
    customCols: 2,
    customRows: 2,
    duplexActivePage: 1,
  });

  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [slotOverrides, setSlotOverrides] = useState<Record<number, string>>({});
  const [activeSlotModal, setActiveSlotModal] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const printSheetRef = useRef<HTMLDivElement | null>(null);

  const selectedPageDef = PAGE_SIZES.find((p) => p.id === settings.pageSize) || PAGE_SIZES[0];
  const isLandscape = settings.orientation === 'landscape';
  const pageWidthMm = isLandscape ? selectedPageDef.heightMm : selectedPageDef.widthMm;
  const pageHeightMm = isLandscape ? selectedPageDef.widthMm : selectedPageDef.heightMm;

  // Handle printing
  const handlePrint = () => {
    confetti({
      particleCount: 40,
      spread: 55,
      origin: { y: 0.8 },
    });
    setTimeout(() => {
      window.print();
    }, 200);
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

  // Helper to get image for a slot
  const getImageForSlot = (slotIdx: number): PrintQueueItem | undefined => {
    // Check manual override first
    if (slotOverrides[slotIdx]) {
      const found = queue.find((q) => q.id === slotOverrides[slotIdx]);
      if (found) return found;
    }

    if (expandedQueue.length === 0) return undefined;
    return expandedQueue[slotIdx % expandedQueue.length];
  };

  // Download high-resolution sheet with ONLY the pure edited images
  const handleDownloadSheet = () => {
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
        const cols = settings.layout === 'custom_grid' ? settings.customCols : (slotCount <= 2 ? 1 : (slotCount <= 4 ? 2 : (slotCount <= 6 ? 2 : (slotCount <= 8 ? 2 : 3))));
        const rows = settings.layout === 'custom_grid' ? settings.customRows : Math.ceil(slotCount / cols);
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
      />

      {/* If queue is empty */}
      {queue.length === 0 ? (
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-12 text-center max-w-2xl mx-auto space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/20">
            <Printer className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white">Your Print Queue is Clean & Ready</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Scan and straighten your ID card (Front & Back), or upload images directly to configure multi-up layouts, copies, and back-and-forth prints.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onNavigateToScanner}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/30 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Go to Scan & Straighten</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-cyan-300 font-semibold text-sm border border-cyan-500/30 inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Image Directly</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT CONTROLS: 4 Cols */}
          <div className="no-print lg:col-span-4 space-y-4">
            {/* 1. COPIES SELECTOR */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Copy className="w-4 h-4 text-cyan-400" />
                  <span>Number of Copies</span>
                </h4>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {settings.copies} {settings.copies === 1 ? 'Copy' : 'Copies'}
                </span>
              </div>

              {/* Stepper & Quick Pills */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSettings((s) => ({ ...s, copies: Math.max(1, s.copies - 1) }))}
                  className="w-9 h-9 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-white font-bold flex items-center justify-center border border-[#30363d] transition-all text-base"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.copies}
                  onChange={(e) => setSettings((s) => ({ ...s, copies: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="w-16 h-9 bg-[#0d1117] border border-[#30363d] rounded-xl text-center text-sm font-bold text-white focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => setSettings((s) => ({ ...s, copies: s.copies + 1 }))}
                  className="w-9 h-9 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-white font-bold flex items-center justify-center border border-[#30363d] transition-all text-base"
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
                          : 'bg-[#21262d] text-slate-300 hover:bg-[#30363d]'
                      }`}
                    >
                      {c}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. BACK & FORTH (2-SIDED PRINT) OPTIONS */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 space-y-3 shadow-sm">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Back & Forth (2-Sided Options)</span>
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSettings((s) => ({ ...s, layout: 'front_back_duplex' }))}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    settings.layout === 'front_back_duplex'
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm ring-1 ring-blue-400'
                      : 'bg-[#21262d] border-[#30363d] text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Duplex 2-Sided</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Exact mirrored coordinate back-to-back
                  </div>
                </button>

                <button
                  onClick={() => setSettings((s) => ({ ...s, layout: 'front_back_fold' }))}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    settings.layout === 'front_back_fold'
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm ring-1 ring-blue-400'
                      : 'bg-[#21262d] border-[#30363d] text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Fold & Laminate</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Side-by-side to fold in half for pouch
                  </div>
                </button>
              </div>

              {settings.layout === 'front_back_duplex' && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-[#0d1117] border border-[#30363d]/60 text-xs">
                  <span className="text-slate-400 font-medium">Duplex Preview Side:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSettings((s) => ({ ...s, duplexActivePage: 1 }))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        settings.duplexActivePage === 1 ? 'bg-cyan-500 text-black' : 'bg-[#21262d] text-slate-400'
                      }`}
                    >
                      Page 1 (Front)
                    </button>
                    <button
                      onClick={() => setSettings((s) => ({ ...s, duplexActivePage: 2 }))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        settings.duplexActivePage === 2 ? 'bg-cyan-500 text-black' : 'bg-[#21262d] text-slate-400'
                      }`}
                    >
                      Page 2 (Back)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. MULTI-UP LAYOUT PRESETS */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>Multi-Up Sheet Layouts</span>
              </h4>

              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {PRINT_LAYOUT_OPTIONS.map((layout) => (
                  <button
                    key={layout.id}
                    onClick={() => setSettings((prev) => ({ ...prev, layout: layout.id as PrintLayoutType }))}
                    className={`text-left p-2.5 rounded-xl transition-all border flex items-center justify-between ${
                      settings.layout === layout.id
                        ? 'bg-blue-600/15 border-blue-500 text-white font-medium shadow-sm ring-1 ring-blue-500/50'
                        : 'bg-[#21262d] border-[#30363d] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">{layout.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{layout.description}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom Grid Controls if custom_grid selected */}
              {settings.layout === 'custom_grid' && (
                <div className="p-3 bg-[#0d1117] rounded-xl border border-[#30363d] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Columns:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4].map((col) => (
                        <button
                          key={col}
                          onClick={() => setSettings((s) => ({ ...s, customCols: col }))}
                          className={`w-7 h-7 rounded-lg font-bold ${
                            settings.customCols === col ? 'bg-cyan-500 text-black' : 'bg-[#21262d] text-slate-300'
                          }`}
                        >
                          {col}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Rows:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4].map((row) => (
                        <button
                          key={row}
                          onClick={() => setSettings((s) => ({ ...s, customRows: row }))}
                          className={`w-7 h-7 rounded-lg font-bold ${
                            settings.customRows === row ? 'bg-cyan-500 text-black' : 'bg-[#21262d] text-slate-300'
                          }`}
                        >
                          {row}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. PAPER SIZE, ORIENTATION & ALIGNMENT */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                <span>Paper Size & Alignment</span>
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={settings.pageSize}
                  onChange={(e) => setSettings((prev) => ({ ...prev, pageSize: e.target.value as any }))}
                  className="bg-[#21262d] border border-[#30363d] text-xs font-medium rounded-xl p-2.5 text-white focus:outline-none"
                >
                  {PAGE_SIZES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name.split('(')[0]}
                    </option>
                  ))}
                </select>

                <div className="flex rounded-xl bg-[#21262d] p-1 border border-[#30363d]">
                  <button
                    onClick={() => setSettings((s) => ({ ...s, orientation: 'portrait' }))}
                    className={`flex-1 py-1 text-xs rounded-lg font-semibold transition-all ${
                      settings.orientation === 'portrait' ? 'bg-blue-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    Portrait
                  </button>
                  <button
                    onClick={() => setSettings((s) => ({ ...s, orientation: 'landscape' }))}
                    className={`flex-1 py-1 text-xs rounded-lg font-semibold transition-all ${
                      settings.orientation === 'landscape' ? 'bg-blue-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    Landscape
                  </button>
                </div>
              </div>

              {/* Card Scale Mode */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#21262d] border border-[#30363d]">
                <div>
                  <div className="text-xs font-semibold text-white">100% Real ID Scale</div>
                  <div className="text-[10px] text-slate-400">CR80 (85.60 × 53.98 mm)</div>
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
                  className="w-4 h-4 rounded text-blue-600 bg-[#0d1117] border-[#30363d] cursor-pointer"
                />
              </div>

              {/* Margin & Spacing Sliders */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Margin:</span>
                    <span className="font-mono text-cyan-400">{settings.marginMm}mm</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    value={settings.marginMm}
                    onChange={(e) => setSettings((s) => ({ ...s, marginMm: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-[#21262d] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Card Gap:</span>
                    <span className="font-mono text-cyan-400">{settings.spacingMm}mm</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={settings.spacingMm}
                    onChange={(e) => setSettings((s) => ({ ...s, spacingMm: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-[#21262d] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 5. QUEUE ITEMS */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <span>Queue Items ({queue.length})</span>
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                  <button
                    onClick={onClearQueue}
                    className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
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
                    className="p-2 rounded-xl bg-[#21262d] border border-[#30363d] flex items-center gap-3"
                  >
                    <img
                      src={item.dataUrl}
                      alt={item.name}
                      className="w-12 h-8 object-cover rounded bg-black border border-slate-700"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{item.name}</div>
                      <div className="text-[10px] text-cyan-400 uppercase font-bold">
                        {item.cardSide || 'single'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {onRotateItem && (
                        <button
                          onClick={() => onRotateItem(item.id)}
                          className="p-1 rounded text-cyan-400 hover:text-white hover:bg-cyan-600/30 transition-all"
                          title="Rotate 90° CW"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onDuplicateItem(item.id)}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#30363d]"
                        title="Duplicate in Queue"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-[#30363d]"
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
                  className="py-2 px-3 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-cyan-300 text-xs font-medium border border-cyan-500/30 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Image</span>
                </button>
                <button
                  onClick={onNavigateToScanner}
                  className="py-2 px-3 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-slate-200 text-xs font-medium border border-[#30363d] flex items-center justify-center gap-1.5 transition-all"
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
            <div className="no-print bg-[#161b22] border border-[#30363d] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Print Sheet Output</span>
                  <span className="text-xs font-normal text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    {selectedPageDef.name.split('(')[0]} • {settings.orientation.toUpperCase()} • {settings.copies} {settings.copies === 1 ? 'Copy' : 'Copies'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Zero guides or labels on printed paper • 100% clean images only
                </p>
              </div>

              {/* Actions & Zoom Controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#21262d] rounded-xl p-0.5 border border-[#30363d]">
                  <button
                    onClick={() => setPreviewZoom((z) => Math.max(50, z - 15))}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                    title="Zoom Out Preview"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono px-2 text-slate-300">{previewZoom}%</span>
                  <button
                    onClick={() => setPreviewZoom((z) => Math.min(150, z + 15))}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                    title="Zoom In Preview"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={handleDownloadSheet}
                  className="px-3.5 py-2 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-slate-200 text-xs font-medium border border-[#30363d] flex items-center gap-1.5 transition-all"
                  title="Download clean printable high-res image"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Clean Sheet</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all transform active:scale-98"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Page</span>
                </button>
              </div>
            </div>

            {/* PHYSICAL PAPER SHEET PREVIEW (Zoomable / Scaled to fit container) */}
            <div className="bg-[#090d13] p-4 sm:p-8 rounded-2xl border border-[#30363d] flex justify-center items-center overflow-auto min-h-[580px]">
              {/* This DIV is what gets printed directly via @media print!
                  CRITICAL: All UI labels, slot badges, scissors icons, and guides HAVE 'no-print'
                  so ONLY the pure images appear on the paper! */}
              <div
                ref={printSheetRef}
                className="print-area bg-white text-black shadow-2xl relative transition-all duration-300"
                style={{
                  width: `${(isLandscape ? 680 : 480) * (previewZoom / 100)}px`,
                  aspectRatio: `${pageWidthMm} / ${pageHeightMm}`,
                  padding: `${settings.marginMm * 1.5}px`,
                  boxSizing: 'border-box',
                }}
              >
                {/* 1. LAYOUT: FRONT & BACK DUPLEX (2-Sided Printing) */}
                {settings.layout === 'front_back_duplex' ? (
                  <div className="h-full flex flex-col justify-center items-center">
                    {/* Screen-only page indicator */}
                    <div className="no-print absolute top-2 right-2 text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      Duplex Page {settings.duplexActivePage}: {settings.duplexActivePage === 1 ? 'FRONT' : 'BACK'}
                    </div>

                    {(() => {
                      const activeItem = getImageForSlot(settings.duplexActivePage === 1 ? 0 : 1) || getImageForSlot(0);
                      const isItemPortrait = activeItem && activeItem.aspectRatio < 1;
                      return (
                        <div
                          className="relative group flex items-center justify-center"
                          style={{
                            width: settings.scaleMode === 'exact_id' ? (isItemPortrait ? '164px' : '280px') : '90%',
                            aspectRatio: activeItem?.aspectRatio || 85.6 / 53.98,
                          }}
                        >
                          <img
                            src={activeItem?.dataUrl}
                            alt="Duplex Card"
                            className="w-full h-full object-contain block rounded-none"
                          />
                          {activeItem && onRotateItem && (
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
                        const isFrontPortrait = frontItem && frontItem.aspectRatio < 1;
                        return (
                          <div
                            className="relative group flex items-center justify-center"
                            style={{
                              width: settings.scaleMode === 'exact_id' ? (isFrontPortrait ? '140px' : '210px') : '45%',
                              aspectRatio: frontItem?.aspectRatio || 85.6 / 53.98,
                            }}
                          >
                            <img
                              src={frontItem?.dataUrl}
                              alt="Front"
                              className="w-full h-full object-contain block rounded-none"
                            />
                            {frontItem && onRotateItem && (
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
                        const isBackPortrait = backItem && backItem.aspectRatio < 1;
                        return (
                          <div
                            className="relative group flex items-center justify-center"
                            style={{
                              width: settings.scaleMode === 'exact_id' ? (isBackPortrait ? '140px' : '210px') : '45%',
                              aspectRatio: backItem?.aspectRatio || 85.6 / 53.98,
                            }}
                          >
                            <img
                              src={backItem?.dataUrl}
                              alt="Back"
                              className="w-full h-full object-contain block rounded-none"
                            />
                            {backItem && onRotateItem && (
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
                      justifyContent: settings.alignment === 'top_center' || settings.alignment === 'top_left' ? 'flex-start' : 'space-around',
                      gap: `${settings.spacingMm * 1.5}px`,
                      padding: `${settings.spacingMm}px 0`,
                    }}
                  >
                    {[0, 1].map((slotIdx) => {
                      const item = getImageForSlot(slotIdx);
                      const isItemPortrait = item && item.aspectRatio < 1;
                      return (
                        <div
                          key={slotIdx}
                          onClick={() => setActiveSlotModal(slotIdx)}
                          className="relative cursor-pointer group flex items-center justify-center"
                          style={{
                            width: settings.scaleMode === 'exact_id' ? (isItemPortrait ? '164px' : '260px') : '88%',
                            aspectRatio: item?.aspectRatio || 85.6 / 53.98,
                          }}
                        >
                          {item ? (
                            <img
                              src={item.dataUrl}
                              alt={`Slot ${slotIdx + 1}`}
                              className="w-full h-full object-contain block rounded-none"
                            />
                          ) : (
                            <div className="w-full h-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs no-print">
                              Empty Slot (Click to Assign)
                            </div>
                          )}

                          {/* Screen-only hover actions */}
                          <div 
                            className="no-print absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 z-20 bg-black/85 backdrop-blur-md p-1 rounded-lg transition-all shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item && onRotateItem && (
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
                              className="px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-slate-200 hover:text-white text-[10px]"
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
                    style={{ gap: `${settings.spacingMm * 1.5}px` }}
                  >
                    {[0, 1].map((slotIdx) => {
                      const item = getImageForSlot(slotIdx);
                      const isItemPortrait = item && item.aspectRatio < 1;
                      return (
                        <div
                          key={slotIdx}
                          onClick={() => setActiveSlotModal(slotIdx)}
                          className="relative cursor-pointer group flex items-center justify-center"
                          style={{
                            width: settings.scaleMode === 'exact_id' ? (isItemPortrait ? '150px' : '210px') : '47%',
                            aspectRatio: item?.aspectRatio || 85.6 / 53.98,
                          }}
                        >
                          {item ? (
                            <img
                              src={item.dataUrl}
                              alt={`Slot ${slotIdx + 1}`}
                              className="w-full h-full object-contain block rounded-none"
                            />
                          ) : (
                            <div className="w-full h-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs no-print">
                              Empty Slot
                            </div>
                          )}

                          {/* Screen-only hover actions */}
                          <div 
                            className="no-print absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 z-20 bg-black/85 backdrop-blur-md p-1 rounded-lg transition-all shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item && onRotateItem && (
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
                              className="px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-slate-200 hover:text-white text-[10px]"
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
                    <div
                      className="relative"
                      style={{
                        width: settings.layout === '1_real_size' ? '280px' : '96%',
                        aspectRatio: getImageForSlot(0)?.aspectRatio || 85.6 / 53.98,
                      }}
                    >
                      {getImageForSlot(0) && (
                        <img
                          src={getImageForSlot(0)?.dataUrl}
                          alt="Single"
                          className="w-full h-full object-contain block rounded-none"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  /* 6. LAYOUT: MULTI-GRID (3, 4, 6, 8, 9 OR CUSTOM) */
                  <div
                    className="h-full grid"
                    style={{
                      gap: `${settings.spacingMm * 1.2}px`,
                      gridTemplateColumns:
                        settings.layout === 'custom_grid'
                          ? `repeat(${settings.customCols}, 1fr)`
                          : slotCount === 3
                          ? '1fr'
                          : slotCount === 4
                          ? 'repeat(2, 1fr)'
                          : slotCount === 9
                          ? 'repeat(3, 1fr)'
                          : 'repeat(2, 1fr)',
                      gridTemplateRows:
                        settings.layout === 'custom_grid'
                          ? `repeat(${settings.customRows}, 1fr)`
                          : slotCount === 3
                          ? 'repeat(3, 1fr)'
                          : slotCount === 4
                          ? 'repeat(2, 1fr)'
                          : slotCount === 6
                          ? 'repeat(3, 1fr)'
                          : slotCount === 9
                          ? 'repeat(3, 1fr)'
                          : 'repeat(4, 1fr)',
                      justifyItems: 'center',
                      alignItems: 'center',
                    }}
                  >
                    {Array.from({ length: slotCount }).map((_, slotIdx) => {
                      const item = getImageForSlot(slotIdx);
                      return (
                        <div
                          key={slotIdx}
                          onClick={() => setActiveSlotModal(slotIdx)}
                          className="relative cursor-pointer group flex items-center justify-center w-full h-full"
                        >
                          {item ? (
                            <img
                              src={item.dataUrl}
                              alt={`Card ${slotIdx + 1}`}
                              className="max-w-full max-h-full object-contain block rounded-none"
                              style={{
                                width: settings.scaleMode === 'exact_id' ? (item.aspectRatio < 1 ? '110px' : '180px') : '95%',
                                aspectRatio: item.aspectRatio || 85.6 / 53.98,
                              }}
                            />
                          ) : (
                            <div className="w-full h-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[10px] no-print">
                              Empty Slot
                            </div>
                          )}

                          {/* Screen-only hover actions */}
                          {item && onRotateItem && (
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
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SLOT ASSIGNMENT MODAL (Click slot to choose which card appears there) */}
      {activeSlotModal !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#30363d]">
              <h3 className="text-sm font-bold text-white">
                Choose Card for Slot {activeSlotModal + 1}
              </h3>
              <button
                onClick={() => setActiveSlotModal(null)}
                className="p-1 rounded-lg hover:bg-[#21262d] text-slate-400 hover:text-white"
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
                  className="p-2.5 rounded-xl bg-[#21262d] hover:bg-blue-600/20 border border-[#30363d] hover:border-blue-500 cursor-pointer flex items-center gap-3 transition-all"
                >
                  <img
                    src={item.dataUrl}
                    alt={item.name}
                    className="w-14 h-9 object-cover rounded bg-black"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{item.name}</div>
                    <div className="text-[10px] text-cyan-400 font-bold uppercase">{item.cardSide}</div>
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
              className="w-full py-2 text-xs text-slate-400 hover:text-white bg-[#0d1117] rounded-xl border border-[#30363d]"
            >
              Reset to Automatic Queue Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
