# Plan: Web UI Refinement, Dedicated Settings, Schedule Drawer, and ATS Document Standards

## 1. Goal & Scope
Refine the Job Apply Automator Web Console and establish binding ATS document generation standards:
1. **Decision Criteria Table View**: Transition View 2 (`#viewCriteria`) from stacked card layout into a full-width structured data table matching the rest of the application. Add an interactive `On/Off` rule toggle (`is_enabled`) and soft-delete capability (`is_deleted`).
2. **Dedicated Settings Menu**: Extract the Antigravity CLI Agent (AGY) configuration card out of Daily Schedule and establish a new top-level sidebar navigation item ("Settings", `#viewSettings`).
3. **Daily Schedule Slide-Over Drawer**: Reconfigure View 5 (`#viewSchedule`) so the Recorded Schedule History (Batch Processing Ledger) table takes 100% full width, while the Schedule Configuration form moves into a toggleable right slide-over drawer triggered by a header button ("Configure Schedule").
4. **Remove Sidebar Footer Widget**: Eliminate the bottom sidebar status container containing "Engine Online" and `#sidebarAgentPill` as requested.
5. **ATS Document Standards Alignment & Governance**: Formalize universal ATS parsing requirements, baseline constraints, component hierarchy, Google XYZ formula, and typography standards (`Open Sans`) into `.agent/rules/ats_document_standards.md` and synchronize `web/src/generator/resumeBuilder.ts`.

---

## 2. Technical Design & Architecture

### 2.1 Database Schema Enhancements (`data/amiya.db`)
Modify table `personalization_rules` to support active toggling and soft-deletion:
- `is_enabled INTEGER NOT NULL DEFAULT 1`: Controls whether the rule is active and exported to `data/personalization.md` for CLI/crawler ingestion.
- `is_deleted INTEGER NOT NULL DEFAULT 0`: Soft-delete flag.
- `deleted_at TEXT`: Timestamp when soft-deleted.

Migration in `web/src/storage/db.ts`:
```sql
ALTER TABLE personalization_rules ADD COLUMN is_enabled INTEGER DEFAULT 1;
ALTER TABLE personalization_rules ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE personalization_rules ADD COLUMN deleted_at TEXT;
```

Update `getPersonalizationRules()` to:
1. Default query filters `WHERE is_deleted = 0`.
2. `syncPersonalizationToFile()` only exports rules where `is_enabled = 1 AND is_deleted = 0` to `data/personalization.md`.

### 2.2 API Endpoints (`web/src/server.ts`)
- `GET /api/personalization`: Returns active, non-deleted rules (with query param `?include_deleted=1` for audit/recovery if needed).
- `POST /api/personalization/:id/toggle`: Toggles `is_enabled` (1 <-> 0), updates timestamp, re-syncs markdown.
- `DELETE /api/personalization/:id`: Performs soft-delete (`UPDATE personalization_rules SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?`), re-syncs markdown.
- `POST /api/personalization/:id/restore`: Restores soft-deleted rule.

### 2.3 Web Console UI (`web/public/index.html`, `style.css`, `app.js`)
1. **Sidebar Navigation**:
   - Remove `.sidebar-footer` element (Engine Online dot and `#sidebarAgentPill`).
   - Add nav button:
     ```html
     <button class="nav-item" data-view="settings" onclick="switchView('settings')">
       <!-- SVG Settings Gear -->
       <span class="nav-label">Settings</span>
     </button>
     ```
2. **View 2 (Personalization Rules Table)**:
   - Convert from `.criteria-list-container` to full `.table-wrapper` with `table.triage-table`:
     - Columns: `Rule Key / Category`, `Criteria Logic (Value)`, `Engine Intent / Description`, `Status (On/Off Toggle)`, `Last Updated`, `Actions (Edit / Soft-Delete)`.
3. **View 5 (Daily Schedule)**:
   - Full-width batch runs table (`#batchRunsTbody`).
   - Top action button: `Configure Schedule`.
   - Right-side drawer (`#scheduleDrawer`) with overlay or slide-over animation holding the crawler schedule form and "Run Batch Now" button.
4. **View 6 (Settings)**:
   - New section `<section id="viewSettings" class="view-panel">`.
   - Contains Antigravity CLI Agent (AGY) configuration card: model selector, execution timeout, toggle, and connection diagnostic tester.

