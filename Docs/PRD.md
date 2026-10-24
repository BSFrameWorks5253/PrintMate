# PRINTMATE
## Product Requirements Document (PRD)

**Product:** PrintMate — Xerox & Print Studio  
**Version:** 1.0  
**Platform:** Windows desktop application  
**Technology:** Electron, React, TypeScript  
**Business model:** Free forever  
**Operating model:** Offline-first, local processing  
**Primary users:** Xerox shops, printing shops, cyber cafés, document service centers, photo studios  
**Core principle:** Professional document preparation and printing without subscriptions, paid APIs, or unnecessary complexity.

---

# 1. Product Overview

## 1.1 Vision

Build a professional desktop application that allows printing-shop operators to import images and documents, automatically correct their alignment, enhance faded text, remove or replace backgrounds, arrange images on paper, prepare front-and-back print jobs, and print directly from one unified workspace.

The application should eliminate the need to switch between multiple applications for common printing tasks.

A typical user should be able to:

1. Import one or multiple images.
2. Automatically straighten, crop, and enhance them.
3. Darken faded text or clean the document background.
4. Remove a photo's background and replace it with white, blue, or any custom color.
5. Arrange images on A4, A3, A5, or other supported paper sizes.
6. Choose how many images appear on each page.
7. Configure front-and-back printing.
8. Review a print-accurate preview.
9. Print or export the result as a PDF.

All core processing must happen locally.

## 1.2 Product goals

- Reduce the time required to prepare customer documents.
- Make incorrectly tilted and poorly photographed documents printable.
- Improve text readability in faded images and photocopies.
- Provide quick passport-photo and ID-photo preparation.
- Simplify multiple-images-per-page printing.
- Support front-and-back document workflows.
- Provide reliable, predictable print output.
- Preserve original customer files.
- Run without internet connectivity after installation.
- Keep development and usage costs as close to ₹0 as technically possible.

## 1.3 Non-goals

The initial release will not include:

- Paid APIs or cloud-dependent image processing.
- AI chatbots or generative AI features.
- Mandatory accounts or registration.
- Cloud synchronization or a hosted database.
- Online customer portals.
- Advertising, subscriptions, credits, or premium tiers.
- A full professional photo-editing suite comparable to Photoshop.
- Remote printer management across the internet.
- Automatic software updates requiring a paid server.

---

# 2. Target Users

## Primary: Xerox and printing-shop operators

Typical needs:

- Quickly prepare images received through messaging applications.
- Correct tilted documents and identity-card photographs.
- Make faded text darker.
- Print several images on one A4 sheet.
- Prepare front and back sides of documents.
- Remove backgrounds from ID photographs.
- Reuse familiar print layouts and settings.

## Secondary: Cyber cafés and document service centers

Typical needs:

- Print application forms and scanned documents.
- Combine photos and PDFs.
- Prepare multi-page application documents.
- Print selected pages or page ranges.
- Handle multiple customer jobs without mixing files.

## Secondary: Individual users and small offices

Typical needs:

- Prepare documents for home printing.
- Print multiple photographs economically.
- Enhance scanned documents.
- Export clean PDFs without installing multiple applications.

---

# 3. Product Principles

Every module must follow these principles.

1. **Local-first:** Core features must work offline.
2. **Original preservation:** Never overwrite the source image automatically.
3. **Reversible editing:** Provide undo, redo, and reset.
4. **Print accuracy:** Use physical dimensions and print resolution rather than relying on screen appearance.
5. **Predictable automation:** Automatic corrections must be reviewable and reversible.
6. **Consistent layouts:** Equal-size layouts must use consistent cells, margins, and gaps.
7. **No image distortion:** Preserve aspect ratios unless the user explicitly chooses stretching.
8. **Fast workflow:** Common operations should require as few clicks as possible.
9. **Privacy:** Customer documents must remain local by default.
10. **No artificial restrictions:** Do not impose image-count limits, export paywalls, or feature locks.

