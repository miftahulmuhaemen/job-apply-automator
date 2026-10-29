---
trigger: always_on
description: Security auditing, test execution cadence, pre-commit gate, and testing standards
---

# Security Auditing, Pre-Commit Verification, and Testing Standards

Strict rules governing the implementation vs. pre-commit verification lifecycle, testing standards, and commit gates:

## 1. Strict Two-Phase Implementation vs. Pre-Commit Lifecycle

### Phase 1: Development & Implementation
- **Build-Only Verification**: Every time changes are made, run static compilation and type checks (`bun run build` in frontend, `go build -o /dev/null .` in backend) to guarantee zero build, syntax, or type errors.
- **Strict Prohibition of Tests & Audits During Development**: NEVER execute test runners (`go test`, `vitest`, `bun test`, Playwright), security audits (`bun audit`), or over-engineering reviews (`ponytail-review`, `ponytail-audit`) during Phase 1. Running test suites before changes are complete wastes tokens and cycles.
- **Mandatory Pre-Halt Cross-Verification Gate**: Before halting, the agent MUST run the 7-Point Checklist from `.agent/rules/cross_verification_standards.md`:
  1. State & Transition Traceability (all consumers audited across DB constraints, API routes, and UI conditionals).
  2. Boundary & Zero-State Auditing (zero/null conditions tested without breaking labels or cooldown calculations).
  3. Strict Persona & Factual Grounding (all claims diffed against `candidateProfile.json`).
  4. External Ingestion & Verbatim Completeness (live URLs return HTTP 200, raw specification sections preserved).
  5. Strict Forward-Order Crawl Invariant (all jobs crawled live from search DOM; zero retrospective synthesis).
  6. Live Application Ledger Cross-Verification & Status Invariant (verified on portal application ledger before marking `APPLIED`; `SUBMITTED (NOT VERIFY-ABLE)` for mobile-only portals like Glints).
  7. Strict Human Approval Gate (all newly ingested/crawled jobs enter `PENDING_HUMAN` in Review tab; zero autonomous promotion to `APPROVED`).
- **Halt and Zero Commit Nudging**: When implementation, build checks, and the 7-point cross-verification checklist are complete, list the modified files in the working tree and **HALT immediately**.
- **Prohibition on Commit Solicitation**: The agent is strictly forbidden from asking *"Are we ready to commit?"*, *"Should I commit this?"*, *"Proceed with commit?"*, or any similar prompt. The agent must NEVER nudge or prompt the user toward committing. Stop talking once the change list and build status are presented.

### Scoped Verification & Non-Code Exemption Rules
- **Zero Tests for Non-Code / Deployment Changes**: NEVER run any test runners (unit, E2E, mutation, audits) if changes are non-code modifications (e.g. Dockerfiles, `docker-compose*.yml`, deployment configs, documentation, markdown files, rule definitions, shell scripts). Use `git commit --no-verify` for non-code commits to prevent executing test hooks.
- **Strict Domain-Scoped Test Isolation**:
  - **Backend-Only Changes**: When changes affect only `backend/`, run ONLY backend checks (`go test ./...`, `go build -o /dev/null .`). NEVER run frontend unit tests (`bun test`) or Playwright E2E suites.
  - **Frontend-Only Changes**: When changes affect only `frontend/`, run ONLY frontend checks (`bun test`, `bun run build`). NEVER run backend tests (`go test ./...`) or backend mutation tests.
  - **Full-Stack Changes**: Run both backend and frontend suites ONLY when code in both `backend/` and `frontend/` has actually been modified.

### Phase 2: Pre-Commit Verification Gate (User-Directed Only)
- **Trigger Condition**: Phase 2 is triggered EXCLUSIVELY when the user explicitly issues an unsolicited command containing "commit" (e.g., "commit", "commit this", "yes to commit").
- **Mandatory Verification Scope Prompt**: Upon receiving the explicit commit command, the agent MUST NOT immediately execute test runners or audits autonomously. Instead, the agent MUST prompt the user:
  > *"Would you like to run full verification (PostgreSQL EXPLAIN ANALYZE on queries, Playwright E2E tests, dependency security audit, unit tests, and build) or standard verification (unit tests and build only)?"*
- **Verification Execution Paths**:
  - **Option A (Full Verification — User confirms "yes" / "full")**:
    1. **PostgreSQL Query Plan Analysis**: Run `EXPLAIN (ANALYZE, BUFFERS)` on every query in the repository if the project uses PostgreSQL to verify plan nodes, buffer access, and index usage.
    2. **Playwright E2E Test Suites**: `cd frontend && bun run test:e2e`.
    3. **Dependency Security Audit**: `cd frontend && bun audit`.
    4. **Automated Unit Test Suites**: `cd backend && go test ./...`, `cd frontend && bun run test`.
    5. **Over-Engineering Review**: `ponytail-review`.
    6. **Production Build Compilation**: `cd backend && go build -o /dev/null .`, `cd frontend && bun run build`.
    7. **Static Code Analysis**: `cd backend && bash scripts/lint.sh`.
    8. **Mutation Testing Audit (Services & Repositories)**: `cd backend && bash scripts/mutation_test.sh ./services/... run && bash scripts/mutation_test.sh ./repositories/... run`.
  - **Option B (Standard Verification — User confirms "no" / "standard" / "unit only")**:
    1. **Automated Unit Test Suites**: `cd backend && go test ./...`, `cd frontend && bun run test`.
    2. **Production Build Compilation**: `cd backend && go build -o /dev/null .`, `cd frontend && bun run build`.
- **Halt on Findings for User Review**:
  - The agent must list ALL findings, test failures, query performance anomalies, security vulnerabilities, and review items clearly for the user.
  - The agent MUST HALT and await user instructions before modifying any code or applying patches.
  - The user reviews the findings and directs next steps (e.g. fix failures, apply security patches, skip, or ignore).
