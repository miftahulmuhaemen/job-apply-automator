---
name: two_phase_pre_commit
description: Sequential lifecycle for development verification, user commit directives, test execution, and pull request generation.
---

# Workflow: Two-Phase Pre-Commit & Release Lifecycle

This workflow governs the exact sequence required when implementing code changes and preparing git commits.

---

## Phase 1: Implementation & Local Validation

1. **Implement Changes**: Make working tree edits in accordance with active plan tasks.
2. **Static Compilation Check**: Run lightweight static checks:
   - TypeScript (Web backend & frontend): `bun run build`
   - Rust CLI: `cd cli && cargo check`
   - Confirm zero build, syntax, or type errors.
3. **Strict Prohibition on Premature Tests**:
   - NEVER execute test runners (`bun test`, `cargo test`), security audits (`bun audit`), or review tools during Phase 1.
4. **Pre-Halt Checklist**: Confirm that state transitions and boundary checks satisfy `.agent/rules/cross_verification_standards.md`.
5. **Report & Halt**:
   - Present the modified files in the working tree.
   - Confirm clean build status.
   - **HALT immediately**.
   - **Prohibition on Commit Solicitation**: The agent MUST NEVER ask "Are we ready to commit?", "Should I commit?", or nudge the user toward committing. Stop and await user instruction.

---

## Phase 2: Pre-Commit Verification Gate (User-Directed Only)

1. **Trigger Condition**: Triggered EXCLUSIVELY when the user explicitly issues an unsolicited directive to commit (e.g. "commit", "commit this", "yes to commit").
2. **Prompt Verification Scope**:
   - Ask the user:
     > *"Would you like to run full verification (Cloudflare D1 EXPLAIN QUERY PLAN on queries, dependency security audit, unit tests, and build) or standard verification (unit tests and build only)?"*
   - Await the user's explicit reply before running any test command.
3. **Execute Verification Path**:
   - **Option A (Full Verification — User confirms "yes" / "full")**:
     1. Cloudflare D1 Query Plan Analysis: `EXPLAIN QUERY PLAN` on modified queries or complex views (`v_companies_summary`).
     2. Dependency Security Audit: `bun audit`.
     3. Automated Unit Test Suites: `cd cli && cargo test` (Rust), `bun test` (TypeScript).
     4. Production Build Compilation: `bun run build` and `cd cli && cargo check`.
   - **Option B (Standard Verification — User confirms "no" / "standard" / "unit only")**:
     1. Automated Unit Test Suites: `cd cli && cargo test` (Rust), `bun test` (TypeScript).
     2. Production Build Compilation: `bun run build`.
4. **Halt on Findings**:
   - Present all test results, vulnerabilities, and review items grouped clearly by domain.
   - **HALT immediately** for user review before modifying any code.
   - Only when user reviews and directs to proceed (with all tests green), advance to Step 5.
5. **Commit & Release Execution**:
   - Format commit message strictly according to `.agent/rules/issue_and_pr_standards.md` (`feat(...)` or `fix(...)`).
   - Stage and commit files: `git commit -m "<type>(<scope>): <subject>"`.
   - Determine current branch via `git rev-parse --abbrev-ref HEAD`:
     - If on `main`: Push directly via `git push origin main`.
     - If on a feature branch: Push branch via `git push -u origin <branch>` and create PR via `gh pr create`.