---

# 4. Functional Requirements

## 4.1 Home Dashboard and Job Management

The home screen is the starting point for every printing task.

### Required features

- New Print Job.
- Open Existing Job.
- Import Images.
- Import PDF.
- Recent Jobs.
- Saved Layout Presets.
- Printer Selection.
- Application Settings.
- Quick access to image enhancement and background removal.

### Import methods

- File picker.
- Drag and drop.
- Multiple-file selection.
- Folder selection.
- Clipboard image paste.
- Supported image files dropped directly into the workspace.

### Job behavior

Each job stores its configuration, image ordering, edits, page layouts, and print settings.

Users must be able to save a job, close the application, and reopen it later without losing the layout.

Customer images must not be copied unnecessarily. Job storage should reference source files where practical, with clear handling for moved or deleted files.

If a source image is missing, show a useful recovery prompt rather than silently removing it.

---

## 4.2 Image Import and Thumbnail Management

### Supported input formats

The application should support common formats, subject to the selected libraries and operating-system capabilities:

- JPEG / JPG
- PNG
- WebP
- BMP
- TIFF
- GIF, using a defined frame-selection policy
- HEIC / HEIF where a compatible local decoder is available
- PDF pages through a dedicated PDF renderer

Additional camera RAW formats may be supported in a later release.

### Image queue

Display imported files as thumbnails with:

- Filename.
- Dimensions.
- File size.
- Image order.
- Processing status.
- Warning indicators.

### Queue actions

- Reorder images using drag and drop.
- Rotate selected images.
- Duplicate an image.
- Remove images from the job.
- Select multiple images.
- Apply edits to selected images.
- Undo or reset selected edits.
- Select all or invert selection.

Removing an image from the job must not delete the original file.

---

## 4.3 Automatic Image Alignment

This is one of the application's most important features.

### Automatic correction

The application should attempt to:

- Detect tilted document boundaries.
- Estimate rotation angle.
- Straighten documents.
- Detect page edges.
- Correct perspective distortion.
- Identify excessive borders and background areas.
- Determine the likely document orientation.
- Detect incorrectly oriented images where possible.

### Manual correction

Provide:

- Rotation by 90-degree increments.
- Fine rotation using a slider or numeric angle.
- Straightening controls.
- Manual crop selection.
- Perspective-correction corner handles.
- Crop aspect-ratio presets.
- Reset and undo.

### Auto-correction behavior

Provide two options:

- **Auto Fix:** Apply suggested corrections.
- **Review Fixes:** Display the proposed corrections before applying them.

For uncertain detections, show a warning and retain the original instead of applying an aggressive correction.

The user must always be able to revert to the original.

### Acceptance criteria

- Auto-straighten can process a batch of images.
- Manual rotation and cropping work independently.
- The original image remains unchanged.
- Corrections can be undone and redone.
- Failed detections do not crash the application.

---

## 4.4 Brightness, Contrast and Document Enhancement

Provide a dedicated editing workspace.

### Basic controls

- Brightness.
- Contrast.
- Exposure.
- Highlights.
- Shadows.
- Gamma.
- Saturation.
- Temperature and tint, where appropriate.
- Sharpness.
- Grayscale.
- Black-and-white threshold.

Use sliders with numeric values and a reset option.

### Text enhancement

Provide a dedicated **Darken Text** feature for:

- Faded printed text.
- Light photocopies.
- Scanned application forms.
- Low-contrast documents.
- Handwritten notes.

The enhancement system should attempt to darken foreground text while retaining the paper background and fine details.

### Background cleanup

- Whiten paper backgrounds.
- Reduce uneven illumination.
- Reduce light shadows.
- Reduce yellow or grey color casts.
- Remove small background imperfections where feasible.

### Processing modes

Provide presets such as:

- Original.
- Faded Document.
- Darken Text.
- Clean White Paper.
- Black-and-White Xerox.
- Handwriting.
- Photograph.
- Custom.

