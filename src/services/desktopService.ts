import type { ElectronPrinterInfo, ElectronPrintOptions } from '../types/electron';

// Check if running inside Electron wrapper
export const isElectronApp = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
};

// Check if running in installed PWA standalone mode
export const isPwaStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
};

// Hardware printer helpers
export const getSystemPrinters = async (): Promise<ElectronPrinterInfo[]> => {
  if (window.electronAPI?.getPrinters) {
    try {
      return await window.electronAPI.getPrinters();
    } catch (err) {
      console.error('[Desktop] Failed to get printers:', err);
      return [];
    }
  }
  return [];
};

export const printWithElectron = async (options?: ElectronPrintOptions) => {
  if (window.electronAPI?.printDocument) {
    return await window.electronAPI.printDocument(options);
  }
  // Fallback to standard browser print
  window.print();
  return { success: true };
};

export const exportElectronPdf = async (defaultFilename?: string, landscape = false) => {
  if (window.electronAPI?.printToPDF) {
    return await window.electronAPI.printToPDF({
      defaultFilename,
      landscape,
      pageSize: 'A4'
    });
  }
  return { success: false, error: 'Electron PDF export not available in browser' };
};

export const saveFileNative = async (fileData: string | Uint8Array, defaultFilename: string, fileType = 'png') => {
  if (window.electronAPI?.saveFile) {
    return await window.electronAPI.saveFile(fileData, defaultFilename, fileType);
  }
  // Browser fallback: trigger virtual anchor download
  try {
    const a = document.createElement('a');
    if (typeof fileData === 'string' && fileData.startsWith('data:')) {
      a.href = fileData;
    } else {
      const blob = new Blob([fileData as unknown as BlobPart]);
      a.href = URL.createObjectURL(blob);
    }
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { success: true, filePath: defaultFilename };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
};
