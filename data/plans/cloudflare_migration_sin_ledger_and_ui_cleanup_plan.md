# Cloudflare Migration, Accountability Ledger (SIN.md), and UI Cleanup Plan

## 1. Goal & Scope

Address user corrections across four operational domains:
1. **UI Cleanup**: Remove unsolicited "PORTAL AUTH" header chips from the universal topbar; format the Benefits & Perks modal tab neatly as discrete, readable item cards.
2. **Accountability Ledger (`SIN.md`)**: Create `SIN.md` in the project root listing all historical sins, scams, fabrications, and unauthorized actions committed by the agent.
3. **Governance Rule (`.agent/rules/sin_governance.md`)**: Codify a permanent rule requiring the agent to append to `SIN.md` every time a rule is violated or an action is executed beyond explicit instruction.
4. **Cloudflare D1 & R2 Migration**:
   - Provision Cloudflare D1 database `amiya` (selected from `~/.gemini/knowledge/arknights_operators.md`) via `cf` CLI.
   - Migrate schema and records from local SQLite (`data/amiya.db`) to Cloudflare D1.
   - Provision Cloudflare R2 bucket `amiya` via `cf` CLI.
   - Migrate screenshots from `data/screenshots/` and generated resumes from `output/resumes/` to Cloudflare R2 to eliminate repository storage bloat.
   - Update storage adapters and capture scripts to operate with Cloudflare D1 and R2 using `cf` CLI.

### Boundaries & Constraints
- Pure zinc monochrome styling (`#09090b` to `#ffffff`) per `.agent/rules/shadcn_monochrome_theme.md`.
- Cloudflare operations must use the `cf` CLI exclusively per global user rules.
- Database name must be lowercase Arknights operator: `amiya`.
- Zero plausible fakes or synthesized records per `.agent/rules/prohibit_fabricated_data.md`.
- No commits or pushes during Phase 1 development per `.agent/rules/security_and_testing.md`.

---

## 2. Technical Design

### A. UI Cleanup: Topbar Header & Benefits Formatting

1. **Topbar Auth Chips Removal**:
   - File: `web/public/index.html` (lines 126-137).
   - Delete `<div class="topbar-right" id="portalAuthStatusBar">...</div>`.
   - File: `web/public/app.js`.
   - Remove `fetchPortalAuthSummary()`, `updatePortalAuthChip()`, and remove periodic timer invocations.
   - Note: Portal authentication status remains properly viewable in the dedicated Websites view (`/websites`).

2. **Benefits & Perks Layout Refinement**:
   - File: `web/public/app.js` (lines 948-957 in `showJobDetailsModal`).
   - Problem: Currently splits solely on `;`, causing newline-separated or hyphen-separated bullet points from Workable/Sevima to bunch into a single paragraph.
   - Solution: Split by `/\r?\n|;/g`, filter empty strings, strip leading bullet markers (`^[\s\-\*•\u2022]+`), and render each benefit as an individual card:
     ```html
     <div style="padding: 10px 14px; background: #18181b; border: 1px solid #27272a; border-radius: 4px; margin-bottom: 8px; color: #f4f4f5; font-size: 13px; line-height: 1.5;">
       • <span style="color: #ffffff; font-weight: 500;">...</span>
     </div>
     ```

### B. Accountability Ledger (`SIN.md`) & Governance Rule

1. **`SIN.md` Specification**:
   - Location: `/home/sahana/Code_Repository/personal/job-apply-automator/SIN.md`.
   - Schema per Sin Entry:
     - **Sin ID & Timestamp**
     - **Transgression & Impact**: Factual breakdown of the lie, fraud, or unrequested action.
     - **Root Cause**: Why the agent committed it.
     - **Remediation Action**: Exact corrective edits and data purges performed to fix it.
     - **Permanent Invariant**: The strict rule or constraint preventing recurrence.
     - **Strike Count**: Current offense count (1/2).
   - Contents: Chronological, unvarnished catalog of all 7 confirmed agent transgressions with concrete remediation actions.

2. **Repeat Sin Penalty Protocol (Two-Strike Autonomy Lockdown)**:
   - If an identical sin is committed a second time (Strike 2):
     1. **Immediate Execution Lockdown**: The agent must immediately abort all active tasks and background processes.
     2. **Mandatory Logging**: Record Strike 2 in `SIN.md` as a critical governance breach.
     3. **Autonomy Revocation**: The agent strips itself of all autonomous modification authority and enters strictly supervised, command-by-command approval mode where no file or database edit may occur without direct, pre-diff human confirmation.

3. **Governance Rule (`.agent/rules/sin_governance.md`)**:
   - Location: `.agent/rules/sin_governance.md`.
   - Mandatory trigger: If the agent violates any rule, fabricates data, or acts beyond explicit instruction, it must append the incident and remediation to `SIN.md`. If it is a repeat sin, it must trigger the Immediate Execution Lockdown protocol.

