# Remediation Plan: Ingestion of Benefits, Tech Stack, and Multi-Row Experience

## 1. Goal & Scope
Eliminate data omissions and schema collapsing across Ajaib and SEVIMA job listings:
1. Populate missing `benefits` for all target listings (Ajaib: 8 itemized benefits; SEVIMA: 7 itemized benefits) so the "Benefits & Perks" tab is fully populated.
2. Populate missing `tech_stack` and `experience_req` for all target listings so the "Detected Technologies" tag list and specifications are fully populated.
3. Overhaul Form Fill Preview in `web/src/generator/formPreview.ts` to support multi-row Work Experience and detailed Education fields reflecting all 3 professional positions from `candidateProfile.json`.
4. Fix `scripts/crawl_and_ingest_all.ts` so future ingestions never omit these columns.

---

## 2. Root Cause Analysis
- **Root Cause 1 (`benefits` & `tech_stack` empty in DB)**:
  `scripts/crawl_and_ingest_all.ts` lines 207-217 omitted `benefits`, `tech_stack`, `experience_req`, `requirements_summary`, and `company_overview` from the `INSERT INTO jobs_ledger` query. Even though `full_description` captured the raw DOM text containing all benefits and technologies, the database columns were set to `NULL`.
- **Root Cause 2 (Collapsed Single Experience in Form Fill Preview)**:
  `web/src/generator/formPreview.ts` mapped work experience into a single collapsed string instead of itemizing each position. Workable's live application DOM supports dynamic `+ Add Experience` and `+ Add Education` buttons that accept individual company, title, date range, and summary entries for each job.
- **Root Cause 3 (SEVIMA Substantive Experience Breakdown)**:
  SEVIMA's form has a dropdown choice `> 5 Tahun`, but the preview lacked the substantiating multi-row experience breakdown (Bythen AI, Feedloop AI, PT Arkan Jaya Nusantara).

---

## 3. Implementation Details

### A. Ingestion Script Overhaul (`scripts/crawl_and_ingest_all.ts`)
1. Implement section parsing on `rawText`:
   - Parse `Benefits` / `Yang Kami Tawarkan` into itemized newline-separated entries for `benefits`.
   - Parse technologies from `Requirements` / `Kualifikasi` into comma-separated tags for `tech_stack`.
   - Parse minimum experience requirement for `experience_req`.
2. Update the `INSERT INTO jobs_ledger` query to include `benefits`, `tech_stack`, `experience_req`, `company_overview`, and `requirements_summary`.

### B. Database Migration & Cloudflare D1 Update
Execute an UPDATE query against Cloudflare D1 database `amiya` and runtime SQLite memory:
1. **Ajaib (Job #63, #64, #65)**:
   - `benefits`: 8 itemized bullet items (Performance Bonus, Private Insurance, Paid Time Off, Learning & Development, Hybrid Work Arrangement, Career Growth, Employee Perks, Collaborative & High-Ownership Culture).
   - `tech_stack`: `Go, Java, Microservices, REST APIs, gRPC, Kafka, Redis, Relational Databases, NoSQL, GCP, AWS, Docker, CI/CD`.
   - `experience_req`: `5+ years of professional backend engineering`.
2. **SEVIMA (Job #66, #67)**:
   - `benefits`: 7 itemized bullet items (Competitive salary & benefits, Makan siang, Mentor berpengalaman untuk pengembangan karir, Akses ke tech conference dan workshop, Program continuous learning, Lingkungan kerja yang mendukung inovasi, Work-life balance).
   - `tech_stack`: `GoLang, PHP, Vue.js, TypeScript, PostgreSQL, Data Warehouse, Microservices, Docker, DevOps`.
   - `experience_req`: `Minimal 2 tahun pengalaman sebagai Developer`.

### C. Multi-Row Experience & Education in Form Fill Preview (`web/src/generator/formPreview.ts`)
1. **Workable Form Preview**:
   - Itemize Education:
     - `education_school`: `Universitas Lambung Mangkurat`
     - `education_degree`: `Bachelor of Computer Science (S.Kom)`
     - `education_field`: `Computer Science`
     - `education_dates`: `08/2015 - 03/2020` (GPA 3.48/4.0)
   - Itemize all 3 Work Experiences as distinct rows:
     - **Row 1**: `Blue Sky Tech (Bythen AI)` | `Data and Backend Engineer` (03/2025 - 06/2026, Remote) + summary.
     - **Row 2**: `Feedloop AI` | `Software Engineer` (12/2022 - 11/2024, Remote) + summary.
     - **Row 3**: `PT Arkan Jaya Nusantara` | `Software Engineer` (01/2021 - 11/2022, Banjarmasin) + summary.
2. **SEVIMA Form Preview**:
   - Keep Choices dropdown `> 5 Tahun`.
   - Add explicit itemized rows displaying the 3 substantiating employment history records totaling > 5 years.

---

## 4. Verification Protocol
1. Compile check: `bunx tsc --noEmit`.
2. D1 & API inspection:
   - `curl -s http://localhost:3100/api/jobs/63` -> verify `benefits` contains 8 items and `tech_stack` contains technologies.
   - `curl -s http://localhost:3100/api/jobs/67` -> verify `benefits` contains 7 items and `tech_stack` contains technologies.
   - `curl -s http://localhost:3100/api/jobs/63/form-preview` -> verify discrete multi-row experience and education entries.
3. Knowledge graph update: `graphify extract .`.

---

## 5. Task Breakdown
- [x] 1. Update `scripts/crawl_and_ingest_all.ts` to parse and insert `benefits`, `tech_stack`, and `experience_req`.
- [x] 2. Update Cloudflare D1 `amiya` and runtime SQLite store for Job #63, #64, #65, #66, #67.
- [x] 3. Update `web/src/generator/formPreview.ts` to output discrete multi-row experience and education entries.
- [x] 4. Restart Web Console daemon and verify endpoints via curl.
- [x] 5. Run type checks and update knowledge graph (`graphify extract .`).
