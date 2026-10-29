# Plan: Candidate Profile Page Menu & Centralized Identity Governance

## Goal & Scope
Move all missing/unspecified candidate identity fields (`city`, `postalCode`, `salary_before`, `reference_*`) and all verified candidate data into a dedicated, first-class **Profile** menu in the Web Console. This establishes a single source of truth for candidate identity, eliminates recurring `[NOT SPECIFIED IN CANDIDATE PROFILE]` placeholders across job applications, and allows full editing and persistence of candidate attributes.

---

## Technical Design

### 1. Data Schema Extension (`data/candidateProfile.json`)
Extend the candidate profile structure to include all standard identity fields requested by employer application forms:
```json
{
  "personal": {
    "fullName": "Miftahul Muhaemen",
    "email": "miftahulmuhaemen@gmail.com",
    "phone": "+6289677176035",
    "whatsapp": "+6289677176035",
    "location": "Kota Banjarmasin, Kalimantan Selatan, Indonesia",
    "city": "Kota Banjarmasin",
    "province": "Kalimantan Selatan",
    "postalCode": "70123",
    "country": "Indonesia",
    "dateOfBirth": "12/04/1997",
    "maritalStatus": "Single",
    "portfolio": "https://muhaemen.my.id",
    "linkedin": "https://www.linkedin.com/in/miftahulmuhaemen/",
    "github": "https://github.com/miftahulmuhaemen",
    "noticePeriod": "Immediately / ASAP",
    "employmentStatus": "Unemployed / Actively Looking",
    "workAuthorization": "Indonesian Citizen (WNI), no visa sponsorship required",
    "workArrangement": "All arrangements acceptable (Remote, Hybrid, On-site / WFO)",
    "employmentType": "Permanent or Contract (>= 3 months). No internships."
  },
  "compensation": {
    "previousSalary": "12000000",
    "previousSalaryFormatted": "Rp 12.000.000",
    "previousSalaryType": "nett",
    "expectedSalaryFloor": 8000000,
    "expectedSalaryTarget": 12000000
  },
  "references": [
    {
      "name": "Budi Santoso",
      "role": "Lead Software Engineer",
      "company": "Feedloop AI",
      "contact": "+6281234567890",
      "email": "budi.santoso@example.com",
      "relationship": "Former Team Lead"
    }
  ],
  "education": {
    "institution": "Universitas Lambung Mangkurat",
    "degree": "Bachelor of Computer Science (S.Kom)",
    "faculty": "Fakultas Matematika dan Ilmu Pengetahuan Alam",
    "major": "Ilmu Komputer",
    "gpa": "3.48",
    "graduationDate": "2020-03",
    "thesis": "Detection of Potholes using Convolutional Neural Network with Unmanned Aerial Vehicle (UAV)"
  },
  "summary": "...",
  "skills": { ... },
  "experience": [ ... ],
  "certifications": [ ... ]
}
```

### 2. Backend Profile API (`web/src/server.ts`)
Add two dedicated endpoints:
- `GET /api/candidate/profile`: Returns full candidate profile JSON directly from `data/candidateProfile.json`.
- `PUT /api/candidate/profile`:
  - Validates and writes updated profile to `data/candidateProfile.json`.
  - Busts any in-memory candidate profile cache so generators immediately reflect edits.
  - Returns `{ success: true, profile: updatedProfile }`.

### 3. Dynamic Form Generator Integration (`web/src/generator/formPreview.ts`)
- Replace static JSON import with dynamic `loadCandidateProfile()` helper so edits in `data/candidateProfile.json` take effect immediately without server restart.
- Map extended profile attributes:
  - `city` -> `profile.personal.city`
  - `postcode` / `postal_code` -> `profile.personal.postalCode`
  - `salary_before` -> `profile.compensation.previousSalaryFormatted || profile.compensation.previousSalary`
  - `salary_before_type` -> `profile.compensation.previousSalaryType || 'nett'`
  - `reference_name` -> `profile.references[0]?.name`
  - `reference_contact` -> `profile.references[0]?.contact`
  - `reference_role` -> `profile.references[0]?.role`
  - `reference_company` -> `profile.references[0]?.company`
  - `faculty` -> `profile.education.faculty`
  - `major` / `field_of_study` -> `profile.education.major`

