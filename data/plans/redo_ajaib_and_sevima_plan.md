# Plan: Dynamic Browser Ingestion & Form Schema Discovery for Ajaib and SEVIMA

## Goal & Scope
- Purge all SEVIMA job listings (#60, #61), platform records, resumes, and screenshots from Cloudflare D1 (`amiya`), local SQLite, Cloudflare R2, and local disk.
- Crawl the 5 job postings via an interactive browser agent from scratch:
  1. `https://apply.workable.com/ajaib/j/17D23FFBAC/`
  2. `https://apply.workable.com/ajaib/j/2E1DBD4A14/`
  3. `https://apply.workable.com/ajaib/j/CD94A01357/`
  4. `https://careers.sevima.com/jobs/sevima-future-talent-software-engineer-q3-2027`
  5. `https://careers.sevima.com/jobs/software-engineer`
- Dynamically navigate into each platform's application flow using the browser session to discover and extract the live application form schema without hardcoded field assumptions.
- Commit all discovered records to `jobs_ledger` strictly with status `PENDING_HUMAN`. Zero autonomous submissions.

---

## Technical Design & Dynamic Architecture

### 1. Data Purge Protocol
- **Cloudflare D1 (`cf d1 execute amiya`) & Local SQLite**:
  - Delete existing SEVIMA jobs and company records.
- **Cloudflare R2 & Local Storage**:
  - Remove SEVIMA-related resumes and screenshots.

### 2. Autonomous Dynamic Application Form Discovery (Dimension 5 & 8)
- Launch ephemeral headless browser session.
- For each target URL:
  1. **Page Traversal & Specification Extraction**:
     - Extract verbatim job specifications directly from the active DOM (title, department, location, compensation, responsibilities, requirements, benefits).
  2. **Dynamic Application Flow Navigation**:
     - Discover and trigger the portal's application entry point (e.g., clicking application triggers, buttons, or navigating to application routes).
     - Handle multi-step or wizard progression if present.
  3. **Generic DOM Form Control Auditing**:
     - Dynamically inspect all `<input>`, `<select>`, `<textarea>`, and upload dropzones in the rendered DOM.
     - Extract metadata for every element:
       - Control type (`text`, `email`, `tel`, `file`, `select`, `checkbox`, `radio`).
       - Constraints (`required`, `accept`, `maxlength`, size limits).
       - Contextual labels, placeholders, and employer screening prompts.
  4. **Dynamic Schema Registration**:
     - Store the complete audited form schema into `jobs_ledger` (serialized in `form_schema` / metadata) exactly as parsed from the live page.

### 3. Dynamic Prerequisite Evaluation & Ledger Commit
- Dynamically diff the discovered required form fields against available candidate data and assets:
  - Any required field or file input not satisfied by candidate storage is dynamically tagged as missing.
- Generate tailored ATS resumes strictly grounded in `data/candidateProfile.json`.
- Commit records to SQLite and Cloudflare D1 with status `PENDING_HUMAN`.

### 4. Console Verification
- Verify that the Web Console displays all 5 jobs in the Review tab.
- Verify that the Form Fill Preview dynamically renders the exact fields discovered by the browser agent for each platform, reflecting whatever prerequisites were identified live.

---

## Task Breakdown

- [x] **Task 1: SEVIMA Data Purge**
  - Remove all SEVIMA listings from D1, SQLite, R2, and local disk.

- [x] **Task 2: Dynamic Browser Ingestion & Form Discovery Script**
  - Implement dynamic browser script to traverse each URL, navigate into the application form, and parse all live form controls and constraints.
  - Run dynamic crawl across all 5 job postings.

- [x] **Task 3: Ledger Population & Document Generation**
  - Insert crawled records with live form schemas into `jobs_ledger` under `PENDING_HUMAN`.
  - Generate tailored ATS resumes for the listings.

- [x] **Task 4: Web Console Inspection & Visual Proof**
  - Verify dynamic form schemas render accurately in the Web Console.
  - Capture visual screenshot evidence of the unsubmitted listings in Review.
