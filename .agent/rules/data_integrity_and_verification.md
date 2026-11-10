---
trigger: always_on
description: Strict data authenticity, accessibility tree DOM extraction, PII protection, canonical alias resolution, cross-verification dimensions, and independent audit standards.
---

# Data Integrity, Parsing & Verification Standards

Strict rules governing data authenticity, browser DOM parsing, candidate privacy, and pre-completion verification invariants.

## 1. Prohibition of Fabricated, Mock & Synthetic Data

1. **Absolute Prohibition of Plausible Fakes**:
   - The agent is STRICTLY PROHIBITED from synthesizing fake screening questions, artificial candidate answers, estimated salaries, fabricated company contacts, or artificial employer requirements.
   - Deceptive filler content to make forms, tables, or modals look populated is prohibited. Plausible fake data disguises incomplete ingestion or extraction failures.
2. **Explicit NULL & Unmistakable Placeholders**:
   - When a data point is absent from the live source, it MUST be stored strictly as `NULL`, `undefined`, or empty array (`[]`). Missing data renders as empty states (`"-"` or `"No custom employer questions"`).
   - If visual wireframes or layout demonstrations require text, use ONLY explicit, non-deceptive placeholders: `Lorem ipsum dolor sit amet...`, `[PLACEHOLDER: NOT SPECIFIED IN SOURCE]`, or `[UNVERIFIED DEMO DATA]`.
3. **Strict Dual-Source Grounding**:
   - Every committed job record or presented result must originate exclusively from either:
     1. **Live Source Ingestion**: Verbatim text extracted directly from the target portal's live DOM session or verified official API endpoint.
     2. **Dynamic Candidate Ledger**: Factual attributes diffed directly against `candidate_profile_attributes` via `getCandidateProfileFromDb()`.
4. **Absolute Prohibition of Silent Fallbacks (Mandatory Explicit State)**:
   - Silent fallbacks are STRICTLY PROHIBITED across all artifact pipelines (resumes, cover letters, portfolios, screening questions, and submissions).
   - Never substitute another employer's tailored PDF, a generic fallback document, or a synthetic placeholder when a tailored asset does not exist or when a tailoring/synthesis process has failed or is incomplete.
   - If a tailored asset does not exist, was not compiled, or failed to generate, the system MUST explicitly report that exact unready/failed state in both the backend API and the UI (e.g. `NOT_GENERATED`, `TAILORING_FAILED`, or `SYNTHESIS_PENDING`).
   - The user must never be misled into believing an asset is tailored or ready when it has not actually been compiled for that specific vacancy.

---

## 2. Accessibility Tree DOM Extraction & Crawling Invariants

1. **Zero Bespoke Crawler Scripts**:
   - Never write one-off crawler scripts per employer (e.g. `scripts/crawl_<company>.ts`). All crawling must be universal and dynamic via standard browser pipelines.
2. **Accessible Form Extraction (Zero Blind Raw DOM Scraping)**:
   - Interactive form controls MUST be extracted via the browser Accessibility Tree (`page.accessibility.snapshot()`) using accessible roles (`textbox`, `combobox`, `radio`, `checkbox`) and their computed visual names.
   - Targeted raw DOM queries are permitted EXCLUSIVELY for technical HTML5 validation constraints (`required`, `accept`, `pattern`, `maxlength`, `type="file"`).
   - Ephemeral framework hashes (`input_files_input_*`, raw UUIDs), bot challenges (`turnstile`, `g-recaptcha-response`), CSRF tokens, radio choice values, and technical consent checkboxes must NEVER enter `candidate_profile_attributes`.
