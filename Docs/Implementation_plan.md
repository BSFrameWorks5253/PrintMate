
# PrintMate — Implementation Plan

**Version:** 1.0  
**Application:** PrintMate — Printing & Xerox Workflow Desktop App  
**Target:** Existing Electron + React + TypeScript codebase  
**Database:** SQLite  
**Operating mode:** Offline-first, local processing  
**Cost target:** ₹0 mandatory recurring service cost

---

## 1. Objective

Implement PrintMate as a complete desktop application for printing shops, enabling users to import documents and images, correct alignment and image quality, remove and replace photo backgrounds, arrange images at exact physical dimensions, preview pages, print, and export PDFs.

The implementation must prioritize reliability, accurate physical dimensions, offline operation, and a professional user experience.

## 2. Mandatory Rules

Before making changes:

1. Inspect the entire existing codebase, including package files, source folders, dependencies, routes, UI components, database, and existing functionality.
2. Identify the framework, architecture, current application entry points, and working features.
3. Read `PRD.md`, `TRD.md`, `CODEBASE_ARCHITECTURE.md`, `APP_FLOW.md`, and `DATABASE_SCHEMA.md` if present.
4. Create a feature-to-codebase mapping before implementation.
5. Reuse existing working components, conventions, dependencies, and styling wherever possible.
6. Do not recreate the application from scratch.
7. Do not replace existing functionality with mockups, placeholder buttons, or simulated processing.
8. Do not install unnecessary dependencies or paid services.
9. Keep all required workflows functional offline.
10. Test each phase before proceeding.

If the current codebase differs from the proposed architecture, adapt the implementation to the existing codebase and document the differences.

---

## 3. Phase 0 — Codebase Audit

### Tasks
- Inspect the repository and application entry points.
- Identify Electron main, preload, and renderer processes if Electron is used.
- Inspect React components, routes, state management, and styling.
- Identify existing file import, image processing, PDF, and print capabilities.
- Inspect database libraries and persistence mechanisms.
- Check build, development, packaging, and test commands.
- Identify existing bugs and integration risks.
- Check dependency licenses and supported platforms.

### Deliverables
- `docs/CODEBASE_AUDIT.md`
- Existing architecture summary
- Reuse-versus-create module mapping
- Dependency and compatibility report
- Prioritized implementation backlog

### Exit Criteria
The agent understands the current application and has a safe implementation strategy. No destructive code changes have been made.

---

## 4. Phase 1 — Foundation and Application Shell

### Tasks
- Establish or refine the existing navigation structure.
- Implement Home, Workspace, Page Layout, Print Preview, Job History, and Settings.
- Establish shared application state and job context.
- Create consistent loading, empty, success, and error states.
- Configure secure Electron IPC if applicable.
- Establish local file storage and temporary-file conventions.
- Add error logging and crash-recovery foundations.

### Deliverables
- Working navigation
- Reusable UI components
- Application-wide error handling
- Secure main-to-renderer communication
- Initial offline architecture

### Exit Criteria
Every main page opens correctly. Navigation does not lose the active job, and existing working features remain intact.

---

## 5. Phase 2 — Database and Persistence

### Tasks
- Implement SQLite initialization.
- Add versioned database migrations.
- Create repositories for jobs, assets, edits, pages, exports, and settings.
- Implement transactions and foreign-key enforcement.
- Persist jobs and editing parameters.
- Store file references without embedding large images in the database.
- Implement safe job deletion.
- Implement missing-source-file detection.
- Add operation tracking for long-running tasks.

### Deliverables
- Local database
- Migration system
- Repository layer
- Job persistence
- Local settings persistence

### Exit Criteria
Jobs survive application restarts. Database upgrades preserve existing data, and deleting a job does not delete original user files.

---

## 6. Phase 3 — Import and Workspace

### Tasks
- Import multiple images through file selection and drag-and-drop.
- Support common image formats using suitable local decoders.
- Import multipage PDFs.
- Display thumbnails, filenames, dimensions, and import status.
- Support reordering, removing, and adding assets.
- Validate unreadable and unsupported files.
- Detect moved or missing originals.
- Implement job autosave and safe recovery.

### Deliverables
- Functional import workflow
- Asset list and image workspace
- PDF page selection
- Import error handling

### Exit Criteria
Users can import multiple files, navigate between them, reopen the job, and continue working without losing changes.

---

## 7. Phase 4 — Image Editing and Correction

### Tasks
Implement the editing pipeline in the following order:

1. Rotate and flip.
2. Manual crop.
3. Straighten and deskew.
4. Automatic document-edge detection.
5. Perspective correction.
6. Brightness and contrast.
7. Grayscale and sharpness.
8. Text darkening and document cleanup.
9. Undo, redo, and reset.
10. Non-destructive edit revisions.

