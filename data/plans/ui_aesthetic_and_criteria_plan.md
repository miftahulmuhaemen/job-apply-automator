# Plan: Dark Shadcn Aesthetic Overhaul, Spacing Harmony, and Job Freshness Criteria

## 1. Goal & Scope
Refactor the Job Apply Automator Web Console and criteria engine to strictly adhere to authentic **Dark Shadcn (Zinc / Neutral)** design principles, eliminate visual clutter, remove redundant metadata, introduce proper component breathing room, remove raw ID displays, and enforce a 7-day job freshness filter:
1. **Job Freshness Criteria (<= 7 Days / Maximum 1 Week)**:
   - Add a strict rule to `personalization_rules` in `data/amiya.db` and unidirectionally sync to `data/personalization.md`.
   - Update `cli/src/job_crawling/preferences.rs` to enforce `max_posting_age_days: 7`.
2. **Component Removal**:
   - Completely remove the 4-card metric grid from `#viewSchedule` (screenshot `/tmp/orca-paste-1793036738021-6ea9897d-856b-4eeb-96aa-eadc035d91d8.png`).
   - Completely remove the right-column diagnostics cards (`SQLite Ledger Health` and `Brave Automation Runtime`) from `#viewSettings` (screenshot `/tmp/orca-paste-1793036748441-714b4755-d257-4a52-ab18-d0072853a121.png`).
3. **Database Redundancy Elimination & Dedicated Control in Settings**:
   - Eliminate `amiya.db` text from the sidebar brand subtitle and from the universal topbar metadata across all pages.
   - Centralize database governance exclusively in `#viewSettings` with a purposeful Database Management card (current active database path, switch/connect input, and new database creation trigger).
4. **Component Spacing & Aesthetic Breathing Room Across All Pages**:
   - Add consistent padding (`20px 24px` to `24px 32px`) to `.view-panel` containers so views never stick directly to the topbar or viewport edges.
   - Establish consistent spacing (`gap: 16px`, `margin-bottom: 16px`) between filters, tabs, cards, and tables.
5. **Elimination of Raw Blank-Face IDs**:
   - Remove the `BATCH ID` raw UUID column from the Daily Schedule runs table. Display `Run Timestamp` as the primary chronological anchor.
   - Audit all tables to guarantee zero unmasked UUIDs or raw database hashes are exposed.
6. **Strict Shadcn Monochrome / Dark Zinc Color Palette**:
   - Eliminate generic AI color slop: remove bright cyan code pills (`#a5f3fc`), neon green toggles (`#22c55e`), bright green/red table numbers, and saturated accents.
   - Adopt authentic Shadcn dark zinc palette:
     - Backgrounds: `#09090b` (root canvas), `#18181b` (cards/dialogs), `#27272a` (secondary/muted inputs), `#3f3f46` (borders/dividers).
     - Foreground Typography: `#f4f4f5` (primary zinc-100), `#a1a1aa` (muted zinc-400), `#71717a` (subtle zinc-500).
     - Switch Toggle: Clean Shadcn neutral switch (white `#fafafa` fill with dark `#09090b` knob when active; dark `#27272a` with `#71717a` knob when inactive).
     - Parameter Keys: Neutral monospace code badge (`#e4e4e7` on `#18181b` with subtle `#27272a` border; zero cyan/blue).
     - Status Badges: Neutral monochrome or very subtle muted zinc tints.

---

## 2. Technical Design

### 2.1 Criteria & Rule Engine Addition
- **Rule Key**: `max_posting_age_days`
- **Category**: `Screening & Legal` (or `Target Engineering Roles`)
- **Criteria Value / Logic**: `<= 7 Days (Maximum 1 Week)`
- **Operational Guidance**: `Strict filter: Only ingest and triage job postings published within the last 7 days (maximum 1 week). Exclude stale postings older than 7 days.`
- **Rust Integration**: In `cli/src/job_crawling/preferences.rs`, define `pub max_posting_age_days: i64 = 7`.

### 2.2 Color Tokens (`web/public/style.css`)
```css
:root {
  --bg-app: #09090b;              /* Root dark canvas */
  --bg-surface: #18181b;          /* Cards, modals, topbar */
  --bg-surface-elevated: #27272a; /* Inputs, table headers, hover states */
  --bg-surface-active: #3f3f46;   /* Active selection */
  --border-subtle: #27272a;       /* Card & divider borders */
  --border-strong: #3f3f46;       /* Input & active borders */
  --border-highlight: #52525b;    /* Focus ring */
  --text-main: #f4f4f5;           /* Primary text */
  --text-secondary: #a1a1aa;      /* Subtitles & metadata */
  --text-muted: #71717a;          /* Hints & inactive states */
}
```