### 2.4 ATS Qualification Baseline & Rule (`.agent/rules/ats_document_standards.md`)
- **Typography**: Universal `Open Sans` font family (`Open Sans, -apple-system, BlinkMacSystemFont, sans-serif`). High-contrast `#000000` text on `#ffffff` canvas. Body text 9.5pt - 10.5pt, Section Headings 11pt - 12pt bold, Header Title 16pt - 20pt bold.
- **Layout Architecture**: Strict single-column linear hierarchy. Zero tables for layout. Zero floating text boxes. Zero multi-column sidebars. Standard margins: 12.7mm (0.5 in) to 15mm.
- **Header Elements**: Full Name, Location, Phone, Email, LinkedIn, GitHub, Portfolio. Zero photos, zero age/gender/marital status data.
- **Categorized Technical Skills**: Explicit groupings (`Languages`, `Backend & Frameworks`, `Databases & Storage`, `Cloud & DevOps`, `Testing & Architecture`) using industry-standard naming conventions.
- **Experience Bullets**: Google XYZ Formula (`Accomplished [X], measured by [Y], by doing [Z]`) with strong action verbs. Zero vague responsibilities ("Responsible for...").
- **ATS Cover Letter**: 3–4 paragraphs, maximum 1 page (250–350 words). Technical alignment, quantified proof of impact, company/mission fit, professional close. Zero AI buzzwords or sycophancy.
- **Synchronization**: Update `web/src/generator/resumeBuilder.ts` to use `Open Sans` and comply with these rules.

---

## 3. Task Breakdown with Status Checkboxes

- [x] **Task 1: ATS Qualification Standards Formulation**
  - [x] Detail ATS parsing mechanics, baseline criteria, and typography standard (`Open Sans`).
  - [x] Formulate `.agent/rules/ats_document_standards.md`.
  - [x] Update `web/src/generator/resumeBuilder.ts` styling and HTML template.
  - [x] Create comprehensive `data/candidate_profile_master.md` and update `data/candidateProfile.json`.

- [x] **Task 2: Database Schema & Backend API Extensions**
  - [x] Add `is_enabled`, `is_deleted`, and `deleted_at` columns to `personalization_rules` in `web/src/storage/db.ts`.
  - [x] Update `getPersonalizationRules` and `syncPersonalizationToFile` to filter out deleted rules and only export enabled rules.
  - [x] Add toggle and soft-delete endpoints in `web/src/server.ts`.
  - [x] Seed candidate profile parameters into `personalization_rules` in `amiya.db`.

- [x] **Task 3: Sidebar Cleanup & Settings Menu Creation**
  - [x] Remove `.sidebar-footer` (Engine Online / AGY status pill) from `web/public/index.html`.
  - [x] Add "Settings" navigation button to sidebar.
  - [x] Create View 6 (`#viewSettings`) and transfer AGY configuration card there.
  - [x] Update `switchView` routing in `web/public/app.js`.

- [x] **Task 4: Decision Criteria Table View Transition**
  - [x] Replace criteria card list in `web/public/index.html` with structured table (`#criteriaTable`).
  - [x] Implement toggle switch for active status (`is_enabled`) and soft-delete in `web/public/app.js`.
  - [x] Add styling for switch toggles and criteria table in `web/public/style.css`.
  - [x] Add category filter tabs and search input.

- [x] **Task 5: Daily Schedule Right Drawer Implementation**
  - [x] Refactor `#viewSchedule` to give 100% full width to Recorded Schedule History table.
  - [x] Build slide-over right sidebar/drawer (`#scheduleDrawer`) for schedule configuration.
  - [x] Add drawer toggle button to topbar/panel header and implement open/close handlers in `app.js`.

- [x] **Task 6: Verification & Documentation Sync**
  - [x] Verify static build and check web server endpoints.
  - [x] Verify UI in browser: table rendering, toggle functionality, drawer slide-over, settings navigation via Puppeteer screenshots.
  - [x] Update `README.md` and regenerate knowledge graph with `graphify extract .`.

---

## 4. Dependencies & Inter-Task Blockers
- **Pre-Execution Gate**: No code edits to `web/` or `.agent/rules/` will be made until explicit user approval of this plan and the ATS qualification baseline.
- **Task 2 Blocks Task 4**: Database schema migration and API endpoints must be ready before testing criteria table toggle and soft-delete.
- **Task 3 & 5 UI Dependencies**: Shared styling in `web/public/style.css` must support both the drawer slide-over and the new Settings panel.

---

## 5. Verification Protocol
1. **Type & Static Compilation**:
   - `cd web && bun run build` (or check syntax via `bun -e "import('./src/server.ts')"`).
2. **Database Verification**:
   - `sqlite3 data/amiya.db "PRAGMA table_info(personalization_rules);"` to confirm `is_enabled` and `is_deleted`.
3. **API Endpoint Verification**:
   - `curl -s http://localhost:3100/api/personalization` to confirm rules load with status.
   - `curl -s -X POST http://localhost:3100/api/personalization/1/toggle` to test active toggle.
4. **Browser Behavioral Test**:
   - Verify sidebar has no bottom widget.
   - Verify Settings view switches cleanly and AGY configuration saves and tests connection.
   - Verify Criteria view renders as a table with toggle switches and soft-delete.
   - Verify Schedule view table is 100% full width and drawer toggles open on button click.
