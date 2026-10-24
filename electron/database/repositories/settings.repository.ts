import { Database } from 'sql.js';
import { queryAll, queryOne, execute } from '../database';

export class SettingsRepository {
  constructor(private db: Database) {}

  get<T = any>(key: string, defaultValue: T): T {
    const row = queryOne<{ key: string; value_json: string }>(
      this.db,
      'SELECT value_json FROM app_settings WHERE key = ?',
      [key]
    );
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value_json) as T;
    } catch {
      return defaultValue;
    }
  }

  set(key: string, value: any): void {
    const valueJson = JSON.stringify(value);
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO app_settings (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at;
    `;
    execute(this.db, sql, [key, valueJson, now]);
  }

  getAll(): Record<string, any> {
    const rows = queryAll<{ key: string; value_json: string }>(
      this.db,
      'SELECT key, value_json FROM app_settings'
    );
    const result: Record<string, any> = {};
    for (const r of rows) {
      try {
        result[r.key] = JSON.parse(r.value_json);
      } catch {
        result[r.key] = r.value_json;
      }
    }
    return result;
  }
}
