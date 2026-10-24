import { contextBridge, ipcRenderer } from 'electron';

export const electronAPI = {
  // File operations
  selectImages: async (): Promise<{ path: string; name: string; size: number }[]> => {
    return ipcRenderer.invoke('files:select-images');
  },
  selectPdf: async (): Promise<{ path: string; name: string; size: number } | null> => {
    return ipcRenderer.invoke('files:select-pdf');
  },
  readFileAsDataUrl: async (filePath: string): Promise<string> => {
    return ipcRenderer.invoke('files:read-data-url', filePath);
  },
  saveExportFile: async (defaultName: string, extensions: string[]): Promise<string | null> => {
    return ipcRenderer.invoke('files:save-dialog', { defaultName, extensions });
  },
  writeExportBuffer: async (outputPath: string, bufferBase64: string): Promise<boolean> => {
    return ipcRenderer.invoke('files:write-buffer', { outputPath, bufferBase64 });
  },

  // Job management
  createJob: async (job: any): Promise<any> => {
    return ipcRenderer.invoke('jobs:create', job);
  },
  loadJob: async (jobId: string): Promise<any> => {
    return ipcRenderer.invoke('jobs:load', jobId);
  },
  saveJob: async (jobId: string, payload: any): Promise<any> => {
    return ipcRenderer.invoke('jobs:save', { jobId, payload });
  },
  listRecentJobs: async (limit?: number): Promise<any[]> => {
    return ipcRenderer.invoke('jobs:list-recent', limit);
  },
  deleteJob: async (jobId: string): Promise<boolean> => {
    return ipcRenderer.invoke('jobs:delete', jobId);
  },
  verifyJobAssets: async (jobId: string): Promise<{ asset: any; exists: boolean }[]> => {
    return ipcRenderer.invoke('jobs:verify-assets', jobId);
  },

  // Printing
  getPrinters: async (): Promise<any[]> => {
    return ipcRenderer.invoke('printing:get-printers');
  },
  submitPrint: async (options: any): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('printing:submit', options);
  },

  // Settings
  getSetting: async (key: string, defaultValue: any): Promise<any> => {
    return ipcRenderer.invoke('settings:get', { key, defaultValue });
  },
  setSetting: async (key: string, value: any): Promise<boolean> => {
    return ipcRenderer.invoke('settings:set', { key, value });
  },
  getAllSettings: async (): Promise<Record<string, any>> => {
    return ipcRenderer.invoke('settings:get-all');
  },

  // System
  getAppVersion: async (): Promise<string> => {
    return ipcRenderer.invoke('system:version');
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
