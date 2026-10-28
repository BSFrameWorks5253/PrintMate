const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, structured APIs to the renderer window
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  
  // 1. Get system printers (USB, Network, Virtual)
  getPrinters: async () => {
    return await ipcRenderer.invoke('get-printers');
  },

  // 2. Direct print with options
  printDocument: async (options) => {
    return await ipcRenderer.invoke('print-document', options);
  },

  // 3. Native Print to PDF
  printToPDF: async (options) => {
    return await ipcRenderer.invoke('print-to-pdf', options);
  },

  // 4. Native Windows Save File Dialog
  saveFile: async (fileData, defaultFilename, fileType) => {
    return await ipcRenderer.invoke('save-file', { fileData, defaultFilename, fileType });
  },

  // 5. App & Platform Metadata
  getAppInfo: async () => {
    return await ipcRenderer.invoke('get-app-info');
  }
});
