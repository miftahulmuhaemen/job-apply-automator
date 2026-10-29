# Implementation Plan: Clean Purge of Ajaib, Portfolio Generation & Photo Upload

## 1. Goal & Scope
1. Completely purge all Ajaib job records, company records, and resume artifacts across Cloudflare D1, SQLite, Cloudflare R2, and local disk.
2. Construct a professional technical **Portfolio PDF** for Miftahul Muhaemen strictly grounded in verified facts from `data/candidateProfile.json` and `data/candidate_profile_master.md` (Koperasi KHMB, Feedloop AI, Bythen AI, ULM Thesis) to satisfy portal file upload requirements.
3. Build a **Photo Upload Mechanism** in the Web Console allowing the candidate to upload their photo (`Foto Diri`, JPEG/PNG <= 4MB), persisting to `data/assets/photo.jpg` and Cloudflare R2 (`assets/photo.jpg`).
4. Re-verify the live portal flow for SEVIMA (Job #61) using the interactive browser protocol without assumptions, surfacing missing prerequisite warnings and clearing them once portfolio and photo are supplied.

---

## 2. Technical Design

### A. Ajaib Purge Protocol
- **D1 & SQLite**:
  - `DELETE FROM jobs_ledger WHERE company = 'Ajaib';`
  - `DELETE FROM companies WHERE name = 'Ajaib';`
- **Cloudflare R2**:
  - Delete `resumes/Ajaib_Senior_Backend_Engineer_II___Shared_Services_Resume.pdf`
  - Delete `resumes/Ajaib_Sr__Backend_Engineer_II___Investment_Resume.pdf`
  - Delete `resumes/Ajaib_Staff_Backend_Engineer___Investment_Resume.pdf`
- **Local Disk**:
  - Remove `./output/resumes/Ajaib*`

### B. Technical Portfolio PDF Construction (`web/src/generator/portfolioBuilder.ts`)
- **Factual Grounding (Zero Plausible Fakes)**:
  - System 1: **Koperasi KHMB** (Offline-first POS, Go Echo v4, React, TypeScript, PostgreSQL, Dexie.js IndexedDB, B-tree indexes, WebSerial thermal printing, production URL `https://koperasi-khmb.cloud`).
  - System 2: **Feedloop AI** (Legal Document Intelligence platform, parsing 100+ page laws, multi-cloud Kubernetes cluster monitoring on GKE/AKS, Qore low-code engine).
  - System 3: **Bythen AI** (Analytical Data Warehouse, Python/Airflow scheduled pipelines, star schema, Go microservices worker queues, GCP Pub/Sub).
  - System 4: **ULM Undergraduate Thesis** (UAV Pothole Detection using SSD ResNet-50 FPN on aerial video footage, peer-reviewed journal JDSSE).
- **Output Asset**:
  - Generated via Puppeteer print to PDF: `output/documents/Miftahul_Muhaemen_Portfolio.pdf`.
  - Synced to R2: `assets/portfolio.pdf`.
  - Max size: <= 5MB (conforming to SEVIMA upload constraints).

### C. Photo Upload Mechanism (`web/src/server.ts` & `web/public/app.js`)
- **Backend Route**:
  - `POST /api/candidate/photo`: Accepts `multipart/form-data` or raw image bytes (JPEG/PNG up to 4MB).
  - Validates MIME type and file size.
  - Saves locally to `data/assets/photo.jpg` and uploads to Cloudflare R2 `assets/photo.jpg`.
- **UI Component**:
  - In the Job Details modal (Form Fill Preview tab under Photo row) or in Settings, provide a file input button: `Upload Foto Diri (JPEG/PNG)`.
  - Displays upload status, preview thumbnail, and file size.
  - Automatically clears the "Missing Portal Prerequisites" warning when valid photo is present.

### D. Dynamic Verification on SEVIMA (Job #61)
- Form Fill Preview evaluates live presence of `photo` and `portfolio`:
  - Before upload/generation: displays `Missing Portal Prerequisites (2)` warning banner.
  - After upload/generation: updates status to `Available` with download/preview buttons.

---

## 3. Task Breakdown

- [ ] `data/plans/clean_restart_portfolio_and_photo_upload_plan.md`: Created and submitted for user approval.
- [ ] Purge Ajaib: Delete records from D1, SQLite, R2, and local disk.
- [ ] `web/src/generator/portfolioBuilder.ts`: Implement factual Portfolio PDF generator.
- [ ] Build Photo upload API (`POST /api/candidate/photo`) and integrate upload UI in Web Console.
- [ ] Generate portfolio PDF and upload candidate photo.
- [ ] Verification: Test Form Fill Preview on SEVIMA to confirm prerequisite warning resolves truthfully.

---

## 4. Verification Protocol
- Run `cf d1 query amiya "SELECT count(*) FROM jobs_ledger WHERE company = 'Ajaib';"` (assert 0).
- Run `curl -X POST /api/candidate/photo` and verify photo saved and synced.
- Verify `output/documents/Miftahul_Muhaemen_Portfolio.pdf` generated under 5MB.
- Screenshot verification of Form Fill Preview on SEVIMA.
