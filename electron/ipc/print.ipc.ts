import { ipcMain, BrowserWindow } from 'electron';

export function registerPrintIpc(mainWindow: BrowserWindow): void {
  ipcMain.handle('printing:get-printers', async () => {
    try {
      const printers = await mainWindow.webContents.getPrintersAsync();
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

  ipcMain.handle('printing:submit', async (_, options: any) => {
    return new Promise((resolve) => {
      try {
        let duplex: 'simplex' | 'longEdge' | 'shortEdge' = 'simplex';
        if (options.duplexMode === 'long_edge') duplex = 'longEdge';
        else if (options.duplexMode === 'short_edge') duplex = 'shortEdge';

        mainWindow.webContents.print(
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
