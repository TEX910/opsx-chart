---
name: opsx-chart-new
description: Start an OpenSpec change with the standard scaffold and stopping point. Use when the user requests the OPSX Chart new workflow.
---

# OPSX Chart new

Read [the shared integration contract](../opsx-chart-diagrams/references/integration.md). Locate the sibling `openspec-new-change/SKILL.md`, read it in full and execute that original workflow inline with the user's same arguments, change, schema and selected store. If absent, stop and explain that the matching OpenSpec operation must be installed first. Do not reconstruct or copy the original workflow.

Preserve the original scaffold-only stopping point. Do not generate specs or diagrams yet. Mention opsx-chart-continue or opsx-chart-propose only when the corresponding original is installed.

When this operation writes views, follow [the shared diagram contract](../opsx-chart-diagrams/references/diagrams.md), using the helper bundled in `../opsx-chart-diagrams/scripts/chart.mjs`. Summarize the original operation and diagram results together, keeping their outcomes distinct if only one succeeds. Respect the original phase boundary; do not start another operation.
