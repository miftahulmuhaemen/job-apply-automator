# Plan: Website Session Governance and Standardized Auth Launcher

## 1. Goal & Scope
Provide a standardized, repeatable, and observable session management system across all job portals:
1. **Canonical Browser Profile & Universal Launcher (`scripts/auth.ts`)**:
   - Standardize on a single, fixed profile directory: `./data/browser_profile`.
   - On WSL2, automatically translate the Linux path to a Windows UNC path via `wslpath -w`.
   - Automatically detect the desktop browser (prioritizing Brave, fallback to Chrome).
   - Support launching authentication sessions via CLI: `bun run auth <portal>` (e.g. `kalibrr`, `glints`, `jobstreet`, `linkedin`).
2. **Session Health Inspection API (`web/src/routes/websites.ts`)**:
   - Add `GET /api/websites/session-status` to inspect cookies in `./data/browser_profile` and determine real-time status (`AUTHENTICATED` vs `REQUIRES_LOGIN`) for each portal.
   - Add `POST /api/websites/:id/authenticate` to trigger the desktop browser launcher directly from the Web Console.
   - Add `POST /api/websites/:id/check-session` to re-verify an individual portal's session after login.
3. **Web Console UI Integration (`Websites Directory`)**:
   - Add a dedicated **Session Status** column to the Websites table.
   - Provide an `[ Authenticate ]` button and `[ Re-check ]` button in the Actions column for each portal.
   - Add a `[ Check All Sessions ]` button in the left-aligned `.websites-toolbar`.
   - Enforce 100% strict Shadcn monochrome neutral scale (`#09090b` to `#ffffff`).
4. **README Standard Documentation (`README.md`)**:
   - Document the single standard for portal onboarding and authentication.

---

## 2. Technical Design

### A. Universal Auth Launcher Script (`scripts/auth.ts`)
- Portal mapping:
  ```ts
  const PORTAL_AUTH_URLS: Record<string, { name: string; url: string; cookieDomains: string[] }> = {
    kalibrr: {
      name: 'Kalibrr Indonesia',
      url: 'https://www.kalibrr.com/login?locale=id_ID',
      cookieDomains: ['kalibrr.com', '.kalibrr.com']
    },
    glints: {
      name: 'Glints Indonesia',
      url: 'https://glints.com/id/login',
      cookieDomains: ['glints.com', '.glints.com']
    },
    jobstreet: {
      name: 'Jobstreet Indonesia',
      url: 'https://id.jobstreet.com/login',
      cookieDomains: ['jobstreet.com', '.jobstreet.com', 'jobstreet.co.id', '.jobstreet.co.id', 'seek.com']
    },
    linkedin: {
      name: 'LinkedIn Indonesia',
      url: 'https://www.linkedin.com/login',
      cookieDomains: ['linkedin.com', '.linkedin.com']
    }
  }
  ```
- Browser resolution order:
  1. `/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe`
  2. `/mnt/c/Program Files/Google/Chrome/Application/chrome.exe`
  3. `/usr/bin/google-chrome`
- Profile path:
  `const PROFILE_DIR = path.resolve(process.cwd(), 'data/browser_profile')`
  If launching Windows binary, execute `wslpath -w <PROFILE_DIR>` to pass `--user-data-dir="\\wsl$\..."`.

### B. Session Health Inspection
- SQLite Cookie Inspector:
  Chromium stores cookies in `data/browser_profile/Default/Network/Cookies` or `data/browser_profile/Default/Cookies` (SQLite database).
  By querying the cookie database for domain and expiration (`SELECT name, host_key, expires_utc FROM cookies WHERE host_key LIKE ...`), we can verify whether active, unexpired session cookies exist for:
  - Kalibrr: `sessionid`, `cf_clearance`, or `_kalibrr_*`
  - Glints: `glints_token`, `connect.sid`, `accessToken`
  - Jobstreet: `SEEK_USER`, `jobstreet_*`
  - LinkedIn: `li_at`
- If cookie database is empty or cookies are expired -> returns `REQUIRES_LOGIN`.
- If valid unexpired cookies exist -> returns `AUTHENTICATED`.

### C. Websites Directory UI (`web/public/`)
- Table Columns:
  `Portal Name | Target URL | Access Policy | Session Status | Auth Type | Account / Username | Credential Handling | Actions`
- In-Page Toolbar (`.websites-toolbar`):
  `[ + Add Website ]` `[ Check All Sessions ]` (both strictly left-aligned).
- Actions per row:
  - `[ Authenticate ]` (Opens desktop browser to portal login URL with shared profile)
  - `[ Check ]` (Queries session health API and updates badge)
  - `[ Block / Allow ]`
  - `[ Delete ]`

---

## 3. Task Breakdown

- [x] **Task 1: Universal Auth Launcher & Cookie Inspector Script**
  - [x] Implement `scripts/auth.ts` with browser detection, WSL path conversion, and portal routing.
  - [x] Add session checking logic querying the profile cookie store.
  - [x] Add `"auth": "bun run scripts/auth.ts"` to `package.json`.

- [x] **Task 2: Web Server API Endpoints for Session Status**
  - [x] Add `GET /api/websites/session-status` in `web/src/server.ts` or routes.
  - [x] Add `POST /api/websites/:id/authenticate` to trigger desktop browser launch.
  - [x] Add `POST /api/websites/:id/check-session` to re-check individual portal session.

- [x] **Task 3: Websites Directory UI Enhancement**
  - [x] Add **Session Status** column in `web/public/index.html`.
  - [x] Update `renderWebsitesTable()` in `web/public/app.js` with `AUTHENTICATED` / `REQUIRES_LOGIN` badges and action buttons (`Authenticate`, `Re-check`).
  - [x] Add `[ Check All Sessions ]` button in `.websites-toolbar`.
  - [x] Ensure 100% strict Shadcn monochrome styling (`#ffffff`, `#09090b`, `#27272a`, `#3f3f46`, `#f4f4f5`).

- [x] **Task 4: Update Documentation**
  - [x] Document portal authentication, session governance, and `bun run auth <portal>` in `README.md`.

- [x] **Task 5: Verification & Evidence Capture**
  - [x] Test `scripts/auth.ts` execution and session health detection.
  - [x] Capture screenshot `/tmp/websites_session_governance.png` proving left-aligned controls, Session Status column, and action buttons.
  - [x] Run 5-dimension cross-verification audit `scratch/run_cross_verification_audit.ts` (45/45 pass).
  - [x] Run `~/.cargo/bin/cargo check --manifest-path cli/Cargo.toml` (0 errors).
  - [x] Run `graphify extract .`.

---

## 4. Verification Protocol
- **Commands**:
  - `bun run scripts/auth.ts --check`: Verify session checker executes cleanly.
  - `bun run scratch/run_cross_verification_audit.ts`: Confirm 47/47 audit tests pass.
  - `~/.cargo/bin/cargo check --manifest-path cli/Cargo.toml`: Confirm 0 errors.
- **Visual Evidence**:
  - `/tmp/websites_session_governance.png`: Showing Session Status column, badges, left-aligned toolbar, and action buttons.
