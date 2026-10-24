export interface Point {
  x: number;
  y: number;
}

export type DocumentTypeId = 
  | 'id_standard'
  | 'driving_license'
  | 'pan_card'
  | 'passport_page'
  | 'paper_a4'
  | 'receipt'
  | 'custom';

export interface DocumentTypeOption {
  id: DocumentTypeId;
  name: string;
  category: 'id' | 'paper' | 'custom';
  description: string;
  aspectRatio: number; // width / height
  standardWidthMm: number;
  standardHeightMm: number;
  iconName: string;
}

export interface ImageAdjustments {
  brightness: number; // -100 to 100, default 0
  contrast: number;   // -100 to 100, default 0
  exposure: number;   // -100 to 100, default 0
  saturation: number; // -100 to 100, default 0
  sharpness: number;  // 0 to 100, default 0
  rotation: number;   // 0, 90, 180, 270 degrees
  fineAngle: number;  // -45 to +45 degrees
  filter: 'none' | 'auto_enhance' | 'scan_bw' | 'grayscale' | 'id_pop';
}

export interface PrintQueueItem {
  id: string;
  dataUrl: string;
  name: string;
  docType: DocumentTypeId;
  cardSide?: 'front' | 'back' | 'single';
  aspectRatio: number;
  createdAt: number;
}

export type PageSizeId = 'a4' | 'a3' | 'letter' | 'legal';

export interface PageDimension {
  id: PageSizeId;
  name: string;
  widthMm: number;
  heightMm: number;
}

export type PrintLayoutType = 
  | '1_fit'
  | '1_real_size'
  | '2_vertical'
  | '2_horizontal'
  | 'front_back_duplex'
  | 'front_back_fold'
  | '3_vertical'
  | '3_triad'
  | '4_grid'
  | '6_grid'
  | '8_grid'
  | '9_grid'
  | 'custom_grid';

export interface PrintSettings {
  pageSize: PageSizeId;
  orientation: 'portrait' | 'landscape';
  layout: PrintLayoutType;
  showCutLines: boolean; // Screen-only guideline overlay
  printCutMarks: boolean; // Optional subtle corner tick marks on print paper (default false)
  scaleMode: 'exact_id' | 'fit_cell' | 'custom';
  marginMm: number;
  spacingMm: number;
  copies: number;
  alignment: 'center' | 'top_center' | 'top_left';
  customCols: number;
  customRows: number;
  duplexActivePage: 1 | 2;
}
