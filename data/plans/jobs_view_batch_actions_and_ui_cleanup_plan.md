# Plan: Jobs View Restructuring, Batch Actions, UI Redundancy Elimination, and Company Intelligence Dossier

## 1. Goal & Scope
Implement six targeted UI, workflow, database, and UX refinements to the Web Console:
1. **Rename Job Triage to Jobs**: Update sidebar nav, topbar titles, and view references from "Job Triage" to "Jobs".
2. **Batch Actions & Workflow Separation (Review vs Pending Jobs)**:
   - Separate job lifecycle into discrete tabs: **Review** (for newly discovered jobs awaiting human approval) and **Pending Jobs** (for approved jobs awaiting application execution).
   - Enforce the approval gate: jobs in **Review** must be approved first and cannot directly run/submit.
   - In **Pending Jobs**, the sole primary action is "Run & Submit Application".
   - Add checklist checkboxes per row and header, with a floating batch action toolbar ("Approve Selected" in Review tab; "Run & Submit Selected" in Pending tab).
3. **Company Intelligence Dossier (Replacing Metrics & Postings in Jobs Modal)**:
   - Redesign the Company Dossier opened from the Jobs view.
   - Remove "Application Metrics & Cooldown Governance" and "Associated Job Postings" (these remain in the Companies menu).
   - Display real, crawled corporate intelligence:
     - **Official Website**: Clickable direct link.
     - **Headquarters Location**: Exact office building and address.
     - **Business Operations & Products**: Authentic in-depth description of what the company does and produces.
     - **Executive Leadership**: CEO, CTO, and Directors (with roles).
     - **HR & Talent Acquisition**: Head of HR, People Operations, and Talent Acquisition leads (with LinkedIn links/contacts).
   - Seed and persist this authentic crawled data into `data/amiya.db` (`companies` and `jobs_ledger`) for Kredivo Group, AMARTEK, and Astro Technologies Indonesia.
4. **Remove Predefined Categories Filter**: Eliminate the predefined category button bar in Decision Criteria, as criteria categories are free-text user inputs. Use free-text search exclusively.
5. **Eliminate Redundant In-Card Panel Headers**: Remove duplicate `.panel-header` blocks in Websites and Companies views that echo the universal topbar.
6. **Remove Meaningless Footer Explanations**: Remove the static explanatory text from view footers (`Single Action button triggers popover...`).

---

## 2. Technical Design

### A. Lifecycle State Transitions (`web/src/storage/db.ts` & `web/src/server.ts`)
- **Strict Approval Gate**:
  - Update `ALLOWED_TRANSITIONS['PENDING_HUMAN'] = ['APPROVED', 'DROPPED']`.
  - Remove direct transition to `APPLYING` from `PENDING_HUMAN`.
  - `POST /api/jobs/:id/submit` strictly rejects jobs that are not `APPROVED` or `FAILED`.
- **Batch API Endpoints**:
  - `POST /api/jobs/batch-status`: Accepts `{ jobIds: string[], status: string, note?: string }` to bulk update statuses.
  - `POST /api/jobs/batch-submit`: Accepts `{ jobIds: string[] }` to bulk execute application submissions on approved jobs.

### B. Tab-Based UI & Batch Checklist (`web/public/index.html`, `web/public/app.js`, `web/public/style.css`)
- **Jobs Tabs**:
  - `Review (<count>)`: Statuses `PENDING_HUMAN`, `CRAWLED`, `SKIPPED`. Actions: Approve, Drop.
  - `Pending Jobs (<count>)`: Statuses `APPROVED`, `FAILED`. Action: "Run & Submit Application".
  - `Submitted (<count>)`: Statuses `APPLIED`, `APPLYING`, `INTERVIEW`, `OFFER`.
  - `Filtered (<count>)`: Statuses `DROPPED`, `REJECTED`.
  - `All (<count>)`: Complete unfiltered ledger.
- **Checklist & Sticky Positioning**:
  - Add sticky checkbox column at `left: 0` (44px width).
  - Offset sticky company column to `left: 44px`.
  - Header checkbox toggles all visible rows in the current tab.
