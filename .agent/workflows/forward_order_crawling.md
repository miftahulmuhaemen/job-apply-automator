---
name: forward_order_crawling
description: Sequential procedure for forward-order job discovery, page session navigation, and verbatim ingestion into the ledger.
---

# Workflow: Forward-Order Crawling Pipeline

This workflow governs the strictly sequential, forward-order ingestion pipeline. Retrospective synthesis or URL guessing is prohibited.

---

## Step 1: Portal Search Navigation
1. Launch or connect to browser CDP session (`web/src/browser/auth.ts`).
2. Navigate directly to target portal search interface (e.g. Kalibrr, Glints, Jobstreet).
3. Apply criteria filters:
   - Target Roles (e.g. Backend Engineer, Software Engineer, Full Stack Engineer).
   - Location (e.g. Indonesia, Remote).
   - Freshness threshold ($\le$ 7 days).

---

## Step 2: DOM Card Selection
1. Query active listing card elements directly from the search results DOM.
2. Filter out already-processed URLs by checking against Cloudflare D1 `jobs_ledger.job_url`.
3. Sequentially click into each active card element.

---

## Step 3: Session Verification
1. Capture `window.location.href` directly from the live browser page session.
2. Confirm the URL is active and verified (returns HTTP 200 without redirects to home/error pages).
3. Confirm session cookies are intact.

---

## Step 4: Semantic Accessibility Extraction
1. Extract page structure via the browser Accessibility Tree (`page.accessibility.snapshot()`).
2. Capture full raw specification sections verbatim:
   - Overview / About the Role
   - Key Responsibilities
   - Minimum Qualifications / Requirements
   - Preferred Qualifications / Nice-to-Have
   - Compensation & Perks
3. Never substitute raw employer specifications with lossy AI summaries during ingestion.

---

## Step 5: Two-Tier Application Form Inspection
1. Navigate to the job's application form (`/apply` or modal entry point).
2. Extract interactive controls (`textbox`, `combobox`, `radio`, `checkbox`) and their accessible names via `page.accessibility.snapshot()`.
3. Query targeted DOM node attributes strictly for technical HTML5 validation constraints (`required`, file upload `accept` types) to populate `form_schema`.

---

## Step 6: Commit to Ledger
1. Commit the newly discovered record into Cloudflare D1 `jobs_ledger`.
2. **Mandatory Review Gate**: Record MUST enter with status strictly set to `PENDING_HUMAN`.
3. Set recommendation metadata (`triage_decision`: `KEEP` vs `FILTER_OUT`, `skip_reason`).
4. Automated promotion to `APPROVED` without human action is strictly prohibited.
