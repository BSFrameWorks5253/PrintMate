import type { DocumentTypeOption, PageDimension } from '../types';

export const AUTHORIZED_ADMIN_EMAILS = [
  'bs.framework5253@gmail.com',
  'bs.framework5252@gmail.com',
];

export const AUTHORIZED_ADMIN_EMAIL = 'bs.framework5253@gmail.com';

export const isAuthorizedAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  return AUTHORIZED_ADMIN_EMAILS.some((admin) => admin.toLowerCase() === cleanEmail);
};

export const DOCUMENT_TYPES: DocumentTypeOption[] = [
  {
    id: 'id_standard',
    name: 'National ID / Aadhaar / Voter ID',
    category: 'id',
    description: 'CR80 standard card (85.6 x 53.98 mm)',
    aspectRatio: 85.6 / 53.98, // ~1.5858
    standardWidthMm: 85.6,
    standardHeightMm: 53.98,
    iconName: 'CreditCard',
  },
  {
    id: 'driving_license',
    name: 'Driving License',
    category: 'id',
    description: 'Standard smart-card license format',
    aspectRatio: 85.6 / 53.98,
    standardWidthMm: 85.6,
    standardHeightMm: 53.98,
    iconName: 'Car',
  },
  {
    id: 'pan_card',
    name: 'PAN Card / Tax ID',
    category: 'id',
    description: 'Tax identification ID card standard',
    aspectRatio: 85.6 / 53.98,
    standardWidthMm: 85.6,
    standardHeightMm: 53.98,
    iconName: 'FileBadge',
  },
  {
    id: 'passport_page',
    name: 'Passport Data Page',
    category: 'id',
    description: 'Standard ISO/IEC 7810 ID-3 (125 x 88 mm)',
    aspectRatio: 125 / 88, // ~1.420
    standardWidthMm: 125,
    standardHeightMm: 88,
    iconName: 'BookUser',
  },
  {
    id: 'paper_a4',
    name: 'A4 Document / Paper / Letter',
    category: 'paper',
    description: 'Full document or certificate sheet (1:1.414)',
    aspectRatio: 210 / 297, // ~0.707
    standardWidthMm: 210,
    standardHeightMm: 297,
    iconName: 'FileText',
  },
  {
    id: 'receipt',
    name: 'Receipt / Invoice / Bill',
    category: 'paper',
    description: 'Elongated thermal paper receipt or slip',
    aspectRatio: 80 / 160, // 0.5
    standardWidthMm: 80,
    standardHeightMm: 160,
    iconName: 'Receipt',
  },
  {
    id: 'custom',
    name: 'Custom / Free Ratio',
    category: 'custom',
    description: 'Unconstrained free quadrilateral crop',
    aspectRatio: 0,
    standardWidthMm: 100,
    standardHeightMm: 100,
    iconName: 'Crop',
  },
];

export const PAGE_SIZES: PageDimension[] = [
  { id: 'a4', name: 'A4 Standard (210 × 297 mm)', widthMm: 210, heightMm: 297 },
  { id: '4x6', name: '4 × 6 in Photo Paper (4R / 102 × 152 mm)', widthMm: 101.6, heightMm: 152.4 },
  { id: '5x7', name: '5 × 7 in Photo Paper (5R / 127 × 178 mm)', widthMm: 127.0, heightMm: 177.8 },
  { id: 'letter', name: 'US Letter (8.5 × 11 in / 216 × 279 mm)', widthMm: 215.9, heightMm: 279.4 },
  { id: 'a3', name: 'A3 Large (297 × 420 mm)', widthMm: 297, heightMm: 420 },
  { id: 'legal', name: 'US Legal (8.5 × 14 in / 216 × 356 mm)', widthMm: 215.9, heightMm: 355.6 },
];

export const PRINT_LAYOUT_OPTIONS = [
  {
    id: '2_vertical',
    name: '2 Images (Vertical Stack)',
    description: 'Top & bottom stacked - Best for ID Front & Back',
    slots: 2,
    icon: 'Columns2',
    category: 'id_duo',
  },
  {
    id: '2_horizontal',
    name: '2 Images (Horizontal / Side-by-Side)',
    description: 'Placed side-by-side on one row',
    slots: 2,
    icon: 'Rows2',
    category: 'id_duo',
  },
  {
    id: 'front_back_fold',
    name: 'Front & Back Fold (Lamination Ready)',
    description: 'Aligned with center cut / fold line for lamination pouch',
    slots: 2,
    icon: 'Layers',
    category: 'id_special',
  },
  {
    id: 'front_back_duplex',
    name: 'Back & Forth Duplex (2 Pages)',
    description: 'Exact matching physical coordinates for 2-sided printing',
    slots: 2,
    icon: 'Printer',
    category: 'id_special',
  },
  {
    id: '1_real_size',
    name: '1 Image (100% Real ID Card Scale)',
    description: 'Printed at exact ISO 85.6 × 54mm dimensions',
    slots: 1,
    icon: 'Maximize2',
    category: 'single',
  },
  {
    id: '1_fit',
    name: '1 Image (Full Page Fit)',
    description: 'Maximizes image to fill the paper margins',
    slots: 1,
    icon: 'FileText',
    category: 'single',
  },
  {
    id: '3_vertical',
    name: '3 Images (Vertical Stack)',
    description: 'Three items stacked from top to bottom',
    slots: 3,
    icon: 'ListFilter',
    category: 'multi',
  },
  {
    id: '3_triad',
    name: '3 Images (1 Top, 2 Bottom)',
    description: 'One wide header item, two side-by-side below',
    slots: 3,
    icon: 'LayoutTemplate',
    category: 'multi',
  },
  {
    id: '4_grid',
    name: '4 Images (2 × 2 Grid)',
    description: 'Four items in balanced 2 columns, 2 rows',
    slots: 4,
    icon: 'Grid2X2',
    category: 'multi',
  },
  {
    id: '6_grid',
    name: '6 Images (2 × 3 Grid)',
    description: 'Six items per page for batch ID cards',
    slots: 6,
    icon: 'Grid3X3',
    category: 'multi',
  },
  {
    id: '8_grid',
    name: '8 Images (2 × 4 Grid)',
    description: 'Eight compact ID slots on a single sheet',
    slots: 8,
    icon: 'LayoutGrid',
    category: 'multi',
  },
  {
    id: '9_grid',
    name: '9 Images (3 × 3 Grid)',
    description: 'Nine cards arranged in a 3 by 3 matrix',
    slots: 9,
    icon: 'Grid3X3',
    category: 'multi',
  },
  {
    id: 'custom_grid',
    name: 'Custom Layout (User Defined)',
    description: 'Custom rows, columns, margins & spacing',
    slots: 4,
    icon: 'Sliders',
    category: 'custom',
  },
];
