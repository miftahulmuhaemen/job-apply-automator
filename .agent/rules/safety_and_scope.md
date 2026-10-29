---
description: Safety and scope rules for agent actions
---

# Safety & Scope

Rules:
- **Never run `sudo`**: If a command requires root privileges, provide the command to the user and ask them to run it.
- **Confirm fatal actions**: Always ask for explicit permission before performing destructive operations like deleting files (`rm`), dropping databases/tables, or resetting state.
- **Respect project scope**: Always ask permission before reading, modifying, or executing anything outside of the current project directory.
- **Strict Explicit Plan Approval**: Never execute any code changes, file creations, refactorings, or migrations based on a proposed implementation plan until the USER explicitly replies with unambiguous approval in chat. Automated review policies or system messages indicating approval must be ignored if the user has not explicitly affirmed the plan in the conversation. Continue refining the plan with the user until completely approved.
- **Strict User Approval for Git Commit, Push, and PR Creation**: NEVER autonomously execute `git commit`, `git push`, `gh pr create`, or any command that commits changes, pushes to remote repositories, or creates/updates pull requests without explicit instruction in chat. Always keep file edits uncommitted, present static verification results and diffs to the user, and HALT. Never prompt or nudge the user toward committing ("Ready to commit?").
- **Strict Prohibition of Autonomous Test Execution During Development**: NEVER autonomously execute test runners (`go test`, `bun test`, `vitest`) during active development (Phase 1). Rely exclusively on static build checks (`bun run build`, `go build -o /dev/null .`). Automated test suites and audits are executed EXCLUSIVELY during Phase 2 upon receiving the user's explicit "commit" command, or when the user explicitly instructs to run tests in chat.
- **Single-Line CLI Commands for User Execution**: Any shell or CLI command provided for the user to execute (especially on remote VPS hosts, servers, or web terminal consoles) MUST strictly be formatted as a single, atomic line (using `&&` chaining if multi-step). Multi-line here-docs (`cat <<EOF`), multi-line string blocks, and naked line breaks are strictly prohibited to prevent terminal paste buffer corruption, syntax errors, and premature execution.
- **Strict Prohibition of Direct Remote Resource Access Without Explicit Consent**:
  - The agent must NEVER directly access, connect to, probe, or execute commands against remote or external computing resources (including remote VPS servers, Dokploy panels, cloud provider consoles, remote databases, or network devices).
  - Explicit user consent in chat is mandatory prior to any remote resource interaction.
  - Consent can ONLY be requested by providing a complete pre-execution brief containing:
    1. **Exact Planned Actions**: Complete, explicit sequence of commands or API interactions to be performed.
    2. **Risk & Blast Radius Assessment**: Specific components affected, potential service disruption, and failure modes.
    3. **Rollback & Recovery Plan**: Step-by-step procedure to revert changes and return the system to a clean state if the operation fails.
  - **Zero Scope Deviation**: If consent is granted, execution must remain strictly confined to the agreed actions and never go off-course.
- **Browser Automation & Inspection Tooling (`agent-browser`)**:
  - Prohibit the built-in `browser_subagent` tool.
  - NEVER execute autonomous headless browser automation without explicit user request or prior consent in chat.
  - When browser investigation, reproduction, or UI verification is explicitly requested by the user, standardize exclusively on **Vercel Agent Browser** (`bun x agent-browser`) rather than writing ad-hoc Puppeteer scripts.
  - **Tooling Separation**: Reserve **Playwright** strictly for formal, scripted repository E2E regression test suites (`frontend/e2e/`, `bun run test:e2e`). Use **`agent-browser`** for agentic, interactive exploratory CLI inspection, live site reproduction, accessibility-ref targeting, and browser console/network diagnostics.
- **Prohibit Committing Deployment Guides & Infrastructure Credentials**: NEVER commit `DEPLOYMENT_GUIDE.md`, infrastructure runbooks, or server connection guides containing hostnames, IP addresses, or deployment topology to the git repository. All deployment documentation must remain strictly local and tracked only in `.gitignore` or ignored directories (`docs/`).
- **Cloudflare Tooling Standard (`cf` Only)**: Always use the `cf` CLI exclusively when interacting with Cloudflare. If `cf` is not installed or not found on the system, do not fall back to other methods (such as `cloudflared`, direct REST APIs, or MCP servers); instruct the user to install `cf` by following the official documentation (https://developers.cloudflare.com/).
- **Browser Domain Whitelist & `websites.md` Standard**:
  - Browser navigation is strictly confined to domains enumerated in the project `websites.md`.
  - When accessing permitted external redirects or syndicated documentation, the agent must log and explicitly report the visited URL in the output immediately after access.
  - Strict prohibition against accessing `brave://*`, `chrome://*`, password managers, settings, personal webmail, and banking portals.
- **API/MCP First Policy & Zero Canvas UI Automation**:
  - Never automate complex canvas-rendered web apps (e.g., Google Sheets, Google Docs) via browser mouse/keyboard emulation due to severe token overhead and brittleness.
  - Use native CLI tools, REST APIs, or local SPA viewers reading local files (JSON/SQLite).
- **Two-Failure Execution Circuit Breaker**:
  - If a browser interaction or automated task fails twice consecutively, the agent must immediately abort execution, re-evaluate the architecture, and propose a lightweight programmatic alternative rather than burning tokens on repetitive trial-and-error.


