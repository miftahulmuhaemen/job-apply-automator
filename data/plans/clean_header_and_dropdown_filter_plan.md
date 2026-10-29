# Plan: Clean Topbar Standard Across All Pages and In-Page Dropdown Filter

## 1. Goal & Scope
Implement the user's explicit design and positioning directives across the entire web application:
1. **Clean Topbar Standard (Universal, Zero Exceptions)**:
   - Header (`.app-topbar`) must be completely clean on every single page, containing exclusively the page title (`#topbarTitle`) and subtitle (`#topbarSubtitle`).
   - Remove `.topbar-controls` and all action/filter buttons from `.app-topbar` across all views (`jobs`, `criteria`, `websites`, `companies`, `schedule`, `settings`).
2. **Compact Dropdown Filter for Jobs**:
   - Replace the horizontal tab button cluster (`Review`, `Pending Jobs`, `Submitted`, `Filtered`, `All`) with a compact Shadcn `<select>` dropdown (`#jobsTabSelect`) showing dynamic record counts: `Review (2)`, `Pending Jobs (1)`, `Submitted (0)`, `Filtered (0)`, `All (3)`.
3. **In-Page Toolbars (Matching Decision Criteria Reference Layout)**:
   - Position search, filter dropdown, column toggle, and batch action toolbar inside `#viewJobs` above the table wrapper (`.jobs-toolbar`), matching the exact layout of `.criteria-toolbar` in `viewCriteria`.
   - Relocate page-specific actions (`+ Add Website` in Websites view, `Configure Schedule` in Schedule view) to their respective in-page toolbars/headers.
4. **Zero Layout Shift for Batch Actions**:
   - Seamlessly toggle standard controls and batch action controls within `.jobs-toolbar`, maintaining a fixed height so `#jobsTable` never shifts or pushes down upon row selection.
5. **Strict Shadcn Monochrome Theme**:
   - Strictly neutral zinc scale (`#09090b` to `#ffffff`) for all select inputs, toolbars, buttons, and badges. Zero saturated colors.

---

## 2. Technical Design

### A. Universal Clean Header (`web/public/index.html` & `web/public/style.css`)
- Remove `.topbar-controls` container entirely from `.app-topbar`.
- `.app-topbar` structure:
  ```html
  <header class="app-topbar">
    <div class="topbar-left">
      <h1 id="topbarTitle" class="topbar-title">Jobs</h1>
      <div class="topbar-meta">
        <span id="topbarSubtitle">Active job listings and workflow lifecycle</span>
      </div>
    </div>
  </header>
  ```
- Remove topbar control visibility manipulation from `switchView()` in `web/public/app.js`.

### B. In-Page Toolbars (`web/public/index.html` & `web/public/style.css`)
1. **Jobs Page (`#viewJobs`)**:
   Add `.jobs-toolbar` at the top of `#viewJobs` before `.table-wrapper`:
   ```html
   <div class="jobs-toolbar" id="jobsToolbar">
     <!-- Standard Controls -->
     <div class="jobs-toolbar-left" id="jobsToolbarControls">
       <input type="text" id="searchInput" class="search-input" placeholder="Search company, tech, role, location...">
       <select id="jobsTabSelect" class="filter-select" onchange="switchJobsTab(this.value)">
         <option value="review" id="optReview">Review (0)</option>
         <option value="pending" id="optPending">Pending Jobs (0)</option>
         <option value="submitted" id="optSubmitted">Submitted (0)</option>
         <option value="dropped" id="optDropped">Filtered (0)</option>
         <option value="all" id="optAll">All (0)</option>
       </select>
     </div>
     <div class="jobs-toolbar-right" id="jobsToolbarActions">
       <button class="btn-secondary" onclick="toggleColumnMenu(event)">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
           <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"></path>
         </svg>
         Columns
       </button>
     </div>

     <!-- Embedded Batch Action Bar (Zero Layout Shift) -->
     <div id="batchActionBar" class="batch-action-bar-embedded" style="display: none;">
       <div class="batch-cluster-left">
         <span class="batch-count-badge"><span id="batchSelectedCount">0</span>&nbsp;selected</span>
         <button class="btn-secondary btn-batch-deselect" onclick="clearJobSelection()" title="Clear selection">Deselect All</button>
       </div>
       <div class="batch-cluster-divider"></div>
       <div id="batchActionButtons" class="batch-action-buttons">
         <!-- Injected via updateBatchActionBar() based on active tab -->
       </div>
     </div>
   </div>
   ```
2. **Websites Page (`#viewWebsites`)**:
   Add `.websites-toolbar` before `.table-wrapper` with `+ Add Website` button.
3. **Daily Schedule Page (`#viewSchedule`)**:
   Move `Configure Schedule` button inside `.table-card-header` on the right side.
