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
  openFilesDialog: (options?: any) => Promise<any>;
  saveFileDialog: (options?: any) => Promise<string | null>;
  revealInFolder: (filePath: string) => Promise<void>;
  selectFolderDialog: () => Promise<string | null>;
  saveFileToFolder: (options: any) => Promise<string>;
  saveFilesBatch: (options: any) => Promise<any>;
  convertDwgToDxf: (dwgBuffer: ArrayBuffer) => Promise<any>;
  checkForUpdates: (customDir?: string) => Promise<any>;
  downloadUpdate: (options: any) => Promise<string>;
  installUpdate: (installerPath?: string) => Promise<any>;
  onUpdateAvailable: (callback: (data: any) => void) => () => void;
  onUpdateProgress: (callback: (data: any) => void) => () => void;
  onUpdateDownloaded: (callback: (data: any) => void) => () => void;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
