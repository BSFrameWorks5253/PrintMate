import { Database } from 'sql.js';
import { queryAll, queryOne, execute } from '../database';

export interface DbOperation {
  id: string;
  job_id: string | null;
  operation_type: 'background_removal' | 'deskew' | 'pdf_render' | 'pdf_export' | 'print_spool';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  current_step: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export class OperationRepository {
  constructor(private db: Database) {}

  create(op: DbOperation): DbOperation {
    const sql = `
      INSERT INTO app_operations (
        id, job_id, operation_type, status, progress, current_step, error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    execute(this.db, sql, [
      op.id,
      op.job_id,
      op.operation_type,
      op.status,
      op.progress,
      op.current_step,
      op.error_message,
      op.created_at,
      op.updated_at,
    ]);
    return op;
  }

  getById(id: string): DbOperation | null {
    return queryOne<DbOperation>(this.db, 'SELECT * FROM app_operations WHERE id = ?', [id]);
  }

  getByJobId(jobId: string): DbOperation[] {
    return queryAll<DbOperation>(
      this.db,
      'SELECT * FROM app_operations WHERE job_id = ? ORDER BY created_at DESC',
      [jobId]
    );
  }

  updateProgress(id: string, progress: number, currentStep?: string): void {
    const now = new Date().toISOString();
    execute(
      this.db,
      'UPDATE app_operations SET progress = ?, current_step = COALESCE(?, current_step), updated_at = ? WHERE id = ?',
      [progress, currentStep || null, now, id]
    );
  }

  complete(id: string): void {
    const now = new Date().toISOString();
    execute(
      this.db,
      "UPDATE app_operations SET status = 'completed', progress = 1.0, updated_at = ? WHERE id = ?",
      [now, id]
    );
  }

  fail(id: string, errorMessage: string): void {
    const now = new Date().toISOString();
    execute(
      this.db,
      "UPDATE app_operations SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?",
      [errorMessage, now, id]
    );
  }
}
