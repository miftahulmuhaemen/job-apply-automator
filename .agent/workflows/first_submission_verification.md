---
name: first_submission_verification
description: Interactive human-in-the-loop procedure for verifying new or updated portal submission drivers on live desktop sessions.
---

# Workflow: First-Submission Verification Gate

Whenever a new Portal Driver is created or an existing driver is updated, the very first live submission on that platform MUST follow this interactive, human-in-the-loop verification procedure.

---

## Step 1: Interactive Driver Execution
1. Launch the submission engine in interactive mode:
   - `prefillOnly: true`
   - `keepOpen: true` (or `interactive: true`)
2. Ensure the browser window opens visibly on the user's desktop with full DevTools accessibility.

---

## Step 2: Form Pre-Filling & Control Dispatch
1. The driver navigates to the application form.
2. Form fields are pre-filled using candidate profile data via `formDispatch.ts`.
3. Tailored resume PDF and dossier are attached to file upload inputs.
4. The driver scrolls down to the submission controls and halts, leaving the browser session active.

---

## Step 3: Human Visual Inspection
A human operator must visually inspect the open browser window to audit:
1. Every input mapped by the driver (name, email, phone, location, work history).
2. Attached files (ensuring correct resume and portfolio dossiers are staged).
3. Any custom employer screening questions to verify factual accuracy against `candidate_profile_attributes`.

---

## Step 4: Challenge Resolution & Manual Submission
1. If the platform presents bot challenges (Cloudflare Turnstile, CAPTCHA, SMS/Email OTP), the human operator solves them directly in the browser window.
2. The human operator clicks the final submission button manually.

---

## Step 5: Submission Receipt Capture & Ledger Verification
1. The driver captures the confirmation screen or receipt modal screenshot directly to Cloudflare R2 via `captureScreenshotToR2`.
2. The driver navigates to the platform's official submitted applications ledger (e.g. `candidate/applications`).
3. Confirm the application card is present with active submitted status (`Application sent`, `Submitted`, `In Review`).
4. Update the ledger status to `APPLIED` (or `SUBMITTED (NOT VERIFY-ABLE)` for mobile-only platforms like Glints).
5. Only after this live verification succeeds is the driver approved for automated headless execution.
