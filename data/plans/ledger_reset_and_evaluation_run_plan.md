# Plan: Ledger Reset, Crawl Evaluation Run (3 Jobs Limit) & AGY Synthesis Verification

## 1. Goal & Scope
Purge legacy/stale records from `jobs_ledger` and `daily_runs` in `data/amiya.db` to eliminate outdated heuristic outputs and uncalibrated profile artifacts. Execute a controlled pilot run restricted strictly to **3 jobs** to re-evaluate:
1. **Criteria Compliance**: Enforcement of all 14 active criteria, including the 7-day job posting freshness ceiling (`max_posting_age_days <= 7`).
2. **AGY Subagent Reasoning**: Context-adaptive screening Q&A synthesis using the corrected candidate story bank (device integration without reverse-engineering, Feedloop legal AI document analysis, Bythen infrastructure triage, Single, Unemployed, GPA 3.48, Contract >= 3 months).
3. **ATS Document Tailoring**: Generation of tailored Open Sans resumes and cover letters adhering strictly to `.agent/rules/ats_document_standards.md`.
4. **Web Console Inspection**: Presentation of the 3 evaluated jobs in the newly redesigned Dark Shadcn console for candidate review.

---

## 2. Technical Design & Flow

### 2.1 Database Reset Protocol
- Execute atomic transaction in SQLite `data/amiya.db`:
  - `DELETE FROM jobs_ledger;` (resets sequence or clears table).
  - `DELETE FROM daily_runs;` (clears old crawl runs).
  - Preserve `personalization_rules` (14 active criteria).
  - Preserve `websites_master` (5 portal directory configurations).
  - Preserve `companies` (employer tracking table).
- Set `max_daily_applications = 3` in `daily_scheduler_settings`.

### 2.2 AGY Prompt & Story Bank Calibration
- Ensure `web/src/agent/cliAgent.ts` injects the verified context from `candidate_profile_master.md`:
  - Story 1 (Infrastructure & Triage): Kubernetes monitoring, database migration, triage at Bythen AI.
  - Story 2 (Integrated AI & Law): Feedloop AI law document analyzer (cross-referencing legal conflicts, deep analysis).
  - Story 3 (Device Integration): Aggregating mini-devices into unified monitoring without claiming reverse-engineering.
  - Candidate Persona: Single, Unemployed, GPA 3.48 (S1 ULM), Contract >= 3 months, No Internships.

### 2.3 Evaluation Run (3 Jobs Ingestion)
- Connect to active browser instance via CDP on port `9222`.
- Ingest 3 recent job postings published within <= 7 days matching target software/data engineering roles.
- Run AGY CLI agent (`gemini-3.8-flash-high`) on each job:
  1. Extract structured specifications & tech stack.
  2. Synthesize candidate screening Q&A answers.
  3. Compile tailored ATS resume and cover letter via `resumeBuilder.ts`.
- Save records with status `pending_human` (or `CRAWLED` / `KEEP`) to allow manual evaluation before any live submission.

---

## 3. Task Breakdown with Status Checkboxes

- [x] **Task 1: Ledger Reset & Quota Configuration**
  - [x] Clear stale records from `jobs_ledger` and `daily_runs` in `data/amiya.db`.
  - [x] Update `max_daily_applications = 3` in `daily_scheduler_settings`.

- [x] **Task 2: Calibrate AGY Q&A Prompt with Corrected Story Bank**
  - [x] Update `web/src/agent/cliAgent.ts` with exact candidate stories (triage/migration, legal AI analysis, device integration without reverse-engineering).

- [x] **Task 3: Execute Ingestion & Evaluation Run (3 Jobs Limit)**
  - [x] Run crawl / exploration session restricted to 3 qualifying job openings (published within <= 7 days).
  - [x] Invoke AGY CLI agent to extract specs and generate tailored screening answers.
  - [x] Generate tailored Open Sans resumes and cover letters in `output/resumes/`.

- [x] **Task 4: Verification & Presentation for User Review**
  - [x] Verify that exactly 3 jobs are staged in `data/amiya.db`.
  - [x] Capture Web Console screenshots (`view_jobs_eval_3.png`, modal details with Q&A and tailored resume).
  - [x] Present generated outputs, tailored documents, and synthesized Q&A to the user for re-evaluation.

- [x] **Task 5: Post-Evaluation Quality & Workflow Remediation**
  - [x] Unblock `PENDING_HUMAN` lifecycle in Action Popover (`web/public/app.js`, `web/src/storage/db.ts`, `web/src/server.ts`).
  - [x] Eliminate residual cooldown badges: enforce `applications_count > 0 && last_applied_at` gate in `renderCompaniesTable()` and prune stale companies.
  - [x] Calibrate candidate story bank in `cliAgent.ts`, `candidateProfile.json`, and `jobs_ledger`: candidate performed DB migrations and incident triage exclusively at Feedloop AI with the engineering team (never alone, never at Bythen AI).
  - [x] Replace synthetic job postings with active URLs and copy full verbatim job specifications (Overview, Responsibilities, Minimum Qualifications, Good to Have, Benefits) into `requirements_summary` and `full_description`.
  - [x] Visually verify fixes via Puppeteer screenshots (`/tmp/popover_pending_human.png`, `/tmp/modal_tab_specifications.png`, `/tmp/modal_tab_qna.png`, `/tmp/companies_table_eligible.png`, `/tmp/company_modal_kredivo.png`).

---

## 4. Verification Protocol
1. **Database Check**: `SELECT COUNT(*) FROM jobs_ledger;` must equal exactly 3.
2. **Criteria Check**: Each job must have `created_at` or posting date within 7 days, zero blacklisted tech, and valid target title.
3. **Story Bank Check**: Verify Q&A responses in `jobs_ledger.candidate_answers` contain zero "reverse-engineering" claims and reference validated project stories.
4. **Document Output Check**: Verify generated PDFs in `output/resumes/` use `Open Sans` and match ATS standard guidelines.