Preset names must describe the intended effect, not guarantee perfect results for every image.

### Before-and-after comparison

Provide a comparison slider or split preview.

Users must be able to:

- Preview changes before committing.
- Apply settings to one image.
- Apply settings to multiple selected images.
- Save a custom preset.
- Reset to the original.

### Acceptance criteria

- Image settings update the preview without requiring repeated file imports.
- Batch processing respects individual source images.
- All modifications remain reversible.
- Text enhancement does not automatically overwrite the source.

---

## 4.5 Background Removal and Replacement

This feature allows the user to remove the background from a photograph and replace it with another color.

### Automatic background removal

Use a locally running segmentation model or another suitable open-source background-removal implementation.

The implementation must not depend on a paid API.

### Background replacement options

Provide:

- White.
- Light blue.
- Blue.
- Red.
- Grey.
- Green.
- Black.
- Custom color.
- Transparent background.

The custom-color selector should support a color picker and HEX color input.

### Manual refinement

Provide:

- Erase brush.
- Restore brush.
- Brush-size control.
- Undo and redo.
- Edge feathering.
- Edge refinement.
- Before-and-after preview.
- Reset background.

### Export behavior

- Preserve transparency in PNG exports.
- Flatten the selected background color for JPG exports.
- Maintain the original subject resolution wherever practical.
- Avoid unintentionally reducing image quality.

### Batch background processing

Users should be able to select multiple portraits, remove their backgrounds, and apply the same replacement color to all selected images.

### Passport and ID photo workflow

Allow users to:

1. Select a photograph.
2. Remove its existing background.
3. Choose white, light blue, or a custom color.
4. Refine the subject edges.
5. Crop to a required aspect ratio.
6. Set exact physical dimensions.
7. Add the image to a print layout.

The application should not claim that a particular background color or photograph meets every government's official passport requirements.

### Performance and privacy

- Run processing locally.
- Bundle a suitable model or provide an optional one-time model download.
- Cache model files locally.
- Do not send images to a remote service.
- Check the model's license, weights license, redistribution terms, and commercial-use permissions before shipping.

If a model is too large to bundle, clearly disclose its size and download requirements. Core non-AI image editing must remain available without downloading it.

---

## 4.6 Print Layout and Page Arranger

The layout engine must calculate image positions and sizes using physical page dimensions.

### Supported paper sizes

- A4.
- A3.
- A5.
- Letter.
- Legal.
- Custom width and height.

Provide portrait and landscape orientation.

### Images per page

Offer quick presets for:

- 1 image.
- 2 images.
- 3 images.
- 4 images.
- 5 images.
- 6 images.
- 8 images.
- 9 images.
- 12 images.

Allow custom layouts where practical.

The system must also support jobs containing more images than fit on one sheet by generating additional pages.

### Layout controls

- Rows and columns.
- Image count per page.
- Page margins.
- Horizontal and vertical gaps.
- Cell dimensions.
- Image order.
- Image alignment.
- Horizontal and vertical centering.
- Optional borders.
- Optional crop marks.
- Optional cutting guides.
- Portrait and landscape layouts.

### Image fitting modes

**Contain:** Fit the entire image within its cell without cropping.

**Crop to Fill:** Fill the cell by cropping excess image content.

**Original Ratio:** Preserve the image's aspect ratio, allowing unused space when necessary.

**Stretch:** Change the image proportions only when explicitly selected by the user.

### Equal-size mode

When enabled, every image occupies a consistent cell size.

The application must distinguish equal cell sizes from identical image aspect ratios. Different source proportions must never be silently distorted.

### Manual layout editor

Provide a page canvas with:

- Drag-and-drop image positioning.
- Resize handles.
- Alignment guides.
- Snapping.
- Duplicate and delete.
- Bring forward and send backward where applicable.
- Undo and redo.
- Fit-to-page view.
- Zoom controls.
- Page navigation.

