# Plan: Exact 1:1 Live Portal Form Schemas & Concrete Salary Bids (Ground-Truth Driven)

## Goal & Scope
- Completely replace the generic 7-group ATS assumption in `web/src/generator/formPreview.ts` with exact 1:1 schemas discovered live by `agent-browser`:
  1. **SEVIMA (careers.sevima.com)**:
     - Exact Section 1: **Data Diri** (Foto Diri*, Nama Lengkap*, Email*, Nomor Telepon*, Status Pernikahan*, Tanggal Lahir*, Alamat*, Pendidikan Terakhir*, Curriculum Vitae*, Portofolio*).
     - Exact Section 2: **Pengalaman Bekerja** (Lama Bekerja*, Gaji yang Diharapkan* [specific exact number: `Rp 8.000.000`], Dari mana mengetahui lowongan*, Pernyataan Kejujuran, Persetujuan AI ATS, Persetujuan Kebijakan Privasi).
  2. **Workable (apply.workable.com - Ajaib)**:
     - Exact Section 1: **Personal Information** (First name*, Last name*, Email*, Headline, Phone, Address, Photo/Avatar, Country*).
     - Exact Section 2: **Profile** (Education, Experience, Summary, Resume).
     - Exact Section 3: **Details** (Cover letter).
- **Concrete Salary Bid**: Eliminate all salary range strings from single-value salary form inputs. For SEVIMA, set expected salary strictly to the exact number `Rp 8.000.000` (`8000000`, Gross monthly), matching candidate regional target and within the employer's published range (Rp 7.7M - Rp 13M).
- **Live Portal Proof**: Present actual full-page screenshots of the live external portals captured directly by `agent-browser` (`data/screenshots/portals/sevima_live_full.png` and `data/screenshots/portals/workable_live_full.png`), establishing external ground truth.

---

## Technical Design

### 1. Dedicated Portal Form Builders in `formPreview.ts`
- Implement `generateSevimaFormPreview(job)`:
  - **Section 1: Data Diri**:
    - `photo`: Inspects `data/assets/photo.*`. If missing, renders `[MISSING - Required by SEVIMA: No applicant photo file on record]` with Action Required.
    - `name`: Candidate full legal name (`Miftahul Muhaemen`).
    - `email`: `miftahulmuhaemen@gmail.com`.
    - `telephone`: `+6289677176035`.
    - `is_married`: `Belum Menikah` (Single).
    - `date_of_birth`: `1997-04-12` (from profile / standard date).
    - `address`: Candidate address (`Kota Banjarmasin, Kalimantan Selatan, Indonesia`).
    - `education`: `S1` (from Choices.js discovered values: S1, S2, S3, D4, etc.).
    - `curriculum_vitae`: Tailored ATS Resume PDF (`PT_Sentra_Vidya_Utama__SEVIMA__Software_Engineer_Resume.pdf`, 64 KB, Ready).
    - `portfolio`: Authentic Technical Portfolio PDF (`Miftahul_Muhaemen_Portfolio.pdf`, 153 KB, Ready).
  - **Section 2: Pengalaman Bekerja**:
    - `experience`: `> 5 Tahun` (from Choices.js discovered values: `< 1 Tahun`, `1-2 Tahun`, `3-5 Tahun`, `> 5 Tahun`).
    - `salary_expected`: Exact single value `Rp 8.000.000` (Gross/bruto monthly) - ZERO ranges.
    - `salary_expected_type`: `bruto` (auto-detected from form).
    - `info`: `Website Karir SEVIMA` / `Lainnya` (from Choices.js).
    - `statement_of_honesty`: `Setuju (Data yang dimasukkan benar dan akurat)`.
    - `statement_of_ai_processing`: `Setuju (Pemrosesan data dengan AI untuk rekrutmen)`.
    - `statement_of_consent`: `Setuju (Kebijakan Privasi SEVIMA)`.

- Implement `generateWorkableFormPreview(job)`:
  - **Section 1: Personal Information**:
    - `firstname`: `Miftahul`
    - `lastname`: `Muhaemen`
    - `email`: `miftahulmuhaemen@gmail.com`
    - `headline`: `Software & Data Engineer (5 Years Exp)`
    - `phone`: `+6289677176035`
    - `address`: `Kota Banjarmasin, Kalimantan Selatan, Indonesia`
    - `avatar`: `Optional (No avatar photo provided)`
    - `CA_55164` (Country): `Indonesia`
  - **Section 2: Profile**:
    - `education`: `Universitas Lambung Mangkurat — Bachelor of Computer Science (GPA 3.78/4.0)`
    - `experience`: `5 Years (Feedloop AI, Bythen AI)`
    - `summary`: Verbatim candidate executive summary.
    - `resume`: Tailored ATS Resume PDF (`Ajaib_Senior_Backend_Engineer_II___Shared_Services_Resume.pdf`, Ready).
  - **Section 3: Details**:
    - `cover_letter`: Verbatim tailored cover letter.

- Generic Fallback: Only used for unmodeled portals.

### 2. Frontend Adaptation in `web/public/app.js`
- Ensure the Form Fill Preview UI renders the portal's exact groups and inputs as defined by the dedicated portal schema.
- For `salary_expected`, display the exact concrete numeric bid (`Rp 8.000.000`) instead of range strings.
- Retain photo upload control and portfolio links for file inputs.

---

## Task Breakdown

- [ ] **Task 1: Overhaul `web/src/generator/formPreview.ts`**
  - Implement exact 1:1 schemas for SEVIMA (Data Diri, Pengalaman Bekerja) and Workable (Personal Info, Profile, Details).
  - Replace salary range in SEVIMA with exact number `Rp 8.000.000`.

- [ ] **Task 2: Update Web Console Rendering & Verification**
  - Test `/api/jobs/67/form-preview` (SEVIMA) and `/api/jobs/63/form-preview` (Ajaib).
  - Confirm exact field names and zero salary ranges on single inputs.

- [ ] **Task 3: Present Live Portal Proof**
  - Document the live external portal screenshots captured via `agent-browser` (`data/screenshots/portals/sevima_live_full.png` and `data/screenshots/portals/workable_live_full.png`).

---

## Verification Protocol
1. Curl `/api/jobs/67/form-preview`: confirm groups are `Data Diri` and `Pengalaman Bekerja`, `salary_expected` value is exactly `Rp 8.000.000`, `education` is `S1`, `experience` is `> 5 Tahun`.
2. Curl `/api/jobs/63/form-preview`: confirm groups are `Personal Information`, `Profile`, and `Details`, with `firstname`, `lastname`, `email`, `CA_55164` (Country: Indonesia).
3. Confirm type compilation `bunx tsc --noEmit` is 0 errors.
