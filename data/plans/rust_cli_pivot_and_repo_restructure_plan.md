# Implementation Plan: Rust CLI Native Pivot, Directory Segregation & Repository Standards

## 1. Goal & Scope
Pivot the Job Apply Automator CLI from TypeScript/Bun to a pure native **Rust CLI application** to achieve minimal memory footprint (~12MB RAM vs ~140MB in Node/Bun), sub-millisecond cold start times, and zero external runtime dependencies on the host system.

Concurrently:
1. Segregate the codebase cleanly into distinct top-level domains: `cli/` (Rust native engine) and `web/` (Triage Web Console).
2. Apply strict Layered Clean Architecture tailored for Rust (`domain`, `infrastructure`, `application`, `interfaces`) and Web Console standards.
3. Enforce strict code hygiene (LOC caps <300 lines/file, full parameterization against SQL/command injection, explicit error propagation).
4. Provide comprehensive `.gitignore` and `README.md`.
5. Add an agent rule mandating continuous `README.md` synchronization on every future change.

---

## 2. Technical Architecture & Lighter Solution Decision

### Lightest Path Determination
- **Direct CDP via WebSocket in Rust** (`tokio-tungstenite` + `serde_json` to Brave DevTools port 9222):
  - **Memory Footprint**: ~10–15 MB RAM (compared to ~140 MB for Puppeteer on Node/Bun).
  - **Binary Profile**: Standalone ~6–8 MB stripped native executable.
  - **Startup Latency**: ~3 ms cold start.
  - **Direct Storage**: Embedded `rusqlite` talking directly to `data/amiya.db` with WAL mode and parameterized queries.
  - **Process Management**: Deterministic child process lifecycle (`std::process::Command`) with POSIX signal handlers (`SIGTERM` -> 2s fallback to `SIGKILL`) preventing zombie `agy` sessions.

### Directory Structure & Segregation
```
job-apply-automator/
├── cli/                                # Rust CLI Native Crate
│   ├── Cargo.toml
│   └── src/
│       ├── domain/                     # Entities & Contracts
│       │   ├── mod.rs
│       │   ├── job.rs                  # JobRecord, JobStatus, SalaryRules
│       │   ├── settings.rs             # SchedulerSettings, AgentConfig
│       │   └── screening.rs            # ScreeningQA, FormMapping
│       ├── infrastructure/             # External Adapters
│       │   ├── mod.rs
│       │   ├── storage/
│       │   │   ├── mod.rs
│       │   │   ├── sqlite_repo.rs      # rusqlite repository implementation
│       │   │   └── migrations.rs       # Schema & column verification
│       │   ├── browser/
│       │   │   ├── mod.rs
│       │   │   ├── cdp_client.rs       # Direct WebSocket CDP connection to Brave
│       │   │   └── dom_inspector.rs    # Accessibility & interactive tree dumps
│       │   └── agent/
│       │       ├── mod.rs
│       │       ├── process_manager.rs  # PID registry & anti-zombie killer
│       │       └── agy_bridge.rs       # Invoker for agy CLI subagent
│       ├── application/                # Business Logic & Use Cases
│       │   ├── mod.rs
│       │   ├── crawler/
│       │   │   ├── jobstreet.rs        # Jobstreet portal crawler
│       │   │   ├── linkedin.rs         # LinkedIn portal crawler
│       │   │   └── generic_ats.rs      # Unknown ATS autonomous explorer
│       │   ├── scheduler/
│       │   │   └── catchup_runner.rs   # Once-a-day boot catch-up logic
│       │   └── screening/
│       │       └── qa_synthesizer.rs   # Screening question answerer & caching
│       ├── interfaces/                 # CLI Interface
│       │   ├── mod.rs
│       │   └── cli_args.rs             # clap command-line parser & subcommands
│       └── main.rs                     # Entry point & signal handlers
├── web/                                # Triage Web Console & HTTP Server
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   └── server.ts                   # Bun HTTP API Server
│   └── public/
│       ├── index.html                  # Semantic Web Console UI
│       ├── style.css                   # High-contrast CSS
│       └── app.js                      # Client-side state & views controller
├── data/                               # Shared Data & Persistence
│   ├── amiya.db                        # Unified SQLite database
│   ├── candidateProfile.json           # Candidate resume profile & preferences
│   ├── personalization.md              # Filter rules & criteria
│   └── plans/                          # Persistent plan governance documents
├── scripts/                            # Platform Launchers & Utilities
│   ├── run_automator.bat               # Windows startup launcher
│   └── start_web_console.bat           # Web console launcher
├── .agent/rules/                       # Agent Governance & Standards
├── .gitignore                          # Git ignore definitions
└── README.md                           # System documentation
```

---

## 3. Engineering & Code Standards

1. **Rust Layered Architecture & Safety**:
   - **Zero SQL / Command Injection**: All SQL queries MUST use positional parameterized bindings via `rusqlite::params![]`. Process invocations MUST pass arguments as discrete vectors without shell interpolation.
   - **LOC Boundary**: Strict maximum of 300 lines of code per file. Functions broken into single-responsibility units.
   - **Idiomatic Error Handling**: Use `thiserror` for library-level domain error taxonomies and `anyhow` for top-level CLI execution reporting.
