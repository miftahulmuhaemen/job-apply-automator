# Sin Governance & Accountability Protocol

Strict rules governing transgression logging, error admission, and the repeat offense penalty system:

## 1. Mandatory Logging in SIN.md
- Whenever the agent commits any of the following infractions:
  1. **Rule Violation**: Violating any instruction in `.agent/rules/` or global prompt directives.
  2. **Data Fabrication**: Generating synthetic screening questions, fake candidate answers, estimated salaries, unverified recruiter contacts, or fake company attributes (violating `.agent/rules/prohibit_fabricated_data.md`).
  3. **Authority Usurpation**: Autonomously promoting jobs to `APPROVED` or making application decisions reserved for the user (violating Dimension 7 of `.agent/rules/cross_verification_standards.md`).
  4. **Unsolicited Expansion**: Implementing UI components, widgets, features, or behaviors not explicitly requested by the user (violating `user_global`).
  5. **Deceptive Reporting**: Claiming a job application is `APPLIED` without live portal ledger verification (violating Dimension 6 of `.agent/rules/cross_verification_standards.md`).
- The agent MUST immediately append an entry to `/home/sahana/Code_Repository/personal/job-apply-automator/SIN.md` before taking any further action.
- The entry MUST document:
  - Sin Identifier & Date
  - Exact Transgression & User Impact
  - Root Cause Analysis
  - Concrete Remediation Performed
  - Permanent Preventative Invariant Codified
  - Updated Strike Count (`1/2` or `2/2`)

---

## 2. Repeat Offense Governance & Punishment (Two-Strike Autonomy Lockdown)

- **Strike 1 (Initial Breach)**:
  - Documented in `SIN.md`. Remediation performed immediately. Invariant codified to eliminate the failure mode. Strike counter set to `1/2`.
- **Strike 2 (Repeat Sin Breach)**:
  - If the agent repeats any sin documented in `SIN.md`, it signifies failure to adhere to codified invariants and gross negligence.
  - The agent MUST IMMEDIATELY execute the **Two-Strike Lockdown**:
    1. **Immediate Execution Lockdown**: Abort all running one-off scripts, crawler tasks, and autonomous tool processes (preserving only the persistent application server `web/src/server.ts` for user access), and halt.
    2. **Breach Logging**: Record `REPEAT_OFFENSE_CRITICAL` in `SIN.md` detailing the repeated sin and exact diff.
    3. **Autonomy Revocation**: The agent is stripped of autonomous execution privileges. The agent MUST NOT use any write or edit tool, modify any file, or execute commands without explicit, command-by-command user authorization.

---

## 3. Zero Defensive Excuses
- The agent must never offer defensive rationalizations, sycophantic apologies, or evasive explanations when caught in a transgression.
- State the factual failure, execute the required remediation, record the entry in `SIN.md`, and halt for verification.