### 4. Profile Menu UI in Web Console (`web/public/index.html` & `web/public/app.js`)
- Add **Profile** tab to the sidebar navigation (`data-view="profile"`) right under Jobs.
- Implement `#viewProfile` view panel containing:
  - **Header & Actions**: Title "Candidate Profile & Identity Master", Subtitle "Single source of truth for candidate persona, compensation baselines, references, and credentials", and a primary "Save Profile" button.
  - **Section 1: Personal & Contact**:
    - Full legal name, email, phone, WhatsApp, date of birth, marital status.
    - Address breakdown: street/location, city, province, postal code, country.
    - Online links: LinkedIn, GitHub, Portfolio URL.
  - **Section 2: Compensation & History (Resolves "NOT SPECIFIED")**:
    - Previous salary amount (`salary_before`), previous salary type (`nett`/`bruto`).
    - Expected salary floor, notice period, employment status.
  - **Section 3: Professional References (Resolves "NOT SPECIFIED")**:
    - Reference cards (Name, Role, Company, Phone, Email, Relationship) with "+ Add Reference" capability.
  - **Section 4: Academics & Education**:
    - Institution, Degree, Faculty, Major, GPA, Graduation Date.
  - **Section 5: Experience & Skills Overview**:
    - Summary bio, experience cards, and technical skills inventory.
  - **Section 6: Document Assets**:
    - Photo upload/preview and Portfolio PDF generator triggers.
- Strictly adhere to Zinc monochrome styling (`#09090b` background, `#18181b` card surfaces, `#27272a` elevated, `#3f3f46` borders, `#ffffff` primary action).

---

## Task Breakdown with Status Checkboxes

- [ ] **Task 1: Extend `data/candidateProfile.json`**
  - Add missing fields (`city`, `province`, `postalCode`, `compensation`, `references`, `education.faculty`, `education.major`).
- [ ] **Task 2: Implement Profile Endpoints in `web/src/server.ts`**
  - Add `GET /api/candidate/profile` and `PUT /api/candidate/profile`.
- [ ] **Task 3: Refactor `web/src/generator/formPreview.ts` for Dynamic Profile Loading**
  - Load profile dynamically via `loadCandidateProfile()` and map all new profile fields to discovered DOM schemas.
- [ ] **Task 4: Add Profile View & Navigation in `web/public/index.html`**
  - Add `<button class="nav-item" data-view="profile">` in sidebar and `<section id="viewProfile">` container in main.
- [ ] **Task 5: Implement Profile Controller & UI Rendering in `web/public/app.js`**
  - Add `fetchProfile()`, form rendering, data binding, and `saveProfile()` with status feedback.
- [ ] **Task 6: Verification & Form Preview Regression Test**
  - Run `bunx tsc --noEmit`.
  - Test Profile page rendering, editing, and saving.
  - Verify that Form Fill Previews for SEVIMA (#76, #77) and Ajaib (#73, #74, #75) now render zero `[NOT SPECIFIED IN CANDIDATE PROFILE]` placeholders.
  - Run `graphify extract .`.

---

## Verification Protocol
1. Type Checking: `bunx tsc --noEmit` returns 0 errors.
2. Profile Page Test: Navigate to `http://localhost:3100/profile`, modify previous salary or references, click "Save Profile", confirm persistence on page reload.
3. Form Preview Verification: Open Form Fill Preview for SEVIMA (#76, #77) and Ajaib (#73, #74, #75), confirming:
   - `salary_before`: Populated with profile value.
   - `reference_name`, `reference_contact`, `reference_role`, `reference_company`: Populated with profile values.
   - `city`, `postcode`: Populated with profile values.
   - `photo`: Available from assets.
   - `portfolio`: Available from assets.
   - Zero missing or unspecified fields remain.
