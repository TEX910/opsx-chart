---
name: opsx-chart-sync
description: Sync one completed OpenSpec change into canonical specs and reconcile its OPSX Chart graph drafts in the same completion pass.
---

# Sync specs and graphs

Use the repository's `openspec-sync-specs` skill to merge delta specs into canonical OpenSpec specs. There is no `openspec sync` CLI subcommand in the supported OpenSpec version. The same change ID then drives graph preflight and promotion; never treat either step as an independent change.

1. Confirm the change and graph drafts with `openspec status --change <name> --json`, `openspec validate <name> --strict --json`, `opsx-chart pending --root <project>`, and `opsx-chart validate --root <project> --change <name>`. Preserve any selected OpenSpec store. Inspect every complete Event-to-Outcome route and `caseBehaviors` for every draft flow. Compare each linked case's Decision WHENs and Outcome THEN with its scenario in the delta. If a complete route lacks a case, a case is `pendingSpec`, or the text differs, run `opsx-chart-graph-to-spec` with the same change ID first and review the written scenario. Do not promote a graph with unreconciled behavior.
2. Apply any OpenSpec delta with `openspec-sync-specs` and validate the canonical specs; if the change has no delta specs, skip that merge. Then run `opsx-chart preflight --root <project> --change <name>` for a pending graph draft. Inspect the returned diagnostics; a changed graph base or scenario drift needs reconciliation before promotion.
3. When preflight is acceptable, run `opsx-chart reconcile --root <project> --change <name>`. Verify `graph/reconciliation.json`, rerun `pending`, and validate the resulting graph. If no graph draft exists, report that only specs were synced; do not run preflight or create a graph just to match the phase.
4. If the change was already archived, use `opsx-chart pending --root <project>` to find its dated archive name. After confirming the canonical spec was synced, run `opsx-chart preflight --root <project> --change <dated-name> --archived` and then `opsx-chart reconcile --root <project> --change <dated-name> --archived`. Review partial state after failure before retrying; an already archived change needs no second archive.
