const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    title: 'PrintMate Studio - ID Scanner & Print Studio',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true
    }
  });

  // Smooth appearance when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

  if (isDev && process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else if (isDev) {
    mainWindow.loadURL(devServerUrl).catch(() => {
      // Fallback to dist if dev server not running
      const indexPath = path.join(__dirname, '../dist/index.html');
      if (fs.existsSync(indexPath)) {
        mainWindow.loadFile(indexPath);
      } else {
        mainWindow.loadURL(devServerUrl);
      }
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers for Native Hardware & File System

// 1. Get List of System Printers
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers;
  } catch (error) {
    console.error('[Electron] Error fetching printers:', error);
    return [];
  }
});

// 2. Direct Hardware Print
ipcMain.handle('print-document', async (event, options = {}) => {
  if (!mainWindow) return { success: false, error: 'No active window' };

  return new Promise((resolve) => {
    mainWindow.webContents.print(
      {
        silent: options.silent || false,
        printBackground: true,
        deviceName: options.deviceName || '',
        color: options.color !== false,
        margins: { marginType: 'none' },
        landscape: options.landscape || false,
        pagesPerSheet: 1,
        collate: true,
        copies: options.copies || 1,
        pageSize: options.pageSize || 'A4',
        header: '',
        footer: ''
      },
      (success, failureReason) => {
        resolve({ success, failureReason });
      }
    );
  });
});

// 3. Native Print to Vector PDF
ipcMain.handle('print-to-pdf', async (event, options = {}) => {
  if (!mainWindow) return { success: false, error: 'No active window' };

  try {
    const pdfData = await mainWindow.webContents.printToPDF({
      printBackground: true,
      landscape: options.landscape || false,
      pageSize: options.pageSize || 'A4',
      margins: { marginType: 'none' }
    });

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Document as PDF',
      defaultPath: options.defaultFilename || 'PrintMate_Layout.pdf',
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    });

    if (!canceled && filePath) {
      await fs.promises.writeFile(filePath, pdfData);
      return { success: true, filePath };
    }

    return { success: false, canceled: true };
  } catch (err) {
    console.error('[Electron] PDF print error:', err);
    return { success: false, error: err.message };
  }
});

// 4. Native Windows Save File Dialog (Images / Scans)
ipcMain.handle('save-file', async (event, { fileData, defaultFilename, fileType }) => {
  if (!mainWindow) return { success: false, error: 'No active window' };

  try {
    const extension = fileType === 'png' ? 'png' : fileType === 'pdf' ? 'pdf' : 'jpg';
    const filterName = extension.toUpperCase() + ' File';

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save File',
      defaultPath: defaultFilename || `PrintMate_${Date.now()}.${extension}`,
      filters: [{ name: filterName, extensions: [extension] }]
    });

    if (!canceled && filePath) {
      // Decode dataUrl if provided as string
      let buffer;
      if (typeof fileData === 'string' && fileData.startsWith('data:')) {
        const base64Data = fileData.replace(/^data:[A-Za-z-+/]+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(fileData);
      }

      await fs.promises.writeFile(filePath, buffer);
      return { success: true, filePath };
    }

    return { success: false, canceled: true };
  } catch (err) {
    console.error('[Electron] File save error:', err);
    return { success: false, error: err.message };
  }
});

// 5. App Info
ipcMain.handle('get-app-info', async () => {
  return {
    isElectron: true,
    version: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged
  };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
