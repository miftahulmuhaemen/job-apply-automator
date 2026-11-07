---
name: graphify
description: Knowledge graph query, navigation, and extraction workflow using graphify.
---

# Workflow: Knowledge Graph Maintenance & Navigation (graphify)

This repository maintains a graphify knowledge graph at `graphify-out/`.

---

## 1. Querying & Navigation Protocol
- For codebase or architecture questions, when `graphify-out/graph.json` exists, first run `graphify query "<question>"` (CLI) or `query_graph` (MCP).
- Use `graphify path "<A>" "<B>"` / `shortest_path` for relationships and `graphify explain "<concept>"` / `get_node` for focused concepts. These return a scoped subgraph, significantly smaller than `GRAPH_REPORT.md` or raw grep output.
- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain do not surface enough context.

---

## 2. Extraction & Update Pipeline
Follow the graphify skill installed at `~/.gemini/config/skills/graphify/SKILL.md` to run the extraction pipeline:
1. At the end of every change, update the graph by running:
   ```bash
   graphify extract .
   ```
2. **Exemption**: For changes strictly confined to documentation, markdown rules (`.agent/`), or plan files (`data/plans/`), do NOT run `graphify extract .`.
3. **Exclusion Standard**: Graphify must strictly ignore all files and directories starting with a dot (e.g. `.vscode/`, `.agents/`, `.git/`, `.*`) and everything listed in `.gitignore` (enforced via `.graphifyignore`).
