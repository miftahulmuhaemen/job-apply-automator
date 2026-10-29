# Plan: Universal Left-Aligned In-Page Toolbars & Inline Batch Controls

## 1. Goal & Scope
Address all 4 layout, alignment, and UX defects identified by the user across the application:
1. **Left-Align Websites Action**: Move `+ Add Website` from the far right to the left-aligned toolbar directly above the table.
2. **Eliminate Daily Schedule Outlier**: Remove the `.table-card` wrapper from the Daily Schedule page so it matches the identical structure of Jobs, Websites, and Criteria: `.view-toolbar` (left-aligned) above `.table-wrapper`.
3. **Left-Align Columns Button & Compact Controls**: Move `[ Columns ]` directly next to `#searchInput` and `#jobsTabSelect` on the left.
4. **Inline Batch Action Appending (Never Remove Existing Controls)**:
   - Keep `#searchInput`, `#jobsTabSelect`, and `[ Columns ]` permanently visible.
   - When rows are selected (`count > 0`), simply append the batch action cluster (`| [ N selected ] [ Deselect All ] [ Action Buttons ]`) inline directly to the right of `[ Columns ]`.
   - All batch controls left-aligned immediately following the existing controls; zero far-right alignment across all toolbars.

---

## 2. Technical Design

### A. Universal Left-Aligned Toolbar Layout (`web/public/style.css`)
- Update toolbar styles to strictly left-align all elements:
  ```css
  .view-toolbar,
  .jobs-toolbar,
  .websites-toolbar,
  .criteria-toolbar,
  .schedule-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    flex-shrink: 0;
    margin-bottom: 8px;
    min-height: 38px;
  }
  ```
- Remove all `.criteria-toolbar-right`, `.jobs-toolbar-right`, and `.websites-toolbar-right` separate containers and `justify-content: space-between`.
- Every button, input, and badge is placed sequentially from left to right.

### B. Jobs Page Toolbar & Inline Batch Appending (`web/public/index.html` & `web/public/app.js`)
- Markup in `#viewJobs`:
  ```html
  <div class="jobs-toolbar">
    <input type="text" id="searchInput" class="search-input" placeholder="Search company, tech, role, location...">
    <select id="jobsTabSelect" class="filter-select" onchange="switchJobsTab(this.value)">
      <option value="review" id="optReview">Review (0)</option>
      <option value="pending" id="optPending">Pending Jobs (0)</option>
      <option value="submitted" id="optSubmitted">Submitted (0)</option>
      <option value="dropped" id="optDropped">Filtered (0)</option>
      <option value="all" id="optAll">All (0)</option>
    </select>
    <button class="btn-secondary" onclick="toggleColumnMenu(event)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
        <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"></path>
      </svg>
      Columns
    </button>

    <!-- Appended inline when rows selected (never hiding search, dropdown, or columns) -->
    <div id="batchActionBar" class="batch-cluster-inline" style="display: none;">
      <div class="batch-cluster-divider"></div>
      <span class="batch-count-badge"><span id="batchSelectedCount">0</span>&nbsp;selected</span>
      <button class="btn-secondary btn-batch-deselect" onclick="clearJobSelection()" title="Clear selection">Deselect All</button>
      <div id="batchActionButtons" class="batch-action-buttons">
        <!-- Dynamically populated buttons -->
      </div>
    </div>
  </div>
  ```
- In `web/public/app.js`:
  - `updateBatchActionBar()`:
    - Never hides `searchInput`, `jobsTabSelect`, or Columns button.
    - If `count === 0`: `batchActionBar.style.display = 'none'`.
    - If `count > 0`: `batchActionBar.style.display = 'inline-flex'`.
    - Buttons inside `#batchActionButtons` are rendered directly inline.

### C. Standardize Daily Schedule & Criteria Pages (`web/public/index.html`)
1. **Daily Schedule (`#viewSchedule`)**:
   - Replace `<div class="table-card">` with standard:
     ```html
     <section id="viewSchedule" class="view-panel">
       <div class="schedule-toolbar">
         <button class="btn-primary" onclick="openScheduleDrawer()">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
             <circle cx="12" cy="12" r="3"></circle>
             <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
           </svg>
           Configure Schedule
         </button>
         <div class="table-card-badge" id="batchRunsBadge">0 recorded runs</div>
       </div>
       <div class="table-wrapper">...</div>
       <footer class="view-footer">...</footer>
     </section>
     ```
2. **Criteria Page (`#viewCriteria`)**:
   - Merge `.criteria-toolbar-left` and `.criteria-toolbar-right` into a single left-aligned row:
     `[ Search parameters... ] [ Synced: data/personalization.md ] [ + Add Parameter ]`
3. **Websites Page (`#viewWebsites`)**:
   - Left-align `+ Add Website` directly in `.websites-toolbar`:
     `[ + Add Website ]`

---

## 3. Task Breakdown

- [x] **Task 1: Universal Left-Aligned Toolbar CSS**
  - [x] Update `.jobs-toolbar`, `.websites-toolbar`, `.criteria-toolbar`, `.schedule-toolbar` to `justify-content: flex-start; gap: 8px;`.
  - [x] Add `.batch-cluster-inline` style for seamless inline appending.
  - [x] Maintain 100% strict Shadcn monochrome neutral scale.

- [x] **Task 2: Restructure Toolbars in HTML**
  - [x] Jobs page: Place `#searchInput`, `#jobsTabSelect`, `Columns` button, and inline `#batchActionBar` in a single left-aligned row.
  - [x] Websites page: Left-align `+ Add Website` in `.websites-toolbar`.
  - [x] Schedule page: Remove `.table-card` outlier and place `Configure Schedule` and run badge in `.schedule-toolbar` directly above `.table-wrapper`.
  - [x] Criteria page: Left-align `+ Add Parameter` adjacent to search input and file badge.

- [x] **Task 3: Controller Update for Inline Batch Appending**
  - [x] Update `updateBatchActionBar()` in `web/public/app.js` to simply toggle `#batchActionBar` inline without touching or hiding search, dropdown, or columns controls.

- [x] **Task 4: Verification & Evidence Capture**
  - [x] Run Puppeteer script to capture:
    - `/tmp/left_aligned_jobs_view.png`: Proving search, filter dropdown, and columns clustered on the left.
    - `/tmp/left_aligned_jobs_batch.png`: Proving batch actions appended inline next to columns on the left.
    - `/tmp/left_aligned_websites_view.png`: Proving `+ Add Website` left-aligned.
    - `/tmp/left_aligned_schedule_view.png`: Proving Schedule toolbar matching all other pages (no card outlier).
    - `/tmp/left_aligned_criteria_view.png`: Proving `+ Add Parameter` left-aligned.
  - [x] Run cross-verification audit `scratch/run_cross_verification_audit.ts` (47/47 passed).
  - [x] Run `~/.cargo/bin/cargo check --manifest-path cli/Cargo.toml` (0 errors).

---

## 4. Verification Protocol
- **Commands**:
  - `bun run scratch/run_cross_verification_audit.ts`: Confirm 46/46 audit tests pass.
  - `~/.cargo/bin/cargo check --manifest-path cli/Cargo.toml`: Confirm Rust CLI builds cleanly with 0 errors.
  - `graphify extract .`: Update AST knowledge graph.
- **Visual Evidence**:
  - All 4 page screenshots proving 100% left-alignment, zero far-right outliers, and inline batch appending.
