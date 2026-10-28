---
name: opsx-chart-propose
description: Plan an OpenSpec change and generate Mermaid views after its spec artifacts are written. Use when the user requests the OPSX Chart propose workflow.
---

# OPSX Chart propose

Read [the shared integration contract](../opsx-chart-diagrams/references/integration.md). Locate the sibling `openspec-propose/SKILL.md`, read it in full and execute that original workflow inline with the user's same arguments, change, schema and selected store. If absent, stop and explain that the matching OpenSpec operation must be installed first. Do not reconstruct or copy the original workflow.

After the original finishes writing the selected spec artifacts, generate change previews. Keep all output within the planning phase. Do not implement or update current views.

When this operation writes views, follow [the shared diagram contract](../opsx-chart-diagrams/references/diagrams.md), using the helper bundled in `../opsx-chart-diagrams/scripts/chart.mjs`. Summarize the original operation and diagram results together, keeping their outcomes distinct if only one succeeds. Respect the original phase boundary; do not start another operation.
