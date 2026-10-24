import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, saveDatabase } from './database/database';
import { registerFileIpc } from './ipc/files.ipc';
import { registerJobIpc } from './ipc/job.ipc';
import { registerPrintIpc } from './ipc/print.ipc';
import { registerSettingsIpc } from './ipc/settings.ipc';

process.on('uncaughtException', (err) => {
  console.error('[PrintMate Main] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[PrintMate Main] Unhandled Rejection:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let isIpcInitialized = false;

async function setupIpc() {
  if (isIpcInitialized) return;
  isIpcInitialized = true;

  ipcMain.removeHandler('system:version');
  ipcMain.handle('system:version', () => app.getVersion());

  registerFileIpc();
  registerPrintIpc();

  try {
    const db = await initDatabase();
    registerJobIpc(db);
    registerSettingsIpc(db);
  } catch (err) {
    console.error('Failed to initialize database during IPC registration:', err);
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1080,
    minHeight: 700,
    title: 'PrintMate — Xerox & Print Studio',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Remove default menu bar for clean professional printing-app feel
  mainWindow.setMenuBarVisibility(false);

  if (process.env.VITE_DEV_SERVER_URL) {
    try {
      await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } catch (err) {
      console.warn('Failed initial loadURL, retrying in 500ms:', err);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && process.env.VITE_DEV_SERVER_URL) {
          mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL).catch(() => {});
        }
      }, 500);
    }
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await setupIpc();
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
