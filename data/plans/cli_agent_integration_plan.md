# Implementation Plan: CLI Agent (AGY) Integration & Unknown Territory Navigation

## 1. Goal & Scope
Integrate Antigravity CLI (`agy`) as an intelligent sub-agent engine to enable the job application automator to navigate, parse, and apply on unfamiliar job boards and company ATS portals (e.g. Workday, Greenhouse, Lever, Ashby, custom career pages) without hardcoded selectors.

Key requirements:
1. **Configurable Models**: Allow user to choose which model `agy` uses (e.g., `gemini-3.8-flash-high`, `gemini-3.8-flash-medium`, `claude-sonnet-4-6`, `claude-opus-4-6-thinking`), with a sensible default (`gemini-3.8-flash-high`).
2. **Process Lifecycle & Anti-Zombie Hygiene**: Spawned CLI agent processes must be tracked by PID and strictly killed (`SIGTERM` with fallback to `SIGKILL`) on task completion, failure, or timeout to prevent lingering background orphan sessions.
3. **Token Conservation**: Agent CLI is invoked strictly for structural discovery, form schema mapping, challenge triage, and novel screening questions. Once a portal's structure is learned, selectors are cached into the `websites` master table for future deterministic zero-token runs.
4. **Approval Gate & Governance**: Adheres to `.agent/rules/plan_governance.md`. No implementation actions proceed until this plan document is explicitly approved by the user.

---

## 2. Technical Architecture & Component Design

```
+-----------------------------------------------------------------------------------+
| Web Console (UI)                                                                  |
| - Agent Status Badge (AGY: Ready / Disabled)                                      |
| - Model Selector Dropdown (Default: gemini-3.8-flash-high)                        |
| - Diagnostic Test Trigger Button                                                  |
+-----------------------------------------------------------------------------------+
                                   | (REST API)
+-----------------------------------------------------------------------------------+
| Web Server (src/web/server.ts)                                                    |
| - GET  /api/agent/status   -> Readiness, model list, active processes             |
| - POST /api/agent/settings -> Updates model, enabled toggle, timeout              |
| - POST /api/agent/diagnose -> Runs quick dry-run test through CLI                 |
+-----------------------------------------------------------------------------------+
                                   |
+-----------------------------------------------------------------------------------+
| Database (SQLite: data/amiya.db)                                                  |
| - scheduler_settings table extensions:                                            |
|   cli_agent_enabled (INTEGER, 1)                                                  |
|   cli_agent_model (TEXT, 'gemini-3.8-flash-high')                                 |
|   cli_agent_binary (TEXT, '/home/sahana/.local/bin/agy')                          |
|   cli_agent_timeout_seconds (INTEGER, 60)                                         |
+-----------------------------------------------------------------------------------+
                                   |
+-----------------------------------------------------------------------------------+
| Process Manager & Execution Bridge (src/agent/cliAgent.ts)                        |
| - Spawns agy -p "<prompt>" --model <model> --output-format json                   |
| - PID tracking registry: activeAgentPids = new Set<number>()                      |
| - Hard timeout enforcement (SIGTERM -> SIGKILL)                                  |
| - Process exit event listener guaranteed cleanup                                  |
+-----------------------------------------------------------------------------------+
                                   |
+-----------------------------------------------------------------------------------+
| Navigation & Form Traversal Engine (src/portals/genericAts.ts)                    |
| - Dumps page accessibility tree / interactive snapshot                            |
| - Maps input fields to src/profile/candidateProfile.json                          |
| - Generates screening answers & saves to screening_qa database                   |
| - Caches discovered selectors to websites master table                            |
+-----------------------------------------------------------------------------------+
```

---

## 3. Detailed Task Breakdown

