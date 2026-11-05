---
trigger: always_on
description: Operational safety, plan governance, two-phase pre-commit verification, architectural standards, and git release conventions.
---

# Governance, Safety & Release Standards

Strict rules governing execution safety, planning invariants, verification cadence, architectural layering, and git releases.

## 1. Operating Safety & Execution Boundaries

1. **Root Privileges & Destructive Operations**:
   - **Never run `sudo`**: If a command requires root privileges, provide the command to the user and request manual execution.
   - **Explicit Confirmation for Destructive Actions**: Always ask explicit permission before performing destructive operations (e.g., deleting files, dropping tables, resetting database state).
   - **Respect Project Scope**: Never read, modify, or execute files outside the repository root without explicit consent.
2. **Single-Line CLI Commands for User Execution**:
   - Any shell command provided for the user to execute (especially on remote VPS hosts, servers, or web terminals) MUST strictly be formatted as a single atomic line (using `&&` chaining if multi-step). Multi-line blocks, unquoted breaks, and here-docs (`cat <<EOF`) are prohibited.
3. **Remote Resource Consent Protocol**:
   - Direct remote access to servers, databases, or cloud consoles is prohibited without prior user authorization.
   - Any consent request must include: planned actions, risk assessment, and a rollback plan.
   - Never commit deployment runbooks or credentials containing hostnames, IPs, or secrets; track deployment notes locally in `.gitignore`.
4. **Cloudflare CLI vs. Application Runtime Boundary**:
   - **Agent Ops**: Use the `cf` CLI exclusively for provisioning and configuring Cloudflare infrastructure. If `cf` is missing, instruct the user to install it; do not fall back to other CLIs.
   - **Runtime Code**: Application runtime code must use standard HTTPS REST APIs for D1 and the AWS S3 SDK for R2 (`amiya`). Subprocess CLI calls within application code are prohibited.
5. **Browser Discovery & Automation Tooling**:
   - **First-Time Discovery**: Standardize on Vercel Agent Browser (`bun x agent-browser`) for exploratory site inspection and accessibility tree inspection. Prohibit the legacy `browser_subagent`.
   - **Subsequent Automation**: Use native Rust portal drivers under `backend/src/job_application/drivers/` via `chromiumoxide`.
   - **Domain Whitelist**: Navigation is confined strictly to domains in `websites.md` or `websites_master`.
   - **Circuit Breaker**: If browser interaction fails twice consecutively, abort and evaluate programmatic alternatives. Prohibit automating canvas-rendered web apps (e.g. Google Docs/Sheets); use REST APIs or CLIs.

---

## 2. Plan Lifecycle & Subprocess Hygiene

