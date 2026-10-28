---
name: opsx-chart-update
description: Revise an existing OpenSpec change and refresh its derived Mermaid views. Use when the user requests the OPSX Chart update workflow.
---

# OPSX Chart update

Read [the shared integration contract](../opsx-chart-diagrams/references/integration.md). Locate the sibling `openspec-update-change/SKILL.md`, read it in full and execute that original workflow inline with the user's same arguments, change, schema and selected store. If absent, stop and explain that the matching OpenSpec operation must be installed first. Do not reconstruct or copy the original workflow.

Refresh change previews for affected spec artifacts after their text is revised. This operation updates a change plan, not the CLI-generated OpenSpec installation.

When this operation writes views, follow [the shared diagram contract](../opsx-chart-diagrams/references/diagrams.md), using the helper bundled in `../opsx-chart-diagrams/scripts/chart.mjs`. Summarize the original operation and diagram results together, keeping their outcomes distinct if only one succeeds. Respect the original phase boundary; do not start another operation.
