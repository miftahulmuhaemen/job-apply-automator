# Portal Driver Authoring & Maintenance Workflow

This document defines the complete procedural workflow and engineering standards for creating, verifying, and maintaining Portal Submission Drivers for the Job Apply Automator.

---

## 1. Architectural Role of a Portal Driver

A Portal Driver is a specialized automation module that controls browser interaction (via Puppeteer) for a specific job board or Applicant Tracking System (ATS), such as Kalibrr, Workable, SEVIMA, Breezy HR, or Ashby.

Every driver must implement the canonical `PortalDriver` interface defined in `web/src/submission/types.ts`:

```typescript
export interface PortalDriver {
  id: string
  name: string
  canHandle(job: { portal?: string | null; job_url: string }): boolean
  submit(page: Page, context: SubmissionContext): Promise<SubmissionReceipt>
}
```

The driver encapsulates:
1. Navigating to the job application form or entry modal.
2. Mapping and typing candidate attributes into HTML controls (`<input>`, `<textarea>`, `<select>`).
3. Handling file uploads (candidate photo, tailored resume PDF, portfolio dossier PDF).
4. Handling interactive gates and bot protections (e.g., Cloudflare Turnstile, CAPTCHA).
5. Submitting the form and asserting the confirmation state.
6. Capturing visual receipt screenshots uploaded directly to Cloudflare R2 bucket (`amiya`).

---

## 2. Mandatory Prerequisite Workflow

**Never build a driver blind or guess form selectors.**

Before writing any driver code, the developer or agent MUST follow this sequence:

### Step 1: Discover & Crawl at Least One Job from Target Platform First
Use Vercel `agent-browser` (`bun x agent-browser`) to inspect the target application gate and accessibility tree. Then run the crawler to capture the verified live job listing into the ledger:
```bash
bun run web/src/crawler/dynamic_crawler.ts "<JOB_URL>"
```
During this crawl, the crawler enters the application form and extracts the complete DOM field structure into `jobs_ledger.form_schema`.

### Step 2: Audit the Crawled Form Schema
Query the database or open the **Form Fill Preview** tab in the Web Console (`http://localhost:3100`) for the crawled job record. Inspect the stored `form_schema`:
- Field identifiers: `name`, `id`, `type`, `tag`.
- Field requirements: `required: true/false`.
- File upload constraints: `accept` attributes, size limits.
- Conditional branches: fields displayed only when certain options are selected.

### Step 3: Verify Column-to-Column Schema Compatibility
Diff every form field in the schema against the dynamic candidate profile ledger (`candidate_profile_attributes` table via `getCandidateProfileFromDb()`).

Confirm the mapping against the canonical attribute dictionary:

| Form Field Concept | Candidate Attribute Key | Value Source | Expected Type / Format |
| :--- | :--- | :--- | :--- |
| Full Name | `full_name` | `candidateProfile.personal.name` | String |
| First Name | `first_name`, `firstname` | Derived from full name | String |
| Last Name | `last_name`, `lastname` | Derived from full name | String |
| Email Address | `email` | `candidateProfile.personal.email` | Valid email string |
| Phone Number | `phone` | `candidateProfile.personal.phone` | Clean digits or `+62...` |
| City / Domicile | `domicile`, `location` | `candidateProfile.personal.location` | String city/region |
| Tailored Resume | `resume`, `cv` | `context.tailoredPdfPath` | File path (`.pdf`) |
| Candidate Photo | `photo`, `photo_file` | `data/assets/photo.jpg` | File path (`.jpg` / `.png`) |
| Portfolio Dossier | `portfolio`, `portfolio_pdf` | `data/assets/portfolio.pdf` | File path (`.pdf`) |
| Expected Salary | `expected_salary` | `calculateExpectedSalaryBid()` | Clean integer string (e.g., `12000000`) |
| Notice Period | `notice_period` | Candidate profile attribute | `Immediate` or `0` |
| LinkedIn Profile | `linkedin` | `candidateProfile.personal.linkedin` | URL string |
| GitHub Profile | `github` | `candidateProfile.personal.github` | URL string |
| Screening Q&A | `qaList` | `context.qaList` | Array of `{ question, answer }` |

### Step 4: Handling New or Domain-Specific Columns
If the target platform demands a mandatory column not listed above (e.g., citizenship status, tax identification number, specific exam score):
1. **Never fabricate fake data** (enforced by `.agent/rules/prohibit_fabricated_data.md`).
2. Add the attribute to `candidate_profile_attributes` with status `ACTION_REQUIRED` if unsupplied.
3. If optional, leave unpopulated or omit.

---

## 3. Driver Implementation Standard

All portal drivers must be placed in `web/src/submission/drivers/<platformName>Driver.ts`.

### Standard Driver Template
```typescript
import path from 'node:path'
import fs from 'node:fs'
import type { Page } from 'puppeteer-core'
import type { PortalDriver, SubmissionContext, SubmissionReceipt } from '../types.js'
import { setControlValueAndDispatch } from '../formDispatch.js'
import { captureScreenshotToR2 } from '../../storage/r2Storage.js'

export class ExamplePlatformDriver implements PortalDriver {
  id = 'example_platform'
  name = 'Example Platform'

  canHandle(job: { portal?: string | null; job_url: string }): boolean {
    const portal = (job.portal || '').toLowerCase()
    const url = job.job_url.toLowerCase()
    return portal.includes('example') || url.includes('example.com')
  }

  async submit(page: Page, context: SubmissionContext): Promise<SubmissionReceipt> {
    const { job, candidateProfile } = context
    const p = candidateProfile.personal

    // 1. Navigate to application URL
    await page.goto(job.job_url, { waitUntil: 'networkidle2', timeout: 30000 })

    // 2. Open application form if behind a modal or button
    const applyBtn = await page.$('button[data-action="apply"], a[href*="/apply"]')
    if (applyBtn) {
      await applyBtn.click()
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
    }

    // 3. Fill text inputs using native form dispatcher
    await setControlValueAndDispatch(page, 'input[name="full_name"]', p.fullName)
    await setControlValueAndDispatch(page, 'input[name="email"]', p.email)
    await setControlValueAndDispatch(page, 'input[name="phone"]', p.phone)

    // 4. Attach files if required
    if (context.tailoredPdfPath && fs.existsSync(context.tailoredPdfPath)) {
      const resumeInput = await page.$('input[type="file"][name*="resume"], input[type="file"][name*="cv"]')
      if (resumeInput) {
        await resumeInput.uploadFile(context.tailoredPdfPath)
      }
    }

    // 5. Submit form
    const submitBtn = await page.$('button[type="submit"]')
    if (!submitBtn) throw new Error('Submit button not found on application form')
    await submitBtn.click()

    // 6. Assert success confirmation
    await page.waitForSelector('.application-success, [data-testid="success-message"]', { timeout: 20000 })

    // 7. Capture visual proof and upload to Cloudflare R2
    const screenshotBuffer = await page.screenshot({ fullPage: true })
    const r2Key = `receipts/${job.id}_${Date.now()}.png`
    const receiptUrl = await captureScreenshotToR2(screenshotBuffer, r2Key)

    return {
      success: true,
      receiptUrl,
      submissionTimestamp: new Date().toISOString(),
      note: 'Application successfully submitted via ExamplePlatformDriver'
    }
  }
}
```

---

## 4. Verification & Testing

Every driver must be verified in accordance with `.agent/workflows/first_submission_verification.md`:
1. First live submission must execute with a live browser window under human supervision.
2. The submission receipt screenshot must be captured and uploaded to Cloudflare R2.
3. The official portal application ledger must be audited to verify HTTP 200 or sent status.