- **Batch Action Toolbar**:
  - Appears docked when `>= 1` item is selected.
  - Adapts buttons dynamically to the active tab:
    - In Review tab: `[✓ Approve Selected]`, `[✕ Drop Selected]`, `[Deselect All]`.
    - In Pending Jobs tab: `[▶ Run & Submit Selected]`, `[✕ Drop Selected]`, `[Deselect All]`.

### C. Company Intelligence Dossier (`web/src/storage/db.ts`, `web/public/app.js`)
- Schema additions to `companies` table:
  - `website`: TEXT (official website URL)
  - `headquarters`: TEXT (detailed building/office address)
  - `leaders`: TEXT (JSON array of `{ role, name, linkedin_url }`)
  - `hr_contacts`: TEXT (JSON array of `{ role, name, linkedin_url, email }`)
  - `products_summary`: TEXT (in-depth description of business operations and products)
- Crawled Data to Populate:
  - **Kredivo Group**:
    - Website: `https://kredivocorp.com` (Consumer: `https://kredivo.id`)
    - Headquarters: Dipo Tower Level 3, Jl. Jend. Gatot Subroto Kav. 51-52, Petamburan, Tanah Abang, Jakarta Pusat 10260
    - Overview/Products: Southeast Asia fintech scale-up providing digital credit cards, BNPL, personal installment loans (Kredivo), and neobanking (Krom Bank).
    - Leaders: Akshay Garg (Group CEO & Co-Founder), Chao Gao (CTO, Kredivo), Umang Rustagi (Deputy CEO).
    - HR Contacts: Jean Lua (Chief HR Officer).
  - **PT Bumi Amartha Teknologi Mandiri (AMARTEK)**:
    - Website: `https://www.amartek.id`
    - Headquarters: Chase Plaza 9th Floor, Jl. Jend. Sudirman Kav. 21, Karet, Setiabudi, Jakarta Selatan 12920
    - Overview/Products: Enterprise IT solutions, custom software engineering, cloud systems integration, and IT talent solutions for banking, insurance, and telecommunications.
    - Leaders: Ervin Chang (President Director / CEO), Hetty Susiyanti (Director), Kuniarwan Suyono (Director).
    - HR Contacts: Mega Ratna (Talent Acquisition Lead), `talent@amartek.id`.
  - **Astro Technologies Indonesia (Astro)**:
    - Website: `https://www.astronauts.id`
    - Headquarters: Graha Antero Lt. 5-6, Jl. Tomang Raya No. 27, Tomang, Grogol Petamburan, Jakarta Barat 11440
    - Overview/Products: On-demand quick-commerce platform delivering groceries, fresh produce, and essentials within 15 minutes across Greater Jakarta through micro-fulfillment hubs.
    - Leaders: Vincent Tjendra (Co-Founder & CEO, Ex-AVP Tokopedia), Jessica Stephanie Jap (Co-Founder & COO), Wandi Budianto (Co-Founder).
    - HR Contacts: Wanda Irawan Anwarsyah (Lead People Growth & Experience), Talent Acquisition Team.
- Modal Rendering:
  - When opened from Jobs table (`openCompanyModal`): renders pure Company Intelligence (Website link, Headquarters, Overview/Products, Executive Leadership cards, HR & Talent Acquisition cards).
  - Metrics and Job Postings remain exclusively in the Companies section (`openCompanyDetailModalFromCompanies`).

### D. Redundancy & Clutter Removal
- Remove `.criteria-category-bar` in `viewCriteria`.
- Remove `.panel-header` in `viewWebsites` and `viewCompanies`.
- Remove `.footer-hint` explanations across table footers.

---

## 3. Task Breakdown

- [x] **Task 1: Database Schema Expansion & Crawled Company Intelligence Ingestion**
  - [x] Add `website`, `headquarters`, `leaders`, `hr_contacts`, `products_summary` columns to `companies` table in `web/src/storage/db.ts`.
  - [x] Update `jobs_ledger.company_overview` with rich crawled business and product summaries.
  - [x] Ingest verified leadership, HR, website, and headquarters data for Kredivo Group, AMARTEK, and Astro.

