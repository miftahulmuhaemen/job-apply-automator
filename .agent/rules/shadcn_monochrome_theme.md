---
trigger: always_on
description: Strict Shadcn monochrome UI and typography standards. Strictly zero colors outside the neutral zinc/white/black palette.
---

# Shadcn Monochrome Theme & Zero-Color Standards

Strict, non-negotiable styling standards across all CSS, HTML, JavaScript, and UI templates in this repository:

## 1. Absolute Prohibition of Non-Monochrome Colors (Zero Rainbow Slop)
- **Zero Saturated Colors**: Absolutely NO green, emerald, red, crimson, blue, indigo, purple, violet, yellow, amber, orange, or pink in any button, badge, border, icon, link, text, background, or indicator.
- **Strictly Zinc / Neutral Monochrome Palette**: All UI elements MUST exclusively use colors from the Shadcn neutral/zinc dark scale:
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

## 2. Shadcn Standard Button Hierarchy
- **Primary / Affirmative Action (Approve, Submit, Add, Run)**:
  - Background: `#ffffff` (solid white)
  - Text: `#09090b` (solid black)
  - Border: `1px solid #ffffff`
  - Hover: Background `#f4f4f5`, text `#09090b`
- **Secondary / Standard Action**:
  - Background: `#27272a` (zinc-800)
  - Text: `#f4f4f5` (zinc-100)
  - Border: `1px solid #3f3f46` (zinc-700)
  - Hover: Background `#3f3f46`, border `#52525b`
- **Destructive / Negative Action (Drop, Delete, Remove, Cancel)**:
  - MUST NEVER be styled with red (`#ef4444`, `#dc2626`, etc.).
  - Background: `#27272a` or transparent
  - Text: `#f4f4f5` or `#a1a1aa`
  - Border: `1px solid #3f3f46` (zinc-700)
  - Hover: Background `#3f3f46`, text `#ffffff`, border `#52525b`
- **Ghost / Link Buttons**:
  - Background: transparent
  - Text: `#a1a1aa` (zinc-400)
  - Hover: Text `#ffffff` (white)

## 3. Badges, Indicators & Links
- **Status Badges**:
  - Background: `#27272a`
  - Border: `1px solid #3f3f46`
  - Text: `#f4f4f5`
- **Status Dots**:
  - Solid White (`#ffffff`), Gray (`#a1a1aa`), or Muted (`#71717a`). Never colored.
- **Links (`<a>`)**:
  - Color: `#f4f4f5` or `#ffffff` with underline or hover underline. NEVER blue (`#38bdf8`, `#3b82f6`).
- **Save / Error Indicators**:
  - Success feedback: Outline `#ffffff` or brief opacity shift. NEVER green (`#10b981`, `#22c55e`).
  - Error feedback: Outline `#71717a` or inverted badge. NEVER red (`#ef4444`).

## 4. Verification Check
- Any commit or modification containing `#10b981`, `#059669`, `#ef4444`, `#22c55e`, `#38bdf8`, `#3b82f6`, `#a855f7` or any color outside the neutral zinc scale is a direct build invariant violation.
