import { ipcMain } from 'electron';
import { Database } from 'sql.js';
import { SettingsRepository } from '../database/repositories/settings.repository';

export function registerSettingsIpc(db: Database): void {
  const settingsRepo = new SettingsRepository(db);

  ipcMain.handle('settings:get', async (_, { key, defaultValue }: { key: string; defaultValue: any }) => {
    return settingsRepo.get(key, defaultValue);
  });

  ipcMain.handle('settings:set', async (_, { key, value }: { key: string; value: any }) => {
    settingsRepo.set(key, value);
    return true;
  });

  ipcMain.handle('settings:get-all', async () => {
    return settingsRepo.getAll();
  });
}