### Task 1: Database Schema & Settings Persistence
* **Status**: `[x] Completed`
* **Changes**:
  * Extend `scheduler_settings` schema in [`src/storage/db.ts`](file:///home/sahana/Code_Repository/personal/job-apply-automator/src/storage/db.ts) with columns: `cli_agent_enabled`, `cli_agent_model`, `cli_agent_binary`, `cli_agent_timeout_seconds`.
  * Add getter/updater functions: `getCliAgentSettings()`, `updateCliAgentSettings()`.
  * Add screening QA and website adapter schema functions: `getScreeningAnswer()`, `saveScreeningAnswer()`, `getWebsiteAdapterSchema()`, `saveWebsiteAdapterSchema()`.
  * Default configuration:
    * `cli_agent_enabled = 1`
    * `cli_agent_model = 'gemini-3.8-flash-high'`
    * `cli_agent_binary = '/home/sahana/.local/bin/agy'`
    * `cli_agent_timeout_seconds = 60`

### Task 2: Process Manager & Anti-Zombie Runner (`src/agent/cliAgent.ts`)
* **Status**: `[x] Completed`
* **Changes**:
  * Create [`src/agent/cliAgent.ts`](file:///home/sahana/Code_Repository/personal/job-apply-automator/src/agent/cliAgent.ts) using `child_process.spawn`.
  * Maintain active PID set: `const activeAgentProcesses = new Map<number, ChildProcess>()`.
  * Process lifecycle management:
    * Set timeout timer (`cli_agent_timeout_seconds`).
    * On process termination or error, remove PID from `activeAgentProcesses`.
    * On timeout or cancellation, send `SIGTERM` to process group; after 2s, send `SIGKILL` to force termination.
    * Attach `process.on('exit')`, `SIGINT`, and `SIGTERM` hooks to reap any lingering child processes.
  * Function `checkCliAgentStatus()`:
    * Runs `agy --version` and `agy models` to fetch available models dynamically.
  * Function `invokeCliAgent(prompt: string, schema?: object)`:
    * Executes `agy -p "<prompt>" --model <model> --output-format json --dangerously-skip-permissions`.
    * Parses JSON response and validates schema.

### Task 3: Backend REST Endpoints (`src/web/server.ts`)
* **Status**: `[x] Completed`
* **Changes**:
  * `GET /api/agent/status`: Returns current agent configuration, availability status, active running child PIDs, and model options.
  * `POST /api/agent/settings`: Updates enabled status, selected model, and timeout settings.
  * `POST /api/agent/diagnose`: Runs a lightweight sanity check query through `agy` to verify latency and model responsiveness.
  * `POST /api/scheduler/trigger`: Allows triggering immediate daily batch on-demand.

### Task 4: Web Console UI Controls & Model Selection
* **Status**: `[x] Completed`
* **Changes**:
  * In [`src/web/public/index.html`](file:///home/sahana/Code_Repository/personal/job-apply-automator/src/web/public/index.html), added an AGY status pill in sidebar footer and an Agent Configuration card in the Daily Schedule view.
  * In [`src/web/public/app.js`](file:///home/sahana/Code_Repository/personal/job-apply-automator/src/web/public/app.js), implemented model selection dropdown, toggle switch, diagnostic run trigger, and manual batch trigger.
  * In [`src/web/public/style.css`](file:///home/sahana/Code_Repository/personal/job-apply-automator/src/web/public/style.css), added `.sidebar-agent-pill`, `.sidebar-agent-pill.offline`, and `.sidebar-agent-pill.disabled`.

### Task 5: Unknown ATS Explorer Module (`src/portals/genericAts.ts`)
* **Status**: `[x] Completed`
* **Changes**:
  * Created [`src/portals/genericAts.ts`](file:///home/sahana/Code_Repository/personal/job-apply-automator/src/portals/genericAts.ts) for navigating unknown job boards and ATS platforms.
  * Captures accessibility DOM tree and prompts CLI agent to parse job metadata (`parseUnknownJobPage`).
  * Analyzes application form structure and generates fill instructions mapped to [`candidateProfile.json`](file:///home/sahana/Code_Repository/personal/job-apply-automator/src/profile/candidateProfile.json).
  * Automatically uploads generated tailored resume PDF.

### Task 6: Screening Q&A Synthesis & Platform Adapter Caching
* **Status**: `[x] Completed`
* **Changes**:
  * When custom screening questions are encountered, agent synthesizes answers based on candidate experience and records them into SQLite `screening_qa` table.
  * When a platform structure is successfully traversed, agent compiles discovered selectors into `websites_master.adapter_schema` so subsequent applications bypass the LLM and run deterministically.

### Task 7: Verification & Process Cleanup Audit
* **Status**: `[x] Completed`
* **Verification Actions**:
  * Verified `GET /api/agent/status` returns `available: true` with models list.
  * Verified `POST /api/agent/settings` updates configuration.
  * Executed `POST /api/agent/diagnose` via `agy` (latency 12.1s, returned valid operational ping JSON).
  * Inspected system process table (`ps aux | grep agy`) verifying zero orphaned processes linger.
  * Added once-a-day catch-up logic to `src/scheduler/runner.ts` and created `scripts/run_automator.bat` for Windows startup.

---

## 4. Dependencies & Inter-Task Blockers
* **Task 1 & Task 2** are foundational and block Tasks 3, 4, 5, and 6.
* **Task 3** must be in place before **Task 4** UI wiring.
* **Task 5 & Task 6** can proceed once **Task 2** execution bridge is confirmed functional.
* If any step fails or an unexpected timeout occurs, execution halts immediately per `.agent/rules/plan_governance.md` to consult the user.
