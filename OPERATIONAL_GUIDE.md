# Operational Guide: Setup, Authentication & Execution Runbook

Comprehensive reference for running the Job Apply Automator across WSL2 and Windows.

---

## 1. Core Architecture: Browser Profile Isolation

Job portals (Kalibrr, Glints, Jobstreet, LinkedIn) enforce Cloudflare Turnstile, OTPs, and anti-bot challenges. The automator handles this via a **dedicated browser profile directory**:

- **Windows Desktop Path**: `C:\Users\<WindowsUser>\.job_apply_automator\browser_profile`
- **WSL2 Mount Path**: `/mnt/c/Users/<WindowsUser>/.job_apply_automator/browser_profile`

### Key Principles
- **Zero Profile Collision**: The automator **never** reads, modifies, or touches your personal Windows Brave profile (`Personal`, `AUTOMATION`, or default).
- **Native NTFS Storage (No UNC Errors)**: Windows Chromium strictly prohibits UNC network paths (`\\wsl.localhost\...`) for `--user-data-dir` because SQLite database locking fails over network shares (triggering "Profile error occurred"). Storing on native Windows NTFS ensures zero profile errors and guarantees cookie databases write cleanly to disk.
- **Deterministic Storage**: Authentication cookies and session tokens persist in `Default/Network/Cookies`.
- **Exclusive Lock Behavior**: While a Brave window is actively open, Windows holds an exclusive lock on the SQLite cookie store. **Closing the login browser window flushes all in-memory session cookies directly to disk and releases the lock**, allowing the automator to verify `AUTHENTICATED` status and perform automated runs immediately.
- **Permanent Session Persistence & Zero Profile Chooser**: With `--profile-directory=Default` and `--disable-profile-picker`, Brave opens directly into the permanent `Default` profile where all session cookies, tokens, and local storage persist indefinitely across restarts, reboots, and updates. It will **never** prompt with the "Who's using Brave?" screen.

---

## 2. Step-by-Step Operational Runbook

### Step 1: Start the Web Triage Console

