---
name: opsx-chart-sync
description: Sync an OpenSpec change and refresh Mermaid views of the current specifications. Use when the user requests the OPSX Chart sync workflow.
---

# OPSX Chart sync

Read [the shared integration contract](../opsx-chart-diagrams/references/integration.md). Locate the sibling `openspec-sync-specs/SKILL.md`, read it in full and execute that original workflow inline with the user's same arguments, change, schema and selected store. If absent, stop and explain that the matching OpenSpec operation must be installed first. Do not reconstruct or copy the original workflow.

Run the original sync once. After successful sync, generate current views from the resulting specs on disk. Retain the proposed change views separately.

When this operation writes views, follow [the shared diagram contract](../opsx-chart-diagrams/references/diagrams.md), using the helper bundled in `../opsx-chart-diagrams/scripts/chart.mjs`. Summarize the original operation and diagram results together, keeping their outcomes distinct if only one succeeds. Respect the original phase boundary; do not start another operation.