### Automatic layout

The user chooses the paper size, image count, and fitting mode. The application calculates a valid arrangement using the available printable area.

The layout engine must respect:

- Physical page dimensions.
- Printer margins.
- Configured gaps.
- Image aspect ratios.
- Requested cell dimensions.
- Page orientation.

If the layout cannot fit, show a clear warning and suggest a valid alternative.

---

## 4.7 Exact Physical Image Dimensions

Allow users to enter image dimensions in:

- Millimeters.
- Centimeters.
- Inches.

Examples include custom ID-photo dimensions and passport-photo sizes.

The application must calculate the corresponding output dimensions based on the selected print resolution.

The editor must distinguish between:

- Physical dimensions on paper.
- Source pixel dimensions.
- Effective print resolution.

When an image lacks sufficient resolution, warn the user instead of claiming that the printed result will be sharp.

---

## 4.8 Passport and ID Photo Sheet Generator

Provide a dedicated preset-based workflow for repeated photographs.

### Features

- Passport-photo layouts.
- ID-card photographs.
- Visa-photo layouts.
- Custom photo dimensions.
- Repeat one photo multiple times.
- Arrange multiple different people on the same sheet.
- Background removal and replacement.
- Fixed aspect ratios.
- Adjustable margins and spacing.
- Optional borders and cutting marks.
- A4 and other supported paper sizes.
- Export as PDF or image.

Allow the user to save custom photo-size presets.

---

## 4.9 Front-and-Back Printing

Support two-sided documents and manually paired image groups.

### Front and back management

- Separate front and back image collections.
- Pair each front image with its corresponding back image.
- Maintain the pairing when images are reordered.
- Preview each side independently.
- Print front only.
- Print back only.
- Print both sides.
- Reorder pairs.
- Warn about missing back-side images.

### Duplex modes

**Automatic Duplex:** Use the printer's supported duplex functionality when available.

**Manual Duplex:** Print the first side, instruct the user to flip or reinsert the paper, and print the reverse side.

### Flip settings

- Flip on long edge.
- Flip on short edge.

Provide a configurable test-sheet workflow to establish the correct paper-reinsertion direction for a specific printer.

### Alignment

Where the printer and paper handling allow it, provide front/back alignment adjustments.

These adjustments must not imply perfect physical registration on every printer. Mechanical feed tolerances can cause small offsets.

### Acceptance criteria

- Front and back collections are distinguishable.
- Missing pairs produce a warning.
- Manual duplex produces clear reinsertion instructions.
- Duplex settings are preserved in saved jobs.
- Automatic duplex is offered only when supported by the printer and operating system.

---

## 4.10 Print Preview

Print preview is a mandatory stage before sending a job to the printer.

### Preview capabilities

- Show every page.
- Zoom in and out.
- Navigate between pages.
- Inspect front and back sides.
- Select pages.
- Display paper dimensions.
- Display margins and optional cut marks.
- Identify clipped or overflowing content.
- Show warnings for low-resolution images.
- Show the selected printer and print settings.

### Print safety checks

Before printing, warn about:

- Content outside the printable area.
- Images exceeding configured dimensions.
- Missing front/back pairs.
- Low-resolution images.
- Blank or nearly blank pages where detectable.
- Unexpected page orientation.
- Unsupported printer settings.
- Empty print jobs.

Warnings should be actionable and should not block legitimate jobs unnecessarily.

---

## 4.11 Printing and Printer Management

Use the native Windows printing system and installed printer drivers.

### Required controls

- Select installed printer.
- Select paper size.
- Portrait or landscape.
- Color or grayscale, where supported.
- Print quality, where supported.
- Copies.
- Page range.
- All pages.
- Selected pages.
- Odd pages.
- Even pages.
- Collation, where supported.
- Duplex mode, where supported.

The application must distinguish between options it supports itself and options provided by the printer driver.

