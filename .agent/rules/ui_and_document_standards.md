---
trigger: always_on
description: Shadcn neutral zinc monochrome design tokens, canonical UI table/modal patterns, and ATS document generation standards.
---

# UI & ATS Document Standards

Strict design, component hierarchy, and document generation standards across all frontend templates and ATS artifact builders.

## 1. Shadcn Neutral Zinc Monochrome Theme

1. **Absolute Prohibition of Saturated Colors (Zero Rainbow Slop)**:
   - Absolutely NO green, red, blue, indigo, purple, yellow, amber, orange, or pink in any button, badge, border, icon, link, text, or indicator.
2. **Canonical Neutral Zinc Dark Palette**:
   - App Background: `#09090b` (zinc-950)
   - Surface Background: `#18181b` (zinc-900)
   - Elevated Surface: `#27272a` (zinc-800)
   - Active Surface / Borders: `#3f3f46` (zinc-700)
   - Subtle Highlight Borders: `#52525b` (zinc-600)
   - Muted Text / Placeholders: `#71717a` (zinc-500)
   - Secondary Text: `#a1a1aa` (zinc-400)
   - Main Text / Headings: `#f4f4f5` (zinc-100)
   - High-Contrast Primary: `#ffffff` (white)
   - High-Contrast Inverted: `#09090b` (black)
3. **Button Hierarchy**:
   - **Primary Action (Approve, Submit, Add, Run)**: Solid white background `#ffffff`, solid black text `#09090b`, border `1px solid #ffffff`. Hover: `#f4f4f5`.
   - **Secondary Action**: Background `#27272a`, text `#f4f4f5`, border `1px solid #3f3f46`. Hover: `#3f3f46`.
   - **Destructive Action (Drop, Delete, Remove)**: NEVER red. Background `#27272a` or transparent, text `#f4f4f5` or `#a1a1aa`, border `1px solid #3f3f46`. Hover: text `#ffffff`, border `#52525b`.
   - **Ghost Action**: Transparent background, text `#a1a1aa`. Hover: `#ffffff`.
4. **Indicators & Switches**:
   - Status badges: `#27272a` surface with `#3f3f46` border and `#f4f4f5` text.
   - Status dots: `#ffffff`, `#a1a1aa`, or `#71717a`. Never colored.
   - Feedback: Outline `#ffffff` or brief opacity shift. Never green or red notifications.
   - Switches: Use canonical Shadcn `Switch.svelte` (zinc track `#27272a`, active `#ffffff`, black thumb `#09090b`). Never native blue checkboxes.

---

## 2. Canonical Tabular & Modal Interface Patterns

0. **Rule Amendment & Contradiction Protocol**:
   - If a user request contradicts or violates existing UI or document rules, it indicates the rule requires amendment.
   - The agent MUST explicitly ask the user how the rule should be updated rather than autonomously deciding, making assumptions, or silently violating/enforcing it.

1. **Strictly Left-Aligned Table Toolbar**:
   - Standardized container: `.toolbar-left-aligned` (`display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 12px 24px; background-color: #09090b; border-bottom: 1px solid #27272a; flex-wrap: wrap;`).
   - ALL toolbar controls (stage/category filter popovers, search input, action buttons, and `Columns ⌄` visibility popovers) MUST sit consecutively on the left.
   - Prohibit `margin-left: auto` or `.toolbar-right-actions`; no control may ever be pushed to the far right.
   - Left-aligned search input with embedded Lucide `Search` icon (size 14, color `#71717a`, padding-left 32px, background `#18181b`).

2. **Universal Dropdown Popover for Category & Stage Filters (Zero Horizontal Tab Sprawl)**:
   - Prohibit horizontal pill tabs (`<Tabs>`) across data table toolbars.
   - Filter selection must use a compact Shadcn zinc dropdown popover (`StageFilterPopover.svelte`): trigger button shows active filter name, count badge, and `ChevronDown`, opening a dark zinc dropdown menu displaying all options with count badges and active checkmarks.

3. **Checkbox Scope Invariant (Jobs Ledger Exclusivity)**:
   - Multi-select checkboxes (`Checkbox.svelte`) are restricted strictly to `JobsLedgerView` where multi-row batch actions exist (Approve, Drop, Direct Submit).
   - Selection checkboxes are strictly prohibited on all other data tables (`Candidate Profile`, `Decision Criteria`, `Websites Directory`, `Companies`, `System Errors`).

4. **Dynamic Column Width Allocation (Zero Giant Empty Voids)**:
   - In full-width tables (`width: 100%`), allocate dynamic fluid width to the primary descriptive column while giving metadata columns balanced fixed widths.
   - In `JobsLedgerView`: `Role` is the dedicated dynamic width column (`width: auto`), absorbing fluid remaining table space and allowing job title / location to expand. `Salary` receives a fixed width of `200px` (`width: 200px;`), fitting compensation ranges on a single line without wrapping.
   - In all other tables: The primary text content column (`Value` in Profile, `Rule Definition` in Criteria, `Base URL` in Websites, `Website/Notes` in Companies, `Error Message` in Errors) receives dynamic width (`width: auto`), while metadata columns have fixed widths.

5. **Table Column Ordering Invariants**:
   - **Jobs Ledger**: Strictly `[Checkbox]` (44px) -> `Role` (dynamic auto) -> `Company` (180px) -> `Details` (`View Details` button, 100px) -> `Actions` (`···` `ActionPopover`, 60px) -> `Portal` (120px) -> `Salary` (200px) -> `Crawled At` (110px) -> `Status` (140px). `Details` and `Actions` sit directly after `Company`, never pushed to the far right.
   - **All Other Data Tables**: Dedicate the single final rightmost column to `Actions` (`<ActionPopover title="...">`).