### Processing Requirements
- Preserve original files.
- Store edit parameters independently from the source.
- Generate previews at suitable resolutions.
- Render final output at sufficient quality.
- Avoid repeated lossy JPEG re-encoding.
- Display uncertain automatic corrections for user approval.
- Allow manual adjustment when detection fails.
- Do not promise reliable text extraction or OCR unless separately implemented.

### Deliverables
- Functional editor
- Automatic correction controls
- Manual adjustment tools
- Revision history
- Preview and final-render pipeline

### Exit Criteria
Changes appear in the preview, survive reopening the job, and can be reset without damaging the original image.

---

## 8. Phase 5 — Photo Background Processing

### Tasks
- Integrate a suitable local background-removal implementation.
- Verify licenses for both runtime dependencies and model weights.
- Bundle or provide a clear first-run setup for required model files.
- Support white, blue, custom-color, and transparent backgrounds where technically supported.
- Preserve edges and image dimensions.
- Show processing progress and errors.
- Keep processing offline after all required resources are available.

### Deliverables
- Background-removal workflow
- Background replacement controls
- Transparent output support where applicable
- Local model/resource validation

### Exit Criteria
Background processing produces a real image output, works without a remote API, and reports failures honestly.

**Fallback:** If no suitable licensed model can be distributed, keep the feature modular and clearly identify the missing dependency. Do not silently substitute a fake effect.

---

## 9. Phase 6 — Page Layout Engine

### Tasks
- Implement A4, A3, Letter, and custom page dimensions.
- Support portrait and landscape orientation.
- Add configurable margins and spacing.
- Add photo-count presets, including 1, 2, 4, 6, 8, 9, and 12 images per page.
- Support custom photo dimensions in millimeters.
- Implement automatic grid arrangement.
- Implement manual placement and drag-and-drop.
- Support multiple copies of the same image.
- Support front/back photo pairing.
- Add fit, fill, crop, and rotation controls.
- Detect overlap, overflow, and invalid dimensions.
- Persist exact page-item positions.

### Technical Requirements
- Use millimeters as the canonical unit for physical layout.
- Convert to render coordinates through a single shared conversion utility.
- Keep preview geometry consistent with PDF output.
- Do not rely on screen pixels to define physical print size.
- Preserve manually positioned items unless the user requests auto-arrangement.

### Deliverables
- Page layout engine
- Photo presets
- Custom dimensions
- Manual arrangement
- Layout validation

### Exit Criteria
A saved layout reopens consistently, preserves physical dimensions, and produces no unexpected stretching or cropping.

---

## 10. Phase 7 — Print Preview and PDF Export

### Tasks
- Render complete pages before printing.
- Support multi-page navigation.
- Show page dimensions, margins, and image placement.
- Add warnings for clipping and unintended scaling.
- Export PDFs with the intended physical page dimensions.
- Export supported image formats.
- Validate output files after writing.
- Prompt before overwriting existing files.
- Track export status and failures.

### Deliverables
- Print preview
- PDF export
- Image export
- Export history
- File destination handling

### Exit Criteria
The exported PDF matches the application layout, including page dimensions, spacing, and image positions.

---

## 11. Phase 8 — Printer Integration

### Tasks
- Detect available system printers.
- Select a printer and query supported options where possible.
- Support copies, color mode, orientation, and paper settings.
- Support duplex printing when available.
- Support page ranges and collation where supported.
- Implement print submission and error reporting.
- Distinguish submitted jobs from confirmed physical completion.
- Provide retry and PDF-export recovery options.

### Critical Requirements
- Use the existing Electron and operating-system printing capabilities where suitable.
- Do not assume every printer supports every option.
- Never silently apply scaling to ID/passport photos.
- Warn when driver settings may affect physical dimensions.
- Avoid automatic resubmission after ambiguous failures because that may print duplicates.

### Deliverables
- Printer selection
- Print settings
- Print submission
- Printer error handling

### Exit Criteria
A test document can be previewed, sent to a supported printer, and recovered through export if printing fails.

---

## 12. Phase 9 — Job History and Settings

### Tasks
- Implement job history and search.
- Reopen, duplicate, archive, and delete jobs.
- Implement default paper size, margins, printer, and export settings.
- Add appearance preferences if required by the existing UI.
- Implement local storage management.
- Add safe cleanup for temporary and derived files.
- Add database backup and recovery support where appropriate.

### Exit Criteria
Users can manage previous jobs, reuse configurations, and customize defaults without unexpectedly modifying existing jobs.

---

## 13. Phase 10 — UI/UX Polish

### Tasks
- Refine spacing, typography, hierarchy, and component consistency.
- Add drag-and-drop feedback.
- Add clear processing indicators.
- Add useful empty states and inline validation.
- Add keyboard shortcuts where appropriate.
- Support undo/redo where applicable.
- Improve responsiveness for common desktop window sizes.
- Verify accessibility, keyboard navigation, and readable contrast.
- Avoid unnecessary animation that slows large jobs.

### Design Direction
Professional printing-workshop software: fast, precise, minimal, and reliable. Prioritize workspace efficiency over decorative effects.

