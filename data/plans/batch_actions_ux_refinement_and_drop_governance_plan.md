# Plan: Batch Actions UX Refinement, Header Integration, and Drop Governance

## 1. Goal & Scope
Address three specific UX, layout, and workflow defects identified by the user:
1. **Eliminate Table Push-Down & Compact Header Controls**:
   - Stop inserting a separate block above the table that pushes table rows downward upon selection.
   - Compact the header (search bar, filter tabs, columns button).
   - Integrate the batch action toolbar directly into the topbar controls area (smoothly replacing or overlaying the search/tab controls when `>= 1` item is selected), ensuring zero layout shift or vertical movement for `#jobsTable`.
2. **Safe Drop Governance & Confirmation Dialogs**:
   - Add explicit confirmation modal/dialog for all destructive/risky actions:
     - Single job "Drop Job": Prompts confirmation before execution.
     - Batch "Drop Selected": Prompts confirmation stating the exact count of jobs being dropped.
   - Allow undoing / restoring dropped jobs:
     - Add `DROPPED -> PENDING_HUMAN` transition in `ALLOWED_TRANSITIONS` (`web/src/storage/db.ts`).
     - In the `Filtered` tab (`currentJobsTab === 'dropped'`), display `Restore Selected to Review` instead of invalid `Approve` or `Submit` buttons.
     - In the single-job Action popover for `DROPPED` jobs, provide `Restore to Review (PENDING_HUMAN)`.
3. **Cluster Batch Actions & Clear "Deselect All" Positioning**:
   - Bring "Deselect All" directly adjacent to the selection count badge, eliminating the distant right-aligned link.
   - Style "Deselect All" as a clear, distinct Shadcn secondary button (`#27272a` bg, `#3f3f46` border, `#f4f4f5` text).
   - Layout cluster:
     `[ (N) selected ] [ Deselect All ]` `|` `[ Primary Action (N) ]` `[ Drop Selected (N) ]`

---

## 2. Technical Design

### A. Lifecycle State Transitions (`web/src/storage/db.ts`)
- Update `ALLOWED_TRANSITIONS`:
  ```ts
  DROPPED: ['PENDING_HUMAN']
  ```
  This allows dropped jobs to be reopened/restored to the `Review` tab (`PENDING_HUMAN`) if dropped by mistake, preventing permanent lock-out.
- Add `restore` handling in `POST /api/jobs/batch-status`:
  Accepts target status `PENDING_HUMAN` to restore dropped jobs.

### B. Header Integration & Layout Shift Prevention (`web/public/index.html` & `web/public/style.css`)
- Remove `#batchActionBar` from inside `.view-panel` above `.table-wrapper`.
- Place `#batchActionBar` directly inside `.app-topbar` (within `.topbar-controls`), positioned to swap with `#jobsFilterControls` when selection count `> 0`:
  - When `selectedJobUuids.size === 0`: `#jobsFilterControls` is `display: flex;`, `#batchActionBar` is `display: none;`.
  - When `selectedJobUuids.size > 0`: `#jobsFilterControls` is `display: none;`, `#batchActionBar` is `display: flex;`.
- Because `.app-topbar` has a fixed height (`60px`), swapping controls inside the topbar produces **zero vertical layout shift**:
  - The table remains at the exact same pixel position on screen.
  - No rows are pushed down or jumped.
- Compact `#jobsFilterControls`:
  - Search input width set to compact (`max-width: 240px;`).
  - Filter tabs padding refined for high information density.

### C. Batch Action Cluster & Deselect Button (`web/public/app.js` & `web/public/style.css`)
- Reorganize the batch action controls into a unified compact cluster:
  ```html
  <div class="batch-cluster-left">
    <span class="batch-count-badge"><span id="batchSelectedCount">0</span> selected</span>
    <button class="btn-secondary btn-batch-deselect" onclick="clearJobSelection()">Deselect All</button>
  </div>
  <div class="batch-divider"></div>
  <div class="batch-cluster-actions" id="batchActionButtons">
    <!-- Tab-dependent actions -->
  </div>
  ```
