import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';

let dbInstance: Database | null = null;
let dbFilePath = '';

export function getDatabasePath(): string {
  if (dbFilePath) return dbFilePath;

  const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : '/tmp');
  const dir = path.join(appData, 'PrintMate', 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  dbFilePath = path.join(dir, 'printmate.db');
  return dbFilePath;
}

export function saveDatabase(): void {
  if (!dbInstance || !dbFilePath) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbFilePath, buffer);
  } catch (err) {
    console.error('Failed to persist SQLite database:', err);
  }
}

export async function initDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  const filePath = getDatabasePath();

  if (fs.existsSync(filePath)) {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.warn('Existing database corrupted or unreadable, creating fresh database:', err);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Configure pragmas
  dbInstance.run(`
    PRAGMA foreign_keys = ON;
  `);

  runMigrations(dbInstance);
  saveDatabase();

  return dbInstance;
}

export function runMigrations(db: Database): void {
  // Migration tracking table
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = queryAll<{ version: number }>(db, 'SELECT version FROM schema_migrations ORDER BY version ASC');
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  // Migration 1: Initial schema matching Database_Schema.md
  if (!appliedVersions.has(1)) {
    db.run(`
      CREATE TABLE IF NOT EXISTS print_jobs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'importing', 'processing', 'ready', 'printing', 'completed', 'failed', 'archived')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_opened_at TEXT,
        notes TEXT,
        schema_version INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_print_jobs_updated ON print_jobs(updated_at DESC);

      CREATE TABLE IF NOT EXISTS job_assets (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        original_path TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT,
        file_extension TEXT,
        file_size_bytes INTEGER,
        source_width INTEGER,
        source_height INTEGER,
        page_count INTEGER NOT NULL DEFAULT 1,
        asset_type TEXT NOT NULL,
        import_status TEXT NOT NULL DEFAULT 'ready',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES print_jobs(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_job_assets_job ON job_assets(job_id, sort_order);

      CREATE TABLE IF NOT EXISTS asset_edits (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        rotation_degrees REAL NOT NULL DEFAULT 0,
        straighten_degrees REAL NOT NULL DEFAULT 0,
        crop_x REAL,
        crop_y REAL,
        crop_width REAL,
        crop_height REAL,
        perspective_data_json TEXT,
        brightness REAL NOT NULL DEFAULT 0,
        contrast REAL NOT NULL DEFAULT 1,
        saturation REAL NOT NULL DEFAULT 1,
        sharpness REAL NOT NULL DEFAULT 0,
        grayscale INTEGER NOT NULL DEFAULT 0,
        text_darkening REAL NOT NULL DEFAULT 0,
        background_mode TEXT NOT NULL DEFAULT 'original',
        background_color TEXT,
        background_asset_path TEXT,
        processing_options_json TEXT,
        is_current INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (asset_id) REFERENCES job_assets(id) ON DELETE CASCADE,
        UNIQUE(asset_id, revision)
      );

      CREATE TABLE IF NOT EXISTS processed_assets (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        edit_revision INTEGER NOT NULL,
        output_path TEXT NOT NULL,
        output_format TEXT NOT NULL,
        output_width INTEGER,
        output_height INTEGER,
        checksum TEXT,
        processing_status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (asset_id) REFERENCES job_assets(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS job_pages (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        paper_size TEXT NOT NULL,
        orientation TEXT NOT NULL,
        width_mm REAL NOT NULL,
        height_mm REAL NOT NULL,
        margin_top_mm REAL NOT NULL DEFAULT 5,
        margin_right_mm REAL NOT NULL DEFAULT 5,
        margin_bottom_mm REAL NOT NULL DEFAULT 5,
        margin_left_mm REAL NOT NULL DEFAULT 5,
        background_color TEXT NOT NULL DEFAULT '#FFFFFF',
        layout_mode TEXT NOT NULL DEFAULT 'grid',
        spacing_x_mm REAL NOT NULL DEFAULT 2,
        spacing_y_mm REAL NOT NULL DEFAULT 2,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES print_jobs(id) ON DELETE CASCADE,
        UNIQUE(job_id, page_number)
      );

      CREATE TABLE IF NOT EXISTS page_items (
        id TEXT PRIMARY KEY,
        page_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        position_x_mm REAL NOT NULL,
        position_y_mm REAL NOT NULL,
        width_mm REAL NOT NULL,
        height_mm REAL NOT NULL,
        rotation_degrees REAL NOT NULL DEFAULT 0,
        fit_mode TEXT NOT NULL DEFAULT 'contain',
        z_index INTEGER NOT NULL DEFAULT 0,
        copy_index INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (page_id) REFERENCES job_pages(id) ON DELETE CASCADE,
        FOREIGN KEY (asset_id) REFERENCES job_assets(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS print_configs (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        printer_name TEXT,
        copies INTEGER NOT NULL DEFAULT 1,
        color_mode TEXT NOT NULL DEFAULT 'color',
        duplex_mode TEXT NOT NULL DEFAULT 'simplex',
        paper_source TEXT,
        scaling_mode TEXT NOT NULL DEFAULT 'actual_size',
        "collate" INTEGER NOT NULL DEFAULT 1,
        page_range TEXT,
        driver_options_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES print_jobs(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS export_records (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        export_type TEXT NOT NULL,
        output_path TEXT NOT NULL,
        page_count INTEGER,
        output_size_bytes INTEGER,
        export_status TEXT NOT NULL,
        error_message TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES print_jobs(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS job_events (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        message TEXT,
        details_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES print_jobs(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS printer_profiles (
        id TEXT PRIMARY KEY,
        profile_name TEXT NOT NULL,
        printer_name TEXT,
        paper_size TEXT NOT NULL DEFAULT 'A4',
        orientation TEXT NOT NULL DEFAULT 'portrait',
        color_mode TEXT NOT NULL DEFAULT 'color',
        duplex_mode TEXT NOT NULL DEFAULT 'simplex',
        settings_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_operations (
        id TEXT PRIMARY KEY,
        job_id TEXT,
        operation_type TEXT NOT NULL,
        status TEXT NOT NULL,
        progress REAL NOT NULL DEFAULT 0,
        current_step TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES print_jobs(id) ON DELETE SET NULL
      );
    `);

    db.run(
      `INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?);`,
      [new Date().toISOString()]
    );
  }
}

/**
 * Execute a query that returns multiple rows
 */
export function queryAll<T = any>(db: Database, sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

/**
 * Execute a query that returns a single row or null
 */
export function queryOne<T = any>(db: Database, sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute an insert/update/delete statement and automatically persist the db
 */
export function execute(db: Database, sql: string, params: any[] = []): void {
  db.run(sql, params);
  saveDatabase();
}

/**
 * Run a callback inside an atomic transaction with automatic rollback on error
 */
export function withTransaction<T>(db: Database, fn: () => T): T {
  db.run('BEGIN TRANSACTION;');
  try {
    const result = fn();
    db.run('COMMIT;');
    saveDatabase();
    return result;
  } catch (error) {
    try {
      db.run('ROLLBACK;');
    } catch {
      // Ignore rollback failure if already rolled back
    }
    throw error;
  }
}
