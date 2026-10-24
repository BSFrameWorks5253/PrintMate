# PRINTMATE
## Technical Requirements & Planning Document (TRP)

**Version:** 1.0  
**Product:** PrintMate — Xerox & Print Studio  
**Platform:** Windows 10/11 desktop  
**Framework:** Electron + React + TypeScript  
**Architecture:** Offline-first, local processing  
**Pricing:** Free forever for developer and clients  
**Document status:** Implementation specification

---

# 1. Technical Objective

Build a production-quality desktop application for Xerox shops, printing businesses, cyber cafés, document service centers, and individual users.

The application must provide image correction, document enhancement, background removal, background replacement, multi-image page layouts, front-and-back printing, print preview, and PDF export.

All core processing must run locally.

## Non-negotiable requirements

- No paid APIs.
- No subscriptions or feature paywalls.
- No per-image or per-print charges.
- No mandatory accounts.
- No mandatory cloud backend.
- No compulsory analytics or telemetry.
- No recurring server dependency.
- No modification of original source images.
- No internet requirement for installed core features.
- Commercial use and redistribution permitted under the selected dependency licenses.

The ₹0 requirement applies to mandatory software services and operating infrastructure. Optional code signing, hardware, and distribution services may still have external costs and must never be required for core functionality.

---

# 2. Recommended Technology Stack

Use stable, compatible versions and pin dependency versions in the project lockfile. Verify maintenance status and licensing before adoption.

| Component | Recommended technology | Purpose |
|---|---|---|
| Desktop shell | Electron | Windows desktop runtime |
| UI | React + TypeScript | Application interface |
| Build system | Vite | Frontend development and bundling |
| Styling | CSS Modules or a consistent CSS architecture | Maintainable styling |
| Icons | Lucide React | Consistent application icons |
| State management | Zustand or React Context for smaller state | UI and workflow state |
| Validation | Zod | Validate settings, job files and IPC payloads |
| Local database | SQLite using a compatible maintained driver | Jobs, presets and metadata |
| Image manipulation | Canvas and suitable open-source libraries | Cropping, rotation and color adjustments |
| Document geometry | OpenCV.js, where appropriate | Deskew and perspective correction |
| Background removal | Compatible local segmentation model | Portrait foreground extraction |
| Model runtime | ONNX Runtime, if compatible with the selected model | Local inference |
| PDF generation | pdf-lib or another suitable open-source PDF library | Print-ready PDF output |
| PDF rendering | PDF.js | PDF previews and page import |
| Printing | Electron printing APIs and Windows printer drivers | Native print workflow |
| Packaging | electron-builder or equivalent | Windows installer and portable build |
| Testing | Vitest + React Testing Library + Playwright where appropriate | Unit and UI tests |
| Logging | Local structured logging | Diagnostics without data transmission |

### Dependency selection rules

1. Prefer actively maintained, well-documented packages.
2. Check all transitive dependencies for license compatibility.
3. Avoid packages that require paid cloud accounts.
4. Avoid dependencies that upload documents for processing.
5. Do not add a package merely because an AI coding tool recommends it.
6. Record the reason for each major dependency in `docs/DEPENDENCIES.md`.
7. Recheck native-module compatibility with the selected Electron version.

The technology stack is a recommendation, not permission to ignore licensing or security issues.

---

# 3. System Architecture

Separate the application into the following modules.

## 3.1 Main process

Responsibilities:

- Application lifecycle.
- Window management.
- File dialogs.
- Local file access.
- SQLite access.
- Print-job coordination.
- Printer capability discovery where supported.
- Controlled filesystem operations.
- Native integrations.
- Application logging.

The main process must not expose unrestricted operating-system functionality to renderer code.

## 3.2 Preload bridge

Provide a narrowly scoped, typed API between the renderer and the main process.

Suggested interface:

