---
name: opsx-chart-verify
description: Verify an OpenSpec change and inspect its Mermaid views without modifying them. Use when the user requests the OPSX Chart verify workflow.
---

# OPSX Chart verify

Read [the shared integration contract](../opsx-chart-diagrams/references/integration.md). Locate the sibling `openspec-verify-change/SKILL.md`, read it in full and execute that original workflow inline with the user's same arguments, change, schema and selected store. If absent, stop and explain that the matching OpenSpec operation must be installed first. Do not reconstruct or copy the original workflow.

Perform original verification, then check existing change/current views read-only where relevant. Report absent or stale diagrams separately as documentation findings. Do not regenerate in verification mode or redefine OpenSpec implementation validity.

When this operation writes views, follow [the shared diagram contract](../opsx-chart-diagrams/references/diagrams.md), using the helper bundled in `../opsx-chart-diagrams/scripts/chart.mjs`. Summarize the original operation and diagram results together, keeping their outcomes distinct if only one succeeds. Respect the original phase boundary; do not start another operation.