6. **Dedicated Table Actions Popover (`ActionPopover`)**:
   - Trigger: 3-dots icon button defined in [`ActionPopover.svelte`](file:///home/sahana/Code_Repository/personal/job-apply-automator/web/frontend/src/lib/components/ui/ActionPopover.svelte).
   - Ordering inside popover:
     1. Header: entity identifier in uppercase muted text.
     2. Primary Actions: workflow transitions (Lucide size 13).
     3. Informational Actions: dialog triggers and external links.
     4. Destructive Actions: bottom-placed with class `danger`.

7. **Footer Pagination Standard (`DataTableFooter.svelte`)**:
   - Left side: Displays `X of Y row(s) selected.` when `showSelection` is true (`JobsLedgerView`), or `Showing Y total entries` when false.
   - Right side: Displays `Page X of Y` indicator with `[Previous]` and `[Next]` pagination buttons.

8. **Canonical Modal & Dossier Pattern**:
   - Backdrop: Fixed with `rgba(0, 0, 0, 0.8)` and backdrop blur.
   - Panel: Background `#18181b`, border `1px solid #27272a`, radius 8px, padding 24px.
   - Header: Entity title in `#ffffff` (16px bold), subtitle in `#a1a1aa` (12px). Title and subtitle must strictly stack vertically in block rows (title on top, subtitle beneath, left-aligned). Prohibit horizontal split layouts between title and subtitle.
   - Body: Scrollable content sections or 3-column summary metric cards (`#27272a` surface, label `#71717a`, value `#ffffff`).
   - Footer: Action buttons must be strictly right-aligned (`display: flex; justify-content: flex-end; align-items: center; gap: 10px; padding: 0; border-top: none; background: transparent; margin-top: 24px;`). Prohibit nested double borders or redundant footer padding.
   - Dismissal: Escape key and backdrop clicks dismiss.

9. **Sidebar Settings Popover Invariant**:
   - Trigger Interactivity: In the sidebar footer, click interactivity is restricted strictly to the dedicated settings gear icon button (`<button class="btn-settings-trigger">`). The outer candidate ledger card container is non-interactive (`<div>`).
   - Popover Positioning: The settings popover must be strictly right-aligned (`right: 8px; left: auto; min-width: 190px; width: max-content;`).

10. **Zero-State & Loading Invariants**:
   - Empty states render centered `.empty-state` (padding 60px 20px, text `#71717a`, font-size 13px) with human-readable text. Loading states use clean zinc styling. Never leave unhandled nulls or empty whitespace.

---

## 3. Applicant Tracking System (ATS) Document Standards

1. **Universal Typography & Visual Hierarchy**:
   - **Mandatory Typeface**: Strictly **`Open Sans`** (`'Open Sans', -apple-system, BlinkMacSystemFont, Arial, sans-serif`). Prohibit serif, novelty, or cursive fonts. Prohibit decorative emojis, icons, rating dots, or graphic skill bars.
   - **Type Scale**:
     - Candidate Full Name: `16pt - 20pt bold`, centered or left-aligned.
     - Section Headings: `11pt - 12pt bold`, uppercase, 1px solid horizontal rule (`#000000` or `#222222`).
     - Job / Organization Title: `10pt - 10.5pt bold`.
     - Dates & Locations: `9pt - 9.5pt italic`.
     - Body Text & Bullets: `9.5pt - 10.5pt regular`, line-height `1.35 - 1.45`.
   - **Contrast**: Pure white canvas (`#ffffff`), pure black primary text (`#000000` or `#111111`), secondary text `#222222` to `#333333`. Prohibit light gray text or colored chips.
2. **Layout & Section Architecture**:
   - **Strict Single-Column Flow**: Top-to-bottom stream. Multi-column CSS grids, sidebars, `<table>` layouts, and floating boxes are strictly prohibited. Standard margins: `12.7mm` (0.5 in) to `15mm`.
   - **Canonical Section Headings**: Strictly use standard parser keys:
     - `Contact Information`
     - `Professional Summary`
     - `Technical Skills`
     - `Professional Experience`
     - `Education & Certifications`
   - **Header Data**: Full legal name, residential city/country, phone with country code, email, LinkedIn, GitHub, portfolio URL. Exclude headshots, age, marital status, or full street addresses.
3. **Experience Bullets & Formulation (Google XYZ Formula)**:
   - Every bullet in `Professional Experience` must follow:  
     *Accomplished [X], as measured by [Y], by doing [Z]*.
   - Start with active past-tense engineering verbs (*Architected, Engineered, Optimized, Automated, Integrated, Deployed, Scaled*). Prohibit passive duties ("Responsible for"). Include concrete numerical metrics.
4. **Categorized Technical Skills**:
   - Explicit partitions: `Languages`, `Backend & Frameworks`, `Databases & Storage`, `Cloud & DevOps`, `Data & AI Engineering`.
   - Use standard industry naming conventions (e.g. `PostgreSQL` not `Postgres`, `TypeScript` not `TS`, `Kubernetes` not `k8s`).
5. **ATS Cover Letter Standards**:
   - Exactly 1 page, 3–4 paragraphs, 250–350 words total, matching `Open Sans` single-column layout.
   - **Paragraph 1 (Hook & Alignment)**: Target role, company, core value proposition.
   - **Paragraph 2 (Quantified Evidence)**: 1–2 technical achievements matching job requirements using XYZ formula.
   - **Paragraph 3 (Mission & Technical Fit)**: Address target company's engineering scale, product, or architectural challenges.
   - **Paragraph 4 (Direct Close)**: Reiterate interest, immediate availability, contact details.
   - Zero generic filler, sycophantic praise (*delighted to apply, thrilled*), or AI buzzwords (*game-changer, delve, elevate*).