- `files.selectImages()`
- `files.selectFolder()`
- `files.readMetadata(fileId)`
- `jobs.create(input)`
- `jobs.load(jobId)`
- `jobs.save(jobId, changes)`
- `jobs.listRecent()`
- `jobs.delete(jobId)`
- `presets.list()`
- `presets.save(input)`
- `presets.delete(presetId)`
- `printing.getPrinters()`
- `printing.getCapabilities(printerId)`
- `printing.submit(input)`
- `printing.getJobStatus(jobId)`
- `exports.savePdf(input)`
- `system.getAppVersion()`

These are proposed internal interfaces, not pre-existing Electron APIs. Implement them through validated IPC handlers.

Every handler must validate its input and enforce permitted operations.

## 3.3 Renderer process

Responsibilities:

- React interface.
- Image thumbnails and previews.
- Editing controls.
- Selection and ordering.
- Layout canvas.
- Background-removal controls.
- Print preview.
- Settings and presets.
- Progress and error displays.

The renderer must not have unrestricted Node.js access.

## 3.4 Image-processing engine

Responsibilities:

- Image decoding.
- Rotation.
- Cropping.
- Perspective correction.
- Brightness and contrast.
- Grayscale and thresholding.
- Document background cleanup.
- Preview rendering.
- Full-resolution output rendering.
- Batch processing.

Keep processing logic separate from React components.

## 3.5 Background-removal engine

Responsibilities:

- Load the local model.
- Validate model availability.
- Initialize the runtime.
- Preprocess images.
- Execute segmentation.
- Convert the model output into a foreground mask.
- Refine the mask.
- Composite the subject onto a selected background.
- Return processing status and errors.

The engine must support cancellation where the selected runtime allows it.

## 3.6 Layout and export engine

Responsibilities:

- Paper geometry.
- Page orientation.
- Margins and gaps.
- Cell calculation.
- Image fitting.
- Multiple-page generation.
- Front/back pairing.
- PDF creation.
- Print preview generation.
- Clipping validation.

This engine must be independent of the UI so it can be tested deterministically.

---

# 4. Electron Security Requirements

Configure the Electron application securely.

Required settings:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true` where compatible with the implementation
- A restrictive Content Security Policy.
- No arbitrary remote code execution.
- No loading untrusted remote websites in privileged windows.
- Strict IPC validation.
- No unrestricted filesystem APIs in the renderer.
- No arbitrary shell commands exposed to UI controls.
- Safe handling of filenames and filesystem paths.

Use explicit file IDs or validated application-managed references rather than accepting arbitrary renderer-provided paths for privileged operations.

Only allow operations on files selected or otherwise authorized through the main process.

---

# 5. Project Structure

Use a clear, modular project layout.

```text
printmate/
├── package.json
├── package-lock.json
├── electron-builder.yml
├── tsconfig.json
├── vite.config.ts
├── docs/
│   ├── PRD.md
│   ├── TRP.md
│   ├── DEPENDENCIES.md
│   ├── LICENSE_AUDIT.md
│   ├── ARCHITECTURE.md
│   └── TEST_PLAN.md
├── resources/
│   ├── icons/
│   └── models/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── ipc/
│   ├── printing/
│   ├── database/
│   ├── filesystem/
│   └── security/
├── src/
│   ├── app/
│   ├── components/
│   ├── pages/
│   │   ├── Home/
│   │   ├── ImageEditor/
│   │   ├── BackgroundStudio/
│   │   ├── LayoutStudio/
│   │   ├── DuplexStudio/
│   │   ├── PrintPreview/
│   │   ├── SavedJobs/
│   │   └── Settings/
│   ├── features/
│   │   ├── import/
│   │   ├── image-processing/
│   │   ├── enhancement/
│   │   ├── background-removal/
│   │   ├── layout/
│   │   ├── duplex/
│   │   ├── printing/
│   │   └── pdf/
│   ├── services/
│   ├── state/
│   ├── types/
│   └── styles/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── layout/
│   ├── printing/
│   └── fixtures/
└── README.md
```

Adjust the exact structure to the chosen build tooling, but preserve the separation between UI, processing, persistence, and native printing.

---

# 6. Core Data Models

Use TypeScript interfaces and runtime validation for persistent data.

## 6.1 Print job

```ts
interface PrintJob {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  imageIds: string[];
  pageIds: string[];
  layoutSettings: LayoutSettings;
  printSettings: PrintSettings;
}
```

## 6.2 Image asset

```ts
interface ImageAsset {
  id: string;
  sourcePath: string;
  fileName: string;
  mimeType: string;
  originalWidth: number;
  originalHeight: number;
  fileSizeBytes: number;
  editState: ImageEditState;
}
```

Do not assume a source file will always remain at its original path. Detect missing files and allow the user to locate them again.

## 6.3 Image edit state

```ts
interface ImageEditState {
  rotationDegrees: number;
  crop: CropRegion | null;
  perspective: PerspectiveSettings | null;
  brightness: number;
  contrast: number;
  exposure: number;
  gamma: number;
  saturation: number;
  grayscale: boolean;
  threshold: number | null;
  enhancementPreset: string | null;
  background: BackgroundSettings | null;
}
```

Use defined ranges and defaults for every adjustment.

Store edits as parameters rather than replacing the original image with a modified file.

## 6.4 Background settings

```ts
type BackgroundSettings =
  | { mode: "original" }
  | { mode: "transparent" }
  | { mode: "solid"; colorHex: string }
  | {
      mode: "segmented";
      colorHex: string;
      modelId: string;
      refinement: EdgeRefinementSettings;
    };
