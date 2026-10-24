# PrintMate — Xerox & Print Studio

> **Professional printing & Xerox workflow desktop application for Windows.**  
> Offline-first, local processing, ₹0 mandatory recurring service cost.

---

## 🌟 Overview & Core Capabilities

PrintMate is built specifically for Xerox shops, printing businesses, cyber cafés, document centers, and photo studios. It unites document straightening, faded photocopy text darkening, passport/ID photo layouts, print previews, and native Windows printing into a single workflow without third-party subscriptions or cloud services.

### 🚀 Key Features

1. **Dashboard & Workflows:**
   - One-click workflow presets: Indian Passport (8-up on A4), Stamp Size (12-up on A4), US Visa (2×2 in 6-up on A4), ID Card Front & Back (CR80 side-by-side or stacked), and Xerox Text Darkener.
   - Drag & drop import for images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`, `.tiff`) and multipage PDF documents.
   - Recent jobs dashboard with quick resume and history management.

2. **Image Editor & Non-Destructive Processing:**
   - **Orientation & Deskew:** 90° rotation, horizontal flip, fine straighten angle (-45° to +45°), and automatic skew detection for tilted mobile phone scans.
   - **Document & Text Darkener (Xerox Mode):** Adaptive contrast enhancement that darkens faded text while cleaning paper background speckles.
   - **Sharpness Filter:** 3×3 Laplacian edge-detection convolution filter for restoring text clarity.
   - **Photo Background Replacement:** Replace background with Studio White, Passport Blue (#0044FF), custom hex color, or transparent PNG.
   - **Interactive Crop:** Aspect ratio presets for 1:1, 35:45 mm Passport, 85.6:54 mm ID Card, and freeform crop.
   - **Original Preservation:** Source files remain completely untouched. Compare with original anytime via "Hold to See Original".

3. **Physical Page Layout Engine:**
   - **Millimeter Canonical Geometry:** Paper dimensions and item coordinates are strictly computed and stored in millimeters (`mm`).
   - **Paper Sizes:** A4 (210×297 mm), A3 (297×420 mm), A5 (148×210 mm), Letter (8.5×11 in), 4×6 photo paper (10×15 cm), and custom sizes.
   - **Xerox Presets & N-up Grids:** 1-up, 2-up, 4-up, 6-up, 8-up, 9-up, 12-up grids.
   - **ID Card Front & Back Pairing:** Places front and back sides of Aadhaar, Voter ID, or PAN cards aligned to exact physical dimensions (85.6×54 mm) on a single A4 sheet.
   - **Visual Warnings:** Real-time margin clipping and overflow indicators.

4. **Print Preview & Print Engine:**
   - High-fidelity preview with millimetre boundaries.
   - Direct integration with Windows print spooler (`webContents.getPrintersAsync()` and native print submission).
   - Simplex, Long-Edge Duplex, and Short-Edge Duplex options.
   - Color and B&W Xerox Grayscale modes.
   - Exact "Actual Size (100%)" mode avoiding printer driver auto-scaling.

5. **Vector Print-Ready PDF Generation:**
   - Generates multi-page PDFs using `pdf-lib` matching exact millimetre and point dimensions.
   - Imports and rasterizes PDF documents using `pdfjs-dist`.

6. **SQLite Persistence:**
   - 100% offline local SQLite database (`%APPDATA%/PrintMate/data/printmate.db`) using zero-dependency WebAssembly SQLite engine.
   - Automated schema migrations and repository pattern for jobs, assets, non-destructive edits, pages, and settings.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Desktop Shell** | Electron 35 |
| **Frontend Framework** | React 18 + TypeScript |
| **Build Tool** | Vite 6 |
| **State Management** | Zustand |
| **Icons** | Lucide React |
| **Database** | SQLite 3 (WebAssembly via `sql.js`) |
| **PDF Generation** | `pdf-lib` |
| **PDF Rendering** | `pdfjs-dist` |
| **Testing** | Vitest |

---

## 💻 Development & Build Commands

```bash
# Install dependencies
npm install

# Run application in development mode (Electron + React Vite HMR)
npm run dev

# Run unit test suite
npm test

# Full production build
npm run build
```

---

## 🔒 Offline & Privacy Guarantee

- **No Paid APIs:** Zero recurring costs for developer or end-users.
- **Local Storage:** All files, jobs, and edits reside strictly on the user's computer.
- **Zero Telemetry:** No mandatory tracking or analytics.