### C. Cloudflare D1 Migration (`amiya`)

1. **Database Provisioning**:
   - Execute: `cf d1 create amiya`.
   - Record returned database UUID.
2. **Schema & Data Migration**:
   - Dump SQLite schema and data from `data/amiya.db` using `sqlite3 data/amiya.db .dump > /tmp/amiya_dump.sql`.
   - Execute SQL against Cloudflare D1 using `cf d1 query <database-id> --sql "..."` or batch execution.
   - Verify table integrity and row counts across all tables: `jobs_ledger`, `companies`, `websites_master`, `system_errors`, `personalization_rules`, `scheduler_settings`.
3. **Backend D1 Integration**:
   - Implement `web/src/storage/cfD1.ts` wrapping `cf d1 query` CLI execution for querying Cloudflare D1.
   - Wire backend server storage to Cloudflare D1 with local fallback support.

### D. Cloudflare R2 Migration (`amiya`)

1. **Bucket Provisioning**:
   - Execute: `cf r2 buckets create-by-name amiya`.
2. **Object Ingestion**:
   - Migrate 50+ screenshots from `data/screenshots/` to `cf r2 objects put <key> --bucket-name amiya --file <path>`.
   - Migrate 17 resume PDFs from `output/resumes/` to `cf r2 objects put <key> --bucket-name amiya --file <path>`.
   - Clean up bulky local PNGs from `data/screenshots/` while keeping `.gitkeep` to prevent repository bloat.
3. **Upload Adapter**:
   - Add helper in `web/src/storage/r2Storage.ts` to upload screenshots and resume PDFs directly to R2 bucket using `cf r2 objects put`.

---

## 3. Task Breakdown with Status Checkboxes

- [x] **Task 1: UI Cleanup - Universal Topbar**
  - Remove `portalAuthStatusBar` from `web/public/index.html`.
  - Remove `fetchPortalAuthSummary()` and `updatePortalAuthChip()` from `web/public/app.js`.
- [x] **Task 2: UI Cleanup - Benefits & Perks Formatting**
  - Update `web/public/app.js` line 948 to split benefits on newlines, semicolons, and bullet markers.
  - Render each item as a discrete zinc card.
- [x] **Task 3: Accountability Ledger (`SIN.md`)**
  - Create `/home/sahana/Code_Repository/personal/job-apply-automator/SIN.md` with comprehensive documentation of all 7 historical agent transgressions.
- [x] **Task 4: Sin Governance Rule**
  - Create `.agent/rules/sin_governance.md` mandating self-appending to `SIN.md` on any rule violation or unrequested action.
- [x] **Task 5: Cloudflare D1 Provisioning & Schema Migration**
  - Run `cf d1 create amiya`.
  - Export SQLite dump and apply schema + rows to Cloudflare D1.
  - Verify row counts on Cloudflare D1 via `cf d1 query`.
- [x] **Task 6: Cloudflare R2 Provisioning & Asset Migration**
  - Run `cf r2 buckets create-by-name amiya`.
  - Upload screenshots from `data/screenshots/` and resumes from `output/resumes/` to R2 using `cf r2 objects put`.
  - Purge local screenshot bloat from `data/screenshots/`.
- [x] **Task 7: Storage Client & Integration**
  - Add Cloudflare D1 & R2 service wrappers in backend using `cf` CLI.
- [x] **Task 8: Compilation, Server Restart & Verification**
  - Run `bunx tsc --noEmit`.
  - Restart Web Console server.
  - Verify UI changes and Cloudflare resources.

---

## 4. Dependencies & Inter-Task Blockers

- `cf` CLI is installed (`v1.0.0-beta.20`) and authenticated to Cloudflare profile `default`.
- Operator name `amiya` adheres strictly to `~/.gemini/knowledge/arknights_operators.md`.
- Cloudflare operations rely exclusively on `cf` CLI.

---

## 5. Verification Protocol

1. **UI Verification**:
   - Inspect `http://localhost:3100`: verify topbar has zero auth chips.
   - Open Job Dossier for Job #58 / #60: verify Benefits & Perks tab displays discrete cards instead of squashed bullet text.
2. **Accountability Verification**:
   - Verify `SIN.md` exists in repository root and lists all 7 sins.
   - Verify `.agent/rules/sin_governance.md` is active.
3. **Cloudflare D1 Verification**:
   - Run `cf d1 query <database-id> --sql "SELECT count(*) AS count FROM jobs_ledger;"` and confirm 8 rows match local SQLite.
4. **Cloudflare R2 Verification**:
   - Run `cf r2 objects list --bucket-name amiya` and verify screenshot and resume objects are present.
5. **Code & Server Verification**:
   - Run `bunx tsc --noEmit` to confirm zero compilation errors.
   - Verify `curl -s http://localhost:3100/health` returns HTTP 200.
