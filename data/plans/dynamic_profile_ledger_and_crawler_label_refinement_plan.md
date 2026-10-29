# Plan: Dynamic Candidate Attributes Ledger & Crawler Label Refinement

## Goal & Scope
1. **Dynamic Candidate Attributes Ledger**: Replace static profile attributes with an extensible, database-backed Candidate Profile & Attributes table (`candidate_profile_attributes` in SQLite and Cloudflare D1 `amiya`). Any newly crawled field that cannot be mapped from existing candidate data is automatically registered as `NOT SPECIFIED` / `ACTION REQUIRED` in this ledger.
2. **Strict Gate Invariant**: Enforce a strict blocker on jobs: a job cannot be transitioned to `APPROVED` or submitted if any of its required application form fields are `NOT SPECIFIED`. The user must resolve them in the Profile table before proceeding.
3. **Crawler Label & Dossier Quality Overhaul**: Fix the crawler label extraction algorithm to eliminate raw garbage labels (`"SVGs not supported by this browser."`, `"MM/YYYY"`, `"Select an option…"`, obscure IDs like `"CA_55164"`), and enrich every field in the Job Dossier with clear human-readable labels, section hierarchy (`Education > Start Date`), and operational descriptions.

---

## Technical Design

### 1. Database Table: `candidate_profile_attributes`
Create and sync in local SQLite and Cloudflare D1 `amiya`:
```sql
CREATE TABLE IF NOT EXISTS candidate_profile_attributes (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL,          -- 'personal', 'contact', 'compensation', 'references', 'education', 'experience', 'custom'
  label TEXT NOT NULL,             -- Human-readable label (e.g. 'Previous Monthly Salary')
  description TEXT,                -- Contextual guidance (e.g. 'Last drawn net/gross monthly compensation')
  value TEXT,                      -- Current value (NULL = NOT SPECIFIED)
  status TEXT NOT NULL DEFAULT 'UNRESOLVED', -- 'RESOLVED' | 'UNRESOLVED'
  source_portal TEXT,              -- Portal where first discovered ('workable', 'sevima', 'profile')
  required_by_default INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```
- Seed initial standard attributes from `data/candidateProfile.json` (identity, contacts, education, experience, compensation, references).
- Whenever a crawler encounters an unmapped form field on any job portal, it automatically upserts into `candidate_profile_attributes` with `status = 'UNRESOLVED'`, `value = NULL`, and contextual label/description.

### 2. Crawler Label Resolution Overhaul (`scripts/dynamic_crawler.ts`)
- **SVG & Junk Scrubbing**: Clone elements and strip `<svg>`, `<desc>`, `<script>`, and `<style>` tags before reading text to eliminate `"SVGs not supported by this browser."`.
- **Hierarchical Label Matching**:
  1. `el.labels[0]` (native HTML property).
  2. `label[for="${el.id}"]`.
  3. `el.closest('label')`.
  4. `aria-labelledby` and `aria-label`.
  5. Form-field wrapper (`[data-ui*="field"]`, `[class*="field"]`, `fieldset`) checking `<label>`, `<legend>`, and `strong`.
- **Placeholder Rejection**: Explicitly reject placeholders that represent input formats or action prompts (`MM/YYYY`, `Select an option…`, `Choose file`, `Enter text…`).
- **Section Hierarchy Prefixing**:
  - Automatically detect parent section/sub-section headings (e.g. `Education`, `Experience`, `Personal Information`) and prefix ambiguous names (`Education > Start date`, `Experience > Start date`, `Experience > Summary`).
