import { create } from 'zustand';
import { PrintJob, JobAsset, AssetEdits, JobPage, PageItem, PaperSize, Orientation } from '../types';
import { createDefaultEdits } from '../utils/image-processing';
import { PAPER_SIZES, STANDARD_PHOTO_PRESETS } from '../utils/units';

interface JobState {
  currentJob: PrintJob | null;
  assets: JobAsset[];
  activeAssetId: string | null;
  edits: Record<string, AssetEdits>;
  editHistory: Record<string, { past: AssetEdits[]; future: AssetEdits[] }>;
  pages: JobPage[];
  activePageIndex: number;
  isDirty: boolean;
  isSaving: boolean;

  // Actions
  createNewJob: (name?: string) => void;
  loadJobFromDb: (jobId: string) => Promise<boolean>;
  saveCurrentJob: () => Promise<boolean>;
  checkMissingSourceFiles: () => Promise<void>;
  addAssets: (newAssets: JobAsset[]) => void;
  removeAsset: (assetId: string) => void;
  reorderAssets: (startIndex: number, endIndex: number) => void;
  setActiveAsset: (assetId: string | null) => void;
  updateAssetEdits: (assetId: string, partial: Partial<AssetEdits>, recordHistory?: boolean) => void;
  resetAssetEdits: (assetId: string) => void;
  undoAssetEdits: (assetId: string) => void;
  redoAssetEdits: (assetId: string) => void;
  canUndoAsset: (assetId: string) => boolean;
  canRedoAsset: (assetId: string) => boolean;

  // Layout Actions
  setActivePageIndex: (index: number) => void;
  addPage: (paperSize?: PaperSize, orientation?: Orientation) => void;
  removePage: (pageIndex: number) => void;
  updatePageSettings: (pageIndex: number, partial: Partial<JobPage>) => void;
  applyLayoutPreset: (presetId: string, copiesPerImage?: number) => void;
  applyGridPreset: (rows: number, cols: number) => void;
  applyIdCardFrontBackLayout: () => void;
  addPageItem: (pageIndex: number, item: PageItem) => void;
  updatePageItem: (pageIndex: number, itemId: string, updates: Partial<PageItem>) => void;
  removePageItem: (pageIndex: number, itemId: string) => void;
  clearPageItems: (pageIndex: number) => void;
}

let autosaveTimer: any = null;
const getElectronAPI = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);