### Printing workflow

1. Generate a print-ready document.
2. Validate page geometry.
3. Show print preview.
4. Open the native printer settings when necessary.
5. Submit the job.
6. Report submission errors clearly.
7. Allow the user to retry or save as PDF.

Do not claim that a page physically printed just because it was successfully submitted to the operating system's print queue.

---

## 4.12 PDF Import and Export

### PDF import

- Open a PDF locally.
- Display page thumbnails.
- Select individual pages.
- Reorder pages.
- Combine selected PDF pages with images.
- Add selected pages to the layout system.

### PDF export

- Export the final layout as PDF.
- Preserve physical page dimensions.
- Preserve image proportions.
- Render at an appropriate quality.
- Support multi-page documents.
- Include configured page margins and cut marks.
- Allow the user to choose a destination.

The application must not silently downscale images or change page dimensions during export.

### Other exports

- JPEG.
- PNG.
- Transparent PNG when appropriate.
- A copy of the final page as a raster image.

The original source files must remain untouched.

---

## 4.13 Saved Jobs and Presets

### Saved jobs

Store:

- Job title.
- Source file references.
- Image order.
- Image edits.
- Background-removal settings.
- Page layouts.
- Paper size.
- Margins and gaps.
- Duplex configuration.
- Print settings.
- Export settings.

### Presets

Users should be able to save and reuse:

- Paper layouts.
- Image counts.
- Passport-photo sizes.
- Background colors.
- Document-enhancement settings.
- Print settings.
- Custom margins and spacing.

### Storage behavior

Use a local SQLite database or another suitable local persistence system.

If source files are moved or deleted, show a recovery option.

Job files must not silently contain embedded copies of sensitive documents unless required by the selected workflow and clearly disclosed.

---

## 4.14 Undo, Redo and Original Preservation

Editing operations must be reversible.

Required capabilities:

- Undo.
- Redo.
- Reset selected edit.
- Reset image to original.
- Revert batch settings.
- Before-and-after comparison.

Use a non-destructive editing model wherever practical. Store editing parameters separately from the source image and generate processed output when needed.

---

## 4.15 Keyboard Shortcuts and Productivity

Support common shortcuts:

- Ctrl+O: Open files.
- Ctrl+S: Save job.
- Ctrl+Z: Undo.
- Ctrl+Y: Redo.
- Ctrl+A: Select all.
- Delete: Remove selected images from the job.
- Ctrl+P: Open print workflow.
- Ctrl+Shift+S: Save a copy or export, according to the application's established shortcut policy.

Display shortcut hints in menus and tooltips.

Avoid intercepting operating-system shortcuts unnecessarily.

---

# 5. User Interface and Experience

## 5.1 Design direction

Create a professional, efficient desktop interface inspired by the clarity and precision of professional creative applications.

The interface should feel like a purpose-built print workstation rather than a generic image-editing website.

### Visual principles

- Clean, restrained design.
- Strong typography and clear hierarchy.
- Neutral surfaces with a restrained accent color.
- High-quality icons.
- Consistent spacing.
- Minimal unnecessary decoration.
- Clear hover, selected, disabled, and processing states.
- Smooth but subtle transitions.
- Light and dark themes if feasible without compromising usability.

Avoid neon styling, excessive glassmorphism, oversized decorative cards, and unnecessary animations.

## 5.2 Main application layout

### Left sidebar

- Home.
- Images.
- Enhance.
- Background.
- Layout.
- Front & Back.
- Print Preview.
- Saved Jobs.
- Settings.

### Center workspace

Display the active image or page canvas.

Provide zoom, selection, alignment guides, and contextual controls.

### Right inspector panel

Display controls relevant to the selected object or workflow:

- Image adjustments.
- Background color.
- Crop dimensions.
- Image fitting.
- Page margins.
- Layout settings.
- Print settings.

The inspector should adapt to the selected tool rather than showing every control at once.

