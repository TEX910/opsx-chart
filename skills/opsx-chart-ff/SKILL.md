---
name: opsx-chart-ff
description: Prepare OpenSpec planning artifacts and their read-only Mermaid scenario views. Use when the user requests the OPSX Chart ff workflow.
---

# OPSX Chart ff

Read [the shared integration contract](../opsx-chart-diagrams/references/integration.md). Locate the sibling `openspec-ff-change/SKILL.md`, read it in full and execute that original workflow inline with the user's same arguments, change, schema and selected store. If absent, stop and explain that the matching OpenSpec operation must be installed first. Do not reconstruct or copy the original workflow.

After the original fast-forward writes its concrete spec artifacts, generate change previews. Preserve its planning-only boundary and conditional/skipped artifacts.

When this operation writes views, follow [the shared diagram contract](../opsx-chart-diagrams/references/diagrams.md), using the helper bundled in `../opsx-chart-diagrams/scripts/chart.mjs`. Summarize the original operation and diagram results together, keeping their outcomes distinct if only one succeeds. Respect the original phase boundary; do not start another operation.
