export type SupportedFileType =
  | 'docx'
  | 'xlsx'
  | 'xls'
  | 'pptx'
  | 'dxf'
  | 'jpg'
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'pdf'
  | 'txt'
  | 'unknown';

export interface QueueItem {
  id: string;
  name: string;
  size: number;
  type: SupportedFileType;
  bytes: Uint8Array;
  status: 'queued' | 'converting' | 'completed' | 'error';
  error?: string;
  convertedBytes?: Uint8Array;
  previewUrl?: string;
}

export interface ImageGalleryItem {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array;
  previewUrl: string;
  rotation: number;
  width: number;
  height: number;
}

export interface CadStudioConfig {
  theme: 'blueprint' | 'layers' | 'clean';
  paperSize: 'a4' | 'a3' | 'a2' | 'a1' | 'letter';
  orientation: 'landscape' | 'portrait';
  scaleToFit: boolean;
}
