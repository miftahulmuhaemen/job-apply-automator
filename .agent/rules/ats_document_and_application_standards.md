---
trigger: always_on
description: Strict professional ATS document standards, zero-fallback invariants, and submission integrity for resumes and cover letters.
---

# Professional ATS Document & Application Submission Standards

Zero-tolerance standards for candidate resumes, cover letters, and email applications. Designed to ensure every generated artifact represents an authentic, high-caliber software engineering professional and completely eliminates embarrassing shortcuts, lazy fallbacks, and placeholder text.

---

## 1. Absolute Prohibition of Fallback Placeholders (Hard Rejection Invariant)

1. **Zero Fake / Dummy / Truncated Fallback Text**:
   - The system and agent are STRICTLY PROHIBITED from injecting generic 2-sentence templates, dummy paragraphs, or truncated summaries (e.g. *"Dear Hiring Team at X, I am writing to apply..."* or *"Skills & Experience compiled for ATS ingestion"*).
   - A document must either be **100% complete, tailored, and verified**, or the system MUST **refuse to proceed** and explicitly report `UNREADY / MISSING`.
2. **Hard Block Over Compromised Delivery**:
   - Drivers (`breezy.rs`, `workable.rs`, `dealls.rs`) and mailers (`email_composer.rs`, `send_job_email`) MUST return a hard error (`anyhow::bail!`) if a tailored cover letter or resume is missing on disk.
   - Never attempt to submit an application or send an email with missing attachments or placeholder text.
3. **Zero Cross-Employer Leakage**:
   - Never reference another company's name or file (e.g. `Radya_Labs_...`) when generating assets for a different employer.
   - Attachment resolvers must strictly search for `{Company}_{Role}_Resume.pdf` and `{Company}_{Role}_Portfolio.pdf`.

---

## 2. Professional ATS Resume Standards (PDF Compilation)

1. **Zero Browser Artifacts (Absolute Prohibition of Headers & Footers)**:
   - Headless Chrome/Chromium print compilation MUST always pass:
     `--headless=new --no-sandbox --disable-gpu --no-pdf-header-footer`
   - Absolutely NO automated browser headers or footers (such as print date timestamps `07/11/26, 13.35`, HTML `<title>` tags, or URL footers `http://...`) may ever appear on generated PDFs.
   - In CSS, `@page { size: A4; margin: 10mm 14mm; }` must be enforced with clean styling.
2. **Strict Single-Page A4 Layout**:
   - Content density must be balanced to fit exactly on 1 page without trailing blank pages or overflow.
   - Font family: `Open Sans`, `-apple-system`, `Arial`, sans-serif.
   - High-contrast pure black on pure white (`#000000` on `#ffffff`).
3. **Grounded in Verified Candidate Truth Loaded from Database**:
   - **Dynamic Identity**: All candidate personal details (full name, phone, email, portfolio URL, location) must be loaded dynamically from Cloudflare D1 (`candidate_profile_attributes`). Never hardcode personal identity strings in code or documentation.
   - **Dynamic Education**: Rendered directly from `profile.education` as stored in the database (`institution`, `degree`, `field`, `gpa`, dates).
   - **Dynamic Experience**: Rendered directly from `profile.experience` with verified company names, roles, dates, and quantitative achievements.
   - **Dynamic Projects**: Rendered directly from `profile.projects` with authentic technical stacks, live URLs, and architecture descriptions.
4. **Google XYZ Formula for Every Bullet Point**:
   - Every bullet MUST state: *Accomplished [X], as measured by [Y], by doing [Z]*.
   - Use active past-tense engineering verbs (*Architected, Engineered, Optimized, Automated, Deployed*). Never passive phrases (*"Responsible for"*).
5. **Strict Role-Only Title Standard (Zero Technology Mentions)**:
   - Role headline titles (e.g., `Fullstack Developer`, `Senior Software Engineer`, `Backend Engineer`, `Frontend Engineer`, `DevOps Engineer`, `Data Engineer`) MUST represent the role/level ONLY.
   - Strictly prohibit parenthetical technology lists such as `(Go & React)`, `(React & TypeScript)`, or `(Go & Cloud Infrastructure)` in headline roles or portfolio tags. All technologies belong exclusively in the Technical Skills section.
6. **Zero Redundancy Inside Resume & Portfolio Documents**:
   - **Professional Summary**: Focuses on architectural patterns, engineering scope, and target company alignment. It MUST NOT repeat the technology laundry list that follows in Technical Skills, and MUST NOT repeat project titles from Featured Projects.
   - **Technical Skills**: Each technology, language, or tool must appear in exactly one category. Cross-category duplication (e.g. languages repeated under backend or frontend categories) is strictly prohibited.
   - **Portfolio Header**: The portfolio tag must be strictly `Software Engineering Portfolio • {Role}` with zero parenthetical technology noise.

---

## 3. Professional Tailored Cover Letter Standards

1. **Authentic Narrative (250–350 Words)**:
   - Every cover letter must be a complete, professional, 3-to-4 paragraph narrative matching the target company and role.
2. **Canonical Structure**:
   - **Salutation**: `Dear Hiring Team at [Company],`
   - **Paragraph 1 (Hook & Identity)**: State target role (strictly role-only via `sanitize_role_title`), company, 5+ years of software engineering experience, and primary technical focus.
   - **Paragraph 2 (Flagship Proof Points)**: Cite 2–3 concrete production systems from the candidate's engineering portfolio with quantified technical details.
   - **Paragraph 3 (Availability & Roadmap Impact)**: Immediate availability (ASAP notice period) and readiness to discuss technical challenges.
   - **Sign-off**: Formal close (`Sincerely,`), followed dynamically by candidate full name, email, phone with country code, and portfolio URL loaded from the database profile.
3. **Zero Redundancy Inside Cover Letter**:
   - Prohibit repeating the company name or role title as a prefix inside portfolio bullet points (e.g., NO `• Software Engineer at X: Fullstack Software Engineer at X, building...`).
   - Prohibit repeating the candidate portfolio URL in the body text when it is already in the contact footer.
   - Exclude non-technical or committee volunteer roles (e.g. `Panitia`, `Seminar`, `Volunteer`) from engineering application cover letters.
4. **Prohibition of AI Buzzwords & Sycophancy**:
   - Prohibit empty flattery (*"I was thrilled to see"*, *"delighted to apply"*, *"esteemed company"*).
   - Prohibit generative clichés (*"delve"*, *"testament"*, *"tapestry"*, *"game-changing"*).

---

## 4. UI & Dispatch Safety Controls

1. **Physical Button Disablement**:
   - `Send via Gmail API` and `Create Draft in Gmail` buttons MUST be physically disabled (`disabled={!resumeExists || !coverLetterText || coverLetterText.length < 100}`) whenever assets are incomplete.
   - Unready states must display clear guidance to generate the required asset in the Tailored Files tab.
2. **Backend Dispatch Guard**:
   - `send_job_email` endpoint must verify that the tailored resume PDF is attached and that the body length is at least 100 characters before calling the Gmail API. Rejects invalid requests with HTTP 200 `{ "success": false, "error": "..." }`.
