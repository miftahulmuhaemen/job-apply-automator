# Plan: Shadcn Component Upgrade (Checkbox, Dropdown, Data Table & Search)

## Goal & Scope
Upgrade the remaining non-Shadcn UI elements in the Web Console (`web/public/index.html`, `web/public/style.css`, and `web/public/app.js`) to match the official Shadcn UI zinc dark monochrome design language:
1. **Shadcn Custom Checkbox**:
   - Replace native browser checkboxes (`<input type="checkbox">`) across table headers, rows, column selectors, and modals with custom-rendered Shadcn checkboxes (`rounded-sm`, 16x16px, `border-zinc-700`, white fill with black checkmark when checked, focus rings, and accessible label/description layout matching user uploads).
2. **Shadcn Dropdown / Select Menus**:
   - Replace the native `<select id="jobsTabSelect">` with a custom Shadcn Select trigger button (`Review (8) ⌄`) and floating popover menu.
   - Refactor the Columns menu (`#columnPopover`) into an exact Shadcn Dropdown Menu with right-aligned checkmarks (`✓`) matching the user's reference image (`uploaded_media_12`).
   - Refactor row action popovers (`#actionPopover`) and batch action dropdowns into Shadcn dropdown menus.
3. **Shadcn Data Table and Search Input**:
   - Upgrade `#searchInput` to a Shadcn Input with a left-aligned Lucide search icon, subtle zinc border (`border-zinc-800`), placeholder typography, and focus ring.
   - Polish table header, row borders (`border-zinc-800`), hover states, and active selected row state (`bg-zinc-900/70`).
   - Add a standardized Shadcn table footer displaying selection status (`X of Y row(s) selected`) alongside pagination controls.

---

## Technical Design

### 1. Shadcn Checkbox Specification
- **Visual Spec** (derived directly from user uploaded reference images):
  - Box size: `16px x 16px` (`w-4 h-4`).
  - Border radius: `4px` (`rounded-sm`).
  - Unchecked State:
    - Background: `transparent` or `#09090b` (zinc-950).
    - Border: `1px solid #3f3f46` (zinc-700).
  - Checked State:
    - Background: `#ffffff` (solid white).
    - Border: `1px solid #ffffff`.
    - Checkmark icon: SVG path `M3.75 7.5L6.25 10L12.25 4` with stroke `#09090b` (2px width), centered.
  - Hover & Focus:
    - Hover border: `#52525b` (zinc-600).
    - Focus ring: `outline: 2px solid #a1a1aa`, `outline-offset: 2px`.
  - Pure CSS implementation on `<input type="checkbox" class="shadcn-checkbox">` with `:checked`, `:focus-visible`, and `appearance: none`, maintaining native HTML form semantics, keyboard navigation (`Space` / `Enter`), and zero event listener breakage.

### 2. Shadcn Dropdown & Select Specification
- **Select Trigger (`#jobsTabTrigger`)**:
  - `display: inline-flex; align-items: center; justify-content: space-between; gap: 8px;`
  - Height: `36px` (`h-9`), padding: `0 12px`, border-radius: `6px` (`rounded-md`).
  - Background: `#18181b` (zinc-900), border: `1px solid #27272a` (zinc-800), text: `#f4f4f5`.
  - Icon: Lucide `chevron-down` SVG on the right.
  - State: Opens floating custom menu `#jobsTabMenu`.
- **Columns Dropdown Menu (`#columnPopover`)**:
  - Matches `uploaded_media_12_1793268068136.png`:
  - Floating card: `background: #09090b; border: 1px solid #27272a; border-radius: 6px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); padding: 4px;`
  - Item row: `display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: 4px; font-size: 13px; color: #f4f4f5; cursor: pointer;`
  - Hover item: `background: #27272a;`
  - Active checkmark: Right-aligned SVG checkmark `✓` (`stroke: #ffffff`) when column is visible.

### 3. Shadcn Search Input & Data Table Toolbar
- **Search Component (`.search-input-wrapper`)**:
  - Container with `position: relative; display: inline-flex; align-items: center; max-width: 320px; width: 100%;`
  - Left Lucide search icon: `<svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#71717a" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>` positioned at `left: 10px`.
  - Input field: `height: 36px; padding: 0 12px 0 32px; border-radius: 6px; border: 1px solid #27272a; background: #09090b; color: #f4f4f5; font-size: 13px;`
  - Focus: `border-color: #52525b; box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);`
- **Data Table Layout**:
  - Container: `border: 1px solid #27272a; border-radius: 6px; overflow: hidden; background: #09090b;`
  - Table header: `background: #18181b; border-bottom: 1px solid #27272a; color: #a1a1aa; font-size: 11.5px; font-weight: 600; text-transform: uppercase;`
  - Table rows: `border-bottom: 1px solid #27272a; transition: background 0.1s ease;`
  - Selected row state: `tr.selected { background-color: #27272a !important; }`
  - Table footer: Bottom bar showing `X of Y row(s) selected.` and pagination buttons.

---

## Task Breakdown
- [x] Task 1: Create pure Shadcn checkbox CSS styles (`.shadcn-checkbox`) in `web/public/style.css` supporting unchecked, checked (solid white + black SVG mark), focus, and disabled states.
- [x] Task 2: Update `web/public/index.html` and `web/public/app.js` to render `.shadcn-checkbox` for:
  - Header select-all checkbox (`#selectAllJobs`)
  - Row selection checkboxes (`.row-checkbox`)
  - Candidate Profile table checkboxes
  - Application form preview modal checkboxes
- [x] Task 3: Build Shadcn Select component for the Jobs status tab filter (`Review`, `Pending`, `Submitted`, `Filtered`, `All`), replacing native `<select id="jobsTabSelect">`.
- [x] Task 4: Refactor the Columns dropdown menu (`toggleColumnMenu` and `#columnPopover`) to strictly match the reference image with right-aligned checkmark indicators and Shadcn styling.
- [x] Task 5: Upgrade the search input bar with the left-aligned Lucide search icon, Shadcn input dimensions, and subtle zinc borders.
- [x] Task 6: Add Shadcn table selection status (`X of Y row(s) selected`) in the table footer.
- [x] Task 7: Capture visual evidence screenshots with Puppeteer verifying the new Checkboxes, Dropdown, and Search/Data Table in the Web Console.
- [x] Task 8: Run type check (`bunx tsc --noEmit`) and update knowledge graph (`graphify extract .`).

---

## Dependencies & Blockers
- None. Runs directly on the existing Web Console (`http://localhost:3100`).
- Backward compatibility: Existing event handlers (`toggleRowSelection`, `toggleSelectAll`, `switchJobsTab`, `toggleColumn`) remain intact with zero regression.

---

## Verification Protocol
1. Static analysis: `bunx tsc --noEmit` must pass with 0 errors.
2. Visual audit:
   - Checkbox: Unchecked shows dark rounded square; checked shows solid white with black checkmark.
   - Dropdown: Columns popover shows right-aligned checkmarks (`uploaded_media_12` parity). Status dropdown renders Shadcn trigger + popover.
   - Search: Search input has left-aligned magnifying glass icon and 36px height.
3. Interactive audit via Puppeteer:
   - Toggle row checkboxes -> verify row highlight and selection counter updates.
   - Toggle columns dropdown -> verify column visibility toggles correctly.
   - Select status filter -> verify table filters rows correctly.
