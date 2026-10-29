# Cloudflare D1 Full Cutover and Local File Purge Plan

## 1. Goal & Scope

Completely eliminate local database and criteria file storage from the repository:
1. **Cut Over Storage to Cloudflare D1 (`amiya`)**:
   - Refactor `web/src/storage/db.ts` to use Cloudflare D1 (`b54fd60b-28c4-4577-b02c-478797c90122`) as the persistent cloud backing store using `cf` CLI exclusively.
   - Use in-memory SQLite (`:memory:`) in the runtime for zero-disk, sub-millisecond query performance, hydrated from Cloudflare D1 on startup and synchronized on every mutation via `cf d1 query`.
2. **Purge Local Database Files**:
   - Delete `data/amiya.db`, `data/amiya.db-shm`, and `data/amiya.db-wal` from the local project directory.
3. **Migrate & Purge `data/personalization.md`**:
   - Rules are already stored in `personalization_rules` in Cloudflare D1 (14 verified rules).
   - Delete `data/personalization.md` and `data/personalization.json` from the repository.
   - Update UI indicators in `web/public/index.html` and `web/public/app.js` to display `Synced: Cloudflare D1 (amiya)` instead of file paths.
   - Remove disk-writing routines in `syncPersonalizationToFile()`.

### Boundaries & Constraints
- Pure zinc monochrome styling (`#09090b` to `#ffffff`) per `.agent/rules/shadcn_monochrome_theme.md`.
- All Cloudflare D1 commands MUST strictly use the `cf` CLI command exclusively per global user rules.
- Database name is `amiya` (IAU / Arknights naming standard).
- No mock or synthesized data per `.agent/rules/prohibit_fabricated_data.md`.

---

## 2. Technical Design

### A. Cloudflare D1 Zero-Disk In-Memory Bridge (`web/src/storage/db.ts`)
1. **Zero-Disk In-Memory Database**:
   - `export const db = new DatabaseSync(':memory:')`
   - Zero `.db`, `-shm`, or `-wal` files created on local disk.
2. **Hydration from Cloudflare D1**:
   - On module initialization, execute `cf d1 query b54fd60b-28c4-4577-b02c-478797c90122 --sql "..."` via `execFileSync` to fetch all rows across:
     - `websites_master`
     - `companies`
     - `scheduler_settings`
     - `personalization_rules`
     - `screening_qa`
     - `daily_runs`
     - `system_errors`
     - `jobs_ledger`
   - Populate `:memory:` tables for fast, synchronous read operations.
3. **Mutation Push to Cloudflare D1**:
   - Helper function `executeD1Mutation(sql: string)`:
     Invokes `execFileSync('cf', ['d1', 'query', D1_DATABASE_ID, '--sql', sql], { encoding: 'utf-8' })`.
   - Update mutating functions (`updateTriageDecision`, `updateJobStatus`, `addWebsite`, `updateWebsite`, `deleteWebsite`, `addPersonalizationRule`, `updatePersonalizationRule`, `togglePersonalizationRule`, `deletePersonalizationRule`, `updateSchedulerSettings`) to execute in `:memory:` AND push mutations directly to Cloudflare D1 via `executeD1Mutation`.
4. **Remove Disk Sync for Personalization**:
   - Deprecate file writes to `data/personalization.md` and `data/personalization.json` in `syncPersonalizationToFile()`. Instead, ensure changes persist to D1 table `personalization_rules`.

### B. UI Badge & Copy Updates
1. `web/public/index.html`:
   - Replace `Synced: <code>data/personalization.md</code>` with `Synced: <code>Cloudflare D1 (amiya)</code>`.
2. `web/public/app.js`:
   - Update rule modal subtitle from `Creates rule in amiya.db and syncs data/personalization.md` to `Persists rule directly to Cloudflare D1 (amiya)`.

### C. File Purge
1. Delete:
   - `data/amiya.db`
   - `data/amiya.db-shm`
   - `data/amiya.db-wal`
   - `data/personalization.md`
   - `data/personalization.json`

---

## 3. Task Breakdown with Status Checkboxes

- [x] **Task 1: Refactor `web/src/storage/db.ts` for Cloudflare D1 & In-Memory Bridge**
  - Switch to `:memory:` with zero disk files.
  - Implement startup hydration from Cloudflare D1 via `cf` CLI.
  - Implement `executeD1Mutation` for all update/insert/delete routines.
  - Remove disk file exports from `syncPersonalizationToFile()`.
- [x] **Task 2: Update UI Labels in `index.html` and `app.js`**
  - Removed redundant `Synced: ...` badge entirely from Criteria toolbar.
  - Cleaned modal descriptions in `app.js`.
- [x] **Task 3: Purge Local Database & Personalization Files**
  - Deleted `data/amiya.db*` and `data/personalization.*`.
  - Confirmed disk state contains zero database or criteria files.
- [x] **Task 4: Compilation, Server Restart & Verification**
  - Run `bunx tsc --noEmit`.
  - Restarted Web Console server.
  - Verified all API endpoints return valid data from Cloudflare D1 with zero local files.

---

## 4. Verification Protocol

1. `ls data/`: Confirm `amiya.db`, `amiya.db-shm`, `amiya.db-wal`, `personalization.md`, `personalization.json` are completely absent.
2. `curl -s http://localhost:3100/api/personalization`: Confirm 14 rules returned from D1.
3. `curl -s http://localhost:3100/api/jobs`: Confirm 8 jobs returned from D1.
4. `bunx tsc --noEmit`: 0 errors.
