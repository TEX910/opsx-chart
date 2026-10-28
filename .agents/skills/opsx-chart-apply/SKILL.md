---
name: opsx-chart-apply
description: Implement an OpenSpec change using scenario diagrams as reading aids. Use when the user requests the OPSX Chart apply workflow.
---

# OPSX Chart apply

Read [the shared integration contract](../opsx-chart-diagrams/references/integration.md). Locate the sibling `openspec-apply-change/SKILL.md`, read it in full and execute that original workflow inline with the user's same arguments, change, schema and selected store. If absent, stop and explain that the matching OpenSpec operation must be installed first. Do not reconstruct or copy the original workflow.

Consult available diagrams while implementing. Refresh change previews if spec text changed, or views are missing/stale. Keep the original task list and completion rules; diagrams do not authorize additional implementation.

When this operation writes views, follow [the shared diagram contract](../opsx-chart-diagrams/references/diagrams.md), using the helper bundled in `../opsx-chart-diagrams/scripts/chart.mjs`. Summarize the original operation and diagram results together, keeping their outcomes distinct if only one succeeds. Respect the original phase boundary; do not start another operation.