### Bottom image strip

Show image thumbnails, processing status, ordering, and selection.

## 5.3 Important interaction rules

- Dragging an image into the workspace must be straightforward.
- Common operations should not require navigating multiple modal dialogs.
- Destructive operations require clear feedback.
- Long-running processing must show progress.
- The user should be able to cancel supported operations.
- Failed operations must not discard unrelated work.
- Every major workflow must support keyboard and mouse input.

## 5.4 Accessibility

- Readable font sizes.
- Sufficient contrast.
- Keyboard navigation.
- Visible focus states.
- Accessible labels for controls.
- Tooltips for unfamiliar print terminology.
- Clear error messages.

---

# 6. Technical Architecture

## 6.1 Recommended stack

**Desktop shell:** Electron  
**Frontend:** React + TypeScript  
**Build tooling:** Vite or another compatible build system  
**Image manipulation:** Canvas and suitable local image-processing libraries  
**Document detection and geometry:** OpenCV.js or a suitable compatible alternative  
**Background removal:** A locally executed segmentation model  
**Model runtime:** ONNX Runtime or another compatible, appropriately licensed local runtime  
**PDF output:** A suitable open-source PDF generation library  
**Persistence:** SQLite  
**Printing:** Electron's printing capabilities, Windows printing integration, and native printer drivers as required  
**Packaging:** Electron packaging and installer tooling compatible with the chosen license and distribution approach

Exact library versions and licenses must be reviewed before implementation.

## 6.2 Architecture principles

Separate the application into these modules:

1. Application shell.
2. File import and decoding.
3. Image-processing engine.
4. Background-removal engine.
5. Non-destructive edit-state manager.
6. Page-layout engine.
7. PDF rendering and export engine.
8. Print integration.
9. Local job database.
10. Settings and preset manager.
11. Error handling and diagnostics.

Modules should communicate through typed interfaces.

The renderer must not receive unrestricted access to the operating system. Use secure Electron configuration, a controlled preload bridge, and narrowly scoped IPC handlers.

Enable context isolation and keep Node.js integration disabled in renderer pages wherever feasible.

## 6.3 Processing strategy

- Keep source images unchanged.
- Generate previews at appropriate resolutions.
- Use full-resolution source data for final exports.
- Cache derived previews where beneficial.
- Release temporary buffers when no longer needed.
- Process large batches incrementally.
- Keep the UI responsive during processing.
- Support cancellation for long-running tasks.
- Display meaningful progress.

Background removal should use the same local-processing principles as the other image-editing features.

## 6.4 Print geometry

Represent page dimensions, margins, gaps, and object positions using explicit physical units internally.

Convert between millimeters, inches, points, and pixels only at defined boundaries.

For raster output, use the requested rendering resolution. For PDF output, preserve the physical dimensions and avoid unnecessary rasterization of content.

Account for printer-specific printable areas and driver limitations.

---

# 7. Free-for-Everyone Business and Licensing Requirements

This is a mandatory product constraint.

## 7.1 Pricing policy

The application must remain free for both the developer and all users.

There must be:

- No subscription.
- No per-print charges.
- No image-processing credits.
- No paid API.
- No mandatory account.
- No advertising.
- No feature paywalls.
- No compulsory cloud service.
- No paid license key.
- No artificial image-count or export limits.

Users may charge their own customers for printing services. Using the application commercially must not require purchasing a license, subject to the actual terms of the selected dependencies.

## 7.2 Zero mandatory backend cost

The core application must not require:

- A hosted backend.
- A cloud database.
- A paid server.
- A hosted image-processing service.
- A paid model-inference service.
- A recurring update server.
- A remote license-validation service.

Core functionality must continue working without internet access.

## 7.3 Dependency licensing

Before release, verify the license and redistribution terms of every dependency, including:

