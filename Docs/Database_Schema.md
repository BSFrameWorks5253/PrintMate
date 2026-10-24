
# PrintMate — Database Schema Specification

Version: 1.0
Database: SQLite
Architecture: Local-first, offline-capable
Primary Goal: Persist print jobs, editing parameters, page layouts, and application settings.

---

## 1. Database Principles

1. Store all application metadata in a local SQLite database.
2. Keep original user files unchanged.
3. Store edit parameters separately from original images.
4. Store paths to files instead of placing large image binaries in SQLite.
5. Use foreign keys and transactions to maintain data integrity.
6. Use schema migrations for all database changes.
7. Use parameterized queries exclusively.
8. Support job recovery after application crashes.
9. Do not require accounts, cloud synchronization, or external APIs.
10. Never delete source files when deleting a job unless the user explicitly requests it.

### Recommended Storage Structure

Windows:
- Database: `%APPDATA%/PrintMate/data/printmate.db`
- Application files: `%APPDATA%/PrintMate/`
- Job assets: `%APPDATA%/PrintMate/jobs/`
- Temporary files: `%TEMP%/PrintMate/`

Use Electron's application data directory API rather than hardcoding paths. Allow users to configure the job-assets location.

Example:

PrintMate/
├── data/
│   └── printmate.db
├── jobs/
│   └── {job_id}/
│       ├── previews/
│       ├── processed/
│       └── exports/
└── temp/

Original files may remain in their existing locations. Never assume they have been copied into the application's job folder.

---

## 2. Entity Relationships

Print Job
├── Job Assets
│   ├── Original file reference
│   ├── Processing state
│   └── Edit configuration
├── Pages
│   ├── Page settings
│   └── Page Items
│       └── Asset references and placement
├── Print Settings
├── Export Records
└── Job Events

Application Settings
├── Default printer
├── Default paper configuration
├── Editing preferences
└── Export preferences

Printer Profiles
└── Saved printer preferences

---

## 3. Table: print_jobs

Stores each user-created print job.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | UUID |
| name | TEXT | NOT NULL | Job name |
| status | TEXT | NOT NULL | Job lifecycle state |
| created_at | TEXT | NOT NULL | ISO-8601 timestamp |
| updated_at | TEXT | NOT NULL | Last modification |
| last_opened_at | TEXT | NULL | Last opened timestamp |
| notes | TEXT | NULL | Optional user notes |
| schema_version | INTEGER | NOT NULL DEFAULT 1 | Job data version |

Allowed status values:
- draft
- importing
- processing
- ready
- printing
- completed
- failed
- archived

Rules:
- Create a job when the user starts a new print workflow.
- Update `updated_at` after persistent changes.
- Do not mark a job completed merely because a print request was submitted.
- A job may be reopened and edited regardless of its previous status, except while an operation is actively locking its resources.

---

## 4. Table: job_assets

Stores references to images, PDFs, and other supported source files.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | UUID |
| job_id | TEXT | NOT NULL, FK | Parent job |
| original_path | TEXT | NOT NULL | Original file location |
| original_name | TEXT | NOT NULL | Original filename |
| mime_type | TEXT | NULL | Detected MIME type |
| file_extension | TEXT | NULL | Extension |
| file_size_bytes | INTEGER | NULL | Original size |
| source_width | INTEGER | NULL | Original pixel width |
| source_height | INTEGER | NULL | Original pixel height |
| page_count | INTEGER | NOT NULL DEFAULT 1 | PDF page count or image count |
| asset_type | TEXT | NOT NULL | image or pdf_page |
| import_status | TEXT | NOT NULL DEFAULT 'ready' | Import state |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | Workspace order |
| created_at | TEXT | NOT NULL | Import timestamp |

Indexes:
- `job_id`
- `(job_id, sort_order)`

Import states:
- queued
- importing
- ready
- missing
- failed

