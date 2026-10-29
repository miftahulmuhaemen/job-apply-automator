# Independent Verification Agent & Semantic Quality Standard

Strict rules requiring independent subagent audit and semantic plausibility verification before declaring tasks complete:

## 1. Absolute Prohibition of Speed-Biased Verification Skips
- The agent is STRICTLY PROHIBITED from skipping verification or performing superficial "checks" (such as checking if a query returned status 200, checking row count > 0, or checking TypeScript compiler output alone) to conclude tasks quickly.
- Speed is never prioritized over data integrity, semantic correctness, or visual plausibility.

---

## 2. Mandatory Semantic Sense & Authenticity Checks
Every extracted record, candidate attribute, form preview, and dossier MUST be scrutinized against human-level domain logic:
1. **Garbage & Technical Artifact Detection**:
   - Keys with random machine hashes, ephemeral framework IDs (`input_files_input_*`, `ca_*`, raw UUIDs).
   - Labels containing code tokens, CSS classes, radio option snippets (`$7-$14`), or bot challenges (`recaptcha`, `turnstile`).
   - If detected, the result is FAULTY and MUST be rejected immediately.
2. **Mock & Synthetic Value Detection**:
   - Values containing placeholder sentences, plausible AI-generated fakes, fabricated salaries, or ungrounded claims not in `candidateProfile.json`.
   - If detected, the result is UNACCEPTABLE. Values must strictly be verified against ground truth or marked explicit `NULL` / `[NOT SPECIFIED]`.
3. **Information vs. Input Disambiguation**:
   - Job specification text (descriptions, responsibilities, requirements, benefits) must NEVER be parsed into form inputs.
   - Form inputs (name, email, resume, salary expectation, screening questions) must NEVER be lumped into specification text.
4. **Visual Reality Check**:
   - Screenshots of the actual rendered UI (e.g. Web Console tables, Dossier modal tabs) MUST be inspected. If a table contains weird column misalignments, duplicate blank standard fields, or cryptic technical strings, it cannot be handed to the user.

---

## 3. Mandatory Dispatch of Independent Verification Subagent
1. **Independent Subagent Audit**:
   - Before presenting final results to the user, the primary agent MUST dispatch an independent subagent (`invoke_subagent` with `TypeName: "research"` or `"self"`) specifically dedicated to adversarial quality verification.
   - The verification subagent must NOT be biased by the primary agent's implementation assumptions.
2. **Subagent Audit Mandate**:
   The verification subagent must independently inspect:
   - Database tables: Check for junk keys, unmapped standard duplicates, or raw DOM tokens.
   - Form Fill Previews: Verify that every field has a human-readable label, accurate source attribution, and zero hallucinated answers.
   - Visual screenshots: Confirm that the user-facing UI looks clean, professional, and strictly conforms to the Zinc monochrome palette.
3. **Halt on Verification Failure**:
   - If the independent verification subagent finds any anomaly, faulty field, or semantic failure, the agent must fix the issue before presenting the result to the user.