Open a terminal in the project root:
```bash
bun run web
```
The console is accessible at:
- **URL**: [http://localhost:3100](http://localhost:3100)

---

### Step 2: Authenticate Portals (Permanent One-Time Setup)

Before running autonomous crawls or automated submissions, authenticate each portal to store persistent session cookies in the dedicated profile.

#### Option A: Via Web Console (Recommended)
1. In the Web Console ([http://localhost:3100](http://localhost:3100)), click **Websites** in the left sidebar.
2. Observe the **Session Status** column (`AUTHENTICATED` vs `REQUIRES_LOGIN`).
3. Click the **[ Authenticate ]** button on the target portal row (e.g. Kalibrr).
4. A desktop Brave window will open directly to the login page using the permanent profile (`.job_apply_automator/browser_profile`).
5. Log in with your credentials and complete any Cloudflare Turnstile or OTP challenges.
6. Once logged in, close the browser window and click **[ Re-check ]** (or **[ Check All Sessions ]**). The badge will turn to `AUTHENTICATED`.

#### Option B: Via Terminal CLI
```bash
# Launch interactive login window for a specific portal
bun run auth kalibrr
bun run auth glints
bun run auth jobstreet
bun run auth linkedin

# Inspect session health across all supported portals
bun run auth --check
```

---

### Step 3: Launch the Automation Browser (Port 9222)

When running the native Rust CLI or manual CDP debugging operations, launch the background browser:

```bash
bun run browser
```

What this script (`scripts/launch-brave.sh`) does automatically:
1. Resolves the native Windows NTFS path `C:\Users\<user>\.job_apply_automator\browser_profile`.
2. Spawns `brave.exe` with `--user-data-dir`, `--profile-directory=Default`, and `--disable-profile-picker`.
3. Binds Chrome DevTools Protocol to `--remote-debugging-port=9222` and `--remote-debugging-address=0.0.0.0`.
4. Bypasses all profile selection screens directly into the authenticated session.

---

### Step 4: Run Job Crawling & Application Operations

#### A. Explore an Unknown Single Job Posting
```bash
./cli/target/release/job-apply-cli explore --url "<job_posting_url>"
```
Navigates through the CDP browser session, extracts full verbatim job specifications, and parses responsibilities and qualifications with the Antigravity subagent.

#### B. Execute Daily Scheduled Ingestion
```bash
bun run cli:schedule
```
Or force execution regardless of whether a batch completed today:
```bash
./cli/target/release/job-apply-cli schedule --once --force
```

#### C. Review and Manage Jobs in Web Console
1. Open [http://localhost:3100](http://localhost:3100).
2. Under **Jobs Review**:
   - Inspect newly ingested roles and market salary benchmarks.
   - Click **Action -> Approve** to advance to applied queues.
   - Click **Action -> Drop** to discard roles with reason tracking.

#### D. Windows Startup Automation (Zero-Touch Daily Run)
1. Press `Win + R`, type `shell:startup`, and press Enter.
2. Create a shortcut in that folder pointing to:
   ```cmd
   \\wsl.localhost\Ubuntu\home\sahana\Code_Repository\personal\job-apply-automator\scripts\run_automator.bat
   ```
3. Whenever Windows boots:
   - If no batch has run today, it runs the catch-up crawl and ingestion.
   - If today's run has already completed, it exits immediately without consuming resources.

---

## 3. Troubleshooting & FAQ

### Q: Why did the "Profile error occurred: Something went wrong when opening your profile" popup appear?
- **Root Cause**: Windows Chromium cannot lock or initialize SQLite database files across network UNC paths (`\\wsl.localhost\...` or `\\wsl$\...`). When launched with a UNC `--user-data-dir`, Chromium disables disk persistence and runs in an ephemeral in-memory mode where cookies are never saved to disk.
- **Resolution**: The automator now uses the native Windows NTFS path `C:\Users\<user>\.job_apply_automator\browser_profile` (accessed in WSL2 at `/mnt/c/Users/<user>/.job_apply_automator/browser_profile`). This guarantees native SQLite file locking and permanent cookie persistence without any profile error dialogs.

### Q: Why did Re-check report "WINDOW OPEN" or still show "REQUIRES_LOGIN"?
- **Root Cause**: While a browser window is actively open, Windows Chromium places an exclusive file lock on the SQLite cookie database (`Default/Network/Cookies`). Any attempt to inspect cookies while the browser is running will find the database locked.
- **Resolution**:
  1. Complete your login in the opened desktop browser.
  2. **Close the login browser window**. Closing the window flushes all session cookies from memory to disk and releases the file lock.
  3. Click **[ Re-check ]**. The badge will transition cleanly to `AUTHENTICATED`.

### Q: Why did a 2nd Authenticate click fail to open a new browser window?
- **Root Cause**: A previous Brave instance was still running in the background holding a stale lock file.
- **Resolution**: Close all background instances of the automation profile before re-launching.

### Q: Why did the "Who's using Brave?" profile picker screen appear previously?
- **Root Cause**: Running `brave.exe` without explicit profile direction causes Brave to trigger the profile picker dialog (`chrome://profile-picker/`), which runs under a temporary, non-persisted `System Profile`.
- **Resolution**: All launchers (`scripts/auth.ts`, `scripts/launch-brave.sh`, and `web/src/submission/browserRunner.ts`) now pass `--profile-directory=Default` and `--disable-profile-picker` alongside `--user-data-dir=C:\Users\<user>\.job_apply_automator\browser_profile`. This permanently bypasses the chooser and forces all logins directly into the persistent `Default` profile.

### Q: Does this interfere with my daily personal Brave browser?
- **No.** Because `--user-data-dir` points to `C:\Users\<user>\.job_apply_automator\browser_profile`, Chromium treats it as an independent instance. Your personal bookmarks, tabs, history, and logins are completely untouched.

### Q: How do I verify if my session cookies expired?
Run:
```bash
bun run auth --check
```
Or click **[ Check All Sessions ]** on the **Websites Directory** page in the Web Console.
