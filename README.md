# Job Apply Automator

Automated ATS job ingestion, criteria-based evaluation, sub-agent screening question synthesis, and application submission engine.

The system is architected into two decoupled components sharing a unified database state:
1. **Native Rust CLI & Backend Server** (`cli/`): Lightweight native application for headless execution, Axum embedded web server (`job-apply-cli server`), Cloudflare D1 direct HTTPS client, Chrome DevTools Protocol (CDP) browser automation, sub-agent process management, and once-a-day catch-up scheduling.
2. **Web Triage Console** (`web/`): Full-featured web interface running at `http://localhost:3100` for candidate review, manual triage, resume document generation, and portal configuration.

---

## Architecture & Directory Topology

The codebase enforces strict domain and intention-based segregation. Code is organized into dedicated directories per action intention rather than arbitrary monolithic folders:

```
job-apply-automator/
├── cli/                                # Native Rust CLI Engine
│   ├── Cargo.toml                      # Dependencies & Release optimizations (LTO, strip)
│   └── src/
│       ├── storage/                    # Cloudflare D1 HTTPS client & single-roundtrip repositories
│       │   ├── d1_client.rs            # D1 REST API client with HTTPS connection pooling
│       │   ├── companies.rs            # Companies repository (v_companies_summary)
│       │   ├── candidate.rs            # Candidate profile & attributes repository
│       │   ├── websites.rs             # Websites repository with COALESCE updates
│       │   ├── jobs_ledger.rs          # Atomic job status transitions & batch updates
│       │   └── mod.rs
│       ├── web_server/                 # Embedded Axum async HTTP server & SPA fallback
│       │   ├── mod.rs
│       │   └── routes.rs
│       ├── job_triage/                 # Action: Ingesting, counting, and status tracking
│       ├── job_crawling/               # Action: Crawling portals & unknown ATS exploration
│       ├── job_application/            # Action: Form filling & terminal review gates
│       ├── screening_qa/               # Action: Novel employer screening Q&A persistence
│       ├── agent_bridge/               # Action: Antigravity CLI (agy) subagent process bridge
│       ├── daily_scheduler/            # Action: Scheduling & once-a-day startup catch-up
│       ├── browser_cdp/                # Action: WebSocket CDP client to Brave browser
│       ├── cli_commands/               # Action: CLI parsing & subcommand orchestration
│       └── main.rs                     # CLI entry point
│
├── web/                                # Triage Web Console & HTTP Server
│   ├── src/                            # Backend API & Domain Layer
│   │   ├── server.ts                   # Bun HTTP API server (port 3100)
│   │   ├── routes/                     # Domain route handlers (jobs, candidate, criteria, system, etc.)
│   │   ├── storage/                    # Cloudflare D1 REST & R2 S3 SDK storage layer
│   │   │   └── repositories/           # Modular data access repositories (jobRepo, candidateRepo, etc.)
│   │   ├── browser/                    # Browser detection & portal authentication launcher
│   │   ├── crawler/                    # Dynamic accessibility tree crawler (a11y card clicks)
│   │   ├── submission/                 # Automated portal drivers (Kalibrr, Workable, Sevima)
│   │   ├── generator/                  # ATS resume & cover letter generator (`resumeBuilder.ts`)
│   │   └── agent/                      # Subagent status & settings adapter (`cliAgent.ts`)
│   ├── frontend/                       # Modern Svelte 5 Runes Web UI (Vite 6)
│   │   ├── src/
│   │   │   ├── lib/components/         # Shadcn neutral zinc components, modals, and views
│   │   │   │   ├── ui/                 # Reusable primitives (ActionPopover, StageFilterPopover, Switch)
│   │   │   │   ├── settings/           # Configuration modals (Scheduler, Agent, Connections)
│   │   │   │   ├── jobs/               # Data tables and dossier inspection modals
│   │   │   │   └── layout/             # Application shell and sidebar
│   │   │   ├── App.svelte              # Main application root
│   │   │   └── app.css                 # Canonical Shadcn Zinc color tokens & styling
│   │   └── package.json                # Frontend package manifest (Svelte 5, Lucide)
│   └── dist/                           # Compiled production static assets served by Bun
│
├── data/                               # Configuration & Active Governance
│   └── plans/                          # Active plan governance documents
│
├── .agent/                             # Agent Governance & Specifications
│   ├── rules/                          # Core behavioral invariant standards
│   │   ├── governance_and_workflow.md      # Safety, plan governance & git release gates
│   │   ├── data_integrity_and_verification.md # Anti-hallucination & cross-verification standards
│   │   ├── ui_and_document_standards.md    # Shadcn monochrome & ATS document standards
│   │   └── codebase_hygiene_and_runtime.md # Runtimes, zero legacy & portal driver contract
│   └── workflows/                      # Procedural execution lifecycles
│
├── .agents/skills/                     # Workspace AI Agent Skills (shadcn, migrate-radix-to-base)
├── .gitignore                          # Repository ignore patterns
└── README.md                           # System documentation
```

---

## Code Safety & Engineering Standards

