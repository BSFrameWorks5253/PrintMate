import { Database } from 'sql.js';
import { queryAll, queryOne, execute } from '../database';

export interface DbJob {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  notes: string | null;
  schema_version: number;
}

export class JobRepository {
  constructor(private db: Database) {}

  create(job: DbJob): DbJob {
    const sql = `
      INSERT INTO print_jobs (id, name, status, created_at, updated_at, last_opened_at, notes, schema_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;
    execute(this.db, sql, [
      job.id,
      job.name,
      job.status,
      job.created_at,
      job.updated_at,
      job.last_opened_at,
      job.notes,
      job.schema_version,
    ]);
    return job;
  }

  getById(id: string): DbJob | null {
    return queryOne<DbJob>(this.db, 'SELECT * FROM print_jobs WHERE id = ?', [id]);
  }

  listRecent(limit: number = 20): DbJob[] {
    return queryAll<DbJob>(
      this.db,
      'SELECT * FROM print_jobs ORDER BY updated_at DESC LIMIT ?',
      [limit]
    );
  }

  update(id: string, updates: Partial<DbJob>): void {
    const fields: string[] = [];
    const values: any[] = [];

    const now = new Date().toISOString();
    updates.updated_at = now;

    for (const [key, val] of Object.entries(updates)) {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(val);
      }
    }

    values.push(id);
    const sql = `UPDATE print_jobs SET ${fields.join(', ')} WHERE id = ?`;
    execute(this.db, sql, values);
  }

  touchOpened(id: string): void {
    const now = new Date().toISOString();
    execute(this.db, 'UPDATE print_jobs SET last_opened_at = ?, updated_at = ? WHERE id = ?', [
      now,
      now,
      id,
    ]);
  }

  delete(id: string): void {
    execute(this.db, 'DELETE FROM print_jobs WHERE id = ?', [id]);
  }
}