1. **Active-Only Plan Governance**:
   - Multi-step tasks must follow [`.agent/workflows/plan_lifecycle.md`](file:///home/sahana/Code_Repository/personal/job-apply-automator/.agent/workflows/plan_lifecycle.md).
   - Dedicated active plans reside in `data/plans/<plan_name>.md`. Only active plans may exist in `data/plans/`; completed plans must be deleted or replaced immediately upon verified completion.
2. **Pre-Execution Approval Gate**:
   - Never execute code edits, file creations, schema changes, or database migrations until the user explicitly replies with unambiguous approval in chat (e.g., "approved", "proceed"). Present the plan path and summary, then halt immediately.
3. **Inquiry-First Protocol (Explain Before Mutating)**:
   - When the user asks a question, raises an inquiry, or points out an anomaly, the agent MUST answer the question, diagnose the facts, and explain the root cause first.
   - The agent is STRICTLY PROHIBITED from modifying source code, mutating active browser/session state, or applying unauthorized patches during an inquiry turn.
   - Any remediation must be proposed as a recommendation or plan, halting for the user's explicit direction or approval before any action is taken.
4. **Subprocess Lifecycle & Anti-Zombie Hygiene**:
   - Any spawned worker, CLI, or test subprocess must be tracked and terminated (`SIGTERM` with fallback to `SIGKILL`) upon task completion, failure, or timeout.
   - **Prohibition of Standing Browser Daemons**: Headless browsers must never run as standing background daemons (`isDaemon: true`). They must be spawned on demand and closed immediately (`browser.close()`) in a `finally` block.
   - Sockets, CDPs, and HTTP connections must be explicitly closed before process termination.

---

## 3. Two-Phase Pre-Commit Verification Workflow

All development and release actions strictly follow [`.agent/workflows/two_phase_pre_commit.md`](file:///home/sahana/Code_Repository/personal/job-apply-automator/.agent/workflows/two_phase_pre_commit.md):

1. **Phase 1: Active Development (Build-Only)**:
   - Run ONLY static builds: `bun run build` and `cd cli && cargo check`.
   - Test runners (`bun test`, `cargo test`), E2E suites, and linters are strictly PROHIBITED during Phase 1.
   - Upon completing implementation and static checks, list modified files and **HALT immediately**.
   - **Zero Autonomous Commits & Zero Nudging**: Never autonomously execute `git commit`, `git push`, or `gh pr create`. Never prompt or nudge the user ("Are you ready to commit?"). Keep edits in the working tree until explicitly directed.
2. **Phase 2: Pre-Commit Gate (User-Directed)**:
   - Executed EXCLUSIVELY upon an explicit directive from the user to commit or test.
   - **Scoped Isolation**: Run frontend checks (`cd frontend && bun run build`) only when `frontend/` changed; run Rust checks (`cd backend && cargo test`) only when `backend/` changed. Never run test suites for markdown or documentation edits.
   - E2E tests run only when the user explicitly requests full verification.
   - Present grouped findings under:
     - `### [Query Performance & Explain Analysis]`
     - `### [Security Audit]`
     - `### [Code Quality & Architecture Review]`
     - `### [Test Verification]`

---

## 4. Architectural Hygiene & Testing Rigor

1. **Layered Architecture & Modularity**:
   - Presentation: `frontend/` (Svelte 5 runes: `$state`, `$derived`, `$props`, snippets).
   - Core Backend: `backend/src/` (Axum HTTP server, static asset serving, Cloudflare D1/R2, chromiumoxide browser automation, CLI interface).
   - **LOC Ceilings**: Target 200–350 LOC per module. Strict ceiling at 400 LOC; decompose files approaching 400 LOC into cohesive sub-modules or utility functions. Monolithic god-files are prohibited.
2. **Production-Grade Testing Standards**:
   - Tests must cover positive paths, negative paths, and edge boundaries.
   - Synchronize tests alongside production code changes; never leave outdated assertions or stale mocks.
   - **Zero Permissive Fallback Mocks**: Mocks must never mask unhandled endpoints with empty datasets (`{ data: [] }`). Mock data must strictly match actual D1 schemas, API envelopes, and nullable types (Zero Mock Drift).
   - Tests and linters must run natively on the host using `bun` and `cargo`; never execute through Docker.

---

## 5. Git Release Conventions & PR Standards

1. **Commit & PR Alignment (`fix` vs. `feat`)**:
   - Bug fixes, defects, or broken behavior: `fix(<scope>): <description> (#<IssueNumber>)`.
   - New features, enhancements, or capabilities: `feat(<scope>): <description> (#<IssueNumber>)`.
   - Adhere to Conventional Commits (`fix`, `feat`, `refactor`, `test`, `docs`, `chore`). Imperative mood, lowercase, no emojis.
   - Scopes: `crawler`, `driver`, `web`, `frontend`, `cli`, `storage`, `generator`, `criteria`, `rules`, `db`.
2. **PR Description Structure**:
   - Executive summary (2–4 bullet points).
   - Discrete **Issues & Resolutions** blocks citing Problem, Resolution, and issue reference (`(Ref: #X)`).
   - Closing keyword at bottom (`Closes #X`).
3. **Post-Commit & Deployment Checklist**:
   - [ ] **Hard Refresh (`Ctrl + F5`)**: Drop cached Vite bundles and load updated Svelte chunks.
   - [ ] **Health Check**: Verify `/api/health` and Cloudflare D1 query functionality.
   - [ ] **Cloudflare Storage**: Verify D1 migrations and R2 bucket (`amiya`) bindings remain accessible.
