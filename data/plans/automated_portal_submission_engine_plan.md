# Plan: Live Automated Portal Submission Engine

## 1. Goal & Scope
Implement an autonomous, production-grade job portal submission engine to replace the existing database mock stub in `web/src/server.ts` (`/api/jobs/:id/submit` and `/api/jobs/batch-submit`):
1. **Dedicated Automator Browser Lifecycle**:
   - Operate strictly and exclusively within the project's dedicated browser profile (`C:/Users/Makutu/.job_apply_automator/browser_profile` on Windows, or `./data/browser_profile` on Linux), resolved via `scripts/auth.ts:getProfilePaths()`.
   - Never touch, lock, inspect, or kill the user's personal desktop browser instances (`AppData/Local/...`).
   - Spawn on-demand ephemeral browser instances with remote debugging (CDP on port 9222) and enforce guaranteed PID-filtered teardown in `finally` blocks so zero orphan processes remain.
2. **Platform Driver Architecture (Kalibrr First)**:
   - Provide an extensible `PortalDriver` interface supporting multi-platform expansion (Kalibrr, Glints, Jobstreet).
   - Implement `KalibrrDriver` to autonomously execute the end-to-end application funnel:
     - Navigate to `job.job_url`.
     - Verify active session authentication; if unauthenticated, abort cleanly with `SESSION_EXPIRED` without corrupting state.
     - Trigger the application modal ("Lamar Sekarang").
     - Inject tailored screening answers into form fields (textareas, selects, radio buttons) grounded strictly in `data/candidateProfile.json`.
     - Attach the generated tailored resume PDF.
     - Submit the application and verify live confirmation.
3. **Auditable External Receipts & State Transition**:
   - Capture high-resolution visual evidence (modal opened, form filled, confirmation screen).
   - Record confirmation URL, external timestamp, and screenshot paths in `jobs_ledger` and `job_status_history` before transitioning to `APPLIED`.
   - On submission failure, transition to `FAILED` with detailed diagnostic error notes.

---

## 2. Technical Design

### A. Submission Engine Architecture (`web/src/submission/`)
```
web/src/submission/
├── types.ts                  # PortalDriver interface, SubmissionContext, SubmissionReceipt
├── browserRunner.ts          # Ephemeral CDP browser launcher & scoped PID teardown
├── portalSubmitter.ts        # Orchestrator: document generation -> driver dispatch -> ledger update
└── drivers/
    └── kalibrrDriver.ts      # Kalibrr-specific DOM actions, selectors, and assertions
```

#### 1. Core Interfaces (`web/src/submission/types.ts`)
```ts
export interface SubmissionReceipt {
  success: boolean
  confirmationUrl: string
  confirmationText: string
  screenshotPaths: {
    modalOpened?: string
    formFilled?: string
    confirmed: string
  }
  submittedAt: string
  error?: string
}

export interface PortalDriver {
  portalId: string
  canHandle(url: string, portalName: string): boolean
  verifyAuthentication(page: any): Promise<boolean>
  submit(context: SubmissionContext): Promise<SubmissionReceipt>
}
```

#### 2. Isolated Browser Lifecycle (`web/src/submission/browserRunner.ts`)
- Spawns browser pointing to `resolveProfileDir(isWindows)` from `scripts/auth.ts`.
- Parameters: `--user-data-dir=${profileDir}`, `--remote-debugging-port=9222`, `--remote-debugging-address=0.0.0.0`, `--remote-allow-origins=*`.
- Connects via `puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' })` (with fallback to WSL gateway `172.25.192.1`).
- Teardown safety:
  - Closes Puppeteer target pages and disconnects CDP.
  - Terminates strictly only processes matching `*job_apply_automator*` via PowerShell CIM filtering:
    `Get-CimInstance Win32_Process -Filter "name = 'brave.exe' or name = 'chrome.exe'" | Where-Object { $_.CommandLine -like '*job_apply_automator*' } | Stop-Process -Force`
  - Guarantees user's personal browser is never terminated.

