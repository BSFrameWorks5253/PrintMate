import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  queryAll,
  execute,
  withTransaction,
  runMigrations,
} from '../../electron/database/database';
import { JobRepository, DbJob } from '../../electron/database/repositories/job.repository';
import { AssetRepository, DbAsset } from '../../electron/database/repositories/asset.repository';
import { EditRepository, DbEdit } from '../../electron/database/repositories/edit.repository';
import { PageRepository, DbJobPage, DbPageItem } from '../../electron/database/repositories/page.repository';
import { ExportRepository, DbExportRecord } from '../../electron/database/repositories/export.repository';
import { OperationRepository, DbOperation } from '../../electron/database/repositories/operation.repository';
import { SettingsRepository } from '../../electron/database/repositories/settings.repository';

describe('Phase 2: Database and Persistence Layer', () => {
  let db: Database;
  let tempDir: string;
  let sampleFilePath: string;
  const standardJobId = 'job-101';

  beforeEach(async () => {
    // Initialize in-memory database
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run('PRAGMA foreign_keys = ON;');

    // Run canonical database migrations
    runMigrations(db);

    // Seed default parent job for foreign-key relational tests
    const now = new Date().toISOString();
    execute(
      db,
      `INSERT INTO print_jobs (id, name, status, created_at, updated_at, schema_version)
       VALUES (?, ?, 'draft', ?, ?, 1)`,
      [standardJobId, 'Initial Test Job', now, now]
    );

    // Create temporary file on disk for non-destructive and missing-file tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'printmate-test-'));
    sampleFilePath = path.join(tempDir, 'original_customer_doc.jpg');
    fs.writeFileSync(sampleFilePath, 'Simulated JPG file bytes for PrintMate test');
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error
    }
  });

  it('1. verifies versioned database migrations apply cleanly', () => {
    const migrations = queryAll<{ version: number }>(
      db,
      'SELECT version FROM schema_migrations'
    );
    expect(migrations.length).toBe(1);
    expect(migrations[0].version).toBe(1);
  });

  it('2. persists and updates jobs in JobRepository', () => {
    const jobRepo = new JobRepository(db);
    const now = new Date().toISOString();

    const job: DbJob = {
      id: 'job-passport-new',
      name: 'Passport Photos 8-up',
      status: 'draft',
      created_at: now,
      updated_at: now,
      last_opened_at: null,
      notes: 'Customer requested white background',
      schema_version: 1,
    };

    jobRepo.create(job);
    const loaded = jobRepo.getById('job-passport-new');
    expect(loaded).toBeDefined();
    expect(loaded?.name).toBe('Passport Photos 8-up');
    expect(loaded?.status).toBe('draft');

    // Update job status
    jobRepo.update('job-passport-new', { status: 'ready', notes: 'Completed layout' });
    const updated = jobRepo.getById('job-passport-new');
    expect(updated?.status).toBe('ready');
    expect(updated?.notes).toBe('Completed layout');

    // Touch opened
    jobRepo.touchOpened('job-passport-new');
    const touched = jobRepo.getById('job-passport-new');
    expect(touched?.last_opened_at).not.toBeNull();
  });

  it('3. stores file references and detects existing vs missing source files', () => {
    const assetRepo = new AssetRepository(db);
    const now = new Date().toISOString();

    // Create asset pointing to real file on disk
    const existingAsset: DbAsset = {
      id: 'asset-existing',
      job_id: standardJobId,
      original_path: sampleFilePath,
      original_name: 'original_customer_doc.jpg',
      mime_type: 'image/jpeg',
      file_extension: 'jpg',
      file_size_bytes: 1024,
      source_width: 800,
      source_height: 600,
      page_count: 1,
      asset_type: 'image',
      import_status: 'ready',
      sort_order: 0,
      created_at: now,
    };

    // Create asset pointing to non-existent path
    const missingAsset: DbAsset = {
      id: 'asset-missing',
      job_id: standardJobId,
      original_path: 'C:\\Users\\NonExistent\\Desktop\\deleted_file.png',
      original_name: 'deleted_file.png',
      mime_type: 'image/png',
      file_extension: 'png',
      file_size_bytes: 2048,
      source_width: 1024,
      source_height: 768,
      page_count: 1,
      asset_type: 'image',
      import_status: 'ready',
      sort_order: 1,
      created_at: now,
    };

    assetRepo.create(existingAsset);
    assetRepo.create(missingAsset);

    // Verify source file detection
    expect(assetRepo.checkSourceExists(existingAsset)).toBe(true);
    expect(assetRepo.checkSourceExists(missingAsset)).toBe(false);

    const verificationResults = assetRepo.verifyJobAssets(standardJobId);
    expect(verificationResults.length).toBe(2);
    expect(verificationResults.find((r) => r.asset.id === 'asset-existing')?.exists).toBe(true);
    expect(verificationResults.find((r) => r.asset.id === 'asset-missing')?.exists).toBe(false);
  });

  it('4. manages non-destructive edit revisions in EditRepository', () => {
    const assetRepo = new AssetRepository(db);
    const editRepo = new EditRepository(db);
    const now = new Date().toISOString();

    // Seed parent asset
    assetRepo.create({
      id: 'asset-for-edits',
      job_id: standardJobId,
      original_path: sampleFilePath,
      original_name: 'scan.jpg',
      mime_type: 'image/jpeg',
      file_extension: 'jpg',
      file_size_bytes: 512,
      source_width: 600,
      source_height: 800,
      page_count: 1,
      asset_type: 'image',
      import_status: 'ready',
      sort_order: 0,
      created_at: now,
    });

    const revision1: DbEdit = {
      id: 'edit-rev-1',
      asset_id: 'asset-for-edits',
      revision: 1,
      rotation_degrees: 90,
      straighten_degrees: 1.5,
      crop_x: 10,
      crop_y: 10,
      crop_width: 400,
      crop_height: 500,
      perspective_data_json: null,
      brightness: 0.1,
      contrast: 1.2,
      saturation: 1.0,
      sharpness: 1.0,
      grayscale: 0,
      text_darkening: 0.5,
      background_mode: 'color',
      background_color: '#FFFFFF',
      background_asset_path: null,
      processing_options_json: null,
      is_current: 1,
      created_at: now,
    };

    editRepo.save(revision1);
    const current = editRepo.getCurrent('asset-for-edits');
    expect(current).toBeDefined();
    expect(current?.rotation_degrees).toBe(90);
    expect(current?.straighten_degrees).toBe(1.5);
    expect(current?.background_mode).toBe('color');

    // Add revision 2 (keeps revision 1 safe in database)
    const revision2: DbEdit = {
      ...revision1,
      id: 'edit-rev-2',
      revision: 2,
      brightness: 0.35,
      is_current: 1,
    };
    editRepo.save(revision2);

    const updatedCurrent = editRepo.getCurrent('asset-for-edits');
    expect(updatedCurrent?.revision).toBe(2);
    expect(updatedCurrent?.brightness).toBe(0.35);

    const allRevisions = editRepo.getRevisions('asset-for-edits');
    expect(allRevisions.length).toBe(2);
  });

  it('5. saves and retrieves multi-item page layouts in PageRepository', () => {
    const assetRepo = new AssetRepository(db);
    const pageRepo = new PageRepository(db);
    const now = new Date().toISOString();

    // Create an asset for page item placement
    assetRepo.create({
      id: 'asset-layout-item',
      job_id: standardJobId,
      original_path: sampleFilePath,
      original_name: 'card.jpg',
      mime_type: 'image/jpeg',
      file_extension: 'jpg',
      file_size_bytes: 200,
      source_width: 400,
      source_height: 250,
      page_count: 1,
      asset_type: 'image',
      import_status: 'ready',
      sort_order: 0,
      created_at: now,
    });

    const pages: DbJobPage[] = [
      {
        id: 'page-1',
        job_id: standardJobId,
        page_number: 1,
        paper_size: 'A4',
        orientation: 'portrait',
        width_mm: 210,
        height_mm: 297,
        margin_top_mm: 10,
        margin_right_mm: 10,
        margin_bottom_mm: 10,
        margin_left_mm: 10,
        background_color: '#FFFFFF',
        layout_mode: 'grid',
        spacing_x_mm: 5,
        spacing_y_mm: 5,
        created_at: now,
        updated_at: now,
      },
    ];

    const items: DbPageItem[] = [
      {
        id: 'item-1',
        page_id: 'page-1',
        asset_id: 'asset-layout-item',
        position_x_mm: 15,
        position_y_mm: 15,
        width_mm: 35,
        height_mm: 45,
        rotation_degrees: 0,
        fit_mode: 'cover',
        z_index: 0,
        copy_index: 1,
        created_at: now,
      },
      {
        id: 'item-2',
        page_id: 'page-1',
        asset_id: 'asset-layout-item',
        position_x_mm: 55,
        position_y_mm: 15,
        width_mm: 35,
        height_mm: 45,
        rotation_degrees: 0,
        fit_mode: 'cover',
        z_index: 1,
        copy_index: 2,
        created_at: now,
      },
    ];

    pageRepo.savePagesWithItems(standardJobId, pages, items);

    const loadedPages = pageRepo.getPagesForJob(standardJobId);
    expect(loadedPages.length).toBe(1);
    expect(loadedPages[0].paper_size).toBe('A4');

    const loadedItems = pageRepo.getItemsForPage('page-1');
    expect(loadedItems.length).toBe(2);
    expect(loadedItems[0].width_mm).toBe(35);
    expect(loadedItems[1].position_x_mm).toBe(55);
  });

  it('6. tracks export records in ExportRepository', () => {
    const exportRepo = new ExportRepository(db);
    const now = new Date().toISOString();

    const record: DbExportRecord = {
      id: 'export-01',
      job_id: standardJobId,
      export_type: 'pdf',
      output_path: 'C:\\Users\\Test\\Desktop\\Exported_Sheet.pdf',
      page_count: 1,
      output_size_bytes: 45000,
      export_status: 'in_progress',
      error_message: null,
      created_at: now,
    };

    exportRepo.create(record);
    const loaded = exportRepo.getById('export-01');
    expect(loaded).toBeDefined();
    expect(loaded?.export_status).toBe('in_progress');

    exportRepo.updateStatus('export-01', 'completed', null, 52000);
    const updated = exportRepo.getById('export-01');
    expect(updated?.export_status).toBe('completed');
    expect(updated?.output_size_bytes).toBe(52000);
  });

  it('7. tracks long-running task operations in OperationRepository', () => {
    const opRepo = new OperationRepository(db);
    const now = new Date().toISOString();

    const op: DbOperation = {
      id: 'op-task-1',
      job_id: standardJobId,
      operation_type: 'background_removal',
      status: 'running',
      progress: 0.2,
      current_step: 'Detecting foreground subject mask',
      error_message: null,
      created_at: now,
      updated_at: now,
    };

    opRepo.create(op);
    const loaded = opRepo.getById('op-task-1');
    expect(loaded?.status).toBe('running');
    expect(loaded?.progress).toBe(0.2);

    opRepo.updateProgress('op-task-1', 0.8, 'Replacing background with white');
    const mid = opRepo.getById('op-task-1');
    expect(mid?.progress).toBe(0.8);
    expect(mid?.current_step).toBe('Replacing background with white');

    opRepo.complete('op-task-1');
    const done = opRepo.getById('op-task-1');
    expect(done?.status).toBe('completed');
    expect(done?.progress).toBe(1.0);
  });

  it('8. executes atomic transactions with rollback on failure', () => {
    const jobRepo = new JobRepository(db);
    const now = new Date().toISOString();

    // Verify initial count
    const initialJobs = jobRepo.listRecent();
    const countBefore = initialJobs.length;

    // A transaction that fails halfway must rollback all statements
    expect(() => {
      withTransaction(db, () => {
        execute(
          db,
          'INSERT INTO print_jobs (id, name, status, created_at, updated_at, schema_version) VALUES (?, ?, ?, ?, ?, 1)',
          ['job-rollback-test', 'Should Rollback', 'draft', now, now]
        );

        // Deliberate error to trigger rollback
        throw new Error('Simulation of unexpected write error');
      });
    }).toThrow('Simulation of unexpected write error');

    // Confirm job-rollback-test was NOT persisted
    const rolledBackJob = jobRepo.getById('job-rollback-test');
    expect(rolledBackJob).toBeNull();
    expect(jobRepo.listRecent().length).toBe(countBefore);
  });

  it('9. ensures safe job deletion with cascade delete while preserving source files', () => {
    const jobRepo = new JobRepository(db);
    const assetRepo = new AssetRepository(db);
    const pageRepo = new PageRepository(db);
    const now = new Date().toISOString();

    // Seed an asset and page under standardJobId
    assetRepo.create({
      id: 'asset-to-delete',
      job_id: standardJobId,
      original_path: sampleFilePath,
      original_name: 'doc.jpg',
      mime_type: 'image/jpeg',
      file_extension: 'jpg',
      file_size_bytes: 100,
      source_width: 200,
      source_height: 200,
      page_count: 1,
      asset_type: 'image',
      import_status: 'ready',
      sort_order: 0,
      created_at: now,
    });

    pageRepo.savePagesWithItems(
      standardJobId,
      [
        {
          id: 'page-to-delete',
          job_id: standardJobId,
          page_number: 1,
          paper_size: 'A4',
          orientation: 'portrait',
          width_mm: 210,
          height_mm: 297,
          margin_top_mm: 5,
          margin_right_mm: 5,
          margin_bottom_mm: 5,
          margin_left_mm: 5,
          background_color: '#FFFFFF',
          layout_mode: 'grid',
          spacing_x_mm: 2,
          spacing_y_mm: 2,
          created_at: now,
          updated_at: now,
        },
      ],
      []
    );

    // Verify records exist before delete
    expect(jobRepo.getById(standardJobId)).toBeDefined();
    expect(assetRepo.getByJobId(standardJobId).length).toBeGreaterThan(0);
    expect(pageRepo.getPagesForJob(standardJobId).length).toBeGreaterThan(0);

    // Source file exists on disk
    expect(fs.existsSync(sampleFilePath)).toBe(true);

    // Delete job from database
    jobRepo.delete(standardJobId);

    // Job and its child records must be deleted from SQLite
    expect(jobRepo.getById(standardJobId)).toBeNull();
    expect(assetRepo.getByJobId(standardJobId).length).toBe(0);
    expect(pageRepo.getPagesForJob(standardJobId).length).toBe(0);

    // CRITICAL REQUIREMENT: User's original file on disk must be 100% PRESERVED
    expect(fs.existsSync(sampleFilePath)).toBe(true);
    const content = fs.readFileSync(sampleFilePath, 'utf-8');
    expect(content).toBe('Simulated JPG file bytes for PrintMate test');
  });

  it('10. persists and retrieves application settings in SettingsRepository', () => {
    const settingsRepo = new SettingsRepository(db);

    settingsRepo.set('default_paper_size', 'A4');
    settingsRepo.set('preferred_printer', 'EPSON L3250 Series');
    settingsRepo.set('grid_spacing_mm', 3.5);

    expect(settingsRepo.get('default_paper_size', 'Letter')).toBe('A4');
    expect(settingsRepo.get('preferred_printer', null)).toBe('EPSON L3250 Series');
    expect(settingsRepo.get('grid_spacing_mm', 0)).toBe(3.5);
    expect(settingsRepo.get('non_existent_key', 'fallback_val')).toBe('fallback_val');

    const all = settingsRepo.getAll();
    expect(all.default_paper_size).toBe('A4');
    expect(all.preferred_printer).toBe('EPSON L3250 Series');
  });
});