- JavaScript packages.
- Native modules.
- PDF libraries.
- Image decoders.
- Background-removal models.
- Model weights.
- Runtime libraries.
- Bundled fonts and icons.
- Installer and packaging components.

Create a third-party notices file.

Do not assume that a model is commercially redistributable merely because its inference library is open source.

## 7.4 Distribution

Provide a Windows installer and, if practical, a portable build.

Manual updates are acceptable. Automatic updates are optional and must not require a paid service.

Code-signing certificates and certain distribution services may have fees. They must not be mandatory for the application to function.

## 7.5 Cost transparency

The implementation must use free, legally compatible dependencies and avoid mandatory recurring services.

The developer should not be required to maintain a server or pay per user or per image.

The PRD does not guarantee that all possible development, hardware, signing, distribution, or future maintenance expenses will be zero.

---

# 8. Privacy and Security

Customer documents may contain personal information, so privacy is a core requirement.

- Process documents locally.
- Do not upload customer images.
- Do not include analytics that transmit image data.
- Do not require user registration.
- Avoid unnecessary collection of personal information.
- Do not delete source files automatically.
- Provide clear control over temporary and saved files.
- Protect the application's local job database against accidental corruption.
- Restrict Electron IPC access.
- Validate imported file types and sizes.
- Handle malformed files safely.
- Avoid executing imported files or treating their contents as application code.
- Provide a way to clear local job history and cached data.

Any optional internet-dependent feature must be clearly identified and must not compromise offline operation.

---

# 9. Performance and Reliability

## 9.1 Performance objectives

The application should remain responsive while importing, editing, arranging, and exporting images.

Initial engineering targets, to be validated on a documented reference computer:

- Application shell becomes interactive within approximately 3 seconds after startup.
- Standard image thumbnails appear progressively rather than waiting for every image to finish.
- Common adjustment previews respond within approximately 150 ms on supported reference hardware where practical.
- The interface remains interactive during background processing.
- Large print jobs are processed incrementally rather than requiring every full-resolution image to remain in memory.

Background removal and large-image processing may take longer depending on hardware and model size.

## 9.2 Error handling

Handle:

- Unsupported formats.
- Corrupted files.
- Missing source images.
- Insufficient memory.
- Failed background-model initialization.
- Failed PDF export.
- Missing printers.
- Invalid paper sizes.
- Unsupported duplex settings.
- Print submission failures.
- Insufficient disk space.
- Permission errors.

Every error must explain the issue and offer a useful next step.

The application must not silently discard edits or claim that a print job completed when it only entered the operating-system queue.

---

# 10. Testing Requirements

## 10.1 Image-processing tests

Test:

- Slightly tilted documents.
- Severely tilted documents.
- Perspective-distorted pages.
- Faded text.
- Dark backgrounds.
- Uneven illumination.
- Handwritten content.
- Photographs with complex hair edges.
- Transparent images.
- Low-resolution photographs.
- Large images.
- Corrupted images.

Verify that the source image is preserved and edits can be reverted.

## 10.2 Layout tests

Test:

- Every supported paper size.
- Portrait and landscape.
- 1, 2, 3, 4, 5, 6, 8, 9, and 12 images per page.
- Mixed aspect ratios.
- Contain and crop-to-fill.
- Exact physical image dimensions.
- Custom margins and gaps.
- Multiple pages.
- Manual positioning.
- Clipping detection.

Verify that generated page geometry matches the selected dimensions.

## 10.3 Printing tests

Test with representative printer drivers and paper configurations.

Verify:

- Printer selection.
- Page ranges.
- Multiple copies.
- Color and grayscale settings.
- Supported quality options.
- Automatic duplex when available.
- Manual duplex workflows.
- Long-edge and short-edge flipping.
- PDF export and reprinting.
- Error reporting when a printer is unavailable.

Physical printing tests are required; a successful preview alone does not prove that the output is correct.

## 10.4 Offline tests

Disconnect the computer from the internet and verify:

