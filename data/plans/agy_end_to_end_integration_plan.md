# Plan: AGY End-to-End Core Pipeline Integration

## Goal & Scope
Permanently eliminate hardcoded dictionaries (`TECH_DICTIONARY`) and static boilerplate templates by connecting the Antigravity CLI (`agy`) agent into the core ingestion and document generation workflows:
1. **Dynamic Job Specification Analysis**: Use AGY to extract `techStack`, itemized `benefits`, and `experienceReq` directly from raw job posting text in a single fast call.
2. **Contextual Resume Summary & Cover Letter**: Use AGY to synthesize role-tailored executive summaries and bespoke 3-paragraph cover letters grounded in `candidateProfile.json`.
3. **Custom Screening Q&A**: Use AGY to answer custom employer screening questions using candidate's verified achievements, removing hardcoded string matching in form previews.
4. **Deterministic Offline Fallbacks**: Preserve deterministic rule-based generators as graceful fallbacks if AGY times out or is offline, ensuring zero pipeline interruption.

---

## Technical Design

### 1. Unified CLI Agent Functions ([`web/src/agent/cliAgent.ts`](file:///home/sahana/Code_Repository/personal/job-apply-automator/web/src/agent/cliAgent.ts))
- **`analyzeJobSpecificationWithAgent(rawText: string)`**:
  - Input: Raw job article text (1,000–3,000 tokens).
  - Schema:
    ```json
    {
      "techStack": ["string"],
      "benefits": ["string"],
      "experienceReq": "string | null",
      "roleSummary": "string"
    }
    ```
  - Execution: Non-interactive `agy -p "<prompt>" --output-format json` with 30s timeout.
- **`generateTailoredNarrativeWithAgent(jobTitle: string, company: string, jdText: string)`**:
  - Input: Target role metadata + candidate profile master.
  - Schema:
    ```json
    {
      "tailoredSummary": "string",
      "coverLetter": "string (3 markdown paragraphs)"
    }
    ```
  - Persona Grounding: Strictly enforces Dimension 3 of Cross-Verification Standards:
    - Bythen AI: Data Warehouse, Airflow DAGs, Great Expectations, Go microservices, GCP Pub/Sub.
    - Feedloop AI: AI legal document platform, collaborative Kubernetes cluster monitoring & PostgreSQL database migrations (never claim solo migrations).
    - PT Arkan Jaya Nusantara: Medical telemetry sensor integration in Go & React.
- **`answerScreeningQuestionWithAgent(question: string, jobTitle: string, company: string)`**:
  - Input: Custom screening prompt.
  - Output: 1–3 sentence grounded, factual response without conversational fluff.

### 2. Integration Points
- **Dynamic Crawler ([`scripts/dynamic_crawler.ts`](file:///home/sahana/Code_Repository/personal/job-apply-automator/scripts/dynamic_crawler.ts))**:
  - Replace `TECH_DICTIONARY` regex loops with `analyzeJobSpecificationWithAgent`.
  - Fallback: Word extraction regex if AGY times out.
- **Document Generator ([`web/src/generator/resumeBuilder.ts`](file:///home/sahana/Code_Repository/personal/job-apply-automator/web/src/generator/resumeBuilder.ts))**:
  - Asynchronously call `generateTailoredNarrativeWithAgent` during `generateJobDocuments`.
  - Embed the tailored summary into the ATS HTML resume and pass the tailored cover letter into the dossier.
- **Form Fill Preview ([`web/src/generator/formPreview.ts`](file:///home/sahana/Code_Repository/personal/job-apply-automator/web/src/generator/formPreview.ts))**:
  - For unmapped employer questions (`category === 'custom'`), call `answerScreeningQuestionWithAgent` to populate proposed answers.

---

## Task Breakdown
- [x] Task 1: Implement `analyzeJobSpecificationWithAgent` and `generateTailoredNarrativeWithAgent` in `web/src/agent/cliAgent.ts`.
- [x] Task 2: Refactor `scripts/dynamic_crawler.ts` to call AGY for tech stack, benefits, and requirement extraction, deleting `TECH_DICTIONARY`.
- [x] Task 3: Refactor `web/src/generator/resumeBuilder.ts` to generate tailored summaries and cover letters via AGY with deterministic fallback.
- [x] Task 4: Connect custom screening questions in `web/src/generator/formPreview.ts` to `answerScreeningQuestionWithAgent`.
- [x] Task 5: Re-crawl ESCREDIA Job #91/#97 to verify dynamic tech stack and tailored documents.
- [x] Task 6: Dispatch independent verification subagent to audit data integrity, ground truth conformance, and visual screenshots.
- [x] Task 7: Update knowledge graph (`graphify extract .`) and verify build (`bunx tsc --noEmit`).

---

## Dependencies & Blockers
- Native `agy` binary: `/home/sahana/.local/bin/agy` (confirmed operational and authenticated).
- Runtime safety: All calls wrapped in 30s timeout with fallback to existing deterministic logic.

---

## Verification Protocol
1. Static analysis: `bunx tsc --noEmit` must pass with 0 errors.
2. Ingestion verification: Ingest ESCREDIA role; confirm `Ruby on Rails`, `Express.js`, `React`, `TypeScript` extracted without dictionary.
3. Document verification: Inspect generated cover letter for Job #91 and #94 to confirm bespoke narrative citing candidate's verified projects.
4. Subagent verification: Independent auditor report confirming zero hallucinated claims.
