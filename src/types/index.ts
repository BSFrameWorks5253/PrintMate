/**
 * PrintMate Core Type Definitions
 * Maps directly to Database_Schema.md and PRD.md contracts.
 */

export type JobStatus =
  | 'draft'
  | 'importing'
  | 'processing'
  | 'ready'
  | 'printing'
  | 'completed'
  | 'failed'
  | 'archived';

export interface PrintJob {
  id: string;
  name: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  notes: string | null;
  schema_version: number;
}

export type AssetType = 'image' | 'pdf_page';
export type ImportStatus = 'queued' | 'importing' | 'ready' | 'missing' | 'failed';

export interface JobAsset {
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
  asset_type: AssetType;
  import_status: ImportStatus;
  sort_order: number;
  created_at: string;
  // In-memory preview / data url (for renderer display)
  preview_url?: string;
}

export type BackgroundMode = 'original' | 'remove' | 'white' | 'blue' | 'custom' | 'transparent';

export interface PerspectivePoints {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
}

export interface AssetEdits {
  id: string;
  asset_id: string;
  revision: number;
  rotation_degrees: number; // 0, 90, 180, 270
  flip_horizontal: boolean;
  flip_vertical: boolean;
  straighten_degrees: number; // deskew angle e.g. -45 to +45
  crop_x: number | null; // normalized 0 to 1
  crop_y: number | null;
  crop_width: number | null;
  crop_height: number | null;
  perspective_data_json: string | null; // PerspectivePoints
  brightness: number; // -1 to 1 (default 0)
  contrast: number; // 0 to 3 (default 1)
  saturation: number; // 0 to 3 (default 1)
  sharpness: number; // 0 to 5 (default 0)
  grayscale: boolean; // boolean (0 or 1 in db)
  text_darkening: number; // 0 to 2 (0 = none, default 0)
  background_mode: BackgroundMode;
  background_color: string | null; // hex color e.g. #FFFFFF or #0044FF
  background_asset_path: string | null;
  processing_options_json: string | null;
  is_current: boolean;
  created_at: string;
}

export type PaperSize = 'A4' | 'A3' | 'A5' | 'Letter' | '4x6' | 'custom';
export type Orientation = 'portrait' | 'landscape';
export type LayoutMode = 'grid' | 'manual' | 'id_card';
export type FitMode = 'contain' | 'cover';

export interface JobPage {
  id: string;
  job_id: string;
  page_number: number;
  paper_size: PaperSize;
  orientation: Orientation;
  width_mm: number;
  height_mm: number;
  margin_top_mm: number;
  margin_right_mm: number;
  margin_bottom_mm: number;
  margin_left_mm: number;
  background_color: string;
  layout_mode: LayoutMode;
  spacing_x_mm: number;
  spacing_y_mm: number;
  created_at: string;
  updated_at: string;
  items?: PageItem[];
}

export interface PageItem {
  id: string;
  page_id: string;
  asset_id: string;
  position_x_mm: number;
  position_y_mm: number;
  width_mm: number;
  height_mm: number;
  rotation_degrees: number;
  fit_mode: FitMode;
  z_index: number;
  copy_index: number;
  created_at: string;
}

export type DuplexMode = 'simplex' | 'long_edge' | 'short_edge';
export type ColorMode = 'color' | 'grayscale';
export type ScalingMode = 'actual_size' | 'fit_to_page' | 'shrink_to_fit';

export interface PrintConfig {
  id: string;
  job_id: string;
  printer_name: string | null;
  copies: number;
  color_mode: ColorMode;
  duplex_mode: DuplexMode;
  paper_source: string | null;
  scaling_mode: ScalingMode;
  collate: boolean;
  page_range: string | null; // e.g. "1-3, 5" or null for all
  driver_options_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface SystemPrinter {
  name: string;
  description: string;
  isDefault: boolean;
  status: number;
}

export interface ExportRecord {
  id: string;
  job_id: string;
  export_type: 'PDF' | 'JPEG' | 'PNG';
  output_path: string;
  page_count: number | null;
  output_size_bytes: number | null;
  export_status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error_message: string | null;
  created_at: string;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  default_paper_size: PaperSize;
  default_orientation: Orientation;
  default_margin_mm: number;
  default_spacing_mm: number;
  default_printer: string | null;
  default_photo_preset: string; // e.g. "passport_in"
  export_directory: string | null;
  jobs_directory: string | null;
  autosave_enabled: boolean;
  preview_quality: 'low' | 'medium' | 'high';
}

export interface PhotoPreset {
  id: string;
  name: string;
  category: 'passport' | 'id_card' | 'stamp' | 'photo';
  width_mm: number;
  height_mm: number;
  description: string;
  recommendedCopies: number;
}
