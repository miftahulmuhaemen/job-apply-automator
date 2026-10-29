# Documentation Synchronization Standard

Strict rules for maintaining repository documentation:

1. **Mandatory Continuous README Synchronization**:
   - Whenever any architectural change, directory reorganization, new CLI command/flag, new endpoint, environment configuration, or database schema change is introduced, `README.md` MUST be updated in the same change set.
   - Never allow `README.md` to become stale or drift from the actual codebase structure, build commands, or operational usage.

2. **README Structure Requirements**:
   - **System Overview**: High-level problem statement, operational status, and runtime boundaries.
   - **Directory & Architecture Topology**: Clear representation of directories segregated by action intention (e.g. `cli/`, `web/`, `data/`, `scripts/`).
   - **CLI Usage & Flags**: Exact commands for manual execution, dry-runs, and scheduler catch-up.
   - **Web Console**: Setup, port configuration, and available views.
   - **Data & Configuration**: Database schema summary, candidate profile structure, and personalization rules.
   - **Windows Startup Integration**: Step-by-step instructions for `shell:startup` automation.

3. **Writing Style & Anti-Slop Enforcement**:
   - Adhere strictly to `.agent/rules/writing_style.md`: zero decorative emojis, zero AI fluff/marketing adjectives, technical precision only.
