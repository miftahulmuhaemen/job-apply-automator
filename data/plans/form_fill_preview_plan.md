# Implementation Plan: Application Form Fill Preview Tab

## 1. Goal & Scope
Provide a clear, transparent "Form Fill Preview" inside the Web Console job details modal drawer. Users can review every standard and custom field that the automator will submit to the employer's portal, including the calculated expected salary bid, contact coordinates, screening disclosures, and attached documents.

---

## 2. Technical Design

### A. Data Contract & Computation (`web/src/generator/formPreview.ts` or `web/src/server.ts`)
- **Expected Salary Logic**:
  - Detect job location from `location` field (e.g. Jakarta/Jabodetabek vs Regional/Surabaya vs International/Remote).
  - Compute candidate bid according to `data/candidate_profile_master.md` Section 8:
    - Jakarta/Jabodetabek: Target IDR 10M–15M (minimum floor IDR 8M).
    - Regional (Surabaya, Jogja, Bali, Banjarmasin): Target IDR 8M–12M (minimum floor IDR 7M). If employer range is listed (e.g. SEVIMA Rp 7.7M–13M), bid within range matching target: `IDR 8.000.000 - 10.000.000 / month`.
- **Field Matrix**:
  1. Personal & Contact (Legal Name, Email, Phone/WhatsApp, Residential City/Province, Postal Code)
  2. Legal & Authorization (Nationality, WNI Authorization, Sponsorship: Not Required)
  3. Professional Screening (Notice Period, Current Employment Status, Total Experience)
  4. Compensation (Employer Listed Range, Candidate Expected Salary Bid, Negotiable flag)
  5. Education & Background (Degree, University, GPA, Graduation Year)
  6. Links & Portfolio (Portfolio URL, LinkedIn, GitHub)
  7. Custom Employer Questions (Parsed from `screening_questions` and `candidate_answers` or explicit zero-state)
  8. Attachments (Tailored PDF filename, Cover Letter inclusion)

### B. UI Integration (`web/public/app.js`)
- Upgrade the details modal tab navigation:
  - Tab 0: `Specifications`
  - Tab 1: `Form Fill Preview` (replaces standalone Screening Q&A with a unified preview of all form fields + custom Q&A)
  - Tab 2: `Benefits & Perks`
  - Tab 3: `Tailored Resume (PDF)`
  - Tab 4: `Cover Letter`
  - Tab 5: `Submission Proof`
- Visual styling conforming strictly to `.agent/rules/shadcn_monochrome_theme.md`:
  - Monochrome zinc key-value table (`#18181b` surface, `#27272a` borders, `#ffffff` values, `#a1a1aa` field labels).

---

## 3. Task Breakdown

- [x] `data/plans/form_fill_preview_plan.md`: Created and approved by user.
- [x] `web/src/generator/formPreview.ts`: Created helper to compute form fill payload for any job record.
- [x] `web/src/server.ts`: Added `GET /api/jobs/:id/form-preview` endpoint returning resolved form fields.
- [x] `web/public/app.js`: Updated modal tabs to render the Form Fill Preview section with field table, expected salary bid, and custom Q&A.
- [x] Recrawled SEVIMA live page: Ingested verbatim specifications and verified all live form controls on `https://careers.sevima.com/jobs/software-engineer/apply`.
- [x] Local build validation: Verified `bunx tsc --noEmit` (0 errors), `bun build web/public/app.js --no-bundle` (0 errors), and captured visual screenshot verification (`/tmp/form_fill_preview_sevima.png`).

---

## 4. Verification Protocol
- Run `curl -s http://localhost:3100/api/jobs/61/form-preview` and verify expected salary for SEVIMA displays `IDR 8.000.000 - 10.000.000 / month`.
- Inspect Web Console modal on SEVIMA (Job #61) to confirm clean zinc key-value rendering with zero color violations.
