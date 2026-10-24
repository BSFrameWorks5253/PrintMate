import { PaperSize, PhotoPreset } from '../types';

export const MM_TO_PT = 72 / 25.4; // ~2.834645669
export const PT_TO_MM = 25.4 / 72;

export function mmToPt(mm: number): number {
  return mm * MM_TO_PT;
}

export function ptToMm(pt: number): number {
  return pt * PT_TO_MM;
}

export function mmToPx(mm: number, dpi: number = 96): number {
  return (mm / 25.4) * dpi;
}

export function pxToMm(px: number, dpi: number = 96): number {
  return (px / dpi) * 25.4;
}

export interface PaperDimensions {
  width_mm: number;
  height_mm: number;
  name: string;
}

export const PAPER_SIZES: Record<PaperSize, PaperDimensions> = {
  A4: { width_mm: 210, height_mm: 297, name: 'A4 (210 × 297 mm)' },
  A3: { width_mm: 297, height_mm: 420, name: 'A3 (297 × 420 mm)' },
  A5: { width_mm: 148, height_mm: 210, name: 'A5 (148 × 210 mm)' },
  Letter: { width_mm: 215.9, height_mm: 279.4, name: 'Letter (8.5 × 11 in)' },
  '4x6': { width_mm: 101.6, height_mm: 152.4, name: 'Photo 4×6 in (10 × 15 cm)' },
  custom: { width_mm: 210, height_mm: 297, name: 'Custom Dimension' },
};

export const STANDARD_PHOTO_PRESETS: PhotoPreset[] = [
  {
    id: 'passport_in',
    name: 'Indian Passport (35 × 45 mm)',
    category: 'passport',
    width_mm: 35,
    height_mm: 45,
    description: 'Standard passport & visa photograph for India and Schengen',
    recommendedCopies: 8,
  },
  {
    id: 'stamp_in',
    name: 'Indian Stamp Size (25 × 30 mm)',
    category: 'stamp',
    width_mm: 25,
    height_mm: 30,
    description: 'Affidavit, marksheet & admission stamp size photograph',
    recommendedCopies: 12,
  },
  {
    id: 'passport_us',
    name: 'US Passport / Visa (2 × 2 in / 51 × 51 mm)',
    category: 'passport',
    width_mm: 50.8,
    height_mm: 50.8,
    description: 'Square 2x2 inch photograph for US visa and passport',
    recommendedCopies: 6,
  },
  {
    id: 'id_card_cr80',
    name: 'ID Card / Aadhaar / PAN (85.6 × 54 mm)',
    category: 'id_card',
    width_mm: 85.6,
    height_mm: 54,
    description: 'Standard ISO CR80 identity card, driving license, PAN card size',
    recommendedCopies: 2,
  },
  {
    id: 'photo_wallet',
    name: 'Wallet Size (64 × 89 mm / 2.5 × 3.5 in)',
    category: 'photo',
    width_mm: 63.5,
    height_mm: 88.9,
    description: 'Traditional pocket/wallet sized personal photograph',
    recommendedCopies: 4,
  },
  {
    id: 'photo_4x6',
    name: 'Postcard / 4R (102 × 152 mm / 4 × 6 in)',
    category: 'photo',
    width_mm: 101.6,
    height_mm: 152.4,
    description: 'Standard 4R glossy photo print',
    recommendedCopies: 2,
  },
];
