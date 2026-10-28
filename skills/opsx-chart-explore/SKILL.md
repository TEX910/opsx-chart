---
name: opsx-chart-explore
description: Explore an OpenSpec change using its specifications and read-only Mermaid views. Use when the user requests the OPSX Chart explore workflow.
---

# OPSX Chart explore

Read [the shared integration contract](../opsx-chart-diagrams/references/integration.md). Locate the sibling `openspec-explore/SKILL.md`, read it in full and execute that original workflow inline with the user's same arguments, change, schema and selected store. If absent, stop and explain that the matching OpenSpec operation must be installed first. Do not reconstruct or copy the original workflow.

Read existing diagrams or draw inline only. Preserve the original exploration and capture boundaries; do not persist views merely because this wrapper was invoked.

When this operation writes views, follow [the shared diagram contract](../opsx-chart-diagrams/references/diagrams.md), using the helper bundled in `../opsx-chart-diagrams/scripts/chart.mjs`. Summarize the original operation and diagram results together, keeping their outcomes distinct if only one succeeds. Respect the original phase boundary; do not start another operation.
