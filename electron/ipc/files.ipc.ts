import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs/promises';
import path from 'path';

function getTargetWindow(): BrowserWindow | undefined {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0 && !windows[0].isDestroyed()) return windows[0];
  return undefined;
}

export function registerFileIpc(): void {
  ipcMain.removeHandler('files:select-images');
  ipcMain.handle('files:select-images', async () => {
    try {
      const win = getTargetWindow();
      const result = await dialog.showOpenDialog(win as any, {
        title: 'Import Images — PrintMate',
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return [];
      }

      const fileInfos = [];
      for (const filePath of result.filePaths) {
        try {
          const stat = await fs.stat(filePath);
          fileInfos.push({
            path: filePath,
            name: path.basename(filePath),
            size: stat.size,
          });
        } catch (err) {
          console.error('Error stating file:', filePath, err);
        }
      }
      return fileInfos;
    } catch (err) {
      console.error('Error in files:select-images:', err);
      return [];
    }
  });

  ipcMain.removeHandler('files:select-pdf');
  ipcMain.handle('files:select-pdf', async () => {
    try {
      const win = getTargetWindow();
      const result = await dialog.showOpenDialog(win as any, {
        title: 'Import PDF Document — PrintMate',
        properties: ['openFile'],
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const filePath = result.filePaths[0];
      const stat = await fs.stat(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        size: stat.size,
      };
    } catch (err) {
      console.error('Error in files:select-pdf:', err);
      return null;
    }
  });

  ipcMain.removeHandler('files:read-data-url');
  ipcMain.handle('files:read-data-url', async (_, filePath: string) => {
    try {
      const buffer = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase().replace('.', '');
      let mime = 'image/jpeg';
      if (ext === 'png') mime = 'image/png';
      else if (ext === 'webp') mime = 'image/webp';
      else if (ext === 'pdf') mime = 'application/pdf';
      else if (ext === 'bmp') mime = 'image/bmp';

      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (err) {
      console.error('Failed to read file as data url:', filePath, err);
      throw err;
    }
  });

  ipcMain.removeHandler('files:save-dialog');
  ipcMain.handle(
    'files:save-dialog',
    async (_, { defaultName, extensions }: { defaultName: string; extensions: string[] }) => {
      const win = getTargetWindow();
      const result = await dialog.showSaveDialog(win as any, {
        title: 'Export Document — PrintMate',
        defaultPath: defaultName,
        filters: [{ name: 'Export Files', extensions }],
      });
      if (result.canceled || !result.filePath) return null;
      return result.filePath;
    }
  );

  ipcMain.removeHandler('files:write-buffer');
  ipcMain.handle(
    'files:write-buffer',
    async (_, { outputPath, bufferBase64 }: { outputPath: string; bufferBase64: string }) => {
      try {
        const buffer = Buffer.from(bufferBase64, 'base64');
        const dir = path.dirname(outputPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(outputPath, buffer);
        return true;
      } catch (err) {
        console.error('Failed to write exported file:', outputPath, err);
        throw err;
      }
    }
  );
}
