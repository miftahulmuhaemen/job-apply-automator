---
trigger: always_on
description: Strict standards for GitHub PR titles, commit messages, PR descriptions, and issue reports.
---

# Issue and PR Standards

Strict rules for formatting titles, commit messages, and descriptions for GitHub Pull Requests (PRs) and Issues:

## 1. Strict Commit, Push & PR Confirmation Gate

1. **Two-Phase Workflow Protocol**:
   - **Phase 1 (Implementation & Local Validation)**: The agent implements changes and performs only lightweight static checks (`bun run build`, `go build -o /dev/null .`). The agent MUST NEVER autonomously execute `bun audit`, test runners, ponytail reviews, or git commits. When implementation is done, the agent lists the changes in the working tree, confirms build status, and HALTS immediately. The agent is strictly prohibited from asking "Are we ready to commit?", "Should I commit?", or prompting the user toward committing.
   - **Phase 2 (Pre-Commit Gate via Explicit User Command)**: Triggered EXCLUSIVELY when the user explicitly issues an unsolicited directive to "commit" (e.g. "commit", "commit this"). Only upon receiving this explicit user instruction does the agent prompt the user whether to run full verification (PostgreSQL EXPLAIN ANALYZE on queries, Playwright E2E tests, dependency security audit, unit tests, and build) or standard verification (unit tests and build only). If yes, the agent executes full verification; if no, the agent executes unit tests and build only.
   - **Halt on Findings for User Review**: The agent lists all test results, failures, vulnerabilities, query performance anomalies, and review items, and MUST halt immediately to allow the user to review findings before modifying any code. Only when the user directs to fix or proceed, and all checks are confirmed 100% green, does the agent proceed.
   - **Proceed to Commit & PR**: Only after all checks pass cleanly with production-grade rigor and verified behavior (or after user reviews and directs to proceed), the agent creates the commit, pushes the branch, and creates the PR using `gh pr create`.

2. **Never Commit, Push, or Prompt Autonomously**:
   - The agent MUST NEVER autonomously execute `git commit`, `git push`, `gh pr create`, or any command that commits changes or pushes branches without the user's explicit directive. All code edits must remain strictly as working-tree modifications until the user explicitly directs the agent to commit. The agent must never solicit or nudge the user to commit.

3. **Post-Commit & Production Deployment Checklist**:
   Whenever a commit or pull request is deployed to an active production environment, the operator/user must be instructed to follow this operational checklist:
   - [ ] **Verify Pending Offline Sync**: Before closing tabs or refreshing, verify that active cashier terminals have flushed all pending offline transactions to the server (check footer status: "Semua transaksi tersinkronisasi").
   - [ ] **Client Browser Hard Refresh (`Ctrl + F5` / `Shift + Reload`)**: Instruct active users and cashier terminals to hard-refresh their browsers to drop stale in-memory Vite bundles and load newly hashed production asset chunks, preventing dynamic chunk import failures.
   - [ ] **Session Re-Authentication (Sign Out / Sign In)**: If the release modified authentication logic, authorization roles, token claims, or staff permissions, instruct users to sign out and log back in to reissue a fresh JWT in `localStorage`.
   - [ ] **Container & Migration Health Check**: Confirm via Dokploy task logs or `/health` that the new container is healthy and `./migrate -dir up` completed successfully without errors.

## 2. Title & Commit Message Conventions

1. **Issue Classification Alignment (`fix` vs `feat`)**:
   - **Bug Fixes**: When the issue is a bug, defect, calculation error, or broken behavior, the PR title and commit messages MUST strictly use `fix(<scope>): <description> (#<IssueNumber>)`. Never use `feat` for bug fixes.
   - **Enhancements & Features**: When the issue is an enhancement, new functionality, or capability extension (e.g., labeled `enhancement`), the PR title and commit messages MUST strictly use `feat(<scope>): <description> (#<IssueNumber>)`. Never use `fix` for enhancements.
   - Format: `<type>(<scope>): <concise description in lowercase> (#<IssueNumber>)`
   - Examples:
     - Bug fix: `fix(reports): calculate initial stock and fix date filtering (#42)`
     - Enhancement: `feat(promotions): searchable product combobox, lifecycle status, and overlap validation (#47)`

2. **Commit Message Standards**:
   - Commits addressing or resolving an Issue MUST strictly match the issue classification (`fix` for bugs/defects, `feat` for enhancements/features).
   - Adhere strictly to Conventional Commits: `<type>(<scope>): <subject>`.
   - Permitted types:
     - `fix`: Bug fixes, defect resolutions, and error corrections.
     - `feat`: Net-new features and enhancement capabilities.
     - `refactor`: Code restructuring without functional or behavioral changes.
     - `test`: Test suite additions, modifications, or fixes.
     - `docs`: Documentation, README, or agent rule updates.
     - `chore`: Tooling, dependency maintenance, or build scripts.
   - Use imperative mood, lowercase subject, and concise phrasing (e.g., `fix(reports): calculate initial stock`, not `fixed` or `fixes`).
   - Zero emojis or emoticons in commit messages.

3. **Scope Designations**:
   - Scopes must be specific, lowercase, and reflect the affected component or domain (e.g., `pos`, `cashier`, `reports`, `promotions`, `navigation`, `products`, `auth`, `api`, `sync`).

## 2. PR Description Structure Guidelines

1. **High-Level Summary**:
   - Provide a concise executive overview explaining the purpose of the PR or Issue.
   - Keep it brief (2–4 bullet points or a short paragraph).

2. **Discrete Issue & Resolution Breakdown**:
   - Do NOT lump changes together into generic "Key Changes" or file-dump sections.
   - Do NOT include a "Verification" section in PR descriptions unless explicitly requested.
   - Group work strictly into separate, discrete issue-and-resolution blocks:
     - **Problem**: Exact failure mode, root cause, user scenario, or requirement.
     - **Resolution**: Precise technical fix, architectural change, or logic alteration implemented to address that specific issue.

3. **Linked Issues**:
   - Always reference tied GitHub issues in the section heading or problem description (e.g. `(Ref: #42)`).
   - Append closing keywords (e.g. `Closes #<IssueNumber>` or `Resolves #<IssueNumber>`) at the bottom of the PR description to automatically link and close the issue upon merge.

4. **Standard Template**:

```markdown
## Summary
<Brief high-level overview of the PR or issue scope>

## Issues & Resolutions

### 1. <Issue / Feature Title> (Ref: #<IssueNumber>)
- **Problem**: <What was failing, missing, or required, including root cause and issue reference>
- **Resolution**: <How it was resolved, citing relevant files and logic>

### 2. <Issue / Feature Title>
- **Problem**: <What was failing, missing, or required, including root cause>
- **Resolution**: <How it was resolved, citing relevant files and logic>

Closes #<IssueNumber>
```

5. **Tone and Style**:
   - Zero decorative emojis or emoticons.
   - Zero conversational filler, hyperbole, or sycophancy.
   - Maintain objective technical precision citing exact identifiers, endpoints, and components.