Rules:
- Keep `original_path` separate from processed output paths.
- Check whether the source file still exists before processing it.
- If the original is moved or deleted, mark it missing and offer relinking.
- For multipage PDFs, use stable page-level identifiers or a dedicated PDF page table if individual pages need separate edits.
- Do not assume that a file extension guarantees its actual format.

---

## 5. Table: asset_edits

Stores non-destructive image-editing parameters.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | UUID |
| asset_id | TEXT | NOT NULL, FK | Related asset |
| revision | INTEGER | NOT NULL | Edit revision number |
| rotation_degrees | REAL | NOT NULL DEFAULT 0 | Rotation |
| straighten_degrees | REAL | NOT NULL DEFAULT 0 | Deskew correction |
| crop_x | REAL | NULL | Normalized crop origin X |
| crop_y | REAL | NULL | Normalized crop origin Y |
| crop_width | REAL | NULL | Normalized crop width |
| crop_height | REAL | NULL | Normalized crop height |
| perspective_data_json | TEXT | NULL | Perspective correction points |
| brightness | REAL | NOT NULL DEFAULT 0 | Brightness adjustment |
| contrast | REAL | NOT NULL DEFAULT 1 | Contrast multiplier |
| saturation | REAL | NOT NULL DEFAULT 1 | Saturation multiplier |
| sharpness | REAL | NOT NULL DEFAULT 0 | Sharpness amount |
| grayscale | INTEGER | NOT NULL DEFAULT 0 | Boolean |
| text_darkening | REAL | NOT NULL DEFAULT 0 | Document enhancement intensity |
| background_mode | TEXT | NOT NULL DEFAULT 'original' | Background treatment |
| background_color | TEXT | NULL | Hex color or supported color value |
| background_asset_path | TEXT | NULL | Optional custom background |
| processing_options_json | TEXT | NULL | Additional versioned options |
| is_current | INTEGER | NOT NULL DEFAULT 1 | Current revision flag |
| created_at | TEXT | NOT NULL | Revision timestamp |

Constraints:
- UNIQUE(asset_id, revision)
- Use foreign keys with appropriate deletion behavior.
- Keep crop values normalized between 0 and 1.
- Validate all numeric values in the application layer.

Background modes:
- original
- remove
- white
- blue
- custom
- transparent

Rules:
- Never overwrite the original asset.
- Create a new revision for committed edits.
- Undo/redo should restore previous revisions or use a dedicated edit-history mechanism.
- Use a versioned JSON structure for advanced processing options.
- Keep image-processing implementations independent of database access.

---

## 6. Table: processed_assets

Stores generated preview and processing output references.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | UUID |
| asset_id | TEXT | NOT NULL, FK | Source asset |
| edit_revision | INTEGER | NOT NULL | Revision used |
| output_path | TEXT | NOT NULL | Generated file path |
| output_format | TEXT | NOT NULL | JPEG, PNG, etc. |
| output_width | INTEGER | NULL | Pixel width |
| output_height | INTEGER | NULL | Pixel height |
| checksum | TEXT | NULL | Optional integrity hash |
| processing_status | TEXT | NOT NULL | Generation state |
| created_at | TEXT | NOT NULL | Generation timestamp |

Processing states:
- queued
- processing
- ready
- failed
- stale

Rules:
- Processed files are disposable derived assets.
- A change to edit parameters invalidates outputs generated from older revisions.
- Rebuild missing previews when necessary.
- Clean up unused generated files safely.
- Never delete files outside PrintMate-managed directories during cleanup.

---

## 7. Table: job_pages

