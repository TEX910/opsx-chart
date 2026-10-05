---
name: opsx-chart-explore
description: Explore an OpenSpec change through OPSX Chart, reading specifications, capability links, and behavior flows together before planning or editing.
---

# Explore a change in OPSX Chart

Use the repository's `openspec-explore` skill for OpenSpec discovery and its read-only boundary. Add the visual perspective in the same exploration; do not start a second plan or change for the graph.

1. Resolve the OpenSpec root and any selected store with `openspec list --json`. If a store was selected, preserve its `--store <id>` on supported OpenSpec commands. Use the resolved local project path for Chart commands. If Chart cannot open that root, report the limitation instead of guessing a different root.
2. Run `npm run --silent cli -- snapshot --root <project>` and inspect relevant capabilities with `npm run --silent cli -- inspect --root <project> --capability <id> [--flow <id>] [--change <change>]`. Compare current and proposed scenario text with the linked graph cases and capability relations.
3. Describe the affected OpenSpec artifacts, graph paths, missing links, and decisions still open. Treat graph topology as descriptive and Markdown scenarios as the behavior contract. Do not infer unspecified outcomes from a drawing.
4. When the user asks to capture the result, continue with `opsx-chart-propose` for a new change or `opsx-chart-update` for an existing one. Exploration itself stays read-only.
