---
name: opsx-chart-continue
description: Create the next OpenSpec artifact and add diagrams when that artifact writes specs. Use when the user requests the OPSX Chart continue workflow.
---

# OPSX Chart continue

Read [the shared integration contract](../opsx-chart-diagrams/references/integration.md). Locate the sibling `openspec-continue-change/SKILL.md`, read it in full and execute that original workflow inline with the user's same arguments, change, schema and selected store. If absent, stop and explain that the matching OpenSpec operation must be installed first. Do not reconstruct or copy the original workflow.

Create only the artifact permitted by the original continue operation. Generate change previews only if that artifact writes concrete spec files; otherwise leave diagrams alone. Do not advance another artifact for diagram completeness.

When this operation writes views, follow [the shared diagram contract](../opsx-chart-diagrams/references/diagrams.md), using the helper bundled in `../opsx-chart-diagrams/scripts/chart.mjs`. Summarize the original operation and diagram results together, keeping their outcomes distinct if only one succeeds. Respect the original phase boundary; do not start another operation.