- **Zero SQL Injection**: All database queries strictly use positional parameterized bindings (`rusqlite::params![]` in Rust; prepared statements in Web server). Dynamic string concatenation in SQL queries is prohibited.
- **Zero Command Injection**: External processes (`agy`) are spawned with discrete argument vectors (`std::process::Command::arg`) rather than passed through shell string interpolation.
- **LOC Boundaries**: Source files are restricted to a maximum of 300 lines of code, organized by single-responsibility units.
- **Process Hygiene**: All spawned subagents are tracked in an active PID registry. Hard timeouts trigger progressive termination (`SIGTERM` followed by `SIGKILL` after 2 seconds) to guarantee zero zombie child processes persist.

---

## Prerequisites

1. **Rust Toolchain**: `rustc 1.80+` and `cargo` installed.
2. **Bun Runtime**: `bun 1.1+` installed for the Web Console and scripts.
3. **Brave Browser (or Google Chrome)**: Installed on Windows (`C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe`) or Linux host.
4. **Antigravity CLI** (`agy`): Installed at `/home/sahana/.local/bin/agy` (or configured via settings).

---

## Step-by-Step Getting Started Guide

### Step 1: Launch the Web Console
Start the local triage and governance dashboard:
```bash
bun run web
```
Open [http://localhost:3100](http://localhost:3100) in your browser.

### Step 2: Authenticate Job Portals (One-Time Setup)
Job portals (Kalibrr, Glints, Jobstreet) require interactive login to bypass Cloudflare Turnstile, CAPTCHA, and OTP challenges.

All session credentials and cookies are stored in a dedicated, isolated profile directory on your native Windows drive: `C:\Users\<user>\.job_apply_automator\browser_profile` (accessible in WSL2 at `/mnt/c/Users/<user>/.job_apply_automator/browser_profile`). This prevents network UNC profile errors, keeps automation completely separate from your personal browsing, and avoids profile chooser popups.

You can authenticate portals in either of two ways:
- **Option A (Via Web Console)**: Go to **Websites Directory** (`http://localhost:3100`), click **[ Authenticate ]** on the desired portal row (e.g. Kalibrr), log in inside the opened window, then click **[ Re-check ]**.
- **Option B (Via CLI)**:
  ```bash
  # Authenticate specific portal
  bun run auth kalibrr
  bun run auth glints
  bun run auth jobstreet
  bun run auth linkedin

  # Verify session tokens are stored and active
  bun run auth --check
  ```

### Step 3: Launch the Automation Browser (CDP Port 9222)
When running automated job crawling or subagent exploration, start the automation browser:
```bash
bun run browser
```
This script automatically:
1. Resolves `C:\Users\<user>\.job_apply_automator\browser_profile` on the local Windows drive.
2. Launches desktop Brave attached strictly to this dedicated profile.
3. Binds Chrome DevTools Protocol to port `9222` (`--remote-debugging-port=9222`).
4. Bypasses the "Who's using Brave?" profile picker entirely.

### Step 4: Run Automation & Daily Job Triage

- **Build the Native CLI binary**:
  ```bash
  bun run cli:build
  ```

- **Run daily batch catch-up (runs once per day)**:
  ```bash
  bun run cli:schedule
  ```

- **Explore and ingest an individual job post**:
  ```bash
  ./cli/target/release/job-apply-cli explore --url "https://www.kalibrr.com/id-ID/c/example/jobs/12345"
  ```

- **Review and approve applications**:
  Open the Web Console at `http://localhost:3100` to review newly crawled jobs, inspect salary benchmarks, approve matches, and manage decision criteria.

---

## CLI Usage

### Build the Rust Native Binary
```bash
cd cli
cargo build --release
```
The compiled executable is located at `cli/target/release/job-apply-cli`.

### Commands & Subcommands

1. **Output System Status & Quota**:
   ```bash
   ./cli/target/release/job-apply-cli status
   ```

2. **Execute Once-a-Day Schedule Catch-Up**:
   ```bash
   # Runs if no batch has completed today; otherwise exits cleanly
   ./cli/target/release/job-apply-cli schedule --once

   # Force execution regardless of whether today already completed
   ./cli/target/release/job-apply-cli schedule --once --force
   ```

3. **Sub-Agent Connectivity & Diagnostics**:
   ```bash
   ./cli/target/release/job-apply-cli agent-diagnose
   ./cli/target/release/job-apply-cli agent-diagnose --model claude-sonnet-4-6
   ```

4. **Explore & Ingest Unknown Job Posting**:
   ```bash
   ./cli/target/release/job-apply-cli explore --url "https://boards.greenhouse.io/company/jobs/12345"
   ```

5. **Manual Application Session**:
   ```bash
   # Safe preview mode (stops at final review screen)
   ./cli/target/release/job-apply-cli apply --dry-run

   # Autonomous submission
   ./cli/target/release/job-apply-cli apply --auto-submit
   ```

---

## Web Console

### Build Web Assets (Svelte 5 & Vite)
Compile the Svelte 5 frontend into `web/dist/`:
```bash
bun run build
```

### Start Web Server
```bash
bun run web
```
The Web Console is accessible at `http://localhost:3100`.

### Key Features
- **Svelte 5 Runes & Shadcn Zinc Monochrome UI**: High-contrast neutral zinc interface (`#09090b` to `#ffffff`) built with modern Svelte 5 runes (`$state`, `$derived`, `$props`), strictly left-aligned data table toolbars, dynamic column widths, and canonical modal patterns.
- **Job Triage & Review**: Review crawled jobs, approve candidate matches, and drop unneeded roles with state history audit timelines.
- **Personalization & Decision Criteria**: Structured table ledger of candidate parameters, screening disclosures, triage boundaries, and compensation floors with interactive On/Off status toggles and soft-deletion.
- **Websites Directory**: Maintain master portals, authentication notes, session health statuses, and cached ATS adapter schemas.
- **Companies Master**: Track employer application frequencies, historical posting archives, and cooldown evaluation.
- **Cloudflare D1 & R2 Storage**: Cloud-native persistence using Cloudflare D1 (`amiya`) for structured relational data and Cloudflare R2 bucket (`amiya`) for screenshots and ATS resume PDFs, with a 60-second in-memory status cache.
- **System Settings & Agent**: Dedicated settings modals for Daily Scheduler, AGY subagent engine models (`gemini-3.8-flash-high`, `claude-sonnet-4-6`, `claude-opus-4-6-thinking`), and storage connection status.
- **ATS Document Standards**: Strict single-column ATS specifications with `Open Sans` typography and Google XYZ bullet formulation codified in `.agent/rules/ui_and_document_standards.md`.

---

## Portal Authentication & Session Governance

Major recruitment portals (Kalibrr, Glints, Jobstreet, LinkedIn) deploy bot protection barriers including Cloudflare Turnstile, OTP email/SMS verification, and interactive Google login challenges. The engine resolves this via an isolated browser profile stored on the native Windows drive:
```
C:\Users\<user>\.job_apply_automator\browser_profile
```
(Accessible inside WSL2 at `/mnt/c/Users/<user>/.job_apply_automator/browser_profile`).

Cookies, credentials, and session tokens persist in this directory. Once authenticated interactively, headless CLI crawls and autonomous subagent operations reuse this profile without re-triggering authentication barriers.

### Authentication via Web Console

1. Open the Web Console at `http://localhost:3100`.
2. Navigate to **Websites Master Directory** from the sidebar.
3. Observe the **Session Status** column for each portal:
   - `AUTHENTICATED`: Active valid session detected in SQLite cookie storage.
   - `WINDOW OPEN`: The browser window is currently open (cookies locked until closed).
   - `REQUIRES_LOGIN`: No active session token found.
4. Click **[ Authenticate ]** on the desired portal row (e.g. Kalibrr).
   - The system launches your desktop browser pointing to the portal login page.
   - Complete your login and pass any Cloudflare Turnstile or OTP challenges.
   - **Close the login browser window** to flush cookies to disk.
5. Click **[ Re-check ]** or **[ Check All Sessions ]** to confirm the badge transitions to `AUTHENTICATED`.

### Authentication via CLI Launcher

You can authenticate or inspect session tokens directly from the terminal:

```bash
# Check current session health across all supported portals
bun run auth --check

# Launch interactive login window for a specific portal
bun run auth kalibrr
bun run auth glints
bun run auth jobstreet
bun run auth linkedin
```

---

## Windows Startup Automation (Daily Run)

The application automatically runs once a day whenever the computer is turned on, regardless of the time of day (morning or night).

### Setup Instructions
1. Press `Win + R`, type `shell:startup`, and press Enter.
2. Create a shortcut in that folder pointing to:
   ```cmd
   wsl.exe -d Ubuntu -e /home/sahana/Code_Repository/personal/job-apply-automator/cli/target/release/job-apply-cli schedule --once
   ```
3. The command executes the daily catch-up check:
   - If a batch has not completed today, it executes the run.
   - If a batch has already completed today, it immediately exits without consuming system resources.

---

## Roadmap & Architecture TODOs

### First-Time User Onboarding & Dynamic Profile Bootstrap (Zero-JSON Architecture)
- **Status**: Implemented. All candidate profile attributes are dynamically managed in `candidate_profile_attributes` (SQLite / Cloudflare D1). Static profile JSON files have been completely purged from the codebase.
- **Onboarding Flow**:
  1. **Resume & Photo Ingestion**: On initial launch, the user uploads their existing CV/resume (PDF) and candidate photo via the Web Console or CLI.
  2. **Interactive Setup Questionnaire**: The user configures criteria rules and platform prerequisites (e.g. salary expectations, work arrangements, notice period, location preferences) in the Web Console.
  3. **Automated Database Seeding**: The ingestion engine parses candidate data and populates `candidate_profile_attributes`.
  4. **Dynamic Application Execution**: All autonomous crawling, ATS document tailoring, and form fill previews load candidate data dynamically from the database at runtime, guaranteeing zero hardcoded PII in source files or plans.
