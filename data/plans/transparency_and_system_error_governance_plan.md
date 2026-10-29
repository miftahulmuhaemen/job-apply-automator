# Transparency, Portal Authentication & System Error Governance Plan

## 1. Goal & Scope

Provide total operational transparency across the Web Console (`http://localhost:3100`) by eliminating hidden assumptions, surfacing detailed job submission diagnostic states, displaying live portal authentication health, providing granular company enrichment tracking, and introducing a centralized system error logging menu to track browser, CDP, crawler, and daemon failures.

### Boundaries
- UI styling must strictly adhere to `.agent/rules/shadcn_monochrome_theme.md` (pure neutral/zinc dark scale `#09090b` to `#ffffff`; zero non-monochrome colors).
- Database changes must be backwards-compatible in SQLite (`data/amiya.db`).
- All pre-scripted automation remains the zero-token primary path, with structured diagnostic checkpoints that clearly flag roadblocks for user review before any agent-browser fallback is triggered.

---

## 2. Technical Design

### A. Centralized System Error Logging (`system_errors` Table)
1. **SQLite Schema**:
   ```sql
   CREATE TABLE IF NOT EXISTS system_errors (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       timestamp TEXT NOT NULL DEFAULT (datetime('now')),
       category TEXT NOT NULL, -- 'BROWSER_CDP', 'AUTH_SESSION', 'CRAWLER', 'SUBMISSION', 'SYSTEM_DAEMON'
       severity TEXT NOT NULL DEFAULT 'ERROR', -- 'CRITICAL', 'ERROR', 'WARNING'
       component TEXT NOT NULL,
       message TEXT NOT NULL,
       details TEXT, -- JSON or stack trace string
       resolved INTEGER DEFAULT 0,
       resolved_at TEXT
   );
   CREATE INDEX IF NOT EXISTS idx_errors_resolved_ts ON system_errors(resolved, timestamp DESC);
   ```
2. **Backend Logger Module (`web/src/storage/errorLogger.ts`)**:
   - `logSystemError(category, component, message, details, severity)`: Records error into `system_errors`.
   - Wire into `browserRunner.ts`, `portalSubmitter.ts`, `server.ts`, and scheduler/crawler handlers.
3. **REST API Endpoints (`web/src/server.ts`)**:
   - `GET /api/errors?resolved=0&category=...`: Returns list of errors and unresolved count badge.
   - `POST /api/errors/:id/resolve`: Marks an error as resolved.
   - `POST /api/errors/clear-resolved`: Cleans up resolved errors.

### B. Job Submission & Roadblock Transparency
1. **Schema & Data Enrichment**:
   - Add `last_error` and `roadblock_url` columns to `jobs_ledger` (or parse directly from `histories`).
   - When a submission fails or halts (e.g. prerequisite assessment required on Kalibrr, unverified ledger check), record the exact classification, URL, and diagnostic reason.
2. **Web Console UI Enhancements**:
   - **Job Dossier Modal (Tab 5: Submission & Diagnostics)**:
     - Prominent status diagnostic panel.
     - If `FAILED`: Display exact roadblock banner (e.g., "Prerequisite Assessment Required: Basic English Communication Skills (Written)"), link to roadblock URL (`https://jobseeker.kalibrr.com/candidate/exams/228`), screenshot of the blocking screen, and actions: "Open Roadblock in Browser", "Retry Pre-scripted", "Run Agent Fallback".
     - If `SUBMITTED (NOT VERIFY-ABLE)`: Display disclaimer badge and receipt modal screenshot explaining mobile-app-only verification (e.g., Glints).
     - If `APPLIED`: Display verified ledger entry text and link to portal's application history.
   - **Jobs Table Row**:
     - Display brief diagnostic tooltip/tag under status badge if `FAILED` or `SUBMITTED (NOT VERIFY-ABLE)`.

### C. Portal Authentication Status Visibility
1. **Global Auth Status Chips**:
   - Place live authentication chips in the main Jobs view toolbar and top header:
     - `Kalibrr: [AUTH | LOGIN REQ | WINDOW OPEN]`
     - `Glints: [AUTH | LOGIN REQ | WINDOW OPEN]`
     - `Jobstreet: [AUTH | LOGIN REQ | WINDOW OPEN]`
   - Clicking a chip opens the Websites tab or directly launches the Brave browser profile window for instant login.
2. **Websites View Refinement**:
   - Display last verified timestamp, cookie profile path, and live verification button per portal.

### D. Company Information Gathering Transparency on Detail Rows
1. **Company Enrichment Status Gauge**:
   - Calculate enrichment score based on populated fields: Overview, Website, HQ, Leaders, HR Contacts, Industry, Size.
