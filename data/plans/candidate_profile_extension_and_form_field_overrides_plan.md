# Plan: Candidate Profile Extension and Interactive Form Field Overrides

## Goal & Scope
Resolve the issue where dynamically discovered form fields display as `[NOT SPECIFIED IN CANDIDATE PROFILE]` with no interface or mechanism for the user to specify or persist their values. This plan introduces:
1. Standard fields in `data/candidateProfile.json` for city, postal code, previous compensation, and professional references.
2. Interactive inline editing and field override capabilities directly inside the Web Console Form Fill Preview modal.
3. Persistent storage of per-job field overrides in `jobs_ledger.candidate_answers` with local SQLite and Cloudflare D1 synchronization.

---

## Technical Design

### 1. Candidate Profile Master Extension (`data/candidateProfile.json`)
Add global profile attributes to eliminate recurring unspecified fields across all applications:
- `personal.city`: `"Kota Banjarmasin"`
- `personal.postalCode`: `"70123"`
- `personal.previousSalary`: previous compensation amount or net salary
- `references`: array of professional references (e.g. former lead/manager at previous companies with `name`, `role`, `company`, `contact`).

### 2. Form Preview Generator Integration (`web/src/generator/formPreview.ts`)
- In `renderDynamicFormSchema`:
  - Check for per-job overrides first from `job.candidate_answers`. If an override exists for `f.key`, use it with source `'user_override'`.
  - Fall back to mapping global profile attributes:
    - `city` -> `p.city || p.location`
    - `postcode` / `postal_code` -> `p.postalCode`
    - `salary_before` -> `p.previousSalary`
    - `reference_name`, `reference_contact`, `reference_role`, `reference_company` -> `candidateProfile.references[0]`
  - Only output `[NOT SPECIFIED IN CANDIDATE PROFILE]` if neither an override nor a profile value exists.

### 3. Server Endpoint for Field Overrides (`web/src/server.ts`)
- Endpoint: `POST /api/jobs/:uuid/form-field`
- Payload: `{ key: string, value: string }`
- Logic:
  1. Retrieve current job by `uuid`.
  2. Parse existing `candidate_answers` (handling both JSON `{ answers: [], overrides: {} }` and legacy semicolon-separated strings).
  3. Store `overrides[key] = value`.
  4. Persist updated JSON string to local SQLite `jobs_ledger` and execute Cloudflare D1 update on database `amiya`.
  5. Return `{ success: true, key, value }`.

### 4. Interactive Web Console UI (`web/public/app.js`)
- In `loadFormFillPreview`:
  - For each field, render an interactive inline override interface:
    - If a field is `[NOT SPECIFIED IN CANDIDATE PROFILE]` or empty:
      Render an input field with a placeholder and a high-contrast Zinc monochrome "Save" button.
    - If a field is populated:
      Render the value along with a subtle "Edit" button that toggles an inline input.
  - On clicking "Save" (or pressing Enter), execute `fetch('/api/jobs/' + uuid + '/form-field', ...)`, update the UI immediately, and mark the status as resolved.

---

## Task Breakdown with Status Checkboxes

- [ ] **Task 1: Extend `data/candidateProfile.json` with Standard Missing Attributes**
  - Add `city`, `postalCode`, `previousSalary`, and `references` structure.
- [ ] **Task 2: Implement Backend Override API in `web/src/server.ts`**
  - Add `POST /api/jobs/:uuid/form-field` with SQLite and Cloudflare D1 persistence.
- [ ] **Task 3: Connect Field Overrides in `web/src/generator/formPreview.ts`**
  - Parse `candidate_answers.overrides` and map profile additions to dynamic form schemas.
- [ ] **Task 4: Implement Interactive Inline Editing in `web/public/app.js`**
  - Replace read-only text with interactive inputs and Save/Edit actions for missing and editable fields.
- [ ] **Task 5: Verification & End-to-End Testing**
  - Run `bunx tsc --noEmit`.
  - Verify inline field editing on SEVIMA (job #76/77) and Ajaib (job #73/74/75) forms.
  - Verify Cloudflare D1 synchronization.
  - Run `graphify extract .`.

---

## Verification Protocol
1. Type check: `bunx tsc --noEmit` returns zero errors.
2. Web Console Verification: Open SEVIMA Form Fill Preview on `http://localhost:3100`, specify `salary_before` and reference fields via the inline UI, confirm values persist on page reload.
3. Cloudflare D1 Verification: `cf d1 query amiya --command "SELECT candidate_answers FROM jobs_ledger WHERE id = 76"` confirms JSON overrides are saved in production ledger.
