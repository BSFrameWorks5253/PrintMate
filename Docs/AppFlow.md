
# PrintMate — App Flow Specification

## 1. Product Overview

PrintMate is an offline-first desktop application for printing and Xerox shops. It imports images and documents, automatically corrects alignment and image quality, arranges photos on printable pages, and provides precise print/export controls.

### Core Principles
- Fully functional offline.
- No accounts, mandatory subscriptions, ads, or paid APIs.
- Process files locally on the user's computer.
- Preserve original files; edits must be non-destructive.
- Support automatic corrections and manual adjustments.
- Display an accurate print preview before printing.
- Never silently crop, stretch, or resize content unexpectedly.

## 2. Application Launch Flow

App Launch
→ Load settings and local database
→ Initialize image/PDF processing services
→ Check required local resources
→ Open Home Dashboard

If initialization fails:
→ Show a readable error
→ Offer Retry or Troubleshooting
→ Never silently lose a user's work

## 3. Main Navigation

- Home
- New Print Job
- Image Editor
- Page Layout
- Print Preview
- Job History
- Settings

Keep navigation consistent across screens. Preserve the active job when switching pages.

## 4. Home Dashboard Flow

Home
→ Start New Job
→ Open Recent Job
→ Browse Job History
→ Configure Paper/Printer Settings

Dashboard content:
- New Print Job action
- Recent jobs
- Quick presets: ID Photo, Passport Photo, Documents, Custom Layout
- Last-used printer and paper settings
- Processing status when a job is active

## 5. New Print Job — Import Flow

Home
→ New Print Job
→ Select Images / Import PDF
→ Validate Files
→ Generate Previews
→ Create Local Job
→ Open Workspace

Import requirements:
- Support common image formats and multipage PDFs.
- Support multiple file selection and drag-and-drop.
- Allow adding more files to an existing job.
- Show thumbnails, filenames, dimensions, and errors.
- Allow reordering and removing imported items.
- Warn about unsupported or unreadable files.
- Keep originals unchanged.

## 6. Main Editing Workspace

Workspace
├── Left Panel: Imported Files
├── Center: Selected Image/Document
├── Right Panel: Editing Controls
└── Bottom: Job Actions

Actions:
- Auto Correct
- Straighten / Rotate
- Crop
- Brightness / Contrast
- Text Darkening
- Background Removal
- Replace Background
- Reset Edits
- Add to Page Layout
- Open Print Preview

All editing controls must update the preview. Use undo/redo where practical.

## 7. Automatic Image Correction Flow

Select Image
→ Analyze Image
→ Detect Rotation / Skew / Document Edges
→ Calculate Suggested Correction
→ Show Corrected Preview
→ User Accepts or Adjusts Manually
→ Save Edit Parameters to Current Job

Rules:
- Do not apply uncertain corrections without showing the result.
- Provide manual rotation, straighten, crop, and perspective controls.
- Preserve aspect ratio unless the user explicitly changes it.
- Provide Reset to Original.
- Keep the original image recoverable.

## 8. Image Enhancement Flow

Select Image
→ Open Enhancement
→ Adjust Brightness / Contrast / Sharpness
→ Optional Grayscale
→ Optional Text Darkening / Document Cleanup
→ Preview
→ Apply or Cancel

Text Darkening:
- Optimize readability of scanned documents.
- Avoid unnecessarily darkening photographs.
- Offer intensity controls.
- Do not overwrite the source file.

## 9. Background Removal Flow

Select Photo
→ Remove Background
→ Run Local Processing
→ Display Result
→ Refine Edges if Supported
→ Select Background

Background options:
- White
- Blue
- Custom Color
- Transparent, when supported by the selected export format

→ Preview
→ Apply or Cancel

All processing must run locally using properly licensed dependencies and model files. Clearly report processing failures instead of displaying a fake result.

## 10. Page Layout Flow

Workspace
→ Page Layout
→ Select Paper Size
→ Select Orientation
→ Select Margins and Spacing
→ Choose Layout Preset or Custom Layout
→ Arrange Photos
→ Preview Page
→ Confirm Layout

Layout options:
- A4, A3, Letter, and supported custom sizes
- Portrait and landscape
- 1, 2, 3, 4, 6, 8, 9, 12, or custom photo counts
- ID/passport photo dimensions
- Copies per image
- Automatic arrangement
- Manual drag-and-drop positioning
- Front/back photo pairing
- Fit, fill, and crop controls
- Spacing, margins, and alignment

Rules:
- Maintain exact physical dimensions for ID photos.
- Show page overflow and clipping warnings.
- Never stretch images unintentionally.
- Recalculate layout after changes to paper size or margins.
- Keep manual placement unless the user explicitly chooses auto-arrange.