2. **Expanded Detail Drawer / Sub-row**:
   - Full attribute breakdown:
     - Overview summary
     - Website link with HTTP status verification indicator
     - Leadership list (`leaders`)
     - HR / Recruiting contacts (`hr_contacts`)
     - Total jobs crawled vs applied
     - "Re-enrich Company Info" button to trigger targeted metadata gathering.

### E. Dedicated "Errors" Navigation Tab
1. **Navigation Menu**:
   - Add `<button class="nav-item" data-view="errors">` to top nav with live unread badge (`<span id="errorCountBadge">...</span>`).
2. **Errors View Layout**:
   - Left-aligned toolbar: Category filter (All, Browser & CDP, Authentication, Crawling, Submissions), Severity filter, Search, "Clear Resolved" button.
   - Data table: Timestamp, Category, Severity, Component, Message, Actions ("View Details", "Resolve").
   - Diagnostic Modal: Formatted stack trace, context payload, and copy button.

---

## 3. Task Breakdown with Status Checkboxes

- [x] **Task 1: System Error Logging Subsystem (Backend & Schema)**
  - [x] Add `system_errors` table and indexes in `web/src/storage/db.ts`.
  - [x] Implement `logSystemError`, `getSystemErrors`, `resolveSystemError`, `clearResolvedErrors` in `web/src/storage/errorLogger.ts`.
  - [x] Add REST endpoints in `web/src/server.ts` (`GET /api/errors`, `POST /api/errors/:id/resolve`, `POST /api/errors/clear-resolved`, `POST /api/errors/test`).
  - [x] Instrument `browserRunner.ts`, `portalSubmitter.ts`, and `server.ts` to log all CDP, browser launch, and submission failures to `system_errors`.

- [x] **Task 2: Job Submission Roadblock Diagnostics**
  - [x] Update `jobs_ledger` with `last_error` and `roadblock_url` fields or parse structured error payloads from `histories`.
  - [x] In `kalibrrDriver.ts` and `portalSubmitter.ts`, store structured roadblock metadata (roadblock type, URL, screenshot path, message) on failure.
  - [x] Update Job Dossier Modal Tab 5 in `web/public/app.js` with structured diagnostic roadblock view, screenshot display, and manual/browser action buttons.
  - [x] Add error snippet indicator to Jobs table rows for `FAILED` and `SUBMITTED (NOT VERIFY-ABLE)` records.

- [x] **Task 3: Live Portal Authentication Transparency**
  - [x] Expose `/api/session-auth/summary` and `/api/websites/session-status` returning portal statuses in a single lightweight payload.
  - [x] Add persistent authentication status indicators in the Jobs view toolbar in `web/public/index.html` and `web/public/app.js`.
  - [x] Enhance Websites view with one-click profile launcher and real-time status refresh.

- [x] **Task 4: Company Detail Row Information Gathering Transparency**
  - [x] Update `GET /api/companies` to return completeness metrics and verification indicators.
  - [x] Enhance Companies table rows and detail modals in `web/public/app.js` to show exact gathered fields vs missing fields, leadership, HR contacts, and website HTTP status.
  - [x] Add single-company enrichment action trigger.

- [x] **Task 5: Dedicated "Errors" Tab & UI View**
  - [x] Add `Errors` button with live unread count badge to top nav in `web/public/index.html`.
  - [x] Build Errors view container with filters, search, and monochrome table in `web/public/index.html`.
  - [x] Implement `renderErrorsView()`, detail inspection modal, and resolve actions in `web/public/app.js`.

- [x] **Task 6: Verification & End-to-End Testing**
  - [x] Type check with `bunx tsc --noEmit` (0 errors).
  - [x] Verify `POST /api/errors` and `GET /api/errors` with curl.
  - [x] Trigger simulated error and confirm it appears in the Errors view with badge.
  - [x] Verify Job #56 shows the Kalibrr exam roadblock clearly in Dossier Tab 5.
  - [x] Confirm company detail rows render all gathered information.

---

## 4. Dependencies & Inter-Task Blockers
- **Pre-Execution Approval**: Blocked on explicit user approval before touching code.
- **Portability**: All CDP and browser launches must respect the Windows host CDP proxy (`9223` / `9222`) and permanent profile directory.

---

## 5. Verification Protocol
1. `bunx tsc --noEmit` -> 0 compilation errors.
2. `curl -s http://localhost:3100/api/errors` -> returns structured JSON error array.
3. Open `http://localhost:3100/` in browser:
   - Verify Errors tab exists with unread count.
   - Verify Job #56 modal shows the exact Kalibrr Exam 228 roadblock and screenshot.
   - Verify Portal Auth status bar displays Kalibrr, Glints, and Jobstreet.
   - Verify Company detail view displays gathered attributes and completeness score.
