import { Database } from 'sql.js';
import { queryAll, queryOne, execute } from '../database';

export interface DbEdit {
  id: string;
  asset_id: string;
  revision: number;
  rotation_degrees: number;
  straighten_degrees: number;
  crop_x: number | null;
  crop_y: number | null;
  crop_width: number | null;
  crop_height: number | null;
  perspective_data_json: string | null;
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  grayscale: number;
  text_darkening: number;
  background_mode: string;
  background_color: string | null;
  background_asset_path: string | null;
  processing_options_json: string | null;
  is_current: number;
  created_at: string;
}

export class EditRepository {
  constructor(private db: Database) {}

  save(edit: DbEdit): DbEdit {
    // Set all prior edits for this asset as not current
    execute(this.db, 'UPDATE asset_edits SET is_current = 0 WHERE asset_id = ?', [edit.asset_id]);

    const sql = `
      INSERT INTO asset_edits (
        id, asset_id, revision, rotation_degrees, straighten_degrees,
        crop_x, crop_y, crop_width, crop_height, perspective_data_json,
        brightness, contrast, saturation, sharpness, grayscale, text_darkening,
        background_mode, background_color, background_asset_path,
        processing_options_json, is_current, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    execute(this.db, sql, [
      edit.id,
      edit.asset_id,
      edit.revision,
      edit.rotation_degrees,
      edit.straighten_degrees,
      edit.crop_x,
      edit.crop_y,
      edit.crop_width,
      edit.crop_height,
      edit.perspective_data_json,
      edit.brightness,
      edit.contrast,
      edit.saturation,
      edit.sharpness,
      edit.grayscale,
      edit.text_darkening,
      edit.background_mode,
      edit.background_color,
      edit.background_asset_path,
      edit.processing_options_json,
      edit.is_current,
      edit.created_at,
    ]);

    return edit;
  }

  getCurrent(assetId: string): DbEdit | null {
    return queryOne<DbEdit>(
      this.db,
      'SELECT * FROM asset_edits WHERE asset_id = ? AND is_current = 1 ORDER BY revision DESC LIMIT 1',
      [assetId]
    );
  }

  getHistory(assetId: string): DbEdit[] {
    return queryAll<DbEdit>(
      this.db,
      'SELECT * FROM asset_edits WHERE asset_id = ? ORDER BY revision ASC',
      [assetId]
    );
  }

  getRevisions(assetId: string): DbEdit[] {
    return this.getHistory(assetId);
  }
}
