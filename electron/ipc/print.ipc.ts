import { ipcMain, BrowserWindow } from 'electron';

function getTargetWindow(): BrowserWindow | undefined {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0 && !windows[0].isDestroyed()) return windows[0];
  return undefined;
}

export function registerPrintIpc(): void {
  ipcMain.removeHandler('printing:get-printers');
  ipcMain.handle('printing:get-printers', async () => {
    try {
      const win = getTargetWindow();
      if (!win) return [];
      const printers = await win.webContents.getPrintersAsync();
      return printers.map((p) => ({
        name: p.name,
        description: p.description || p.displayName || p.name,
        isDefault: p.isDefault,
        status: p.status,
      }));
    } catch (err) {
      console.error('Failed to get system printers:', err);
      return [];
    }
  });

  ipcMain.removeHandler('printing:submit');
  ipcMain.handle('printing:submit', async (_, options: any) => {
    return new Promise((resolve) => {
      try {
        const win = getTargetWindow();
        if (!win) {
          resolve({ success: false, error: 'No active window available for print dispatch' });
          return;
        }

        let duplex: 'simplex' | 'longEdge' | 'shortEdge' = 'simplex';
        if (options.duplexMode === 'long_edge') duplex = 'longEdge';
        else if (options.duplexMode === 'short_edge') duplex = 'shortEdge';

        win.webContents.print(
          {
            silent: options.silent ?? false,
            printBackground: true,
            deviceName: options.printerName || undefined,
            color: options.colorMode !== 'grayscale',
            copies: options.copies || 1,
            duplexMode: duplex,
            landscape: options.orientation === 'landscape',
            margins: { marginType: 'none' }, // exact mm positions handled in layout
            collate: options.collate ?? true,
          },
          (success, failureReason) => {
            if (success) {
              resolve({ success: true });
            } else {
              resolve({ success: false, error: failureReason || 'Printing was cancelled or failed' });
            }
          }
        );
      } catch (err: any) {
        resolve({ success: false, error: err.message || 'Unknown printer submission error' });
      }
    });
  });
}
