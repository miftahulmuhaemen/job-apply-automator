---
trigger: always_on
description: Plan governance, persistent documentation, approval gates, task tracking, and cross-session lifecycle standards.
---

# Plan Governance & Persistent Execution Standards

Strict rules for drafting, tracking, and executing implementation plans across agent sessions:

## 1. Mandatory Persistent Plan Documentation
1. **Persistent Document Standard**:
   - Every multi-step task, architectural change, or feature implementation MUST be documented in a dedicated markdown file in `data/plans/<plan_name>.md`.
   - Never rely on conversational memory or ephemeral thinking blocks. Context must be persisted to disk so future sessions retain full architectural and operational context.
2. **Standard Plan Schema**:
   Every plan document must include:
   - **Goal & Scope**: High-level problem statement and boundaries.
   - **Technical Design**: Schemas, interfaces, endpoints, component contracts, and lifecycle behavior.
   - **Task Breakdown with Status Checkboxes**: Discrete, verifiable tasks (`[ ]` Pending, `[/]` In Progress, `[x]` Completed, `[-]` Blocked).
   - **Dependencies & Inter-Task Blockers**: Clear callouts if a task relies on another task or external input.
   - **Verification Protocol**: Exact commands and behavioral tests required to confirm completion.

---

## 2. Strict Pre-Execution Approval Gate
1. **Zero Action Without Explicit Approval**:
   - The agent MUST NEVER execute code edits, file creations, schema changes, or database migrations until the user explicitly replies with unambiguous approval in chat (e.g. "approved", "proceed with plan").
   - Vague statements, automatic acknowledgments, or conversational transitions do NOT constitute approval.
2. **Review Halts**:
   - When presenting a plan, present the document path, summary, and HALT immediately to await user review.

---

## 3. Partial Execution, Dependency Handling & Blockers
1. **Never Leave State Ambiguous**:
   - When a plan contains numerous tasks, update the plan document after each milestone is verified.
2. **Halt on Blockers or Failures**:
   - If an error, environmental failure, or ambiguous requirement prevents finishing an approved task, the agent MUST NOT invent silent workarounds or proceed blindly to subsequent steps.
   - The agent MUST HALT immediately, document the exact failure and blocked dependency in the plan file, and ask the user when and how to finish or adjust the plan.
3. **Cross-Plan Dependency Management**:
   - If Plan A is waiting on Plan B (or waiting on user credentials/external inputs), mark Plan A as `[-] Blocked on <Dependency>` in the plan registry, inform the user, and request guidance before switching tasks.

---

## 4. Subprocess Lifecycle & Anti-Zombie Process Hygiene
1. **Mandatory Process Termination**:
   - Any spawned CLI, worker, or subprocess (such as CLI Agent `agy` sessions, Puppeteer browsers, or test runners) MUST be tracked by PID and explicitly terminated (`SIGTERM` with fallback to `SIGKILL`) immediately upon task completion, failure, or timeout.
   - Leaving background orphan/zombie processes lingering after task execution is strictly prohibited.
2. **Prohibition of Standing Headless Browser Daemons**:
   - Headless browsers (Google Chrome, Chromium, Puppeteer, Playwright) MUST NEVER be launched or left running as standing background daemons (`isDaemon: true`).
   - Browsers must be strictly ephemeral: spawned on-demand by the specific job or script requiring them, and terminated (`browser.close()`) immediately when the crawling, verification, or screenshot operation finishes.
3. **Mandatory Script Connection Teardown & Event Loop Cleanliness**:
   - Every script interacting with CDP, Puppeteer, WebSockets, or HTTP server sockets MUST wrap execution in a `try ... finally` block ensuring:
     - `await browser.disconnect()` or `await browser.close()`.
     - Explicit process termination (`process.exit(0)` on success, `process.exit(1)` on error) so open sockets do not keep the Bun/Node event loop alive.
4. **Post-Task Background Audit**:
   - The agent must never leave one-off scripts (e.g. `scratch/*.ts`, screenshot scripts, audit scripts) lingering in background task lists. Only persistent application services explicitly designated by the user (such as `web/src/server.ts`) may remain active.