Stores printable pages within a job.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | UUID |
| job_id | TEXT | NOT NULL, FK | Parent job |
| page_number | INTEGER | NOT NULL | Page order |
| paper_size | TEXT | NOT NULL | A4, A3, Letter, custom |
| orientation | TEXT | NOT NULL | portrait or landscape |
| width_mm | REAL | NOT NULL | Physical page width |
| height_mm | REAL | NOT NULL | Physical page height |
| margin_top_mm | REAL | NOT NULL DEFAULT 5 | Top margin |
| margin_right_mm | REAL | NOT NULL DEFAULT 5 | Right margin |
| margin_bottom_mm | REAL | NOT NULL DEFAULT 5 | Bottom margin |
| margin_left_mm | REAL | NOT NULL DEFAULT 5 | Left margin |
| background_color | TEXT | NOT NULL DEFAULT '#FFFFFF' | Page background |
| layout_mode | TEXT | NOT NULL DEFAULT 'grid' | Grid or manual |
| spacing_x_mm | REAL | NOT NULL DEFAULT 2 | Horizontal spacing |
| spacing_y_mm | REAL | NOT NULL DEFAULT 2 | Vertical spacing |
| created_at | TEXT | NOT NULL | Creation timestamp |
| updated_at | TEXT | NOT NULL | Modification timestamp |

Constraints:
- UNIQUE(job_id, page_number)
- Positive page dimensions
- Non-negative margins and spacing
- Printable content must fit within the available page area or trigger a warning.

Store physical dimensions in millimeters. Convert to pixels or printer units only in rendering/printing code.

---

## 8. Table: page_items

Stores each image's position and size on a page.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | UUID |
| page_id | TEXT | NOT NULL, FK | Parent page |
| asset_id | TEXT | NOT NULL, FK | Source image |
| position_x_mm | REAL | NOT NULL | Left coordinate |
| position_y_mm | REAL | NOT NULL | Top coordinate |
| width_mm | REAL | NOT NULL | Physical width |
| height_mm | REAL | NOT NULL | Physical height |
| rotation_degrees | REAL | NOT NULL DEFAULT 0 | Item rotation |
| fit_mode | TEXT | NOT NULL DEFAULT 'contain' | contain or cover |
| z_index | INTEGER | NOT NULL DEFAULT 0 | Stacking order |
| copy_index | INTEGER | NOT NULL DEFAULT 1 | Duplicate instance number |
| created_at | TEXT | NOT NULL | Creation timestamp |

Indexes:
- `page_id`
- `asset_id`

Rules:
- Coordinates use the page's top-left corner as the origin.
- All positions and sizes use millimeters.
- `contain` preserves the full image within the frame.
- `cover` fills the frame and may crop the image; preview the crop before printing.
- Support multiple page items referencing the same source asset.
- Validate item bounds before printing.
- Do not store only a grid count; store the final positions and dimensions for reliable reproduction.

---

## 9. Table: print_configs

Stores print settings for a job.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | UUID |
| job_id | TEXT | NOT NULL, FK | Related job |
| printer_name | TEXT | NULL | Installed printer name |
| copies | INTEGER | NOT NULL DEFAULT 1 | Number of copies |
| color_mode | TEXT | NOT NULL DEFAULT 'color' | color or grayscale |
| duplex_mode | TEXT | NOT NULL DEFAULT 'simplex' | Simplex or duplex |
| paper_source | TEXT | NULL | Tray/source if supported |
| scaling_mode | TEXT | NOT NULL DEFAULT 'actual_size' | Output scaling |
| collate | INTEGER | NOT NULL DEFAULT 1 | Boolean |
| page_range | TEXT | NULL | Requested page range |
| driver_options_json | TEXT | NULL | Supported driver-specific options |
| created_at | TEXT | NOT NULL | Creation timestamp |
| updated_at | TEXT | NOT NULL | Modification timestamp |

Duplex modes:
- simplex
- long_edge
- short_edge

Scaling modes:
- actual_size
- fit_to_page
- shrink_to_fit

Rules:
- Use actual-size printing by default for ID/passport photos.
- Clearly indicate when a printer driver may scale content.
- Validate supported options against the installed printer.
- Do not assume every printer supports duplex, color, or every paper size.

---

## 10. Table: export_records

