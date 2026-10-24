import { Database } from 'sql.js';
import { queryAll, queryOne, execute } from '../database';

export interface DbExportRecord {
  id: string;
  job_id: string;
  export_type: 'pdf' | 'png' | 'jpeg';
  output_path: string;
  page_count: number | null;
  output_size_bytes: number | null;
  export_status: 'in_progress' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
}

export class ExportRepository {
  constructor(private db: Database) {}

  create(record: DbExportRecord): DbExportRecord {
    const sql = `
      INSERT INTO export_records (
        id, job_id, export_type, output_path, page_count,
        output_size_bytes, export_status, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    execute(this.db, sql, [
      record.id,
      record.job_id,
      record.export_type,
      record.output_path,
      record.page_count,
      record.output_size_bytes,
      record.export_status,
      record.error_message,
      record.created_at,
    ]);
    return record;
  }

  getById(id: string): DbExportRecord | null {
    return queryOne<DbExportRecord>(this.db, 'SELECT * FROM export_records WHERE id = ?', [id]);
  }

  getByJobId(jobId: string): DbExportRecord[] {
    return queryAll<DbExportRecord>(
      this.db,
      'SELECT * FROM export_records WHERE job_id = ? ORDER BY created_at DESC',
      [jobId]
    );
  }

  updateStatus(
    id: string,
    status: 'in_progress' | 'completed' | 'failed',
    errorMessage: string | null = null,
    outputSizeBytes: number | null = null
  ): void {
    execute(
      this.db,
      'UPDATE export_records SET export_status = ?, error_message = ?, output_size_bytes = COALESCE(?, output_size_bytes) WHERE id = ?',
      [status, errorMessage, outputSizeBytes, id]
    );
  }
}
