# PrintMate 🖨️✨

> **Pro ID Card & Document Scanner, Auto-Straightener & Multi-Layout Print Studio**

PrintMate is a modern web application designed for fast, accurate ID card scanning, automatic boundary detection, perspective deskewing, and multi-up print layout production.

---

## 🚀 Key Features

### 1. 🔍 Intelligent Boundary Detection & Deskewing
- **Auto-Border Snapping**: Uses adaptive local contrast and Otsu thresholding to snap pins to document corners even in uneven lighting or floor reflections.
- **Perspective Unwarp**: Real-time homography bilinear interpolation straightens slanted documents into high-resolution outputs.
- **Orientation Control**: 1-click rotation (90° CW / -90° CCW) and automatic landscape alignment for standard ID cards (Aadhaar, PAN, Driving License, Voter ID).
- **Interactive Loupe & Tap-to-Snap**: 3× zoom magnifier for precision corner positioning, plus Sobel edge snapping.

### 2. 🖨️ Multi-Layout Print Studio
- **Flexible Layouts**:
  - `2_vertical`: Top & bottom layout
  - `2_horizontal`: Side-by-side layout
  - `front_back_duplex`: 2-sided duplex page printing
  - `front_back_fold`: Center fold alignment for lamination pouches
  - `custom_grid`: 3, 4, 6, 8, 9 or custom column/row multi-up grids
- **Exact ID Scale (CR80)**: Preserves physical 85.60 mm × 53.98 mm dimensions.
- **Pure Clean Paper Guarantee**: All guidelines, badges, and toolbars are hidden on paper during printing via `@media print`.
- **Copies & Rotation**: Instant rotation directly on print sheet slots and queue items.

### 3. 📸 Passport Size Photo Maker
- **Standard Dimensions**: 35 mm × 45 mm at **300 DPI**.
- **Photo Paper Layouts**: Optimized for 4×6 (4R) photo paper.
- **Dynamic Count**: Change from 4, 6, 8, 10, 12, to 16 photos per sheet with automatic proportional shrink for counts > 8.
- **Studio Classic Border**: Clean white border with subtle outlines matching photo studio standards.

---

## 🛠️ Technology Stack
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS + Custom Page-Wise Scoped Stylesheets
- **Icons**: Lucide React
- **Architecture**: Modular image processing pipeline (`cornerDetection`, `perspectiveTransform`, `transform2d`, `imageAdjustments`)

---

## 📦 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation
```bash
# Clone the repository
git clone https://github.com/BSFrameWorks5253/PrintMate.git

# Navigate into project directory
cd PrintMate

# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```
