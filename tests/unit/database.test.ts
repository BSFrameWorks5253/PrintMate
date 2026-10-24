import { describe, it, expect, beforeAll } from 'vitest';
import initSqlJs, { Database } from 'sql.js';
import { JobRepository } from '../../electron/database/repositories/job.repository';
import { AssetRepository } from '../../electron/database/repositories/asset.repository';
import { SettingsRepository } from '../../electron/database/repositories/settings.repository';
import { execute, queryAll } from '../../electron/database/database';

describe('SQLite Database & Repository Tests', () => {
  let db: Database;
  let jobRepo: JobRepository;
  let assetRepo: AssetRepository;
  let settingsRepo: SettingsRepository;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();

    // Run Migration 1 schema
    db.run(`
      CREATE TABLE IF NOT EXISTS print_jobs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_opened_at TEXT,
        notes TEXT,
        schema_version INTEGER NOT NULL DEFAULT 1
      );

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
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    jobRepo = new JobRepository(db);
    assetRepo = new AssetRepository(db);
    settingsRepo = new SettingsRepository(db);
  });

  it('creates and retrieves a print job', () => {
    const jobId = 'test-job-1';
    const now = new Date().toISOString();
    jobRepo.create({
      id: jobId,
      name: 'Passport Photo Run',
      status: 'ready',
      created_at: now,
      updated_at: now,
      last_opened_at: null,
      notes: 'Customer urgent print',
      schema_version: 1,
    });

    const retrieved = jobRepo.getById(jobId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe('Passport Photo Run');
    expect(retrieved?.status).toBe('ready');
  });

  it('adds and lists job assets', () => {
    const assetId = 'asset-1';
    const now = new Date().toISOString();
    assetRepo.create({
      id: assetId,
      job_id: 'test-job-1',
      original_path: 'C:/photos/customer.jpg',
      original_name: 'customer.jpg',
      mime_type: 'image/jpeg',
      file_extension: 'jpg',
      file_size_bytes: 1048576,
      source_width: 1200,
      source_height: 1600,
      page_count: 1,
      asset_type: 'image',
      import_status: 'ready',
      sort_order: 0,
      created_at: now,
    });

    const assets = assetRepo.getByJobId('test-job-1');
    expect(assets.length).toBe(1);
    expect(assets[0].original_name).toBe('customer.jpg');
    expect(assets[0].source_width).toBe(1200);
  });

  it('persists and retrieves app settings', () => {
    settingsRepo.set('theme', 'dark');
    settingsRepo.set('default_paper_size', 'A4');

    expect(settingsRepo.get('theme', 'light')).toBe('dark');
    expect(settingsRepo.get('default_paper_size', 'Letter')).toBe('A4');
    expect(settingsRepo.get('non_existent', 'fallback')).toBe('fallback');
  });
});
