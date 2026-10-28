---
name: opsx-chart-bulk-archive
description: Archive selected OpenSpec changes and retain their Mermaid reading views. Use when the user requests the OPSX Chart bulk-archive workflow.
---

# OPSX Chart bulk-archive

Read [the shared integration contract](../opsx-chart-diagrams/references/integration.md). Locate the sibling `openspec-bulk-archive-change/SKILL.md`, read it in full and execute that original workflow inline with the user's same arguments, change, schema and selected store. If absent, stop and explain that the matching OpenSpec operation must be installed first. Do not reconstruct or copy the original workflow.

Prepare previews only for the selected changes with actual spec outputs. Execute the original bulk archive once. Freeze only previews that were actually archived, using their returned paths; refresh current views once from final specs on disk. Respect partial failures and do not move skipped changes.

When this operation writes views, follow [the shared diagram contract](../opsx-chart-diagrams/references/diagrams.md), using the helper bundled in `../opsx-chart-diagrams/scripts/chart.mjs`. Summarize the original operation and diagram results together, keeping their outcomes distinct if only one succeeds. Respect the original phase boundary; do not start another operation.