```

Keep manual mask edits in a suitable versioned representation rather than embedding large image data directly in the job record.

## 6.5 Layout settings

```ts
type Unit = "mm" | "in";

type FitMode =
  | "contain"
  | "cover"
  | "original-ratio"
  | "stretch";

interface LayoutSettings {
  paperWidthMm: number;
  paperHeightMm: number;
  orientation: "portrait" | "landscape";
  marginMm: number;
  gapMm: number;
  rows: number;
  columns: number;
  fitMode: FitMode;
  borderEnabled: boolean;
  borderWidthMm: number;
  cutMarksEnabled: boolean;
  outputDpi: number;
}
```

Validate the paper dimensions, row and column counts, margins, and gaps before generating pages.

## 6.6 Print settings

```ts
interface PrintSettings {
  printerId: string | null;
  copies: number;
  colorMode: "color" | "grayscale";
  pageRange: string | null;
  duplexMode: "simplex" | "manual" | "automatic";
  flipEdge: "long" | "short";
  paperSize: string;
  orientation: "portrait" | "landscape";
}
```

Printer-specific options must be represented separately when the driver exposes additional capabilities.

---

# 7. Local Database

Use SQLite for jobs, presets, and metadata.

Suggested tables:

### `jobs`

- `id`
- `name`
- `created_at`
- `updated_at`
- `schema_version`

### `job_images`

- `id`
- `job_id`
- `source_path`
- `filename`
- `mime_type`
- `original_width`
- `original_height`
- `file_size_bytes`
- `sort_order`
- `edit_state_json`

### `pages`

- `id`
- `job_id`
- `page_index`
- `layout_json`
- `side_type`

### `presets`

- `id`
- `name`
- `preset_type`
- `settings_json`
- `created_at`
- `updated_at`

### `app_settings`

- `key`
- `value_json`

Use foreign keys, transactions, schema migrations, and recovery-safe writes.

Do not store passwords or unnecessary personal information.

Temporary processing files should live in a managed cache and be cleaned up safely.

---

# 8. Image-Processing Algorithms

## 8.1 Rotation and deskew

1. Decode the source image.
2. Detect likely document boundaries or text orientation.
3. Estimate rotation.
4. Generate a preview of the proposed correction.
5. Apply the correction non-destructively.
6. Allow manual adjustment.
7. Render the final result from the original source and edit parameters.

Avoid repeated resampling of an already-resampled image when generating final output.

## 8.2 Perspective correction

1. Detect a likely quadrilateral page boundary.
2. Estimate its four corners.
3. Show the detected corners to the user.
4. Allow manual correction.
5. Apply a perspective transform.
6. Validate that the resulting crop is usable.

Do not force a perspective correction when the detection is unreliable.

## 8.3 Document enhancement

Implement separate operations for:

- Brightness and contrast.
- Gamma correction.
- Grayscale.
- Adaptive or global thresholding.
- Background normalization.
- Shadow reduction.
- Mild sharpening.

Darken Text should be designed to enhance the foreground while minimizing damage to thin strokes, signatures, and background details.

No single enhancement algorithm will work optimally for every image. Provide presets and manual controls.

## 8.4 Preview and rendering pipeline

Maintain two processing paths:

**Preview path:** Uses appropriately sized images for responsive interaction.

**Final rendering path:** Uses the original-resolution source and the full edit state.

The final output must not accidentally use a low-resolution thumbnail.

---

# 9. Background-Removal Implementation

## 9.1 Model requirements

Select a segmentation model only after confirming:

- Commercial-use permissions.
- Redistribution rights for the weights.
- Compatibility with the chosen inference runtime.
- Input resolution and preprocessing requirements.
- Expected memory usage.
- CPU inference support.
- Offline operation.
- Acceptable portrait-edge quality.

A suitable ONNX-compatible model is preferred, but the exact model must be selected and verified during implementation.

## 9.2 Processing pipeline

1. Validate the input image.
2. Decode the image.
3. Resize or tile it according to model requirements.
4. Normalize the model input.
5. Run local inference.
6. Convert the output into a foreground mask.
7. Resize the mask to the required dimensions.
8. Refine edges where appropriate.
9. Apply user-controlled erase and restore edits.
10. Composite the foreground over the chosen background.
11. Preserve the original source.
12. Export the final image in the requested format.

## 9.3 Mask refinement

Support:

- Edge softness.
- Feathering.
- Mask expansion or contraction where appropriate.
- Manual erase and restore.
- Zoomed edge inspection.

Avoid promising perfect hair, transparent objects, or complex edge extraction.

## 9.4 Background color output

Use a solid-color fill for selected colors.

For JPEG output, flatten transparency onto the selected background.

For PNG output, preserve alpha when transparent mode is selected.

Store the original image, segmentation settings, and mask-edit data separately so the background can be changed without repeating unrelated edits.

## 9.5 Model packaging

Prefer a model that can be bundled legally and reasonably.

If bundling is impractical:

- Provide an optional download from a verified source.
- Show the download size.
- Validate the downloaded file.
- Store it locally.
- Explain that background removal is unavailable until installation.
- Keep all other application features usable.

Never silently download model files from an unverified URL.

---

# 10. Print Layout Geometry

This is a critical subsystem. Layout must be deterministic and independently testable.

## 10.1 Coordinate system

Use millimeters as the internal unit for physical page geometry.

Convert to PDF points using:

`points = millimeters × 72 / 25.4`

For raster rendering:

`pixels = millimeters × DPI / 25.4`

Avoid using screen CSS pixels as physical print dimensions.

## 10.2 Usable page area

Let:

- `W` = page width in millimeters.
- `H` = page height in millimeters.
- `L`, `R`, `T`, `B` = margins.
- `Gx` = horizontal gap.
- `Gy` = vertical gap.
- `C` = number of columns.
- `Rcount` = number of rows.

Then:

`UsableWidth = W - L - R`

`UsableHeight = H - T - B`

For equal-sized grid cells:

`CellWidth = (UsableWidth - (C - 1) × Gx) / C`

`CellHeight = (UsableHeight - (Rcount - 1) × Gy) / Rcount`

Reject or warn about layouts with non-positive cell dimensions.

The actual printable area may be smaller than the paper dimensions due to printer hardware margins.

## 10.3 Image fitting

### Contain

Scale the source to fit within the cell while preserving the aspect ratio.

### Cover

Scale until the cell is filled, then crop excess content.

### Original ratio

Preserve the aspect ratio and center the image within its allotted area. Do not force the image to fill the cell.

### Stretch

Use the requested cell dimensions only when the user explicitly chooses distortion.

## 10.4 Multiple pages

If there are more images than can fit on a sheet:

1. Fill the current page according to the configured ordering.
2. Create another page.
3. Continue until every selected image is placed.
4. Preserve the configured order.
5. Keep paired front/back images together when the selected workflow requires it.

## 10.5 Output resolution

Use a configurable default print resolution, such as 300 DPI, where appropriate.

A high DPI setting does not create missing source detail. Warn users when the source image resolution is insufficient for the requested physical dimensions.

## 10.6 Page clipping

Validate that every placed image and optional mark lies inside the configured page boundary.

Warn when objects fall outside the physical page or printer-supported printable area.

---

# 11. Front-and-Back Printing

Represent duplex jobs as ordered physical sheets containing separate front and back compositions.

Each side must have a defined page index and pairing relationship.

### Automatic duplex

Use the printer's supported duplex functionality when the driver exposes it.

### Manual duplex

Generate two ordered print passes:

- Front-side pass.
- Back-side pass.

Provide configurable feed instructions and a test-sheet process.

Do not hardcode a universal paper-reinsertion direction. Printers vary in feed path and orientation.

### Validation

- Detect unpaired sides.
- Preserve pair ordering.
- Validate the number of sheets.
- Confirm long-edge or short-edge intent.
- Provide independent front and back previews.

---

# 12. PDF Generation and Printing

## 12.1 PDF generation

Generate PDF pages using explicit physical dimensions.

Ensure that:

- Paper size is correct.
- Image positions match the layout.
- Images are not unintentionally distorted.
- Page count matches the generated layout.
- Cut marks are included only when enabled.
- Output filenames are sanitized.
- Large jobs are processed without excessive memory use.

## 12.2 Print integration

Electron printing behavior and printer-driver capabilities must be tested against the selected Electron version and supported Windows environments.

The print adapter must distinguish:

- Print job creation.
- Print submission.
- Submission failure.
- Status information actually available from the operating system.

Do not promise exact control over every driver-specific setting if the selected integration does not expose it.

## 12.3 Fallback behavior

If native printing fails:

- Explain the error.
- Preserve the print job.
- Allow the user to export the generated PDF.
- Allow a retry after printer settings are corrected.

---

# 13. State Management and Undo/Redo

Use a clear separation between:

- Persistent job state.
- Current UI state.
- Active selection.
- Temporary processing state.
- Derived previews.
- Export state.

For edits, maintain an undoable command or state-history system.

Avoid storing complete full-resolution image buffers in every history entry.

Where possible, store edit parameters, crop regions, mask operations, and layout changes.

Undo/redo must not modify the original source file.

---

# 14. Performance Requirements

Target the following on a documented reference Windows computer:

- Initial usable UI within approximately 3 seconds.
- Progressive thumbnail loading.
- Responsive adjustment previews.
- Background processing without freezing the interface.
- Incremental handling of large batches.
- Bounded preview-cache memory.
- Cancellation of supported long-running operations.
- Recovery from failed image processing without losing the entire job.

Performance depends on hardware, image resolution, model size, and selected processing settings.

Use workers or appropriate asynchronous processing techniques where supported. Do not move expensive processing into the main UI thread.

---

# 15. Error Handling and Diagnostics

Use typed application errors and user-readable messages.

Examples:

- Unsupported image format.
- File could not be decoded.
- Source file missing.
- Model not installed.
- Background inference failed.
- Export destination unavailable.
- Insufficient disk space.
- Invalid layout dimensions.
- Printer unavailable.
- Print submission failed.

Diagnostics must remain local by default.

Never include image content or sensitive customer data in logs.

The application must preserve recoverable job state after an error or unexpected shutdown wherever practical.

---

# 16. Automated Testing

## Unit tests

Test:

- Unit conversions.
- Image-fit calculations.
- Page geometry.
- Margin and gap calculations.
- Page-count calculation.
- Front/back pairing.
- File-type validation.
- Settings validation.
- Undo/redo operations.
- Serialization and deserialization.

## Image-processing tests

Use fixed test fixtures for:

- Tilted documents.
- Perspective-distorted pages.
- Faded text.
- Uneven backgrounds.
- Complex portrait edges.
- Transparent images.
- Low-resolution photographs.
- Large images.
- Corrupted inputs.

Use measurable image-quality checks where practical, alongside visual review.

## Integration tests

Test:

- Importing multiple images.
- Saving and reopening jobs.
- Batch enhancement.
- Background removal.
- PDF generation.
- Missing-source recovery.
- Print submission error handling.
- Offline workflows.

## Print tests

Use representative physical printers and Windows printer drivers.

Verify:

- Actual page size.
- Physical image dimensions.
- Image ordering.
- Cropping and margins.
- Duplex orientation.
- PDF output.
- Printer setting compatibility.

A simulated print preview is not sufficient proof of physical print accuracy.

---

# 17. Build and Release

## Development

Provide scripts for:

- Development startup.
- Type checking.
- Linting.
- Unit testing.
- Integration testing.
- Production build.
- Windows packaging.

## Release artifacts

Produce:

- Windows installer.
- Portable version where practical.
- Release notes.
- User guide.
- Third-party license notices.
- Dependency and model-license audit.
- Offline installation instructions.

Do not make the application dependent on an online account or paid update server.

Verify that bundled native modules and model files work on a clean Windows installation.

---

# 18. Implementation Milestones

### Milestone 1: Foundation

- Secure Electron shell.
- React UI.
- File import.
- Thumbnail queue.
- Local job persistence.
- Application settings.

### Milestone 2: Image editor

- Rotation and crop.
- Auto-straightening.
- Perspective correction.
- Brightness and contrast.
- Darken Text.
- Batch editing.

### Milestone 3: Background Studio

- Model integration.
- Background removal.
- Solid-color replacement.
- Transparency export.
- Manual refinement.

### Milestone 4: Layout Studio

- Paper presets.
- Images-per-page controls.
- Fit modes.
- Exact dimensions.
- Manual layout editor.
- Multi-page generation.

### Milestone 5: Printing

- Print preview.
- PDF import/export.
- Printer selection.
- Copies and page ranges.
- Front/back pairing.
- Duplex workflow.

### Milestone 6: Release quality

- Security review.
- Performance testing.
- Offline testing.
- Physical print validation.
- Dependency-license audit.
- Packaging and documentation.

Each milestone must have passing tests before dependent milestones are considered complete.

---

# 19. Definition of Done

The application is ready for release only when:

- All core workflows function locally.
- Image edits are reversible.
- Original files remain untouched.
- Background removal and color replacement work with the installed model.
- Multi-image layouts preserve their configured dimensions and proportions.
- Print preview matches generated PDF geometry.
- Front/back pairing works.
- Supported printer settings are handled correctly.
- Jobs and presets persist across restarts.
- The application works offline after setup.
- No paid service is required.
- Dependencies and model licenses have been reviewed.
- Critical errors preserve recoverable user work.
- Windows installation and startup are tested on a clean environment.

---

# 20. Final Technical Directive

Build PrintMate as a modular, secure, offline-first Electron application using React and TypeScript.

Prioritize accurate print geometry, reliable image correction, practical document enhancement, high-quality local background removal, reversible editing, and robust printing workflows.

Do not substitute mock functionality for real features. Do not claim that printing, duplex support, model inference, or file export works until it has been implemented and tested.

Do not introduce paid APIs, mandatory cloud services, subscriptions, advertising, or feature restrictions.

The result must be a maintainable, commercially usable printing utility that is free for both its developer and its users, subject to the verified licenses of its components.