- Tab-dependent batch actions:
  - **Review Tab (`review`)**:
    - `[✓ Approve Selected (N)]` (Shadcn primary: white `#ffffff`, text black `#09090b`)
    - `[✕ Drop Selected (N)]` (Shadcn secondary: dark zinc `#27272a`, border `#3f3f46`, text white `#f4f4f5`)
  - **Pending Jobs Tab (`pending`)**:
    - `[▷ Run & Submit Selected (N)]` (Shadcn primary: white `#ffffff`, text black `#09090b`)
    - `[✕ Drop Selected (N)]` (Shadcn secondary)
  - **Filtered Tab (`dropped`)**:
    - `[↺ Restore Selected to Review (N)]` (Shadcn primary: moves status back to `PENDING_HUMAN`)
  - **All Tab (`all`)**:
    - Contextual batch actions with drop confirmation.

### D. Destructive Confirmation Modal
- When user clicks `Drop Selected`:
  - Open confirmation dialog: *"Are you sure you want to drop ${count} selected job(s)? They will be moved to the Filtered tab."*
  - Only executes upon explicit user confirmation (`Confirm Drop`).
- When user clicks `Drop Job` in single-row popover:
  - Prompt confirmation: *"Drop application draft for ${company} - ${title}?"*
- In `Filtered` tab, single-row Action popover provides `Restore to Review` which transitions status back to `PENDING_HUMAN`.

---

## 3. Task Breakdown

- [x] **Task 1: Database Transition & Restoration Support**
  - [x] Add `DROPPED: ['PENDING_HUMAN']` in `ALLOWED_TRANSITIONS` (`web/src/storage/db.ts`).
  - [x] Verify `/api/jobs/batch-status` supports transitioning `DROPPED` jobs back to `PENDING_HUMAN`.

- [x] **Task 2: Topbar Header Integration (Zero Table Push-Down)**
  - [x] Move `#batchActionBar` from `viewJobs` into `.topbar-controls` in `web/public/index.html`.
  - [x] Compact search input and filter buttons in `web/public/style.css`.
  - [x] Update `updateBatchActionBar()` in `web/public/app.js` to toggle between `#jobsFilterControls` and `#batchActionBar` inside the header.

- [x] **Task 3: Clustered Batch Layout & Prominent Deselect Button**
  - [x] Re-order the elements in `#batchActionBar`: place `[ (N) selected ]` and `[ Deselect All ]` adjacent on the left, followed by the action buttons.
  - [x] Style `btn-batch-deselect` as a standard Shadcn secondary button.
  - [x] Maintain 100% strict monochrome Shadcn palette (`#ffffff`, `#09090b`, `#27272a`, `#3f3f46`, `#f4f4f5`).

- [x] **Task 4: Destructive Action Confirmation & Filtered Tab Governance**
  - [x] Add confirmation modal / check to `executeBatchAction('DROPPED')`.
  - [x] Add confirmation check to single-job drop action in `openActionPopover`.
  - [x] Implement `Restore to Review` for `DROPPED` jobs in both batch action bar and single row action popover.

- [x] **Task 5: Verification & Evidence Capture**
  - [x] Run Puppeteer script to capture:
    - `/tmp/jobs_header_batch_active.png`: Demonstrating batch action bar integrated into topbar with zero table shift.
    - `/tmp/jobs_filtered_tab_restore.png`: Demonstrating `Restore Selected to Review` in Filtered tab.
  - [x] Test drop confirmation and restore lifecycle in SQLite.
  - [x] Run `cargo check --manifest-path cli/Cargo.toml` and cross-verification audit.

---

## 4. Verification Protocol
- **Commands**:
  - `bun run scratch/run_cross_verification_audit.ts`: Confirm 43/43 audit tests pass.
  - `cargo check --manifest-path cli/Cargo.toml`: Confirm Rust CLI builds cleanly with 0 errors.
- **Visual Evidence**:
  - `/tmp/jobs_header_batch_active.png`: Zero layout push-down on `#jobsTable`.
  - `/tmp/jobs_batch_cluster.png`: Unified cluster with prominent `Deselect All` button.
  - `/tmp/jobs_filtered_tab_restore.png`: Restoration action in Filtered tab.
