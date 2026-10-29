# Plan: Complete Ledger Reset and Live Forward-Order Crawl Pipeline

## 1. Goal & Scope
Purge all existing records from `jobs_ledger` and `daily_runs` in `data/amiya.db` to remove any previously patched or retrofitted data. Execute an automated, live forward-order crawl pipeline adhering strictly to Dimension 5 of `.agent/rules/cross_verification_standards.md`:
1. **Live Portal Navigation**: Connect to headless browser session and navigate directly to active job boards (Kalibrr Golang/Backend listings).
2. **Search Card Ingestion**: Parse active search result card elements from the live DOM matching the criteria (role: Golang/Backend, location: Indonesia, age: <= 7 days where specified).
3. **Card-by-Card Navigation**: Navigate the browser into each card's target page, capturing `window.location.href` directly from the live session and extracting the complete verbatim specifications.
4. **Factual Screening Q&A**: Invoke AGY CLI agent to generate screening answers strictly grounded in `data/candidateProfile.json`.
5. **Ledger Ingestion & Verification**: Insert records into `jobs_ledger` (capped at 3 jobs for pilot evaluation), update `companies` master, and verify via Puppeteer screenshots.

---

## 2. Technical Steps

- [x] **Task 1: Rule Invariant Hardening**
  - [x] Add Dimension 5 (Strict Forward-Order Crawl Invariant) to `.agent/rules/cross_verification_standards.md`.
  - [x] Update `.agent/rules/security_and_testing.md` to reference the 5-point checklist.

- [x] **Task 2: Database Purge**
  - [x] Delete all rows from `jobs_ledger` and `daily_runs` in `data/amiya.db`.
  - [x] Synchronize `companies` table to reflect 0 jobs / 0 applications.

- [x] **Task 3: Automated Forward-Order Crawl Execution**
  - [x] Run live forward crawl script connecting to Chrome CDP on port 9222.
  - [x] Extract active listing cards and navigate directly into qualifying roles.
  - [x] Capture live `window.location.href`, exact title, employer, and full verbatim DOM text.
  - [x] Ground screening answers in `data/candidateProfile.json` with strict Feedloop collaborative team-based triage / Bythen data warehouse rules.
  - [x] Insert records into `jobs_ledger` with status `PENDING_HUMAN`.

- [x] **Task 4: Five-Point Cross-Verification & Evidence Capture**
  - [x] Execute `scratch/run_cross_verification_audit.ts` to ensure all 5 dimensions pass (43/43 passed).
  - [x] Capture Web Console screenshots (`/tmp/forward_crawl_triage.png`, `/tmp/forward_crawl_modal_spec.png`, `/tmp/forward_crawl_modal_qna.png`, `/tmp/forward_crawl_companies.png`).
  - [x] Synchronize graphify (`graphify extract .`) and run `cargo check`.
