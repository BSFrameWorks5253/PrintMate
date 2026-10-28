export interface ElectronPrinterInfo {
  name: string;
  displayName?: string;
  description?: string;
  status?: number;
  isDefault: boolean;
}

export interface ElectronPrintOptions {
  silent?: boolean;
  deviceName?: string;
  color?: boolean;
  landscape?: boolean;
  copies?: number;
  pageSize?: string;
}

export interface ElectronAPI {
  isElectron: boolean;
  getPrinters: () => Promise<ElectronPrinterInfo[]>;
  printDocument: (options?: ElectronPrintOptions) => Promise<{ success: boolean; failureReason?: string }>;
  printToPDF: (options?: { landscape?: boolean; pageSize?: string; defaultFilename?: string }) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  saveFile: (fileData: string | Uint8Array, defaultFilename?: string, fileType?: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  getAppInfo: () => Promise<{ isElectron: boolean; version: string; platform: string; isPackaged: boolean }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
