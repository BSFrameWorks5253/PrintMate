import { ipcMain } from 'electron';
import { Database } from 'sql.js';
import { withTransaction } from '../database/database';
import { JobRepository } from '../database/repositories/job.repository';
import { AssetRepository } from '../database/repositories/asset.repository';
import { EditRepository } from '../database/repositories/edit.repository';
import { PageRepository } from '../database/repositories/page.repository';

export function registerJobIpc(db: Database): void {
  const jobRepo = new JobRepository(db);
  const assetRepo = new AssetRepository(db);
  const editRepo = new EditRepository(db);
  const pageRepo = new PageRepository(db);

  ipcMain.handle('jobs:create', async (_, job: any) => {
    return jobRepo.create(job);
  });

  ipcMain.handle('jobs:load', async (_, jobId: string) => {
    const job = jobRepo.getById(jobId);
    if (!job) return null;

    jobRepo.touchOpened(jobId);

    const assets = assetRepo.getByJobId(jobId);
    const edits: Record<string, any> = {};
    for (const asset of assets) {
      const currentEdit = editRepo.getCurrent(asset.id);
      if (currentEdit) {
        edits[asset.id] = currentEdit;
      }
    }

    const pages = pageRepo.getPagesForJob(jobId);
    const pagesWithItems = pages.map((page) => ({
      ...page,
      items: pageRepo.getItemsForPage(page.id),
    }));

    return {
      job,
      assets,
      edits,
      pages: pagesWithItems,
    };
  });

  ipcMain.handle('jobs:save', async (_, { jobId, payload }: { jobId: string; payload: any }) => {
    return withTransaction(db, () => {
      // 1. Update job timestamp & status
      if (payload.job) {
        jobRepo.update(jobId, payload.job);
      } else {
        jobRepo.update(jobId, { updated_at: new Date().toISOString() });
      }

      // 2. Save assets
      if (payload.assets && Array.isArray(payload.assets)) {
        for (const asset of payload.assets) {
          const existing = assetRepo.getById(asset.id);
          if (!existing) {
            assetRepo.create(asset);
          }
        }
      }

      // 3. Save edits
      if (payload.edits && typeof payload.edits === 'object') {
        for (const edit of Object.values(payload.edits) as any[]) {
          if (edit && edit.id && edit.asset_id) {
            editRepo.save(edit);
          }
        }
      }

      // 4. Save pages & items
      if (payload.pages && Array.isArray(payload.pages)) {
        const dbPages = payload.pages.map((p: any) => ({
          id: p.id,
          job_id: jobId,
          page_number: p.page_number,
          paper_size: p.paper_size,
          orientation: p.orientation,
          width_mm: p.width_mm,
          height_mm: p.height_mm,
          margin_top_mm: p.margin_top_mm,
          margin_right_mm: p.margin_right_mm,
          margin_bottom_mm: p.margin_bottom_mm,
          margin_left_mm: p.margin_left_mm,
          background_color: p.background_color || '#FFFFFF',
          layout_mode: p.layout_mode || 'grid',
          spacing_x_mm: p.spacing_x_mm ?? 2,
          spacing_y_mm: p.spacing_y_mm ?? 2,
          created_at: p.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        const allItems: any[] = [];
        for (const p of payload.pages) {
          if (p.items && Array.isArray(p.items)) {
            for (const it of p.items) {
              allItems.push({
                id: it.id,
                page_id: p.id,
                asset_id: it.asset_id,
                position_x_mm: it.position_x_mm,
                position_y_mm: it.position_y_mm,
                width_mm: it.width_mm,
                height_mm: it.height_mm,
                rotation_degrees: it.rotation_degrees || 0,
                fit_mode: it.fit_mode || 'contain',
                z_index: it.z_index || 0,
                copy_index: it.copy_index || 1,
                created_at: it.created_at || new Date().toISOString(),
              });
            }
          }
        }

        pageRepo.savePagesWithItems(jobId, dbPages, allItems);
      }

      return true;
    });
  });

  ipcMain.handle('jobs:verify-assets', async (_, jobId: string) => {
    return assetRepo.verifyJobAssets(jobId);
  });

  ipcMain.handle('jobs:list-recent', async (_, limit: number = 20) => {
    return jobRepo.listRecent(limit);
  });

  ipcMain.handle('jobs:delete', async (_, jobId: string) => {
    jobRepo.delete(jobId);
    return true;
  });
}
