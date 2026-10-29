---
trigger: always_on
description: Standardizes runtime and package manager execution to Bun across the repository.
---

# Runtime & Package Management Standard (Bun)

1. **Mandatory Runtime & Package Manager**:
   - Use `bun` as the primary execution runtime and package manager for TypeScript, JavaScript, script execution, and dependency management (`bun run`, `bun test`, `bun install`, `bun add`, `bunx`).
2. **Prohibited Runtimes**:
   - Avoid `npm`, `npx`, `yarn`, or `pnpm` for routine development workflows unless a specific native binding strictly requires Node.js built-ins unavailable in Bun.
3. **Execution Commands**:
   - Starting Web Console: `bun run src/web/server.ts`
   - Running Automation / CLI: `bun run src/index.ts`
   - Running Scripts: `bun run scripts/<script_name>.ts`
