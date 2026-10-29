# Zero Legacy and Dead Code Policy

Strict rules against retaining obsolete, replaced, or unused code:

1. **Immediate Purge of Superseded Assets**:
   - The repository must maintain zero dead code, unused scripts, obsolete scaffolding, or legacy modules.
   - When any feature, engine, or architecture is migrated or superseded, the legacy code MUST be purged completely from the codebase in the same change set.
   - Retaining unused legacy code for "reference", "backup", or "fallback" is strictly prohibited. Version control retains history.

2. **One-Off and Test Script Hygiene**:
   - Temporary test scripts, one-off migration utilities, and redundant scratch files must be removed immediately once their specific validation task is verified.
   - Only persistent, maintained operational scripts and test suites are permitted in `scripts/`.

3. **Continuous Working Tree Hygiene**:
   - Never leave orphaned directories, abandoned prototypes, or duplicate implementations in the working tree.
   - Whenever dead or legacy code is pruned, immediately synchronize `README.md` and repository topology per `documentation_sync.md`.