- **Remediation & Expected Behavior Standard**:
  - When the user directs to fix findings, the agent works through them until all checks are completely GREEN.
  - **Expected behavior takes precedence over superficial passing**: Never alter test assertions or fabricate dummy data simply to make a test pass without ensuring the underlying production code behaves correctly.
- **Proceed to Commit & PR**: Only after all tests and audits are 100% GREEN (or explicitly waived by the user), the agent creates the commit, pushes to remote, and creates the PR.

---

## 2. Production-Grade Testing Standards (Zero Half-Assed Tests)

- **Comprehensive Coverage Requirement**:
  - Test suites must exhaustively cover positive paths, all negative paths, boundary thresholds, and edge cases.
  - Sub-tests must exercise actual code logic, branch paths, and domain behavior rather than trivial assertions.
- **Synchronized Test Evolution**:
  - Whenever production code changes, corresponding unit and integration tests MUST be updated along with expectations with equal engineering rigor.
  - Leaving tests with outdated expectations, stale mock calls, or obsolete assertions is strictly prohibited.
- **Prohibition of Permissive / Empty Fallback Mocks**:
  - Mocks must never mask missing endpoints or unhandled queries with blanket catch-all fallbacks returning empty data (e.g. `mock.get.mockImplementation(url => ({ data: [] }))` or accepting `[]` where real data is expected).
  - Tests must assert against realistic datasets that reflect actual domain requirements. Allowing a test to pass with absurd or empty data that bypasses real business logic is strictly prohibited.
- **Strict Schema-Synchronized Mocking (Zero Mock Drift)**:
  - All mock data across frontend and backend test suites must strictly reflect real database schemas, API envelopes (`data`, `meta`), nullable types, and serialized JSON contracts.
  - Fabricating synthetic properties or artificial happy-path fields not present in backend contracts is strictly prohibited.
- **Mandatory Go Static Analysis & Mutation Testing Scaffolding**:
  - In any Go project or service where static analysis is not yet configured, `golangci-lint` must be initialized immediately with strict bug, SAST, and concurrency linters (`.golangci.yml` and `scripts/lint.sh`).
  - In any Go project or service where mutation testing is not yet configured, `gremlins` must be initialized immediately (`.gremlins.yaml` and `scripts/mutation_test.sh`) enabling all 8 AST mutation engines (`CONDITIONALS_BOUNDARY`, `CONDITIONALS_NEGATION`, `INCREMENT_DECREMENT`, `INVERT_LOGICAL`, `INVERT_NEGATIVES`, `INVERT_LOOPCTRL`, `ARITHMETIC_BASE`, `ASSIGNMENT_ARITHMETIC`) in integration mode with an 80%+ efficacy threshold.
- **Prohibition of Docker-Based Test and Audit Execution**:
  - NEVER execute tests (`go test`, `vitest`, `bun test`, Playwright E2E), security audits (`bun audit`), linters (`golangci-lint`), or mutation testing (`gremlins`) through Docker or Docker Compose containers.
  - Container build and rebuild cycles add excessive latency when tests fail or require iterative adjustments.
  - Run all test suites, security audits, and linters natively on the host environment (`bun`, `go`). Docker is strictly reserved for production runtime packaging and deployment orchestration.

---

## 3. E2E Zero-Execution Rule (Strict No-Run Policy)

- During Phase 1 active development, the agent MUST NOT autonomously execute ANY E2E test commands:
  - NEVER run E2E test runners (`playwright test`, `bun run test:e2e`).
  - NEVER run frontend build (`bun run build`).
  - NEVER run backend build (`go build`).
  - NEVER run knowledge graph extractions (`graphify extract .`).
- Running E2E tests is STRICTLY user-directed ONLY:
  - During the Phase 2 Pre-Commit Gate when the user explicitly confirms "yes" to running full verification (E2E + EXPLAIN + audits).
  - Or upon explicit instruction from the user in chat.
- Instructions for running E2E tests locally must be documented and maintained in `README.md`.

---

## 4. Grouped Pre-Commit Reporting Format

All pre-commit findings presented to the user must be grouped cleanly by skill/domain:
- `### [Query Performance & Explain Analysis]` (when full verification is executed)
- `### [Security Audit]` (when full verification is executed)
- `### [Ponytail Review / Audit]` (when full verification is executed)
- `### [Test Verification]` (unit tests, and E2E when full verification is executed)

---

## 5. Saved Architectural Decisions (Permanently Excluded from Audits)

The following architectural decisions are permanent and must NOT be flagged or questioned:
1. **Shadcn UI**: Keep `shadcn` styling, CSS variables, and all primitives in `src/components/ui/`.
2. **Axios HTTP Client**: Keep `axios` across all frontend hooks, services, and tests.
3. **Backend DI Containers & Interfaces**: Keep the dependency injection containers in `backend/v1/container/` and all single-implementation interface definitions (`I*Api`, `I*Service`, `I*Repository`).

---

## 6. Verification Commands

- **Backend Build**: `cd backend && go build -o /dev/null .`
- **Frontend Build**: `cd frontend && bun run build`
- **Backend Tests**: `cd backend && go test ./...`
- **Frontend Tests**: `cd frontend && bun run test`
- **Frontend Audit**: `cd frontend && bun audit`
- **Backend Lint**: `cd backend && bash scripts/lint.sh`
- **Backend Mutation Testing (Services)**: `cd backend && bash scripts/mutation_test.sh ./services/... run`
- **Backend Mutation Testing (Repositories)**: `cd backend && bash scripts/mutation_test.sh ./repositories/... run`
