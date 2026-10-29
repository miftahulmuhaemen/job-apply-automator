---
trigger: always_on
description: Mandatory pre-completion cross-verification standards to prevent regressions across state machines, boundaries, facts, and ingested data
---

# Cross-Verification Standards & Regression Prevention

Strict behavioral invariants that MUST be verified before concluding any implementation step or presenting results:

## 1. The Seven-Point Cross-Verification Checklist

Whenever code, configuration, or data is modified, the agent must cross-check all 7 dimensions before marking work done:

### Dimension 1: State & Transition Traceability
- **Trace Every Consumer**: When adding, renaming, or modifying an entity status or enum value (e.g., `PENDING_HUMAN`), verify its handling across:
  1. Database constraints & allowed transition tables (`ALLOWED_TRANSITIONS`).
  2. Backend route handlers & mutation endpoints (e.g., `/submit`, `/status`).
  3. Frontend conditional branches, popovers, action menus, and badges.
- **Zero Dead Ends**: Ensure no reachable state renders as an unhandled fallback or terminal state unless explicitly intended.

### Dimension 2: Boundary & Zero-State Auditing
- **Zero/Null Isolation**: Every calculated label, metric, or status badge must be tested against:
  - Zero count (`count === 0` must never trigger count-dependent flags like cooldowns).
  - Null/undefined timestamps (must never trigger duration or cooldown math).
  - Empty datasets (must render clean fallback messages rather than NaN or broken layouts).
- **Filter Inversion**: Confirm that filters and queries handle negative criteria correctly without leaking stale or soft-deleted records.

### Dimension 3: Strict Persona & Factual Grounding (Zero Plausible Fakes)
- **Diff Against Source Profile**: Any generated claim, answer, resume highlight, or cover letter must strictly diff against `data/candidateProfile.json`:
  - **Company Attribution**: Never attribute an accomplishment from Company A to Company B.
  - **Team vs. Solo**: Never claim solo ownership for collaborative team efforts (e.g., incident triage, migrations).
  - **Forbidden Inferences**: Never invent unlisted technical roles, tools, or responsibilities.
- **Zero Unverified Claims & Plausible Fakes**: If a detail is not in the candidate profile or the live job post, the agent is strictly prohibited from inventing believable questions, answers, salaries, or contacts. Store `NULL` / empty, or use explicit non-deceptive placeholders like `Lorem ipsum` or `[NOT SPECIFIED]`. Never create plausible fakes (enforced by `.agent/rules/prohibit_fabricated_data.md`).

### Dimension 4: External Ingestion & Verbatim Completeness
- **HTTP 200 Verification**: External job links, portal URLs, and webhook endpoints must be verified active or return HTTP 200. Never commit synthetic or 404 links.
- **Full Verbatim Preservation**: When storing job specifications, preserve all sections verbatim:
  - Overview / About the Role
  - Key Responsibilities
  - Minimum Qualifications / Requirements
  - Good-to-Have / Preferred Qualifications
  - Compensation, Perks & Work Arrangements
- Never replace raw employer specifications with lossy AI summaries unless specifically instructed.

### Dimension 5: Strict Forward-Order Crawl Invariant (Zero Retrospective Patching)
- **Forward-Order Pipeline Enforcement**: All job discovery and ingestion must strictly follow forward sequential order:
  1. Navigate to target portal search interface (e.g. Kalibrr, Glints, Jobstreet).
  2. Apply criteria filters (Role: Backend/Golang, Location: Indonesia, Freshness: <= 7 days).
  3. Query and collect active listing card elements directly from the search results DOM.
  4. Navigate headless browser directly into each clicked listing card.
  5. Capture `window.location.href` directly from the live page session (guaranteeing zero redirects to root or dead links).
  6. Extract full raw DOM text verbatim.
  7. Only commit to `jobs_ledger` with confirmed live session data.
- **Strict Prohibition on Retrospective Synthesis**:
  - The agent MUST NEVER synthesize job records, guess external URL slugs, or patch URLs retroactively into the database.
  - No job record is permitted to enter `jobs_ledger` without originating directly from a verified live browser card click.

### Dimension 6: Live Application Ledger Cross-Verification & Status Invariant
- **Strict Ledger Verification Requirement**:
  - An application MUST NEVER be marked as `APPLIED` based on assumptions, local form submit events, wizard progression buttons, or page redirects.
  - The driver or agent MUST navigate directly to the target portal's official submitted application ledger (e.g., Kalibrr: `https://jobseeker.kalibrr.com/candidate/applications`, Jobstreet: `https://myjobstreet.jobstreet.com/application/history.afr`).
  - The submitted job record MUST be verifiably parsed from that live list with an active sent status (e.g., `Application sent`, `Submitted`, `In Review`) timestamped within the recent window (e.g., `just now`, `today`).
  - Screenshot proof of the application card on the portal's submission history page MUST be captured.
- **Unverifiable Portal Exception (e.g., Glints)**:
  - If a job platform does not provide a web-accessible application history ledger (such as Glints, where submission verification is restricted to the mobile app), the status MUST NEVER be set to `APPLIED`.
  - On such platforms, the status MUST strictly be recorded as `SUBMITTED (NOT VERIFY-ABLE)`.
  - The final confirmation screen or receipt modal must still be saved as screenshot proof.
- **Strict Prohibition on Prerequisite Gate Bypassing**:
  - If a platform redirects to any prerequisite gate (e.g., Kalibrr skill exams at `candidate/exams/`, mandatory candidate profile wizards, or candidate assessments), the submission MUST NOT be marked as successful or submitted.
  - The driver/agent must immediately flag the exact roadblock, the prerequisite URL, and halt or adapt.

### Dimension 7: Strict Human Approval Gate (Zero Autonomous Promotion to APPROVED)
- **Mandatory PENDING_HUMAN Invariant**: All newly crawled, ingested, or pre-submitted job listings MUST enter `jobs_ledger` strictly with status `PENDING_HUMAN` (Review tab).
- **Sole Human Authority Over Approval**: Automated crawlers, background tasks, and agents are STRICTLY PROHIBITED from autonomously transitioning any job to `APPROVED`.
- **Recommendation vs. Action Boundary**: Ingestion and triage algorithms may populate `triage_decision` (`KEEP` vs `FILTER_OUT`) and `skip_reason` as recommendation metadata, but the transition to `APPROVED` or `DROPPED` requires explicit human approval in the Web Console or direct unsolicited command from the user.

### Dimension 8: Mandatory Application Form Schema & Prerequisite Gate Auditing
- **Traverse to Application Form at Ingestion**: Ingestion must not stop at the public job description text. The crawler must navigate into the active application form (e.g., `/apply` or modal entry point).
- **Audit Form Controls & Constraints**: The crawler must query and parse all form elements (`<input>`, `<select>`, `<textarea>`) to identify every `required` field and file upload constraint (`type="file"`, `accept`).
- **Missing Prerequisite Enforcement**: If a mandatory input (such as a profile photo or portfolio PDF) is not present in the candidate profile or storage, the job must be flagged as blocked by missing prerequisites. Staging a job as ready for application when mandatory inputs are unsupplied is strictly prohibited.

---

## 2. Evidence Before Completion
- The agent must not declare a feature complete or bug resolved based solely on code inspection.
- Concrete visual or API response evidence (e.g., Puppeteer screenshots, curl outputs, database query rows) must demonstrate that all 8 dimensions pass before halting.
