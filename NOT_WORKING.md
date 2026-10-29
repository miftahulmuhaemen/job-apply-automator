# What We Tried and Did Not Work (NOT_WORKING.md)

This document tracks all architectural approaches, crawler patterns, and ingestion workflows that failed, degraded data quality, or produced garbage outputs. These patterns are strictly prohibited.

---

## 1. Bespoke Hardcoded Portal Crawler Scripts
- **What Was Tried**: Writing dedicated scripts per portal (`scripts/crawl_ajaib.ts`, `scripts/crawl_sevima.ts`, `scripts/crawl_escredia.ts`) with hardcoded CSS selectors (`.job-detail`, `#apply-form`, custom button classes).
- **Why It Failed**: 
  - Fails on minor portal DOM updates.
  - Does not generalize across multi-portal pipelines.
  - Requires continuous manual script maintenance and burns context tokens.
- **Strict Prohibition**: Never write one-off scraper scripts per company or portal. Discovery and ingestion must strictly rely on dynamic browser automation with semantic accessibility navigation.

---

## 2. Blind Raw DOM Input Scraping (`input, select, textarea`)
- **What Was Tried**: Querying all `<input>`, `<select>`, and `<textarea>` elements and inserting their raw `name` or `id` attributes as candidate profile attributes.
- **Why It Failed**:
  - Ingested ephemeral framework IDs (e.g., Workable's `input_files_input_VH5s9GQYJI7HBmLg`, Ashby's dynamic UUIDs).
  - Ingested bot challenges, anti-CSRF tokens, Recaptcha/Turnstile payloads (`g-recaptcha-response`).
  - Ingested technical consent checkboxes (`statement_of_ai_processing`, `talent_pool_consent`).
  - Ingested radio button choice values (e.g. `$7-$14`) as attribute keys.
  - Polluted the candidate attribute ledger with 64+ items of garbage.
- **Strict Prohibition**: Never extract form schemas or candidate attributes by looping through raw DOM `<input>` tags. Interactive controls must be filtered via the browser's Accessibility Tree with deterministic accessible names.

---

## 3. Database Mutation During Read-Only Operations (Form Preview Path)
- **What Was Tried**: Invoking `upsertCandidateAttribute` inside `web/src/generator/formPreview.ts` to capture unmapped fields on the fly when generating form previews.
- **Why It Failed**:
  - Merely opening a job dossier modal or viewing the preview triggered mutations that reinjected junk attributes back into the database.
  - Destroyed ledger state isolation.
- **Strict Prohibition**: Preview generation (`/api/jobs/:id/form-preview`) must be 100% read-only. Database mutations are permitted exclusively during forward-order ingestion and explicit user save actions.

---

## 4. Literal Key Matching Without Canonical Alias Normalization
- **What Was Tried**: Expecting every job portal to use standard keys like `full_name`, `email`, or `phone`.
- **Why It Failed**:
  - Portals use varying names (`name`, `lastname`, `nama_belakang`, `telepon`, `last_company`, `salary_expectation`).
  - Treated standard candidate data as unmapped custom attributes, generating duplicate blank rows in `UNRESOLVED` state while the candidate profile already had full data.
- **Strict Prohibition**: Any field mapping must route through a canonical attribute alias dictionary (`isCanonicalCandidateAttribute`) before being evaluated as a candidate attribute.

---

## 5. Autonomous Multi-Turn Agent Reasoning Over Full Page DOM
- **What Was Tried**: Using an LLM agent to interactively inspect entire raw HTML trees, take screenshots, and guess what to click and what to fill across multiple turns.
- **Why It Failed**:
  - Extremely slow (minutes per listing).
  - Context window explosion from raw HTML markup.
  - Inability to reliably distinguish informational content (job descriptions, company perks) from interactive form fields.
  - Stalled on iframes, shadow DOMs, and nested modals.
- **Strict Prohibition**: Never feed raw HTML dumps to an LLM agent for page navigation. Use the browser engine's native Accessibility Tree snapshot (`page.accessibility.snapshot()`) to extract clean semantic nodes in a single deterministic pass (< 100ms).

---

## 6. Synthetic Data & Plausible Hallucinations
- **What Was Tried**: Generating plausible-sounding screening questions, estimated salary benchmarks, or filler answers when data was missing.
- **Why It Failed**:
  - Masked crawling failures.
  - Violated grounding against `data/candidateProfile.json`.
  - Disguised missing portal prerequisites.
- **Strict Prohibition**: Absence of data must be stored as `NULL` or explicit non-deceptive placeholders like `[NOT SPECIFIED]`. Never generate plausible fake domain data.

---

## 7. Retrospective Database Patching & Synthetic Ledger Creation
- **What Was Tried**: Guessing external URLs, synthesizing jobs from memory, or patching database records without live browser interaction.
- **Why It Failed**:
  - Resulted in 404 links, redirected landing pages, and unverified records in `jobs_ledger`.
- **Strict Prohibition**: Every job must originate from a verified live browser card click following the forward-order crawl invariant.

---

## 8. Superficial Verification & Speed-Prioritized Completion
- **What Was Tried**: Inspecting code syntax or checking database row counts and declaring success without scrutinizing the semantic validity of the data.
- **Why It Failed**:
  - Handed garbage results with raw hashes, duplicate blank rows, and broken schemas to the user.
- **Strict Prohibition**: Never declare a feature or ingestion complete without independent verification of the actual rendered data, UI visual proof, and field semantic plausibility.
