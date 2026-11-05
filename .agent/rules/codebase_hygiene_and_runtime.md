---
trigger: always_on
description: Bun and Cargo execution runtimes, zero-legacy code policy, documentation synchronization, portal driver contracts, and writing style standards.
---

# Codebase Hygiene, Tooling & Driver Standards

Strict rules governing execution runtimes, repository cleanliness, documentation synchronization, portal driver contracts, and communication style.

## 1. Runtime & Package Management Standard (Bun & Cargo)

1. **Mandatory Execution Runtimes**:
   - Primary TypeScript/JavaScript runtime & package manager for frontend: **`bun`** (`bun run`, `bun test`, `bun install`, `bun add`, `bunx`). Prohibit `npm`, `npx`, `yarn`, or `pnpm` unless a native binding strictly requires Node.js internals.
   - Core backend & automation engine: **`cargo`** (Rust).
2. **Canonical Execution Commands**:
   - Starting Backend & Web Console: `bun run web` (or `cargo run --manifest-path backend/Cargo.toml -- server`).
   - Building Web Assets: `bun run build` (or `cd frontend && bun run build`).
   - Rust Backend Check: `cd backend && cargo check`.
   - Rust Backend Lint: `cd backend && cargo clippy -- -D warnings`.
   - Rust Backend Tests: `cd backend && cargo test` (Phase 2 only).
   - Running Automation Engine / CLI: `cargo run --manifest-path backend/Cargo.toml`.

---

## 2. Zero Legacy & Dead Code Policy

1. **Immediate Purge of Superseded Assets**:
   - The repository maintains zero dead code, unused scripts, obsolete scaffolding, or superseded modules.
   - When any feature or engine is migrated or replaced, the legacy code MUST be purged completely in the same change set. Retaining legacy code for "reference", "backup", or "fallback" is strictly prohibited; git history retains past versions.
2. **Scratch & Test Script Hygiene**:
   - One-off scripts, temporary migration files, and scratch scripts must be removed immediately once validation finishes. Only persistent operational tools are permitted in `scripts/`.
3. **Continuous Working Tree Hygiene**:
   - Never leave orphaned directories or prototypes in the working tree. Synchronize documentation immediately whenever code is pruned.

---

## 3. Documentation Synchronization Standard

1. **Mandatory Continuous README Synchronization**:
   - Whenever an architectural change, directory reorganization, CLI command/flag, endpoint, configuration, or database schema change is introduced, `README.md` MUST be updated in the same change set. Never allow `README.md` to drift from the actual codebase.
2. **README Structure Requirements**:
   - System Overview, Directory & Architecture Topology, CLI Usage & Flags, Web Console Setup, Data & Configuration, Windows Startup Integration.
3. **Strict Directory Governance (Zero `/docs` Directory)**:
   - Standalone documentation directories such as `/docs/` are strictly prohibited.
   - All architecture specifications, portal driver contracts, operational workflows, and behavioral invariants must reside exclusively under `.agent/rules/`, `.agent/workflows/`, or standard configuration files (with external tools like `graphify-out/` as the sole exception).

---

## 4. Portal Driver Contract & Invariants

All automated submission drivers under `backend/src/job_application/drivers/` must adhere to these invariants:

1. **Canonical Interface Implementation**:
   - Implement `PortalDriver` trait defined in `backend/src/job_application/drivers/mod.rs`:
     - `id(&self) -> &str`: Unique platform identifier (`kalibrr`, `workable`, `sevima`, etc.).
     - `name(&self) -> &str`: Human-readable portal name.
     - `can_handle(&self, portal: &str, url: &str) -> bool`: Deterministic URL and portal matcher.
     - `submit(&self, page: &Page, context: &SubmissionContext, ...)`: Complete submission lifecycle.
2. **Dynamic Attribute Grounding (Zero Plausible Fakes)**:
   - Candidate data must load dynamically from `candidate_profile_attributes` via `getCandidateProfileFromDb()`.
   - Never fabricate fake answers or salaries. If a mandatory field is missing, flag the job as blocked.
3. **R2 Receipt & Visual Proof**:
   - Drivers MUST capture a full-page receipt screenshot upon successful submission and upload it directly to Cloudflare R2 bucket (`amiya`).
4. **Human-In-The-Loop First-Submission Gate**:
   - The first live submission on any new or updated driver MUST NEVER run headlessly. It must execute via the supervised interactive browser sequence defined in [`.agent/workflows/first_submission_verification.md`](file:///home/sahana/Code_Repository/personal/job-apply-automator/.agent/workflows/first_submission_verification.md).

---

## 5. Browser Runtime, Profile & Phone Number Invariants

1. **Strict Brave Browser Exclusivity**:
   - The automation engine strictly uses Brave Browser with the user's authentic persistent profile (`C:\Users\<user>\.job_apply_automator\browser_profile` on Windows, or `~/.job_apply_automator/browser_profile` on native Linux Brave).
   - All other browsers (Google Chrome, Chromium, Edge, etc.) are strictly prohibited. Never spawn Chrome or unauthenticated browser instances.
2. **Fail Fast with User Notification (Zero Silent Fallback)**:
   - If Brave cannot be reached on port 9222 or fails to spawn, the system MUST fail fast immediately and report the blocker directly to the user with actionable remediation steps (e.g., closing unflagged Brave instances or executing `bun run backend:browser`).
   - The system is strictly prohibited from silently falling back to Google Chrome, headless mode, or an unauthenticated scratch profile.
3. **Universal Phone Number UI Formatting**:
   - Every phone number, telephone, and contact field across all portal drivers must dynamically inspect whether a country code prefix (`+62`, prefix badge, flag, or label) exists in the UI (within the input's container, wrapper, or adjacent siblings).
   - If a country code prefix (`+62`) is present in the UI: do NOT prepend `0`; jump straight to `8` (e.g., `89677176035`). Never produce `+62 08...`.
   - If no country code prefix exists in the UI: format with domestic leading `0` (e.g., `089677176035`).
   - This invariant applies universally across all candidate and contact phone inputs.

---

## 6. Writing Style & Communication Guidelines

1. **Prohibit AI Emoticons and Decorative Emojis**:
   - Do not use emoticons or emojis in documentation, commit messages, code comments, UI copy, or chat responses.
2. **Prohibit AI Fluff and Conversational Filler**:
   - Avoid generic pleasantries, sycophantic acknowledgments, and hyperbolic phrases (*delve into, game-changer, seamless, passionate*). Present technical facts directly and objectively.
3. **Mandatory Next Action Callout**:
   - Every response MUST conclude with a clear, explicit section indicating the next action for either the agent or the user (e.g., `### Next Actions` specifying **Agent Action** and/or **User Action**). Never end a response ambiguously.