#### 3. Kalibrr Driver Implementation (`web/src/submission/drivers/kalibrrDriver.ts`)
- **Step 1 (Auth Check)**: Inspect DOM for guest indicators (`Masuk`, `Daftar`, or login redirects). If unauthenticated, throw `PortalAuthenticationRequiredError`.
- **Step 2 (Trigger Apply)**: Query and click button matching `Lamar Sekarang` or `Apply Now`.
- **Step 3 (Document Attachment)**: Ensure tailored PDF resume exists in automator directory and upload via `input[type="file"]`.
- **Step 4 (Screening Questions & Form Filling)**:
  - Query visible `textarea`, `input[type="text"]`, and `select` elements.
  - Map form labels/placeholders against `job.candidate_answers` and `data/candidateProfile.json`.
  - Dispatch simulated `input`, `change`, and `blur` events for React/Vue reactive state synchronization.
- **Step 5 (Submission & Receipt Capture)**:
  - Click submit button (`Kirim Lamaran` / `Submit Application`).
  - Wait for success modal, confirmation toast, or redirect to submitted state.
  - Save screenshots to `data/screenshots/submissions/job_${job.id}_confirmed.png`.

#### 4. Server Route Refactoring (`web/src/server.ts`)
- In `POST /api/jobs/:id/submit`:
  1. Verify job is `APPROVED` or `FAILED`.
  2. Transition to `APPLYING` (`updateJobStatus(job.id, 'APPLYING', ..., true)`).
  3. Generate tailored resume & cover letter.
  4. Call `portalSubmitter.executeSubmission(job)`.
  5. On success: Transition to `APPLIED` with receipt metadata and visual confirmation paths.
  6. On error: Transition to `FAILED` with exact failure message in history.
- In `POST /api/jobs/batch-submit`:
  - Run sequentially through `portalSubmitter.executeSubmission()` with cooldown intervals (5-10s) to avoid portal rate limiting.

---

## 3. Task Breakdown with Status Checkboxes

- [x] **Task 1: Submission Engine Core & Types**
  - Created `web/src/submission/types.ts` defining contracts for drivers, receipts, and submission contexts.
  - Created `web/src/submission/browserRunner.ts` with isolated automator browser launch, CDP connection, and strict PID-scoped teardown.
  - Created `web/src/submission/driverRegistry.ts` for multi-portal extensible driver lookup and listing.
- [x] **Task 2: Kalibrr Portal Driver Implementation**
  - Created `web/src/submission/drivers/kalibrrDriver.ts` implementing authentication verification, apply modal trigger, dynamic screening question injection, resume upload, and confirmation detection.
  - Implemented multi-step wizard detection and submission confirmation receipt capture.
- [x] **Task 3: Server API Integration & Orchestrator**
  - Created `web/src/submission/portalSubmitter.ts` orchestrating document generation, driver selection, screenshot persistence, and database audit updates.
  - Refactored `POST /api/jobs/:id/submit` and `POST /api/jobs/batch-submit` in `web/src/server.ts` to execute live submissions.
  - Added `GET /api/jobs/:id/receipt-screenshot` and `GET /api/submission/drivers` endpoints.
- [x] **Task 4: UI Receipt Viewer & Visual Status Evidence**
  - Updated Web Console modal/details views (`web/public/app.js`) to display live submission confirmation screenshots and external receipts for `APPLIED` jobs via Tab 5 ("Submission Proof").
- [x] **Task 5: End-to-End Verification & Browser Cleanliness Audit**
  - Verified static TypeScript compilation (`bunx tsc --noEmit`) with zero errors.
  - Verified zero lingering background processes or browser instances.

---

## 4. Dependencies & Inter-Task Blockers
- **Portal Authentication**: Requires active login session in `C:/Users/Makutu/.job_apply_automator/browser_profile` (can be launched and authenticated via `bun run scripts/auth.ts kalibrr`).
- **Profile Independence**: Must strictly operate on automator's isolated profile without touching user's personal browser data.

---

## 5. Verification Protocol
1. **Static Build Check**:
   `bun run build` in web console to verify zero TypeScript compilation errors.
2. **Process Teardown Audit**:
   Verify via PowerShell that no lingering `*job_apply_automator*` processes remain after submission.
3. **Receipt Evidence**:
   Confirm generated screenshot exists in `data/screenshots/submissions/` and `jobs_ledger` contains verified confirmation timestamp and URL.