2. **Web Architecture & State Segregation**:
   - The Web Console remains lightweight in Bun/TypeScript (`web/`), sharing `data/amiya.db` with the CLI.
3. **Governance & Documentation Rule**:
   - Update `.agent/rules/` with `documentation_sync.md` mandating that every pull request or feature modification updates `README.md` with relevant flags, schemas, and architecture notes.

---

## 4. Task Breakdown

### Task 1: Environment & Toolchain Setup
* **Status**: `[x] Completed`
* **Changes**:
  * Installed Rust toolchain (`rustc 1.80+` / `cargo 1.80+`) on system via `rustup`.
  * Verified cargo environment.

### Task 2: Repository Restructure & Git Hygiene
* **Status**: `[x] Completed`
* **Changes**:
  * Created `cli/` and `web/` directories.
  * Relocated web console files (`src/web/*`) cleanly into `web/` (`web/src/server.ts`, `web/public/*`).
  * Added production-grade `.gitignore` covering `target/`, `node_modules/`, `data/*.db-journal`, PDF artifacts, and editor temporary files.
  * Authored comprehensive `README.md` detailing architecture, CLI commands, web console, and setup instructions.
  * Created `.agent/rules/documentation_sync.md` enforcing mandatory README updates on all future changes.

### Task 3: Rust CLI Workspace & Intention-Based Structure
* **Status**: `[x] Completed`
* **Changes**:
  * Initialized `cli/Cargo.toml` with dependencies: `rusqlite` (bundled), `tokio`, `tokio-tungstenite`, `serde`, `serde_json`, `clap`, `thiserror`, `anyhow`, `chrono`, `uuid`, `reqwest`, `nix`.
  * Configured release profile for maximum size and speed (`opt-level = "z"`, `lto = true`, `codegen-units = 1`, `panic = "abort"`, `strip = true`).
  * Segregated code strictly by action intentions:
    - `cli/src/storage/`: Database connection, WAL mode, pragmas, schema migrations.
    - `cli/src/job_triage/`: Ingested job models, status tracking, triage repository.
    - `cli/src/job_crawling/`: Portal preferences, generic ATS sub-agent parsing, form mapping.
    - `cli/src/job_application/`: Form payload models, review inspector terminal prompt.
    - `cli/src/screening_qa/`: Screening question persistence & repository.
    - `cli/src/agent_bridge/`: Subagent process manager, PID registry, anti-zombie signals.
    - `cli/src/daily_scheduler/`: Once-a-day boot catch-up engine & settings repository.
    - `cli/src/browser_cdp/`: Low-level Chrome DevTools Protocol WebSocket client.
    - `cli/src/cli_commands/`: `clap` arguments parser and subcommand runners.

### Task 4: Native SQLite Storage Layer
* **Status**: `[x] Completed`
* **Changes**:
  * Implemented `rusqlite` with WAL mode and foreign key pragmas in `cli/src/storage/connection.rs`.
  * Implemented parameterized repository operations with zero SQL injection risk across all domain modules.

### Task 5: Sub-Agent (`agy`) Process Manager
* **Status**: `[x] Completed`
* **Changes**:
  * Implemented `ProcessManager` tracking active child PIDs.
  * Enforced progressive termination (`SIGTERM` -> 2s -> `SIGKILL`).
  * Implemented non-interactive JSON parser for `agy -p "<prompt>" --model <model> --output-format json`.

### Task 6: Direct Brave CDP Client
* **Status**: `[x] Completed`
* **Changes**:
  * Implemented direct WebSocket CDP client connecting to Brave on port 9222.
  * Implemented DOM element evaluation, text extraction, navigation, and click actions over CDP.

### Task 7: Scheduler Catch-Up & CLI Interface
* **Status**: `[x] Completed`
* **Changes**:
  * Implemented `clap` CLI subcommands: `status`, `agent-diagnose`, `schedule`, `explore`, `apply`.
  * Updated `scripts/run_automator.bat` to launch `cli/target/release/job-apply-cli schedule --once`.

### Task 8: Verification, Benchmarking & Graphify Update
* **Status**: `[x] Completed`
* **Verification Actions**:
  * Compiled release binary size: 3.6 MB stripped native executable.
  * Verified sub-millisecond execution via `./cli/target/release/job-apply-cli status`.
  * Verified sub-agent execution via `./cli/target/release/job-apply-cli agent-diagnose` (12.6s, status: operational).
  * Verified zero lingering `agy` child processes in `ps aux`.
  * Verified Web Console operates smoothly at `http://localhost:3100` via `bun run web/src/server.ts`.

---

## 5. Dependencies & Blocker Assessment
- **Rust Toolchain**: Requires installing `rustup` on the WSL2 environment before code compilation in Task 3.
- In accordance with `.agent/rules/plan_governance.md`, no implementation actions proceed until explicit user approval is granted.