## 11. Print Preview Flow

Page Layout
→ Print Preview
→ Inspect Every Page
→ Navigate Between Pages
→ Verify Paper Size and Orientation
→ Verify Image Dimensions and Margins
→ Open Print Settings or Return to Editing

Preview must reflect the actual intended output, including:
- Page dimensions
- Image placement and crop
- Margins and spacing
- Number of pages
- Front/back arrangement
- Selected printer settings where available

Show warnings for clipping, low-resolution images, unsupported settings, or possible scaling.

## 12. Print Flow

Print Preview
→ Click Print
→ Select Installed Printer
→ Configure Paper Size and Orientation
→ Configure Copies and Color Mode
→ Configure Duplex, if supported
→ Confirm Print
→ Send Job to Operating System
→ Show Result

States:
- Preparing
- Sending to Printer
- Submitted
- Failed
- Cancelled, where supported

Do not claim a document has physically printed merely because it was submitted to the operating system.

If printing fails:
→ Show the error
→ Preserve the current job
→ Offer Retry or Export to PDF

Printer availability and supported options depend on the operating system, printer driver, and hardware.

## 13. PDF Import and Export Flow

### Import
Import PDF
→ Select File
→ Choose Pages or All Pages
→ Render Previews
→ Add Pages to Workspace

### Export
Workspace / Page Layout
→ Export
→ Choose PDF or Image Format
→ Configure Output Quality
→ Choose Destination
→ Export
→ Show Saved Location

PDF export must preserve page size and layout. Offer suitable image export formats and quality settings.

## 14. Job History Flow

Home
→ Job History
→ Search / Filter Jobs
→ Open Job
→ Continue Editing / Duplicate / Export / Delete

Store job metadata and edit parameters locally. Reopenable jobs must not depend on temporary preview files.

Before deleting a job, ask for confirmation. Never delete original source files as a side effect of deleting a job.

## 15. Settings Flow

Settings
├── Appearance
├── Default Paper Size
├── Default Printer
├── Default Margins
├── Default Photo Dimensions
├── Image Processing
├── Export Preferences
├── Local Storage
└── About / Troubleshooting

Save settings locally and apply them to new jobs. Changing defaults must not unexpectedly alter existing saved layouts.

## 16. Core Data Flow

Import Files
→ Local Job Model
→ Non-Destructive Edit Parameters
→ Image Processing Pipeline
→ Page Layout Engine
→ Print/PDF Renderer
→ Operating System or Local Export

Use original files as immutable sources. Generate processed previews and final outputs separately.

## 17. Error Handling

Handle:
- Unsupported or corrupted files
- Insufficient disk space
- Failed image processing
- Missing local models
- PDF rendering failures
- Invalid layout dimensions
- Printer unavailable
- Print submission failure
- Export permission errors
- Database or job recovery errors

Each error must explain what happened and provide a relevant recovery action. Preserve unsaved work whenever possible.

## 18. Privacy and Cost Requirements

- No required cloud backend.
- No mandatory login.
- No paid APIs.
- No analytics or external uploads by default.
- No automatic upload of user documents or photos.
- Local storage and processing by default.
- Use dependencies and model weights whose licenses permit the intended distribution.
- Do not add subscriptions, ads, or artificial usage limits.

Optional operating-system, printer-driver, hardware, or software-distribution costs are outside the app's control.

## 19. Implementation Rules for the Coding Agent

1. Inspect the existing codebase before changing anything.
2. Reuse the existing framework, architecture, components, and styling where practical.
3. Do not rebuild the app from scratch unless explicitly authorized.
4. Do not remove, rename, or break existing working features.
5. Implement real functionality; do not substitute mock controls or fake processing.
6. Keep modules separate and establish clear interfaces.
7. Use secure Electron IPC if the application uses Electron.
8. Test all critical flows, including failures and recovery.
9. Verify that editing does not modify original files.
10. Update documentation to match the actual implementation.
11. Do not claim completion until implemented features have been tested.
12. Keep the application usable offline and free from mandatory paid services.

## 20. Definition of Done

The application is ready when a user can:

- Import multiple images or PDFs.
- Correct skew and image quality automatically or manually.
- Adjust brightness, contrast, and document readability.
- Remove and replace photo backgrounds.
- Arrange images at defined physical dimensions.
- Preview all pages before printing.
- Print through supported system printers.
- Export a correctly sized PDF.
- Save and reopen jobs.
- Recover from processing, export, and printer errors.
- Complete core workflows without an internet connection.
