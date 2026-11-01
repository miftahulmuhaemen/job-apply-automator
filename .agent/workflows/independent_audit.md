---
name: independent_audit
description: Procedure for dispatching an independent verification subagent to audit semantic quality, database hygiene, and visual UI standards.
---

# Workflow: Independent Adversarial Quality Audit

This workflow defines the procedure for running an independent verification audit before presenting feature results or completed data tasks to the user.

---

## Step 1: Subagent Dispatch
1. The primary agent launches an independent verification subagent:
   - Tool: `invoke_subagent`
   - Role: `Adversarial Quality Auditor`
   - TypeName: `research` (or `self`)
2. The subagent operates in a separate context to prevent confirmation bias from the implementation run.

---

## Step 2: Database & Data Hygiene Audit
The subagent inspects database records:
1. **Garbage & Technical Artifacts**: Check for keys with random machine hashes, ephemeral framework IDs (`input_files_input_*`, raw UUIDs), or radio snippet values (`$7-$14`).
2. **Synthetic / Mock Values**: Verify that no values contain believable AI-generated fakes, fabricated salaries, or claims not grounded in the dynamic candidate profile ledger (`candidate_profile_attributes`).
3. **Disambiguation Check**: Verify that specification text is not dumped into interactive form inputs, and interactive form controls are not lumped into specification text.

---

## Step 3: Form Fill Preview Audit
1. Query `/api/jobs/:id/form-preview` for modified or tested jobs.
2. Confirm that every discovered field has a clean, human-readable label and accurate source attribution.
3. Confirm that missing data renders as clean empty states (`NULL` or `-`) rather than broken layouts.

---

## Step 4: Visual UI & Theme Inspection
1. Capture or review screenshots of rendered interfaces (Web Console, modals, tables).
2. Audit against `.agent/rules/shadcn_monochrome_theme.md`:
   - Verify strict Zinc/neutral monochrome styling.
   - Verify zero colored badges, borders, or buttons.
3. Confirm layout alignments, column spacing, and clean text wrapping.

---

## Step 5: Report Disposition
1. The subagent returns an audit report:
   - **PASS**: All dimensions meet quality and authenticity invariants.
   - **FAIL**: Defect list with exact keys, records, or UI components.
2. If defects are found, the primary agent must resolve them before presenting work to the user.
