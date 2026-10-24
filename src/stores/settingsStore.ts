import { create } from 'zustand';
import { AppSettings, SystemPrinter, PaperSize, Orientation } from '../types';

interface SettingsState {
  settings: AppSettings;
  printers: SystemPrinter[];
  selectedPrinter: string | null;
  isLoadingPrinters: boolean;

  fetchSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  fetchPrinters: () => Promise<void>;
  setSelectedPrinter: (printerName: string | null) => void;
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  default_paper_size: 'A4',
  default_orientation: 'portrait',
  default_margin_mm: 5,
  default_spacing_mm: 2,
  default_printer: null,
  default_photo_preset: 'passport_in',
  export_directory: null,
  jobs_directory: null,
  autosave_enabled: true,
  preview_quality: 'high',
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  printers: [],
  selectedPrinter: null,
  isLoadingPrinters: false,

  fetchSettings: async () => {
    if (!window.electronAPI) return;
    try {
      const all = await window.electronAPI.getAllSettings();
      if (all && Object.keys(all).length > 0) {
        set({ settings: { ...defaultSettings, ...all } });
        if (all.default_printer) {
          set({ selectedPrinter: all.default_printer });
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings from SQLite:', err);
    }
  },

  updateSetting: async (key, value) => {
    const updated = { ...get().settings, [key]: value };
    set({ settings: updated });
    if (window.electronAPI) {
      try {
        await window.electronAPI.setSetting(key as string, value);
      } catch (err) {
        console.error(`Failed to persist setting ${key}:`, err);
      }
    }
  },

  fetchPrinters: async () => {
    if (!window.electronAPI) return;
    set({ isLoadingPrinters: true });
    try {
      const list = await window.electronAPI.getPrinters();
      set({ printers: list, isLoadingPrinters: false });
      if (!get().selectedPrinter && list.length > 0) {
        const defaultPrinter = list.find((p: any) => p.isDefault) || list[0];
        set({ selectedPrinter: defaultPrinter.name });
      }
    } catch (err) {
      console.error('Failed to get printers:', err);
      set({ isLoadingPrinters: false });
    }
  },

  setSelectedPrinter: (printerName) => {
    set({ selectedPrinter: printerName });
  },
}));