- Application startup.
- Image import.
- Image correction.
- Brightness and text enhancement.
- Background removal when its model is installed.
- Layout generation.
- PDF export.
- Printing.
- Saving and reopening jobs.

If the background model has not been installed, the application must explain that clearly without disabling unrelated features.

---

# 11. Acceptance Criteria

The initial release is accepted only when all of the following are satisfied:

1. A user can import multiple images into one job.
2. Images can be straightened automatically and manually.
3. Users can crop, rotate, and undo changes.
4. Brightness and contrast controls work.
5. Darken Text and document-cleanup modes work on supported inputs.
6. Background removal and custom-color replacement run locally with the required model installed.
7. Multiple images can be arranged on supported paper sizes.
8. Images retain their proportions unless the user explicitly chooses otherwise.
9. Users can customize margins, gaps, and layout.
10. Exact physical image dimensions are supported.
11. Front-and-back collections can be paired and previewed.
12. Manual duplex provides clear reinsertion guidance.
13. Print preview displays all pages.
14. PDF export preserves page dimensions.
15. The original source files remain untouched.
16. Jobs and presets persist locally.
17. The application runs without a user account.
18. Core workflows work offline.
19. No paid service or subscription is required.
20. Third-party licenses and redistribution permissions have been reviewed.
21. Critical errors do not silently discard user work.
22. The application is packaged for Windows installation.

---

# 12. Development Roadmap

## Phase 1 — Foundation

- Electron and React setup.
- Secure IPC architecture.
- Main interface.
- File import and thumbnail queue.
- Local job persistence.
- Undo/redo foundation.

## Phase 2 — Image Editing

- Rotation and cropping.
- Auto-straightening.
- Perspective correction.
- Brightness and contrast.
- Darken Text.
- Grayscale and background cleanup.
- Batch editing.

## Phase 3 — Background Removal

- Local model integration.
- Background color selection.
- Transparent PNG output.
- Manual erase and restore.
- Edge refinement.
- Batch background replacement.

## Phase 4 — Layout Engine

- Paper presets.
- Rows and columns.
- Multiple images per page.
- Image fitting modes.
- Exact physical dimensions.
- Margins, gaps, and cut marks.
- Manual page canvas.

## Phase 5 — Print System

- Print preview.
- PDF import and export.
- Printer selection.
- Copies and page ranges.
- Front-and-back pairing.
- Manual duplex.
- Automatic duplex where supported.

## Phase 6 — Quality and Release

- Performance optimization.
- Error handling.
- Privacy review.
- Dependency-license audit.
- Offline testing.
- Physical print testing.
- Windows installer and portable build.
- Documentation and release checklist.

---

# 13. Success Metrics

Measure product quality locally without requiring telemetry.

- Time needed to prepare a typical print job.
- Number of manual corrections needed after automatic alignment.
- Number of successfully completed print workflows.
- Frequency of clipping or sizing errors found during testing.
- Background-removal quality on representative photographs.
- Time required to process a batch.
- Application crash rate during internal testing.
- Percentage of core features that work offline.
- Number of mandatory external services: zero.
- Mandatory subscription or per-use fees: zero.

Success should be evaluated through local test reports, usability testing, and explicit user feedback rather than compulsory data collection.

---

# 14. Final Product Definition

PrintMate is a Windows desktop application that combines document enhancement, photo background removal, print layout design, and reliable printing into one free tool.

Its primary workflow is:

**Import → Auto Fix → Enhance → Remove/Replace Background → Arrange → Preview → Print or Export PDF**

The application must prioritize speed, reliable physical print dimensions, reversible editing, privacy, and offline operation.

The complete core feature set must remain free for the developer and every client. No paid API, hosted backend, subscription, mandatory account, or per-image fee may be introduced as a dependency of the product.

**Final requirement:** Build a professional, locally processed, commercially usable printing application using carefully selected free and license-compatible tools, with no mandatory recurring infrastructure costs.