- **Hidden Input Deduplication**: Ignore hidden shadow/autocomplete inputs (`aria-hidden="true"`, `tabindex="-1"`) that duplicate interactive custom dropdowns (e.g. Workable's `CA_55164`).

### 3. Job Dossier & Form Preview Enrichment (`web/src/generator/formPreview.ts`)
- Every `FormFieldItem` will include:
  - `label`: Clean, capitalized label with section prefix (e.g. `Education: Start Date`, `Country / Work Authorization`).
  - `description`: Explanatory subtitle detailing what the field is for and how it is submitted.
  - `value`: Mapped value from `candidate_profile_attributes` or `[NOT SPECIFIED IN CANDIDATE PROFILE]`.
  - `status`: `'RESOLVED'` vs `'ACTION_REQUIRED'`.

### 4. Strict Submission & Approval Gating
- Backend gate in `web/src/server.ts` (`POST /api/jobs/:uuid/status`):
  - If target status is `APPROVED` or `SUBMITTED`, check all required fields in `job.form_schema`.
  - If any required field maps to an attribute that is `NULL`, `empty`, or `UNRESOLVED`, reject the transition with HTTP 400:
    `{ error: "PRECONDITION_FAILED", message: "Cannot proceed: X required field(s) are NOT SPECIFIED in Profile.", unresolvedFields: [...] }`.
- Web Console UI gate in `web/public/app.js`:
  - In Job Dossier / Form Fill Preview, if unresolved required fields exist, disable the "Approve Job" button, render a prominent monochrome warning banner, and provide a direct link to resolve the fields in the Profile table.

### 5. Profile Table Menu in Web Console (`web/public/index.html` & `app.js`)
- Add **Profile** to the main sidebar navigation.
- Render `#viewProfile` with a comprehensive, searchable, filterable table matching the Decision Criteria layout:
  - Columns: Category, Key, Label & Question Prompt, Operational Context / Description, Current Value (inline editable), Status (`RESOLVED` vs `ACTION REQUIRED`), Actions.
  - Filter tabs: All, Action Required (Unresolved), Personal, Compensation, References, Education, Custom Discovered.
  - Actions: "+ Add Attribute", inline click-to-edit values, and "Save" with real-time sync to Cloudflare D1 `amiya`.

---

## Task Breakdown with Status Checkboxes

- [x] **Task 1: Create `candidate_profile_attributes` Table & Seed Master Data**
  - Create table in SQLite and Cloudflare D1 `amiya`.
  - Seed baseline attributes from `data/candidateProfile.json`.
- [x] **Task 2: Overhaul Crawler Label Extraction in `scripts/dynamic_crawler.ts`**
  - Implement SVG stripping, placeholder rejection, section hierarchy enrichment, and custom question prompt extraction.
- [x] **Task 3: Implement Auto-Registration of Discovered Unmapped Fields**
  - When crawling any job, automatically register unmapped form fields into `candidate_profile_attributes`.
- [x] **Task 4: Enforce Approval Gate in `web/src/server.ts`**
  - Block transitions to `APPROVED` or `SUBMITTED` when required fields remain `UNRESOLVED`.
- [x] **Task 5: Refactor Form Preview Generator (`web/src/generator/formPreview.ts`)**
  - Read from `candidate_profile_attributes` and enrich fields with human-readable labels and descriptions.
- [x] **Task 6: Build Profile Table View in Web Console (`index.html` & `app.js`)**
  - Add Profile sidebar navigation item, `#viewProfile` table layout, inline editing, and filter tabs.
- [x] **Task 7: Re-Crawl Active Jobs (Ajaib, SEVIMA, ESCREDIA, Ashby) & Verify**
  - Re-crawl Ajaib (#86-#88), SEVIMA (#89-#90), ESCREDIA (#91-#92), and Ashby (#93) using the refined crawler.
  - Confirm zero garbage labels (`"SVGs not supported"`, `"MM/YYYY"`, `"Select an option..."`).
  - Confirm gating logic and Profile table inline resolution.
  - Run `bunx tsc --noEmit` and `graphify extract .`.

---

## Verification Protocol
1. Static Analysis: `bunx tsc --noEmit` returns zero errors.
2. Label Extraction Verification: Inspect re-crawled form schemas for Ajaib and SEVIMA to verify all labels are clean, descriptive, and have section hierarchy.
3. Gating Test: Attempt to approve a job with an unresolved required attribute via API/UI; confirm it is blocked with HTTP 400.
4. Resolution Test: Resolve the attribute in the Profile table; confirm the job is unblocked, the preview updates immediately, and D1 database `amiya` reflects the change.
