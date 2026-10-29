# Plan: Web Console UI/UX Redesign & Design System Overhaul

## 1. Goal & Scope
Redesign the Job Apply Automator Web Console to eliminate visual clutter, duplicate controls, and empty black voids, bringing the interface to a professional, high-density dashboard standard (Linear / Vercel aesthetic):
1. **Daily Schedule View Redesign**:
   - Eliminate redundant duplicate topbar and panel headers.
   - Remove the duplicate "Configure Schedule" button (retain a single clean button in the topbar).
   - Add high-signal executive metric summary cards above the ledger table: Total Batches, Processed Volume, Approved Yield, and Run Success Rate.
   - Frame the batch ledger inside a structured card container with polished table typography, status badges, and column widths.
2. **System Settings View Redesign**:
   - Eliminate the lonely floating card in the pitch-black void.
   - Restructure Settings into a comprehensive two-column or multi-card control plane:
     - **Card 1: Antigravity CLI Agent (AGY)**: Model reasoning picker with pill badges, timeout input with unit suffix, active switch toggle, and diagnostic connection tester.
     - **Card 2: Crawler Engine & CDP Governance**: Target boards, concurrent rate-limiting, and Brave CDP remote debugging status.
     - **Card 3: Database & Ledger Health**: SQLite `data/amiya.db` file stats (WAL mode, table row counts, size on disk, and database integrity/vacuum trigger).
3. **Global Design System & Surface Polish**:
   - Eliminate flat pitch-black (`#000000`) void. Establish a layered neutral surface scale: Canvas (`#09090b`), Surface/Card (`#121316`), Elevated Surface (`#18191d`), Row Hover (`#1c1d22`), Borders (`#27272a`).
   - Standardize buttons, input heights (36px), typography hierarchy, and switch toggles.
   - Smooth slide-over drawer transitions with refined backdrop blur.

---

## 2. Technical Design & Architecture

### 2.1 CSS Surface Tokens (`web/public/style.css`)
```css
:root {
  --bg-app: #09090b;              /* Root canvas */
  --bg-surface: #121316;          /* Primary cards & panels */
  --bg-surface-elevated: #18191e; /* Inputs, table headers, hover states */
  --bg-surface-hover: #1e2026;    /* Active row hover */
  --border-subtle: #22242a;       /* Card & divider borders */
  --border-strong: #2e313a;       /* Input & active borders */
  --border-highlight: #3f434f;    /* Focus & interactive highlights */
  --text-primary: #f4f4f5;        /* Primary typography */
  --text-secondary: #a1a1aa;      /* Subtitles & metadata */
  --text-muted: #71717a;          /* Timestamps & hints */
  --badge-success-bg: rgba(34, 197, 94, 0.12);
  --badge-success-border: rgba(34, 197, 94, 0.28);
  --badge-success-text: #4ade80;
  --badge-danger-bg: rgba(244, 63, 94, 0.12);
  --badge-danger-border: rgba(244, 63, 94, 0.28);
  --badge-danger-text: #fb7185;
}
```

### 2.2 Component Hierarchy & Layout Structure (`web/public/index.html`)

#### Daily Schedule (`#viewSchedule`)
- **Metric Cards Grid** (4 columns):
  1. *Total Runs*: Total batch entries recorded in `daily_runs`.
  2. *Jobs Evaluated*: Sum of processed candidates.
  3. *Approved Yield*: Total approved/kept candidates and conversion %.
  4. *Engine Health*: Success vs failed batches ratio.
- **Batch Ledger Table Card**:
  - Full-width card container with subtle border and inner table wrapper.
  - Column alignment: Batch ID (`code`), Run Date (`monospace`), Status (`soft badge`), Batch Size, Processed, Approved, Skipped, Error/Details (`truncate with title tooltip`).
- **Single Header Action**:
  - "Configure Schedule" button positioned cleanly in topbar controls only.

#### System Settings (`#viewSettings`)
- **Responsive 2-Column Grid**:
  - **Left Column**:
    - *Antigravity CLI Agent (AGY)*: Enable toggle, model dropdown (Gemini 3.8 Flash High, Claude Sonnet 4.6, Claude Opus 4.6 Thinking), execution timeout, Save & Test buttons, diagnostic output container.
  - **Right Column**:
    - *Brave Browser & CDP Status*: Remote debugging port 9222 check, process health, command launcher cheat sheet.
    - *SQLite Storage & Ledger Maintenance*: File location, WAL mode status, row counts for `jobs_ledger`, `personalization_rules`, `companies`, and `daily_runs`.

#### Header & Topbar Alignment
- Remove the duplicated `<h2 class="panel-title">` from the inner view panels where the topbar already displays the view title and subtitle.
- Keep the page topbar clean and purposeful.

---

## 3. Task Breakdown with Status Checkboxes

- [x] **Task 1: Design Tokens & Layout Architecture Overhaul**
  - [x] Update `web/public/style.css` with dark theme surface scale (`--bg-app`, `--bg-surface`, `--bg-surface-elevated`).
  - [x] Add metric card components (`.metric-card-grid`, `.metric-card`, `.metric-value`, `.metric-label`).
  - [x] Polish form inputs, select elements, switch toggles, and buttons with consistent border radii and hover states.

- [x] **Task 2: Daily Schedule View & Metric Dashboard Redesign**
  - [x] Remove duplicate header and duplicate "Configure Schedule" button from `web/public/index.html`.
  - [x] Add executive metric cards to `#viewSchedule`.
  - [x] Wrap `#batchRunsTbody` in a styled card container with clean column widths and soft status badges.
  - [x] Update `web/public/app.js` to compute and render real-time summary statistics from `runs` data.

- [x] **Task 3: System Settings Multi-Card Layout Redesign**
  - [x] Remove duplicated headers in `#viewSettings`.
  - [x] Implement responsive 2-column settings layout in `web/public/index.html`.
  - [x] Add backend endpoint `GET /api/system/status` in `web/src/server.ts` returning database file stats and row counts.
  - [x] Wire database and browser status cards in `web/public/app.js`.

- [x] **Task 4: Verification & Visual Proof**
  - [x] Check syntax and restart web server daemon.
  - [x] Capture new Puppeteer screenshots of Schedule and Settings views.
  - [x] Confirm elimination of duplicate buttons and empty voids.
  - [x] Update `README.md` and extract knowledge graph via `graphify extract .`.

---

## 4. Verification Protocol
1. **Compilation Check**: `bun -e "import('./web/src/server.ts')"` syntax verification.
2. **Visual Inspection**: Capture Puppeteer screenshots of `#viewSchedule` and `#viewSettings` at `1440x900` resolution.
3. **Behavioral Test**: Verify topbar controls toggle properly, schedule drawer slides out smoothly without UI stutter, and settings save properly.