3. **Forward-Order Crawl Invariant & Zero Retrospective Synthesis**:
   - Every job listing must originate from a verified live browser card click in an active session per [`.agent/workflows/forward_order_crawling.md`](file:///home/sahana/Code_Repository/personal/job-apply-automator/.agent/workflows/forward_order_crawling.md).
   - Guessing URLs or retroactively patching synthetic URLs into the database is prohibited.
4. **Read-Path Invariance**:
   - Form preview generation (`/api/jobs/:id/form-preview`), dossier viewing, and report rendering MUST remain 100% read-only. Never mutate database records during read or preview calls.
5. **Canonical Attribute Alias Resolution**:
   - Form inputs must resolve against canonical aliases (`isCanonicalCandidateAttribute`) before being treated as custom attributes. Common aliases (`lastname`, `telepon`, `salary_expectation`) map directly to canonical parents.

---

## 3. Strict Candidate PII Protection

1. **Zero Real Personal Data in Repository Files**:
   - Full names, phone numbers, WhatsApp numbers, email addresses, residential street addresses, postal codes, date of birth, marital status, and personal social media profiles must NEVER be committed or hardcoded in source code, fallback strings, CLI binaries, tests, seed scripts, or plan documents.
2. **Mandatory Placeholder Tokens**:
   - Use generic non-deceptive placeholders when designing templates or tests:
     - Name: `[CANDIDATE_FULL_NAME]`, `Candidate Name`
     - Email: `candidate@example.com`
     - Phone: `+628000000000`
     - Location: `Indonesia (Remote / Hybrid / On-site)`
     - Education: `[DEGREE] in [FIELD_OF_STUDY], [INSTITUTION]`
3. **Dynamic Ledger Truth**:
   - All real candidate attributes must be loaded dynamically at runtime from Cloudflare D1 / SQLite (`candidate_profile_attributes` table) or user environment variables. Never commit static profile JSON or markdown files.
4. **Pre-Commit Privacy Audit**:
   - Verify no real candidate PII exists in working tree files (`git grep -i -E "<regex>"`) prior to release.

---

## 4. Nine-Dimension Pre-Completion Cross-Verification

Before declaring any implementation step complete or presenting results, verify all 9 dimensions:

1. **State & Transition Traceability**: Verify transitions across `ALLOWED_TRANSITIONS`, backend mutation routes, and frontend badges/popovers. Ensure zero unreachable terminal states.
2. **Boundary & Zero-State Auditing**: Test zero counts (`count === 0` must not trigger cooldowns), null timestamps (no broken duration math), and empty datasets (clean empty states). Confirm negative filter inversion.
3. **Persona & Profile Grounding**: Diff all resume/cover letter claims against dynamic candidate profile attributes (`getCandidateProfileFromDb()`). Never attribute Company A accomplishments to Company B; never claim solo ownership for team projects.
4. **Verbatim Specification Preservation**: External job URLs must return HTTP 200. Responsibilities, qualifications, and compensation sections must be preserved verbatim without lossy summarization.
5. **Forward-Order Card Click Fidelity**: Verify each ingested job originated from an active browser session card click, not synthesized slugs.
6. **Application Ledger Cross-Verification**: Applications must be confirmed against the portal's submitted history ledger with an active sent status and receipt screenshot. On platforms lacking a web ledger (e.g. Glints), record status strictly as `SUBMITTED (NOT VERIFY-ABLE)`. Prerequisite gates (exams, profile wizards) must halt submission and flag blockers.
7. **Strict Human Gate (`PENDING_HUMAN`)**: All ingested or triaged jobs enter `jobs_ledger` strictly as `PENDING_HUMAN`. Autonomous crawlers or agents are strictly forbidden from promoting jobs to `APPROVED`.
8. **Two-Tier Form Schema Auditing**: Ingestion traverses into the active `/apply` form to extract accessible inputs and identify missing mandatory candidate attributes early.
9. **Supervised First Submission**: The first live submission on any new or updated driver MUST run interactively with a human in the loop per [`.agent/workflows/first_submission_verification.md`](file:///home/sahana/Code_Repository/personal/job-apply-automator/.agent/workflows/first_submission_verification.md). Autonomous headless first submissions are prohibited.

---

## 5. Independent Verification Subagent & Semantic Quality

1. **Prohibition of Speed-Biased Skips**:
   - The agent is STRICTLY PROHIBITED from skipping verification or performing superficial checks (status 200 alone, row count > 0 alone, or build checks alone) to conclude tasks quickly.
2. **Semantic Authenticity Checks**:
   - **Garbage & Technical Artifacts**: Inspect for random hashes (`input_files_input_*`), CSS class tokens in labels, radio snippets (`$7-$14`), or bot challenge leftovers (`recaptcha`, `turnstile`). Reject immediately if detected.
   - **Information vs. Input Disambiguation**: Descriptions and requirements must never be stored as form inputs; input fields must never be lumped into description specifications.
   - **Visual Reality Inspection**: Inspect screenshots of rendered UI for column misalignments, duplicate blank fields, or broken formatting.
3. **Continuous E2E Latency Profiling Invariant**:
   - Every execution of the E2E suite (`bun run test:e2e`) must profile all network request-response pairs and record min, avg, and maximum (slowest / worst-case) response times per endpoint.
   - Benchmark logs persist to `tests/proofs/endpoint_latency_benchmark.json`.
   - Latency evaluation is strictly case-by-case based on request characteristics (distinguishing fast database reads from heavy external crawls or LLM generations). Slow outliers are flagged for inspection rather than failing automatically on a single flat threshold.
4. **Independent Subagent Audit**:
   - Before presenting final results to the user, dispatch an independent verification subagent following [`.agent/workflows/independent_audit.md`](file:///home/sahana/Code_Repository/personal/job-apply-automator/.agent/workflows/independent_audit.md) to audit semantic correctness and visual sanity without implementation bias.