### Exit Criteria
All major workflows are understandable without documentation, and the UI accurately reflects actual processing and printing states.

---

## 14. Phase 11 — Testing and Quality Assurance

### Unit Tests
- Image dimension conversion
- Rotation and crop calculations
- Layout placement and margins
- Physical-size conversion
- Page overflow detection
- Edit revision handling
- Database repository operations

### Integration Tests
- Import to edit to layout
- Layout to preview to PDF
- Job save and reopen
- Missing-source recovery
- Background processing
- Export failures
- Printer setting validation

### End-to-End Tests
1. Import an image and export it.
2. Import a multipage PDF and select pages.
3. Straighten and enhance a tilted document.
4. Darken text without unexpectedly changing page dimensions.
5. Remove a photo background and replace it.
6. Arrange multiple ID photos on A4.
7. Confirm actual-size preview and export.
8. Save, close, and reopen a job.
9. Simulate missing files and processing failures.
10. Verify original files remain unchanged.

### Quality Checks
- TypeScript checks
- Linting
- Unit and integration tests
- Production build
- Packaging verification
- Offline smoke tests
- Dependency-license review

### Exit Criteria
All critical tests pass. Any unresolved issues are documented rather than hidden.

---

## 15. Phase 12 — Packaging and Release

### Tasks
- Configure the existing build and packaging system.
- Package required runtime dependencies and licensed model resources.
- Verify installation and launch on supported Windows versions.
- Test application-data persistence across upgrades.
- Verify uninstall behavior and user-data retention.
- Document backup, troubleshooting, and recovery.
- Remove development-only dependencies from production artifacts where appropriate.

### Exit Criteria
The packaged application installs, launches, processes files, exports PDFs, and retains jobs without requiring a paid service or an internet connection for normal operation.

---

## 16. Suggested Module Boundaries

Adapt these boundaries to the actual repository rather than duplicating existing modules.

- `jobs`: lifecycle and persistence
- `import`: image and PDF ingestion
- `editing`: edit parameters and revisions
- `processing`: image transformations
- `background-removal`: local model integration
- `layout`: physical page geometry
- `preview`: page rendering
- `export`: PDF and image output
- `printing`: system printer integration
- `settings`: local preferences
- `recovery`: interrupted operation handling

Keep UI components, business logic, persistence, file operations, and operating-system integration separated.

---

## 17. Execution Strategy

Implement one phase at a time.

For every phase:

1. Inspect relevant existing code.
2. Define the smallest safe implementation scope.
3. Implement the real functionality.
4. Integrate it with existing features.
5. Run relevant tests and build checks.
6. Fix regressions before continuing.
7. Update documentation and implementation status.
8. Commit or create a recoverable checkpoint if version control is available.

Do not attempt to implement all features in one unverified code-generation pass.

Prioritize a stable end-to-end workflow before advanced features.

---

## 18. Priority Levels

### P0 — Core Application
- Codebase audit
- Database and persistence
- Image/PDF import
- Basic image editing
- Physical page layout
- Print preview
- PDF export
- Basic printer integration

### P1 — Essential Enhancements
- Automatic deskew and perspective correction
- Document text darkening
- Photo-count presets
- Exact ID/passport photo dimensions
- Job history and recovery
- Duplex printing where supported

### P2 — Advanced Enhancements
- Local background removal
- Background color replacement
- Advanced layout controls
- Additional export presets
- Enhanced keyboard shortcuts and workflow automation

Dependencies may change this order, but advanced features must not compromise the core print workflow.

---

## 19. Definition of Done

PrintMate is complete when:

- [ ] The existing codebase and features are preserved.
- [ ] Users can import images and PDFs.
- [ ] Automatic and manual correction work.
- [ ] Brightness, contrast, and document enhancement work.
- [ ] Background removal works locally if its licensed resources are available.
- [ ] Users can arrange photos at precise physical dimensions.
- [ ] Preview and exported output agree.
- [ ] Users can print through supported system printers.
- [ ] Jobs persist across restarts.
- [ ] Errors provide useful recovery actions.
- [ ] Original files are preserved.
- [ ] Critical tests and production build pass.
- [ ] Normal operation requires no paid API or cloud backend.
- [ ] Documentation matches the implemented code.

---

## 20. Final Instructions to the AI Coding Agent

Work directly inside the existing PrintMate codebase.

Start with Phase 0. Report the current architecture, working features, missing functionality, risks, and proposed implementation sequence before making major changes.

Then implement the plan incrementally, adapting it to the repository. Do not stop at documentation or UI mockups. Implement, integrate, and test actual functionality.

Do not remove working features, overwrite user data, reset databases, invent successful test results, or claim unimplemented features are complete.

At the end of each phase, report:
- Files created or changed
- Features implemented
- Tests executed and their actual results
- Known issues
- Next phase

Maintain the ₹0 mandatory recurring-cost requirement and local-first processing throughout development.
