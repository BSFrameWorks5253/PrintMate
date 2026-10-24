import { ipcMain } from 'electron';
import { Database } from 'sql.js';
import { SettingsRepository } from '../database/repositories/settings.repository';

export function registerSettingsIpc(db: Database): void {
  const settingsRepo = new SettingsRepository(db);

  ipcMain.removeHandler('settings:get');
  ipcMain.handle('settings:get', async (_, { key, defaultValue }: { key: string; defaultValue: any }) => {
    return settingsRepo.get(key, defaultValue);
  });

  ipcMain.removeHandler('settings:set');
  ipcMain.handle('settings:set', async (_, { key, value }: { key: string; value: any }) => {
    settingsRepo.set(key, value);
    return true;
  });

  ipcMain.removeHandler('settings:get-all');
  ipcMain.handle('settings:get-all', async () => {
    return settingsRepo.getAll();
  });
}
