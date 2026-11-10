# Project Roadmap & TODO

## Active Roadmap & Upcoming Milestones

### 1. Interview Prep & Leadership Analysis (On-Demand)
- **Status**: [ ] **PLANNED** (Design & Architecture Documented)
- **Reference**: Detailed spec in [`data/plans/interview_prep_and_leadership_analysis.md`](file:///home/sahana/Code_Repository/personal/job-apply-automator/data/plans/interview_prep_and_leadership_analysis.md)
- **Key Deliverables**:
  - [ ] **Job Dossier Tab**: Add new tab `"Interview Prep"` inside `JobDossierModal.svelte`.
  - [ ] **Non-Automatic / On-Demand Invariant**: Strict rule that this analysis is **never** executed automatically during crawl or intake; strictly initiated on-demand via `[Analyze Interview Stakeholders & Insights]` button.
  - [ ] **Leadership & Recruiter Discovery**: Automated research identifying HR recruiters, CTO / VP Engineering, and relevant Tech Leads for the company and position.
  - [ ] **Social & Thought Leadership Intelligence**: Ingest and analyze public activity, posts, and articles on LinkedIn and Threads to identify interviewer priorities and technical philosophy.
  - [ ] **Tailored Conversation Starters & Reverse Questions**: Generate high-leverage talking points linking candidate portfolio systems with the interviewers' technical focus.
  - [ ] **Backend Schema & APIs**:
    - Add `interview_prep_json` column to `jobs_ledger` in Cloudflare D1.
    - Endpoints: `GET /api/jobs/:id/interview-prep` and `POST /api/jobs/:id/interview-prep/analyze`.

---

### 2. Resume & Portfolio Batch Synchronization
- **Status**: [x] **COMPLETED (Verified Across All 13 Active Jobs)**
- **Tasks**:
  - [x] Ground ATS resume generation in Cloudflare D1 candidate profile without fallback truncation.
  - [x] Eliminate redundancy against Portfolio document (remove duplicate `Featured Production Projects` section from Resume).
  - [x] Restore all 3 authentic professional experiences (Blue Sky Tech, Feedloop AI, PT Arkan Jaya Nusantara).
  - [x] Sanitize Technical Skills to pure tech stack syntax (remove `(CTEs, indexing)`, `Schema Optimization`, etc.).
  - [x] Enforce strict section ordering:
    1. Header
    2. PROFESSIONAL SUMMARY
    3. PROFESSIONAL EXPERIENCE
    4. TECHNICAL SKILLS
    5. EDUCATION
  - [x] Verify live online availability across all 12 remaining jobs on Dealls (`status=active`, `closed=false`).
  - [x] Regenerate tailored ATS Resumes & Portfolio Dossiers for all 12 jobs (100% compiled to exact 1-page A4 PDFs).