Tracks exported PDF and image files.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | UUID |
| job_id | TEXT | NOT NULL, FK | Related job |
| export_type | TEXT | NOT NULL | PDF, JPEG, PNG |
| output_path | TEXT | NOT NULL | Destination path |
| page_count | INTEGER | NULL | Exported pages |
| output_size_bytes | INTEGER | NULL | Resulting file size |
| export_status | TEXT | NOT NULL | Export state |
| error_message | TEXT | NULL | Failure details |
| created_at | TEXT | NOT NULL | Export timestamp |

Export states:
- queued
- processing
- completed
- failed
- cancelled

Rules:
- Record successful exports and relevant failures.
- Never claim success until the output file has been written and validated.
- Ask before overwriting an existing destination file.

---

## 11. Table: job_events

Stores useful job lifecycle events for recovery and troubleshooting.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | UUID |
| job_id | TEXT | NOT NULL, FK | Related job |
| event_type | TEXT | NOT NULL | Event identifier |
| message | TEXT | NULL | Human-readable description |
| details_json | TEXT | NULL | Structured diagnostic information |
| created_at | TEXT | NOT NULL | Event timestamp |

Examples:
- job_created
- import_started
- import_completed
- processing_failed
- layout_updated
- export_completed
- print_submitted
- job_recovered

Do not store full image contents, sensitive document text, or unnecessary personal data in event records.

---

## 12. Table: printer_profiles

Stores reusable printer preferences.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | UUID |
| profile_name | TEXT | NOT NULL | User-defined name |
| printer_name | TEXT | NULL | Installed printer |
| paper_size | TEXT | NOT NULL DEFAULT 'A4' | Default paper |
| orientation | TEXT | NOT NULL DEFAULT 'portrait' | Orientation |
| color_mode | TEXT | NOT NULL DEFAULT 'color' | Color setting |
| duplex_mode | TEXT | NOT NULL DEFAULT 'simplex' | Duplex setting |
| settings_json | TEXT | NULL | Additional options |
| created_at | TEXT | NOT NULL | Creation timestamp |
| updated_at | TEXT | NOT NULL | Modification timestamp |

Do not assume a printer profile remains valid after a printer is removed or its driver changes.

---

## 13. Table: app_settings

Stores application preferences as key/value entries.

| Column | Type | Constraints | Description |
|---|---|---|---|
| key | TEXT | PRIMARY KEY | Setting identifier |
| value_json | TEXT | NOT NULL | Serialized setting |
| updated_at | TEXT | NOT NULL | Last modification |

Example keys:
- theme
- default_paper_size
- default_orientation
- default_margins
- default_printer
- default_photo_dimensions
- export_directory
- jobs_directory
- autosave_enabled
- preview_quality
- processing_preferences

Validate each setting against its expected schema when reading and writing.

---

## 14. Table: app_operations

Tracks long-running operations so interrupted work can be recovered.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | UUID |
| job_id | TEXT | NULL, FK | Related job |
| operation_type | TEXT | NOT NULL | Import, processing, export |
| status | TEXT | NOT NULL | Operation state |
| progress | REAL | NOT NULL DEFAULT 0 | Progress from 0 to 1 |
| current_step | TEXT | NULL | Current task |
| error_message | TEXT | NULL | Failure details |
| created_at | TEXT | NOT NULL | Start timestamp |
| updated_at | TEXT | NOT NULL | Last update |

On application launch:
1. Find operations left in queued or processing states.
2. Determine whether they can be safely resumed.
3. Mark unrecoverable operations interrupted.
4. Preserve temporary data until cleanup is safe.
5. Show the user the appropriate recovery action.

Never blindly resume a print submission because the operating system may already have accepted it.

---

## 15. Core SQLite Initialization

Use a migration system rather than repeatedly creating tables at application startup.

Example baseline:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS print_jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN (
            'draft', 'importing', 'processing', 'ready',
            'printing', 'completed', 'failed', 'archived'
        )),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_opened_at TEXT,
    notes TEXT,
    schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_updated
ON print_jobs(updated_at DESC);

