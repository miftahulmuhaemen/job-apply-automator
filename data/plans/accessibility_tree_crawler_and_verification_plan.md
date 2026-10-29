# Plan: Browser Accessibility Tree Dynamic Crawler & Subagent Verification Gate

## Goal & Scope
1. Overhaul the dynamic crawler (`scripts/dynamic_crawler.ts`) to use the native browser Accessibility Tree (`page.accessibility.snapshot()`) to extract job specifications and application form schemas.
2. Filter out non-actionable, technical, or decorative elements at the accessibility layer (retaining only human-visible labels and interactive controls).
3. Bind all crawler extraction and preview rendering to the prohibitions defined in `NOT_WORKING.md` and `.agent/rules/prohibited_approaches.md`.
4. Establish an independent subagent verification workflow (`.agent/rules/independent_verification_agent.md`) that scrutinizes every extracted job, schema, and attribute before concluding work.

---

## Technical Design

### 1. Accessibility Tree Snapshot Extraction
- Replace messy DOM query selectors (`Array.from(document.querySelectorAll('input, select, textarea'))`) with `await page.accessibility.snapshot()`.
- Traverse the accessibility node hierarchy:
  - Extract human-visible labels directly from computed node names (`node.name`).
  - Extract input types from accessibility roles (`textbox`, `combobox`, `radio`, `checkbox`, `button`).
  - Capture preceding context / `StaticText` for comboboxes and radiogroups.
  - Detect required fields natively via `node.required` or accessible label indicators (`*`).
- Correlate interactive accessibility nodes with underlying DOM elements (for file uploads, names, and submit triggers) without polluting the candidate attribute ledger with raw DOM hashes.

### 2. Candidate Attribute Ledger Protection
- Apply strict canonical alias normalization (`isCanonicalCandidateAttribute`) on all discovered controls.
- Prevent non-canonical DOM tokens, bot challenges, file input hashes (`input_files_input_*`), and consent checkboxes from ever being registered into `candidate_profile_attributes`.
- Retain preview path (`web/src/generator/formPreview.ts`) as 100% read-only.

### 3. Independent Verification Subagent Audit
- Once dynamic crawling is executed, dispatch an independent research subagent to audit:
  1. `candidate_profile_attributes`: Confirm 0 junk rows, 0 machine hashes, exactly 51 canonical rows (or only genuine new employer questions).
  2. `jobs_ledger` & Form Previews: Confirm human-readable field labels, 0 `[MISSING]` required fields, correct salary bid calculation.
  3. UI visual screenshots: Confirm clean, professional appearance conforming to Zinc monochrome standard.

---

## Task Breakdown
- [x] Create `NOT_WORKING.md` documenting all failed approaches, root causes, and strict prohibitions.
- [x] Create `.agent/rules/prohibited_approaches.md` binding agent behavior to `NOT_WORKING.md`.
- [x] Create `.agent/rules/independent_verification_agent.md` establishing mandatory independent subagent audit and semantic plausibility verification.
- [/] Refactor `scripts/dynamic_crawler.ts` to utilize `page.accessibility.snapshot()`.
- [ ] Run dynamic crawl across test jobs (Ashby, ESCREDIA, SEVIMA, Ajaib).
- [ ] Dispatch independent subagent to audit database state, form previews, and UI evidence.
- [ ] Verify build (`bunx tsc --noEmit`) and update knowledge graph (`graphify extract .`).

---

## Verification Protocol
1. Static analysis: `bunx tsc --noEmit` must pass with 0 errors.
2. Database query: `candidate_profile_attributes` must contain 0 ephemeral hashes, 0 radio snippet keys, and maintain canonical integrity.
3. Form Fill Previews: Inspect JSON and visual screenshots for Job #93 (Ashby), #91 (ESCREDIA), and #86 (Ajaib).
4. Subagent verification report confirming semantic correctness.