- [x] **Task 2: Backend Transition Enforcement & Batch Endpoints**
  - [x] Update `ALLOWED_TRANSITIONS` in `web/src/storage/db.ts` to enforce `PENDING_HUMAN -> APPROVED`.
  - [x] Enforce status checks in `/api/jobs/:id/submit` (reject unapproved jobs).
  - [x] Add `POST /api/jobs/batch-status` and `POST /api/jobs/batch-submit` routes in `web/src/server.ts`.

- [x] **Task 3: Jobs Navigation & Tab Restructuring**
  - [x] Rename "Job Triage" to "Jobs" in sidebar, topbar, and view switchers.
  - [x] Replace old filter buttons with discrete lifecycle tabs: `Review`, `Pending Jobs`, `Submitted`, `Filtered`, `All`.
  - [x] Update tab counts and filtering logic in `web/public/app.js`.

- [x] **Task 4: Checklist Column & Batch Action Toolbar**
  - [x] Add sticky checkbox column to `#jobsTable` (header select-all + row checkboxes).
  - [x] Implement selection state management and selection counter in `web/public/app.js`.
  - [x] Build floating/docked batch action toolbar in `web/public/index.html` and style in `web/public/style.css`.
  - [x] Wire batch action handlers to call `/api/jobs/batch-status` and `/api/jobs/batch-submit`.
  - [x] Update row action popover: Review tab allows Approve/Drop only; Pending Jobs tab provides Run & Submit.

- [x] **Task 5: Company Intelligence Dossier Redesign in Jobs View**
  - [x] Update `openCompanyModal` in `web/public/app.js` to render the Company Intelligence layout (Website, Headquarters, Products/Business Model, Executive Leadership, HR/Recruiters).
  - [x] Remove Application Metrics and Associated Job Postings from the Jobs view company modal.

- [x] **Task 6: UI Redundancy & Explanation Cleanup**
  - [x] Remove `.criteria-category-bar` from `viewCriteria` in `web/public/index.html`.
  - [x] Remove `filterCriteriaCategory` logic from `web/public/app.js`.
  - [x] Remove duplicate `.panel-header` blocks from `viewWebsites` and `viewCompanies`.
  - [x] Remove `.footer-hint` from `viewJobs`, `viewCriteria`, and `viewSchedule`.

- [x] **Task 7: Five-Point Cross-Verification & Evidence Capture**
  - [x] Update and run `scratch/run_cross_verification_audit.ts` to verify all 5 dimensions pass.
  - [x] Capture Puppeteer screenshots of:
    - `/tmp/jobs_company_intelligence_modal.png`: Redesigned company modal with website, headquarters, leadership, and HR.
    - `/tmp/jobs_review_tab.png`: Review tab with checklist and Approve/Drop actions.
    - `/tmp/jobs_batch_action.png`: Batch toolbar visible when jobs are checked.
    - `/tmp/jobs_pending_tab.png`: Pending Jobs tab showing approved jobs with Run & Submit Application actions.
    - `/tmp/websites_clean.png`: Websites view confirming removal of duplicate header.
    - `/tmp/companies_clean.png`: Companies view confirming removal of duplicate header.
    - `/tmp/criteria_clean.png`: Decision Criteria confirming removal of predefined category tabs.
  - [x] Run `graphify extract .` and `cargo check --manifest-path cli/Cargo.toml`.

---

## 4. Verification Protocol
- **Commands**:
  - `bun run scratch/run_cross_verification_audit.ts`: Confirm 100% pass across state transitions, boundaries, persona, verbatim specs, and forward crawling.
  - `cargo check --manifest-path cli/Cargo.toml`: Confirm Rust CLI builds with zero errors.
  - `graphify extract .`: Extract updated AST knowledge graph.
- **Visual Evidence**:
  - `/tmp/jobs_review_tab.png`: Review tab with checklist and Approve/Drop actions.
  - `/tmp/jobs_batch_action.png`: Batch toolbar visible when jobs are checked.
  - `/tmp/jobs_pending_tab.png`: Pending Jobs tab showing approved jobs with Run & Submit Application actions.
  - `/tmp/websites_clean.png`: Websites view confirming removal of duplicate header.
  - `/tmp/companies_clean.png`: Companies view confirming removal of duplicate header.
  - `/tmp/criteria_clean.png`: Decision Criteria confirming removal of predefined category tabs.
