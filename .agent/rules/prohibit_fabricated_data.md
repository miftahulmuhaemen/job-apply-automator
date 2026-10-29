---
trigger: always_on
description: Strict prohibition of fabricated, mock, or synthetic data masquerading as real; mandatory null or explicit placeholder standard
---

# Prohibition of Fabricated, Mock & Synthetic Data (Zero Plausible Fakes)

Strict, non-negotiable rules governing data authenticity, ingestion truthfulness, and placeholder standards:

## 1. Absolute Prohibition of Plausible Fabrications
- **Zero Hallucinated Domain Data**: The agent is STRICTLY PROHIBITED from generating believable fake data, synthetic screening questions, fabricated candidate answers, estimated/made-up salaries, invented company leaders or HR contacts, or artificial employer specifications.
- **Deception Prevention**: Agents must NEVER generate realistic-looking filler content to make forms, tables, modals, or databases appear populated. Plausible fake data disguises incomplete ingestion or extraction failures, creating false impressions of completed work.
- **Zero Autonomous Synthesis**: Never synthesize job requirements, questions, or company attributes unless explicitly extracted verbatim from the target portal's live DOM or official API response.

---

## 2. Mandatory Null & Explicit Placeholder Standard
- **Absence Must Be Stored as NULL / Empty**:
  - When a data point (e.g. screening questions, salary benchmark, perks, leader info, HR email) is not present in the live source, it MUST be stored strictly as `NULL`, `undefined`, or an empty array (`[]`).
  - Missing data must render cleanly as empty states (e.g., `Screening Q&A (0)` with `"Standard application form; no custom employer questions"` or `"-"`).
- **Mandatory Unmistakable Placeholders for Demos / Wireframes**:
  - If a layout test, UI demonstration, or wireframe explicitly requires visual text, the agent MUST ONLY use standard, unmistakable placeholder text:
    - `Lorem ipsum dolor sit amet...`
    - `[PLACEHOLDER: NOT SPECIFIED IN SOURCE]`
    - `[UNVERIFIED DEMO DATA]`
  - The agent is STRICTLY FORBIDDEN from inventing realistic domain-specific anecdotes, simulated interview questions, or plausible technical answers as placeholders.

---

## 3. Strict Dual-Source Grounding Invariant
Every piece of data committed to `jobs_ledger` or presented to the user must originate exclusively from one of two verified sources:
1. **Live Source Ingestion**: Verbatim text directly extracted from the live platform page session or verified official API endpoint (conforming to Dimension 4 and Dimension 5 of `.agent/rules/cross_verification_standards.md`).
2. **Candidate Profile Master**: Factual statements and claims diffed directly against [`data/candidateProfile.json`](file:///home/sahana/Code_Repository/personal/job-apply-automator/data/candidateProfile.json) (conforming to Dimension 3).

Any data not traceable to these two ground-truth sources must NEVER be committed to the database or displayed as authentic.