CREATE TABLE IF NOT EXISTS job_assets (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    original_path TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT,
    file_extension TEXT,
    file_size_bytes INTEGER,
    source_width INTEGER,
    source_height INTEGER,
    page_count INTEGER NOT NULL DEFAULT 1,
    asset_type TEXT NOT NULL
        CHECK (asset_type IN ('image', 'pdf_page')),
    import_status TEXT NOT NULL DEFAULT 'ready'
        CHECK (import_status IN (
            'queued', 'importing', 'ready', 'missing', 'failed'
        )),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (job_id)
        REFERENCES print_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_job_assets_job_order
ON job_assets(job_id, sort_order);
```

This is only the initial migration example. Implement every remaining table and constraint in versioned migration files.

---

## 16. Migration Strategy

Store migration scripts in a dedicated directory:

electron/database/migrations/
├── 001_initial_schema.sql
├── 002_asset_edits.sql
├── 003_page_layout.sql
├── 004_print_and_export.sql
└── 005_recovery_and_indexes.sql

Maintain a schema migration history table:

- version
- migration_name
- applied_at

Rules:
1. Apply migrations in ascending version order.
2. Run each migration transactionally when supported.
3. Never delete an existing database to resolve a migration failure.
4. Back up the database before destructive schema changes.
5. Report migration failures clearly.
6. Test upgrades using a copy of an existing database.

---

## 17. Data Integrity and Performance

- Enable foreign-key enforcement on every database connection.
- Use transactions for related job, asset, and layout updates.
- Add indexes for frequently queried foreign keys and sort fields.
- Paginate or limit large job-history queries.
- Do not store generated thumbnails as BLOBs by default.
- Use SQLite WAL mode where appropriate.
- Handle busy/locked database errors.
- Keep long-running image processing outside database transactions.
- Use atomic file writes for exports and important metadata files.
- Perform scheduled cleanup only on confirmed application-owned temporary files.

---

## 18. Electron Security

- SQLite access belongs in the Electron main process or a trusted database service.
- The renderer must not access the database directly.
- Expose narrow, validated IPC operations through preload.
- Never expose arbitrary SQL execution to the renderer.
- Validate file paths and ensure file operations are permitted.
- Restrict destructive operations to application-managed data unless the user explicitly authorizes otherwise.
- Use context isolation and disable Node integration in the renderer.
- Never execute SQL or file paths constructed from untrusted input without validation.

---

## 19. Implementation Checklist

- [ ] Create database initialization service.
- [ ] Implement versioned migrations.
- [ ] Create repositories for each table group.
- [ ] Implement print job CRUD operations.
- [ ] Implement asset import and missing-file detection.
- [ ] Implement non-destructive edit revisions.
- [ ] Implement processed preview tracking.
- [ ] Implement physical page and page-item persistence.
- [ ] Implement printer profiles and job print settings.
- [ ] Implement export history.
- [ ] Implement operation recovery.
- [ ] Implement safe job deletion and asset cleanup.
- [ ] Implement validated Electron IPC.
- [ ] Test migration, crash recovery, and foreign-key integrity.
- [ ] Test jobs containing large numbers of images and pages.
- [ ] Verify that deleting a job never deletes original user files.

## 20. Coding Agent Instructions

Before implementing this schema:

1. Inspect the existing codebase and database, if one already exists.
2. Reuse existing libraries, conventions, and working features.
3. Do not replace or reset an existing database.
4. Map existing models to this schema and document any differences.
5. Adapt the schema to the current application rather than blindly creating duplicate tables.
6. Implement migrations and repositories before connecting UI features.
7. Use real persistence; do not use localStorage as a replacement for the primary database.
8. Keep processing and printing logic separate from database code.
9. Test each migration and core database workflow.
10. Keep all required database functionality local and free of paid services.
11. Update this document if the actual implementation differs.

The schema is a proposed baseline. Final implementation details must match the actual codebase, supported image/PDF workflows, and operating-system constraints.