### 2.3 Schedule Table Redesign (`web/public/index.html` & `app.js`)
- Table Columns:
  1. `Run Date & Time` (formatted timestamp, clean typography)
  2. `Status` (subtle neutral badge: COMPLETED / FAILED)
  3. `Batch Cap` (right aligned, neutral text)
  4. `Processed` (right aligned, neutral text)
  5. `Approved` (right aligned, neutral text)
  6. `Skipped` (right aligned, neutral text)
  7. `Execution Details` (clean text)
- Remove `BATCH ID` column and raw UUID strings (`01a178f1...`).

### 2.4 Settings Layout Redesign (`web/public/index.html`)
- Remove the 2-column split with the diagnostic cards.
- Implement a clean, single-column or 2-card centered layout (max-width `760px`):
  - **Card 1: Antigravity CLI Agent (AGY)**: Model selection, timeout, interactive toggle, test connection button.
  - **Card 2: Database Storage & Environment**:
    - Current Active SQLite Database (`data/amiya.db`).
    - Input to select/switch database path.
    - Action buttons: "Switch Database", "Initialize New Database".

### 2.5 Page Spacing & Layout Architecture
- Wrap content in `.view-content-wrapper` with `padding: 24px; display: flex; flex-direction: column; gap: 16px;`.
- Remove table gluing against the topbar.
- Add comfortable inner margins to all cards, tables, and tab groups.

---

## 3. Task Breakdown with Status Checkboxes

- [x] **Task 1: Add 7-Day Job Freshness Criteria**
  - [x] Insert `max_posting_age_days` rule into `personalization_rules` in `data/amiya.db`.
  - [x] Sync rule into `data/personalization.md`.
  - [x] Add `max_posting_age_days: 7` into `cli/src/job_crawling/preferences.rs`.

- [x] **Task 2: Strip Clutter, Redundant `amiya.db` Info & Metric Cards**
  - [x] Remove `amiya.db` from sidebar brand subtitle and universal topbar in `web/public/index.html`.
  - [x] Remove 4 metric cards (`.metrics-grid`) from `#viewSchedule`.
  - [x] Remove `SQLite Ledger Health` and `Brave Automation Runtime` cards from `#viewSettings`.

- [x] **Task 3: Eliminate Raw IDs & Reformat Schedule Table**
  - [x] Remove `BATCH ID` column from `#viewSchedule` in `web/public/index.html`.
  - [x] Update `renderBatchRuns` in `web/public/app.js` to render without UUIDs, using neutral text formatting.

- [x] **Task 4: Strict Dark Shadcn Design System & Palette Overhaul**
  - [x] Overhaul color variables in `web/public/style.css` to dark zinc neutrals.
  - [x] Replace cyan parameter badges with neutral zinc monospace tags.
  - [x] Replace neon green switch toggle with Shadcn white/zinc toggle.
  - [x] Strip bright green/red/yellow text colors from tables, badges, and numbers.

- [x] **Task 5: Component Spacing & Layout Breathing Room**
  - [x] Add standardized padding (`24px`) and gap (`16px`) to all `.view-panel` containers in `web/public/style.css`.
  - [x] Ensure tables, tabs, search bars, and card containers have aesthetic whitespace.

- [x] **Task 6: Dedicated Database Control in Settings**
  - [x] Add Database Management card to `#viewSettings` in `web/public/index.html`.
  - [x] Implement switch/create endpoints in `web/src/server.ts` and UI handlers in `web/public/app.js`.

- [x] **Task 7: Visual Verification with Puppeteer & Graphify Sync**
  - [x] Restart server daemon and verify compilation.
  - [x] Capture Puppeteer screenshots of Schedule, Settings, and Criteria views at `1440x900`.
  - [x] Inspect captured screenshots to confirm aesthetic spacing, zero raw IDs, and neutral Shadcn palette.
  - [x] Run `graphify extract .` and update `README.md`.

---

## 4. Verification Protocol
1. **Visual Check**: Run `bun run scripts/capture_views.ts` to capture new screenshots of `#viewSchedule`, `#viewSettings`, and `#viewCriteria`. Inspect with `read_file` to confirm:
   - Zero metric cards in Schedule view.
   - Zero raw UUIDs or hashes in Schedule table.
   - Zero cyan boxes in Criteria table.
   - Clean neutral Shadcn dark palette with proper spacing.
   - Zero `amiya.db` redundant text in sidebar or topbar.
2. **Compilation**: `bun -e "import('./web/src/server.ts')"` and `cargo check --manifest-path cli/Cargo.toml`.
3. **Criteria Integrity**: Verify `max_posting_age_days` rule present in `personalization_rules` and `data/personalization.md`.
