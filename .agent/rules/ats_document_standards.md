# Applicant Tracking System (ATS) Document Standards

Strict engineering and document generation standards for autonomous agents, resume generators, and cover letter builders:

## 1. Universal Typography & Visual Hierarchy
1. **Mandatory Typeface**:
   - Every generated resume, CV, and cover letter MUST strictly use **`Open Sans`** (`'Open Sans', -apple-system, BlinkMacSystemFont, Arial, sans-serif`).
   - Prohibit all serif, novelty, cursive, or low-support monospaced fonts for document rendering.
   - Prohibit decorative emojis, icons, rating dots, or graphical skill bars.
2. **Type Scale**:
   - **Candidate Full Name**: `16pt - 20pt bold`, centered or left-aligned.
   - **Section Headings**: `11pt - 12pt bold`, uppercase, with simple 1px solid horizontal rule border (`#000000` or `#222222`).
   - **Job / Organization Title**: `10pt - 10.5pt bold`.
   - **Dates & Locations**: `9pt - 9.5pt italic`.
   - **Body Text & Bullet Points**: `9.5pt - 10.5pt regular`, line-height `1.35 - 1.45`.
3. **Contrast & Color Palette**:
   - Canvas: Pure white (`#ffffff`).
   - Primary Text: High-contrast pure black (`#000000`) or charcoal (`#111111`).
   - Secondary Text / Rules: `#222222` to `#333333`.
   - Prohibit light gray text (`#888888`), colored background chips, or tinted callout boxes.

---

## 2. Structural Parsing & Layout Architecture
1. **Strict Single-Column Flow**:
   - Layout must stream linearly from top to bottom.
   - Strictly prohibit multi-column CSS grids, flexbox sidebars, HTML `<table>` elements for layout, and floating text boxes.
   - Standard margins: `12.7mm` (0.5 inch) to `15mm` on A4 or US Letter.
2. **Canonical Section Headings**:
   - ATS parsers map candidate profiles through standard dictionary keywords. Custom headings break parser tokenization.
   - Headings must strictly be one of:
     - `Contact Information`
     - `Professional Summary`
     - `Technical Skills`
     - `Professional Experience`
     - `Education & Certifications`
3. **Header Information**:
   - Full legal name, residential location (City, Province/Country), phone number with country code, email address, LinkedIn profile URL, GitHub profile URL, portfolio URL.
   - Strictly exclude headshots/photos, age, date of birth, marital status, religion, or full physical street addresses.

---

## 3. Experience Bullets & Content Formulation
1. **Google XYZ Formula**:
   - Every bullet in `Professional Experience` must follow:  
     *Accomplished [X], as measured by [Y], by doing [Z]*.
   - Start every bullet with an active past-tense engineering verb (*Architected, Engineered, Optimized, Automated, Integrated, Deployed, Scaled*).
   - Prohibit passive responsibility descriptions (e.g. "Responsible for maintaining servers").
2. **Quantifiable Metrics**:
   - Include concrete numerical indicators where available (percentages, latencies in milliseconds, scale of records, cluster counts, throughput).
3. **Categorized Technical Skills**:
   - Skills must be partitioned into explicit categories:
     - `Languages`: Golang, TypeScript, JavaScript, Python, Rust, SQL, PHP
     - `Backend & Frameworks`: Go (net/http, Gin, Fiber, Echo v4), Node.js (NestJS, Express), REST APIs, WebSockets
     - `Databases & Storage`: PostgreSQL, MySQL, MongoDB, Redis, SQLite (WAL)
     - `Cloud & DevOps`: Docker, Kubernetes (GKE, AKS), GCP, AWS, Azure, GitHub Actions CI/CD
     - `Data & AI Engineering`: Apache Airflow, Metabase, Great Expectations, GCP Pub/Sub, RAG Pipelines, Vector Search
   - Use standard industry naming conventions matching job specifications (e.g., `PostgreSQL` not `Postgres`, `TypeScript` not `TS`, `Kubernetes` not `k8s`).

---

## 4. ATS Cover Letter Standards
1. **Length & Structure**:
   - Exactly 1 page, 3 to 4 concise paragraphs, 250–350 words total.
   - Matching typography: `Open Sans`, single-column, `#000000` on `#ffffff`.
2. **Paragraph Architecture**:
   - **Paragraph 1 (Hook & Alignment)**: Identify the exact target role and company. State the core engineering value proposition immediately.
   - **Paragraph 2 (Quantified Evidence)**: Present 1–2 technical achievements matching the primary technical requirements of the job description (using XYZ formula).
   - **Paragraph 3 (Mission & Technical Fit)**: Address the company's technical product, engineering scale, or architectural challenges.
   - **Paragraph 4 (Direct Close)**: Reiterate interest, state immediate availability, and provide contact details.
3. **Anti-Slop & Professional Precision**:
   - Zero generic filler, sycophantic praise (*delighted to apply, thrilled, honor*), or AI buzzwords (*game-changer, delve, elevate, seamless, passionate*).