export const useJobStore = create<JobState>((set, get) => ({
  currentJob: null,
  assets: [],
  activeAssetId: null,
  edits: {},
  editHistory: {},
  pages: [],
  activePageIndex: 0,
  isDirty: false,
  isSaving: false,

  createNewJob: (name?: string) => {
    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();
    const newJob: PrintJob = {
      id: jobId,
      name: name || `Print Job — ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      status: 'draft',
      created_at: now,
      updated_at: now,
      last_opened_at: now,
      notes: null,
      schema_version: 1,
    };

    const initialPage: JobPage = {
      id: crypto.randomUUID(),
      job_id: jobId,
      page_number: 1,
      paper_size: 'A4',
      orientation: 'portrait',
      width_mm: PAPER_SIZES.A4.width_mm,
      height_mm: PAPER_SIZES.A4.height_mm,
      margin_top_mm: 5,
      margin_right_mm: 5,
      margin_bottom_mm: 5,
      margin_left_mm: 5,
      background_color: '#FFFFFF',
      layout_mode: 'grid',
      spacing_x_mm: 2,
      spacing_y_mm: 2,
      created_at: now,
      updated_at: now,
      items: [],
    };

    set({
      currentJob: newJob,
      assets: [],
      activeAssetId: null,
      edits: {},
      editHistory: {},
      pages: [initialPage],
      activePageIndex: 0,
      isDirty: true,
    });

    const electronAPI = getElectronAPI();
    if (electronAPI) {
      electronAPI.createJob(newJob).catch((e) => console.error('Failed to create job in SQLite:', e));
    }
  },

  loadJobFromDb: async (jobId: string) => {
    const electronAPI = getElectronAPI();
    if (!electronAPI) return false;
    try {
      const data = await electronAPI.loadJob(jobId);
      if (!data || !data.job) return false;

      // Ensure previews are loaded for assets
      const loadedAssets = await Promise.all(
        (data.assets || []).map(async (a: any) => {
          if (!a.preview_url && electronAPI) {
            try {
              const url = await electronAPI.readFileAsDataUrl(a.original_path);
              return { ...a, preview_url: url };
            } catch {
              return a;
            }
          }
          return a;
        })
      );

      set({
        currentJob: data.job,
        assets: loadedAssets,
        activeAssetId: loadedAssets.length > 0 ? loadedAssets[0].id : null,
        edits: data.edits || {},
        editHistory: {},
        pages: data.pages && data.pages.length > 0 ? data.pages : [
          {
            id: crypto.randomUUID(),
            job_id: jobId,
            page_number: 1,
            paper_size: 'A4',
            orientation: 'portrait',
            width_mm: 210,
            height_mm: 297,
            margin_top_mm: 5,
            margin_right_mm: 5,
            margin_bottom_mm: 5,
            margin_left_mm: 5,
            background_color: '#FFFFFF',
            layout_mode: 'grid',
            spacing_x_mm: 2,
            spacing_y_mm: 2,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            items: [],
          },
        ],
        activePageIndex: 0,
        isDirty: false,
      });

      get().checkMissingSourceFiles();
      return true;
    } catch (err) {
      console.error('Failed to load job from DB:', err);
      return false;
    }
  },

  saveCurrentJob: async () => {
    const { currentJob, assets, edits, pages } = get();
    if (!currentJob) return false;

    set({ isSaving: true });
    try {
      const electronAPI = getElectronAPI();
      if (electronAPI) {
        await electronAPI.saveJob(currentJob.id, {
          job: { ...currentJob, updated_at: new Date().toISOString() },
          assets,
          edits,
          pages,
        });
      }
      set({ isDirty: false, isSaving: false });
      return true;
    } catch (err) {
      console.error('Failed to save job:', err);
      set({ isSaving: false });
      return false;
    }
  },

  addAssets: (newAssets: JobAsset[]) => {
    const { assets, edits, currentJob, pages } = get();
    const updatedEdits = { ...edits };

    newAssets.forEach((a) => {
      if (!updatedEdits[a.id]) {
        updatedEdits[a.id] = createDefaultEdits(a.id);
      }
    });

    const combinedAssets = [...assets, ...newAssets];
    set({
      assets: combinedAssets,
      edits: updatedEdits,
      activeAssetId: get().activeAssetId || (newAssets.length > 0 ? newAssets[0].id : null),
      isDirty: true,
    });

    // Auto-populate layout if current page has no items
    if (pages.length > 0 && (!pages[0].items || pages[0].items.length === 0)) {
      get().applyGridPreset(2, 2);
    }

    get().saveCurrentJob();
  },

  removeAsset: (assetId: string) => {
    const { assets, edits, activeAssetId, pages } = get();
    const filteredAssets = assets.filter((a) => a.id !== assetId);
    const updatedEdits = { ...edits };
    delete updatedEdits[assetId];

    // Remove from all page items
    const updatedPages = pages.map((p) => ({
      ...p,
      items: (p.items || []).filter((item) => item.asset_id !== assetId),
    }));

    set({
      assets: filteredAssets,
      edits: updatedEdits,
      pages: updatedPages,
      activeAssetId: activeAssetId === assetId ? (filteredAssets[0]?.id || null) : activeAssetId,
      isDirty: true,
    });
    get().saveCurrentJob();
  },

  reorderAssets: (startIndex: number, endIndex: number) => {
    const { assets } = get();
    const result = Array.from(assets);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    result.forEach((a, idx) => {
      a.sort_order = idx;
    });
    set({ assets: result, isDirty: true });
    get().saveCurrentJob();
  },

  setActiveAsset: (assetId: string | null) => {
    set({ activeAssetId: assetId });
  },

  checkMissingSourceFiles: async () => {
    const { currentJob, assets } = get();
    const electronAPI = getElectronAPI();
    if (!currentJob || !electronAPI) return;

    try {
      const results = await electronAPI.verifyJobAssets(currentJob.id);
      if (results && results.length > 0) {
        const resultMap = new Map<string, boolean>();
        results.forEach((r) => resultMap.set(r.asset.id, r.exists));

        const updated = assets.map((a) => {
          const exists = resultMap.get(a.id);
          if (exists === false) {
            return { ...a, import_status: 'missing' as const };
          }
          return a;
        });

        set({ assets: updated });
      }
    } catch (err) {
      console.warn('Failed to verify source files on disk:', err);
    }
  },

  updateAssetEdits: (assetId: string, partial: Partial<AssetEdits>, recordHistory = true) => {
    const { edits, editHistory } = get();
    const current = edits[assetId] || createDefaultEdits(assetId);
    const updated: AssetEdits = {
      ...current,
      ...partial,
      revision: current.revision + 1,
      created_at: new Date().toISOString(),
    };

    let newHistory = editHistory;
    if (recordHistory) {
      const assetHistory = editHistory[assetId] || { past: [], future: [] };
      const newPast = [...assetHistory.past, { ...current }];
      // Limit history to 50 entries to conserve memory
      if (newPast.length > 50) newPast.shift();
      newHistory = {
        ...editHistory,
        [assetId]: {
          past: newPast,
          future: [],
        },
      };
    }

    set({
      edits: {
        ...edits,
        [assetId]: updated,
      },
      editHistory: newHistory,
      isDirty: true,
    });

    // Debounced autosave to SQLite (1 second of inactivity)
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
    }
    autosaveTimer = setTimeout(() => {
      get().saveCurrentJob();
    }, 1000);
  },

  undoAssetEdits: (assetId: string) => {
    const { edits, editHistory } = get();
    const assetHistory = editHistory[assetId];
    if (!assetHistory || assetHistory.past.length === 0) return;

    const current = edits[assetId] || createDefaultEdits(assetId);
    const newPast = [...assetHistory.past];
    const previous = newPast.pop()!;

    set({
      edits: {
        ...edits,
        [assetId]: {
          ...previous,
          revision: current.revision + 1,
          created_at: new Date().toISOString(),
        },
      },
      editHistory: {
        ...editHistory,
        [assetId]: {
          past: newPast,
          future: [{ ...current }, ...assetHistory.future],
        },
      },
      isDirty: true,
    });

    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      get().saveCurrentJob();
    }, 1000);
  },

  redoAssetEdits: (assetId: string) => {
    const { edits, editHistory } = get();
    const assetHistory = editHistory[assetId];
    if (!assetHistory || assetHistory.future.length === 0) return;

    const current = edits[assetId] || createDefaultEdits(assetId);
    const newFuture = [...assetHistory.future];
    const next = newFuture.shift()!;

    set({
      edits: {
        ...edits,
        [assetId]: {
          ...next,
          revision: current.revision + 1,
          created_at: new Date().toISOString(),
        },
      },
      editHistory: {
        ...editHistory,
        [assetId]: {
          past: [...assetHistory.past, { ...current }],
          future: newFuture,
        },
      },
      isDirty: true,
    });

    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      get().saveCurrentJob();
    }, 1000);
  },

  canUndoAsset: (assetId: string) => {
    const hist = get().editHistory[assetId];
    return !!hist && hist.past.length > 0;
  },

  canRedoAsset: (assetId: string) => {
    const hist = get().editHistory[assetId];
    return !!hist && hist.future.length > 0;
  },

  resetAssetEdits: (assetId: string) => {
    const { edits, editHistory } = get();
    const current = edits[assetId];
    let newHistory = editHistory;
    if (current) {
      const assetHistory = editHistory[assetId] || { past: [], future: [] };
      newHistory = {
        ...editHistory,
        [assetId]: {
          past: [...assetHistory.past, { ...current }],
          future: [],
        },
      };
    }
    set({
      edits: {
        ...edits,
        [assetId]: createDefaultEdits(assetId),
      },
      editHistory: newHistory,
      isDirty: true,
    });
    get().saveCurrentJob();
  },

  setActivePageIndex: (index: number) => {
    set({ activePageIndex: index });
  },

  addPage: (paperSize: PaperSize = 'A4', orientation: Orientation = 'portrait') => {
    const { pages, currentJob } = get();
    const size = PAPER_SIZES[paperSize] || PAPER_SIZES.A4;
    const width_mm = orientation === 'portrait' ? size.width_mm : size.height_mm;
    const height_mm = orientation === 'portrait' ? size.height_mm : size.width_mm;

    const newPage: JobPage = {
      id: crypto.randomUUID(),
      job_id: currentJob?.id || 'temp',
      page_number: pages.length + 1,
      paper_size: paperSize,
      orientation,
      width_mm,
      height_mm,
      margin_top_mm: 5,
      margin_right_mm: 5,
      margin_bottom_mm: 5,
      margin_left_mm: 5,
      background_color: '#FFFFFF',
      layout_mode: 'grid',
      spacing_x_mm: 2,
      spacing_y_mm: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [],
    };

    set({
      pages: [...pages, newPage],
      activePageIndex: pages.length,
      isDirty: true,
    });
    get().saveCurrentJob();
  },

  removePage: (pageIndex: number) => {
    const { pages, activePageIndex } = get();
    if (pages.length <= 1) return; // Keep at least one page

    const updated = pages.filter((_, idx) => idx !== pageIndex);
    updated.forEach((p, idx) => {
      p.page_number = idx + 1;
    });

    const newIndex = Math.min(activePageIndex, updated.length - 1);
    set({ pages: updated, activePageIndex: newIndex, isDirty: true });
    get().saveCurrentJob();
  },

  updatePageSettings: (pageIndex: number, partial: Partial<JobPage>) => {
    const { pages } = get();
    if (!pages[pageIndex]) return;

    const updatedPages = [...pages];
    const target = { ...updatedPages[pageIndex], ...partial, updated_at: new Date().toISOString() };

    // If paper size or orientation changed, update dimensions
    if (partial.paper_size || partial.orientation) {
      const pSize = target.paper_size;
      const sizeDef = PAPER_SIZES[pSize] || PAPER_SIZES.A4;
      if (target.orientation === 'landscape') {
        target.width_mm = sizeDef.height_mm;
        target.height_mm = sizeDef.width_mm;
      } else {
        target.width_mm = sizeDef.width_mm;
        target.height_mm = sizeDef.height_mm;
      }
    }

    updatedPages[pageIndex] = target;
    set({ pages: updatedPages, isDirty: true });
    get().saveCurrentJob();
  },

  applyLayoutPreset: (presetId: string, copiesPerImage: number = 8) => {
    const { pages, activePageIndex, assets } = get();
    const page = pages[activePageIndex];
    if (!page || assets.length === 0) return;

    const preset = STANDARD_PHOTO_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const printableW = page.width_mm - page.margin_left_mm - page.margin_right_mm;
    const printableH = page.height_mm - page.margin_top_mm - page.margin_bottom_mm;

    const itemW = preset.width_mm;
    const itemH = preset.height_mm;
    const spacingX = page.spacing_x_mm;
    const spacingY = page.spacing_y_mm;

    const cols = Math.floor((printableW + spacingX) / (itemW + spacingX));
    const rows = Math.floor((printableH + spacingY) / (itemH + spacingY));
    const maxCapacity = cols * rows;

    const items: PageItem[] = [];
    let count = 0;

    // Arrange copies for active asset or all assets
    const activeAsset = assets.find((a) => a.id === get().activeAssetId) || assets[0];
    const totalToPlace = Math.min(copiesPerImage || preset.recommendedCopies, maxCapacity);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (count >= totalToPlace) break;

        const posX = page.margin_left_mm + c * (itemW + spacingX);
        const posY = page.margin_top_mm + r * (itemH + spacingY);

        items.push({
          id: crypto.randomUUID(),
          page_id: page.id,
          asset_id: activeAsset.id,
          position_x_mm: posX,
          position_y_mm: posY,
          width_mm: itemW,
          height_mm: itemH,
          rotation_degrees: 0,
          fit_mode: 'cover', // ID/Passport photo fill frame
          z_index: count,
          copy_index: count + 1,
          created_at: new Date().toISOString(),
        });
        count++;
      }
      if (count >= totalToPlace) break;
    }

    const updatedPages = [...pages];
    updatedPages[activePageIndex] = {
      ...page,
      items,
      layout_mode: 'grid',
      updated_at: new Date().toISOString(),
    };

    set({ pages: updatedPages, isDirty: true });
    get().saveCurrentJob();
  },

  applyGridPreset: (rows: number, cols: number) => {
    const { pages, activePageIndex, assets } = get();
    const page = pages[activePageIndex];
    if (!page || assets.length === 0) return;

    const printableW = page.width_mm - page.margin_left_mm - page.margin_right_mm;
    const printableH = page.height_mm - page.margin_top_mm - page.margin_bottom_mm;

    const cellW = (printableW - (cols - 1) * page.spacing_x_mm) / cols;
    const cellH = (printableH - (rows - 1) * page.spacing_y_mm) / rows;

    const items: PageItem[] = [];
    let assetIdx = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const asset = assets[assetIdx % assets.length];
        const posX = page.margin_left_mm + c * (cellW + page.spacing_x_mm);
        const posY = page.margin_top_mm + r * (cellH + page.spacing_y_mm);

        items.push({
          id: crypto.randomUUID(),
          page_id: page.id,
          asset_id: asset.id,
          position_x_mm: posX,
          position_y_mm: posY,
          width_mm: cellW,
          height_mm: cellH,
          rotation_degrees: 0,
          fit_mode: 'contain',
          z_index: items.length,
          copy_index: 1,
          created_at: new Date().toISOString(),
        });
        assetIdx++;
      }
    }

    const updatedPages = [...pages];
    updatedPages[activePageIndex] = {
      ...page,
      items,
      layout_mode: 'grid',
      updated_at: new Date().toISOString(),
    };

    set({ pages: updatedPages, isDirty: true });
    get().saveCurrentJob();
  },

  applyIdCardFrontBackLayout: () => {
    const { pages, activePageIndex, assets } = get();
    const page = pages[activePageIndex];
    if (!page || assets.length === 0) return;

    const frontAsset = assets[0];
    const backAsset = assets.length > 1 ? assets[1] : assets[0];

    // Standard CR80 ID Card dimensions: 85.6 mm x 54 mm
    const idWidth = 85.6;
    const idHeight = 54;

    // Center horizontally on page
    const centerX = (page.width_mm - idWidth) / 2;
    // Stack front and back vertically with clean 15mm gap (standard Indian Xerox format)
    const topFrontY = 35;
    const topBackY = topFrontY + idHeight + 20;

    const items: PageItem[] = [
      {
        id: crypto.randomUUID(),
        page_id: page.id,
        asset_id: frontAsset.id,
        position_x_mm: centerX,
        position_y_mm: topFrontY,
        width_mm: idWidth,
        height_mm: idHeight,
        rotation_degrees: 0,
        fit_mode: 'contain',
        z_index: 1,
        copy_index: 1,
        created_at: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        page_id: page.id,
        asset_id: backAsset.id,
        position_x_mm: centerX,
        position_y_mm: topBackY,
        width_mm: idWidth,
        height_mm: idHeight,
        rotation_degrees: 0,
        fit_mode: 'contain',
        z_index: 2,
        copy_index: 1,
        created_at: new Date().toISOString(),
      },
    ];

    const updatedPages = [...pages];
    updatedPages[activePageIndex] = {
      ...page,
      items,
      layout_mode: 'id_card',
      updated_at: new Date().toISOString(),
    };

    set({ pages: updatedPages, isDirty: true });
    get().saveCurrentJob();
  },

  addPageItem: (pageIndex: number, item: PageItem) => {
    const { pages } = get();
    if (!pages[pageIndex]) return;

    const updated = [...pages];
    updated[pageIndex] = {
      ...updated[pageIndex],
      items: [...(updated[pageIndex].items || []), item],
      updated_at: new Date().toISOString(),
    };
    set({ pages: updated, isDirty: true });
  },

  updatePageItem: (pageIndex: number, itemId: string, updates: Partial<PageItem>) => {
    const { pages } = get();
    if (!pages[pageIndex]) return;

    const updated = [...pages];
    const items = (updated[pageIndex].items || []).map((it) =>
      it.id === itemId ? { ...it, ...updates } : it
    );
    updated[pageIndex] = {
      ...updated[pageIndex],
      items,
      updated_at: new Date().toISOString(),
    };
    set({ pages: updated, isDirty: true });
  },

  removePageItem: (pageIndex: number, itemId: string) => {
    const { pages } = get();
    if (!pages[pageIndex]) return;

    const updated = [...pages];
    const items = (updated[pageIndex].items || []).filter((it) => it.id !== itemId);
    updated[pageIndex] = {
      ...updated[pageIndex],
      items,
      updated_at: new Date().toISOString(),
    };
    set({ pages: updated, isDirty: true });
  },

  clearPageItems: (pageIndex: number) => {
    const { pages } = get();
    if (!pages[pageIndex]) return;

    const updated = [...pages];
    updated[pageIndex] = {
      ...updated[pageIndex],
      items: [],
      updated_at: new Date().toISOString(),
    };
    set({ pages: updated, isDirty: true });
  },
}));
