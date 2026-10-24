import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { initDatabase, saveDatabase } from './database/database';
import { registerFileIpc } from './ipc/files.ipc';
import { registerJobIpc } from './ipc/job.ipc';
import { registerPrintIpc } from './ipc/print.ipc';
import { registerSettingsIpc } from './ipc/settings.ipc';

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1080,
    minHeight: 700,
    title: 'PrintMate — Xerox & Print Studio',
    backgroundColor: '#0b0f17',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Remove default menu bar for clean professional printing-app feel
  mainWindow.setMenuBarVisibility(false);

  // Initialize SQLite database
  try {
    const db = await initDatabase();
    registerFileIpc(mainWindow);
    registerJobIpc(db);
    registerPrintIpc(mainWindow);
    registerSettingsIpc(db);
  } catch (err) {
    console.error('Failed to initialize database and IPC:', err);
  }

  ipcMain.handle('system:version', () => {
    return app.getVersion();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  saveDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  saveDatabase();
});
