# Prohibited Approaches and Anti-Patterns (NOT_WORKING.md Compliance)

Strict, non-negotiable prohibitions referencing [`NOT_WORKING.md`](file:///home/sahana/Code_Repository/personal/job-apply-automator/NOT_WORKING.md):

## 1. Mandatory Reference to NOT_WORKING.md
Before implementing or proposing any crawler, scraper, parser, ingestion logic, or database update, the agent MUST review [`NOT_WORKING.md`](file:///home/sahana/Code_Repository/personal/job-apply-automator/NOT_WORKING.md). Any proposal or implementation that repeats an anti-pattern documented in `NOT_WORKING.md` is a direct build invariant violation.

---

## 2. Invariant Rules Derived from NOT_WORKING.md

### Prohibition 1: Zero Bespoke Portal Scripts
- NEVER create hardcoded one-off crawler scripts per employer or portal (e.g. `scripts/crawl_<company>.ts`).
- All crawling must be universal and dynamic, executing through the forward-order browser pipeline and native browser Accessibility Tree.

### Prohibition 2: Zero Blind Raw DOM Scraping for Form Fields
- NEVER query raw `<input>`, `<select>`, `<textarea>` elements to construct candidate attributes or form schemas.
- Ephemeral DOM hashes (e.g., `input_files_input_*`, random UUIDs), bot challenges (`g-recaptcha-response`, `turnstile`), CSRF tokens, radio choice values, and technical consent checkboxes MUST NEVER enter `candidate_profile_attributes`.
- Interactive form controls MUST be extracted via the browser Accessibility Tree (`page.accessibility.snapshot()`) using accessible roles (`textbox`, `combobox`, `radio`, `checkbox`) and their computed visual names.

### Prohibition 3: Zero Database Mutations in Read Paths
- Form preview generation (`/api/jobs/:id/form-preview`), dossier viewing, and report generation MUST remain 100% read-only.
- Never call `upsertCandidateAttribute` or mutate tables during preview rendering.

### Prohibition 4: Mandatory Canonical Alias Resolution
- Form inputs must never be treated as unmapped custom attributes without first checking against the canonical attribute alias dictionary (`isCanonicalCandidateAttribute`).
- Common aliases (`lastname`, `name`, `last_company`, `telepon`, `salary_expectation`) must map directly to their canonical parent attribute.

### Prohibition 5: Zero Autonomous Multi-Turn Agent DOM Navigation
- Never dump raw HTML trees into an LLM agent context to deduce page structure.
- Use single-pass Accessibility Tree extraction to deterministically distinguish information nodes (descriptions, perks) from interactive form controls in < 100ms.

### Prohibition 6: Zero Plausible Hallucinations
- Missing fields must strictly be stored as `NULL` or non-deceptive placeholders (`[NOT SPECIFIED]`).
- Plausible fake salaries, fake questions, or fabricated answers are strictly forbidden.

### Prohibition 7: Zero Retrospective URL Synthesis
- Every job record must originate from a verified live browser card click with confirmed active URL session.

### Prohibition 8: Zero Skipping Verification for Speed
- Syntactic validity and row counts are insufficient. Every data result must be verified for semantic plausibility, human-like sense, and visual clarity before concluding work.
