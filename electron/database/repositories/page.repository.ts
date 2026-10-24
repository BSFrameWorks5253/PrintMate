import { Database } from 'sql.js';
import { queryAll, execute } from '../database';

export interface DbPage {
  id: string;
  job_id: string;
  page_number: number;
  paper_size: string;
  orientation: string;
  width_mm: number;
  height_mm: number;
  margin_top_mm: number;
  margin_right_mm: number;
  margin_bottom_mm: number;
  margin_left_mm: number;
  background_color: string;
  layout_mode: string;
  spacing_x_mm: number;
  spacing_y_mm: number;
  created_at: string;
  updated_at: string;
}

export interface DbPageItem {
  id: string;
  page_id: string;
  asset_id: string;
  position_x_mm: number;
  position_y_mm: number;
  width_mm: number;
  height_mm: number;
  rotation_degrees: number;
  fit_mode: string;
  z_index: number;
  copy_index: number;
  created_at: string;
}

export class PageRepository {
  constructor(private db: Database) {}

  savePagesWithItems(jobId: string, pages: DbPage[], items: DbPageItem[]): void {
    // Delete existing pages & items for this job
    execute(this.db, 'DELETE FROM job_pages WHERE job_id = ?', [jobId]);

    for (const page of pages) {
      const pageSql = `
        INSERT INTO job_pages (
          id, job_id, page_number, paper_size, orientation, width_mm, height_mm,
          margin_top_mm, margin_right_mm, margin_bottom_mm, margin_left_mm,
          background_color, layout_mode, spacing_x_mm, spacing_y_mm, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;
      execute(this.db, pageSql, [
        page.id,
        page.job_id,
        page.page_number,
        page.paper_size,
        page.orientation,
        page.width_mm,
        page.height_mm,
        page.margin_top_mm,
        page.margin_right_mm,
        page.margin_bottom_mm,
        page.margin_left_mm,
        page.background_color,
        page.layout_mode,
        page.spacing_x_mm,
        page.spacing_y_mm,
        page.created_at,
        page.updated_at,
      ]);
    }

    for (const item of items) {
      const itemSql = `
        INSERT INTO page_items (
          id, page_id, asset_id, position_x_mm, position_y_mm, width_mm, height_mm,
          rotation_degrees, fit_mode, z_index, copy_index, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;
      execute(this.db, itemSql, [
        item.id,
        item.page_id,
        item.asset_id,
        item.position_x_mm,
        item.position_y_mm,
        item.width_mm,
        item.height_mm,
        item.rotation_degrees,
        item.fit_mode,
        item.z_index,
        item.copy_index,
        item.created_at,
      ]);
    }
  }

  getPagesForJob(jobId: string): DbPage[] {
    return queryAll<DbPage>(
      this.db,
      'SELECT * FROM job_pages WHERE job_id = ? ORDER BY page_number ASC',
      [jobId]
    );
  }

  getItemsForPage(pageId: string): DbPageItem[] {
    return queryAll<DbPageItem>(
      this.db,
      'SELECT * FROM page_items WHERE page_id = ? ORDER BY z_index ASC, created_at ASC',
      [pageId]
    );
  }
}
