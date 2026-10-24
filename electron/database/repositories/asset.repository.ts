import { Database } from 'sql.js';
import { queryAll, queryOne, execute } from '../database';

export interface DbAsset {
  id: string;
  job_id: string;
  original_path: string;
  original_name: string;
  mime_type: string | null;
  file_extension: string | null;
  file_size_bytes: number | null;
  source_width: number | null;
  source_height: number | null;
  page_count: number;
  asset_type: string;
  import_status: string;
  sort_order: number;
  created_at: string;
}

export class AssetRepository {
  constructor(private db: Database) {}

  create(asset: DbAsset): DbAsset {
    const sql = `
      INSERT INTO job_assets (
        id, job_id, original_path, original_name, mime_type, file_extension,
        file_size_bytes, source_width, source_height, page_count, asset_type,
        import_status, sort_order, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    execute(this.db, sql, [
      asset.id,
      asset.job_id,
      asset.original_path,
      asset.original_name,
      asset.mime_type,
      asset.file_extension,
      asset.file_size_bytes,
      asset.source_width,
      asset.source_height,
      asset.page_count,
      asset.asset_type,
      asset.import_status,
      asset.sort_order,
      asset.created_at,
    ]);
    return asset;
  }

  getByJobId(jobId: string): DbAsset[] {
    return queryAll<DbAsset>(
      this.db,
      'SELECT * FROM job_assets WHERE job_id = ? ORDER BY sort_order ASC, created_at ASC',
      [jobId]
    );
  }

  getById(id: string): DbAsset | null {
    return queryOne<DbAsset>(this.db, 'SELECT * FROM job_assets WHERE id = ?', [id]);
  }

  updateOrder(id: string, sortOrder: number): void {
    execute(this.db, 'UPDATE job_assets SET sort_order = ? WHERE id = ?', [sortOrder, id]);
  }

  delete(id: string): void {
    execute(this.db, 'DELETE FROM job_assets WHERE id = ?', [id]);
  }
}