4. **Criteria Page (`#viewCriteria`)**:
   Already follows this exact pattern via `.criteria-toolbar`.
5. **Companies Page (`#viewCompanies`) & Settings Page (`#viewSettings`)**:
   Keep header clean.

### C. Dropdown Tab Filter & State Sync (`web/public/app.js`)
- Update `switchJobsTab(tab)`:
  - Updates `currentJobsTab = tab`.
  - Sets `document.getElementById('jobsTabSelect').value = tab`.
  - Re-renders job rows and updates counts.
- In `renderJobs()`:
  - Update option labels on `#jobsTabSelect` with real-time counts:
    - `#optReview`: `Review (${counts.review})`
    - `#optPending`: `Pending Jobs (${counts.pending})`
    - `#optSubmitted`: `Submitted (${counts.submitted})`
    - `#optDropped`: `Filtered (${counts.dropped})`
    - `#optAll`: `All (${counts.all})`
- In `updateBatchActionBar()`:
  - When `selectedJobUuids.size > 0`:
    - `#jobsToolbarControls.style.display = 'none'`
    - `#jobsToolbarActions.style.display = 'none'`
    - `#batchActionBar.style.display = 'flex'`
  - When `selectedJobUuids.size === 0`:
    - `#jobsToolbarControls.style.display = 'flex'`
    - `#jobsToolbarActions.style.display = 'flex'`
    - `#batchActionBar.style.display = 'none'`
  - Since both standard and batch modes occupy `.jobs-toolbar` with the identical fixed height (`38px`), layout shift on `#jobsTable` is guaranteed **0px**.

---

## 3. Task Breakdown

- [x] **Task 1: Universal Clean Header in HTML & App Controller**
  - [x] Remove `.topbar-controls` and all embedded control divs from `.app-topbar` in `web/public/index.html`.
  - [x] Clean up control toggling logic from `switchView()` in `web/public/app.js`.
  - [x] Verify every view (`jobs`, `criteria`, `websites`, `companies`, `schedule`, `settings`) displays a clean title and subtitle only.

- [x] **Task 2: Jobs View Toolbar with Compact Dropdown Filter & Columns Button**
  - [x] Add `.jobs-toolbar` with `#searchInput`, `#jobsTabSelect`, and Columns button in `web/public/index.html`.
  - [x] Embed `#batchActionBar` directly inside `.jobs-toolbar`.
  - [x] Add Shadcn styling in `web/public/style.css` for `.jobs-toolbar`, `.filter-select`, and `.batch-action-bar-embedded`.

- [x] **Task 3: Relocate Action Controls for Websites and Schedule Views**
  - [x] Add `.websites-toolbar` with `+ Add Website` in `viewWebsites`.
  - [x] Move `Configure Schedule` button to `.table-card-header` in `viewSchedule`.

- [x] **Task 4: Controller Updates for Dropdown Filter & Batch Toolbar Toggling**
  - [x] Update `switchJobsTab()` to sync `#jobsTabSelect` value.
  - [x] Update `renderJobs()` to update dropdown `<option>` counts dynamically.
  - [x] Update `updateBatchActionBar()` to seamlessly swap controls inside `.jobs-toolbar`.

- [x] **Task 5: Verification & Visual Evidence Capture**
  - [x] Run Puppeteer script to capture:
    - `/tmp/clean_header_jobs_view.png`: Proving clean header and in-page toolbar with dropdown filter.
    - `/tmp/clean_header_websites_view.png`: Proving clean header and in-page `+ Add Website` button.
    - `/tmp/clean_header_batch_active.png`: Proving in-toolbar batch action with 0px table layout shift.
    - `/tmp/clean_header_schedule_view.png`: Proving clean header and in-card `Configure Schedule` button.
    - `/tmp/clean_header_criteria_view.png`: Proving clean header and in-page criteria toolbar.
  - [x] Run cross-verification audit `scratch/run_cross_verification_audit.ts` (46/46 passed).
  - [x] Run `~/.cargo/bin/cargo check --manifest-path cli/Cargo.toml` (0 errors).

---

## 4. Verification Protocol
- **Commands**:
  - `bun run scratch/run_cross_verification_audit.ts`: Confirm 47/47 audit tests pass.
  - `~/.cargo/bin/cargo check --manifest-path cli/Cargo.toml`: Confirm Rust CLI builds cleanly with 0 errors.
  - `graphify extract .`: Update AST knowledge graph.
- **Visual Evidence**:
  - `/tmp/clean_header_jobs_view.png`: Clean topbar and in-page `.jobs-toolbar` with compact dropdown.
  - `/tmp/clean_header_batch_active.png`: Zero layout shift when batch toolbar activates inside in-page toolbar.
