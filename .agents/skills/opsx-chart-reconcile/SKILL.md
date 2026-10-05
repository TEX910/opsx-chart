---
name: opsx-chart-reconcile
description: Recover or inspect OPSX Chart graph reconciliation for a paired OpenSpec change, including drafts stranded after archive. Use the phase skills for ordinary sync and archive.
---

# Reconcile or recover a graph draft

The graph draft has a digest of the canonical graph it was based on. OpenSpec sync and graph promotion are separate operations; neither is a cross-tool transaction.

1. For an ordinary completion, use `opsx-chart-sync` followed by `opsx-chart-archive`; both operate on the same OpenSpec change ID. This skill handles a graph conflict or a draft found after archive.
2. Run `npm run --silent cli -- pending --root <project>` and `npm run --silent cli -- validate --root <project> --change <change-id>` for an active change. Review the canonical spec and draft graph together. Ensure the OpenSpec delta has already been synced with `openspec-sync-specs` or by archive before promoting the graph.
3. Run `npm run --silent cli -- preflight --root <project> --change <change-id>`. Inspect every diagnostic, including text drift warnings. A base conflict means the canonical graph changed since the draft; resolve it in the draft and retry. If preflight is acceptable, run `npm run --silent cli -- reconcile --root <project> --change <change-id>`, confirm `graph/reconciliation.json`, and rerun `pending`.
4. If OpenSpec archive already moved the change, `npm run --silent cli -- pending --root <project>` reports the dated archive directory. Use its name with `npm run --silent cli -- preflight --root <project> --change <dated-name> --archived` and then `npm run --silent cli -- reconcile --root <project> --change <dated-name> --archived` after confirming canonical spec sync. Resolve diagnostics before promotion. Do not discard the stranded draft.

Do not edit canonical specs as a side effect of graph promotion. Review the state after any partial failure before retrying.
