# Plan: Decision Criteria Layout Cleanup and Direct Inline Column Editing

## 1. Goal & Scope
Address two specific UX and functional issues in the Personalization & Decision Criteria panel:
1. **Layout & Spacing Cleanup ("Hanging" Void)**:
   - Eliminate the large blank void between the topbar and the Decision Criteria table caused by the standalone `Synced: data/personalization.md` badge.
   - Build a clean, balanced toolbar directly above the table containing:
     - Left: Search input (`#criteriaSearchInput`) with instant filter + `Synced: data/personalization.md` status badge.
     - Right: `+ Add Parameter` primary action button.
   - Clean up topbar controls so the header remains unified without duplicate or hidden search inputs.
2. **Direct Inline Column Editing (Spreadsheet Grid)**:
   - Make all criteria columns directly editable in-place on the table without requiring an Edit modal:
     - **Category**: Directly editable input with datalist/autocomplete of common categories.
     - **Parameter / Key**: Directly editable code input.
     - **Criteria Value / Logic**: Directly editable auto-resizing text area / input for values.
     - **Operational Guidance & Lengthy Context**: Directly editable text area for operational instructions.
     - **Status**: Retain direct on-row active/inactive toggle switch.
     - **Actions**: Remove the `[ Edit ]` button; retain only the `[ Delete ]` button.
   - Implement immediate auto-save on change/blur via `POST /api/personalization/:id` with real-time sync to `data/personalization.md`.

---

## 2. Technical Design

### A. Backend Storage & API Updates (`web/src/storage/db.ts` & `web/src/server.ts`)
- **`updatePersonalizationRule` in `web/src/storage/db.ts`**:
  - Extend to accept partial or full updates of any field: `{ category?: string, key?: string, value?: string, description?: string }`.
  - Automatically invoke `syncPersonalizationToFile()` to synchronize markdown and JSON snapshots.
- **Route Handler in `web/src/server.ts`**:
  - Update `POST /api/personalization/:id` (and accept `PATCH` / `PUT`) to extract `category`, `key`, `value`, `description` from the request body and update the database accordingly.

### B. UI Structure & Spacing Cleanup (`web/public/index.html` & `web/public/style.css`)
- In `web/public/index.html`:
  - Replace the single right-aligned `Synced: data/personalization.md` div with a unified `.criteria-toolbar`:
    - `.criteria-toolbar-left`: Search bar (`criteriaSearchInput`) and synced file badge.
    - `.criteria-toolbar-right`: `+ Add Parameter` button.
  - Remove `criteriaActionControls` from the global topbar to avoid redundant controls and layout jumping.
- In `web/public/style.css`:
  - Style `.criteria-toolbar` with `display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 12px;`.
  - Add inline cell editing styles (`.inline-cell-input`, `.inline-cell-textarea`) that blend seamlessly into the table row styling (dark background, subtle borders, focus glow, auto-height).

### C. Frontend Table Rendering & Inline Auto-Save (`web/public/app.js`)
- In `renderCriteriaTable()`:
  - Render Category as an inline input (`.inline-cell-category`).
  - Render Parameter / Key as an inline code input (`.inline-cell-key`).
  - Render Criteria Value / Logic as an inline auto-resizing textarea (`.inline-cell-value`).
  - Render Guidance & Context as an inline auto-resizing textarea (`.inline-cell-desc`).
  - Render Actions with ONLY the `Delete` button (remove `Edit` button).
- In auto-save handler `saveCriteriaCell(id, field, value)`:
  - Debounce or trigger on `change` / `blur`.
  - Send `{ [field]: value }` to `POST /api/personalization/${id}`.
  - Update local `criteriaData` item in memory.
  - Provide a brief visual indicator (e.g., subtle green outline or check) confirming successful persistence.

---

## 3. Task Breakdown

- [x] **Task 1: Backend Storage & API Support for Multi-Field Inline Updates**
  - [x] Update `updatePersonalizationRule` in `web/src/storage/db.ts` to support `category`, `key`, `value`, and `description`.
  - [x] Update `POST /api/personalization/:id` in `web/src/server.ts` to process all four fields.

- [x] **Task 2: Spacing & Toolbar Layout Restructuring**
  - [x] Replace the floating badge in `web/public/index.html` with a clean `.criteria-toolbar` above the table.
  - [x] Move the search input and `+ Add Parameter` button into `.criteria-toolbar`.
  - [x] Remove `criteriaActionControls` from `.app-topbar` and update `switchView('criteria')` in `web/public/app.js`.
  - [x] Add `.criteria-toolbar` styling in `web/public/style.css` to eliminate the dead space gap.

- [x] **Task 3: Direct Inline Editable Grid Implementation**
  - [x] Style `.inline-cell-input` and `.inline-cell-textarea` in `web/public/style.css`.
  - [x] Update `renderCriteriaTable()` in `web/public/app.js` to render editable inputs for Category, Key, Value, and Guidance.
  - [x] Remove the `[ Edit ]` button from the Actions column; keep only `[ Delete ]`.
  - [x] Implement `saveCriteriaCell(ruleId, field, value)` in `web/public/app.js`.

- [x] **Task 4: Verification & Evidence Capture**
  - [x] Run Puppeteer script to capture:
    - `/tmp/criteria_inline_toolbar.png`: Criteria view showing compact toolbar (search + synced badge + add button) with zero dead space.
    - `/tmp/criteria_inline_editing.png`: Decision Criteria table displaying inline inputs and Actions column containing only Delete.
  - [x] Test modifying Category, Key, Value, and Guidance directly inline and verify persistence in SQLite and `data/personalization.md`.
  - [x] Run `cargo check --manifest-path cli/Cargo.toml` and cross-verification audit.

---

## 4. Verification Protocol
- **Commands**:
  - `bun run scratch/run_cross_verification_audit.ts`: Confirm 43/43 audit tests pass.
  - `cargo check --manifest-path cli/Cargo.toml`: Confirm CLI builds with 0 errors.
- **Visual Evidence**:
  - `/tmp/criteria_inline_toolbar.png`: Confirms elimination of dead space and balanced toolbar.
  - `/tmp/criteria_inline_editing.png`: Confirms inline editable inputs across all columns and removal of `Edit` button.
