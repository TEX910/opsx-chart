---
name: opsx-chart-reconcile
description: Coordinate OpenSpec spec sync, OPSX Chart graph reconciliation, archive, and recovery of stranded graph drafts. Use when completing or recovering a paired spec and graph change.
---

# Sync and reconcile

The graph draft has a digest of the canonical graph it was based on. OpenSpec sync and graph promotion are separate operations; neither is a cross-tool transaction.

1. Run `npm run --silent cli -- pending --root <project>` and `validate --root <project> --change <change-id>`. Review the delta spec and graph draft together. Correct validation errors before sync.
2. Sync the OpenSpec delta into canonical specs with the repository's OpenSpec workflow (`openspec sync` or the installed `openspec-sync-specs` skill). Then run `npm run --silent cli -- preflight --root <project> --change <change-id>`. Inspect every diagnostic, including text drift warnings. A base conflict means the canonical graph changed since the draft; reconcile the files manually and update the draft before retrying.
3. If preflight is acceptable, run `npm run --silent cli -- reconcile --root <project> --change <change-id>`. Confirm the generated `graph/reconciliation.json` record and rerun `pending`. Archive the OpenSpec change only after the graph is promoted and validated.
4. If OpenSpec archive already moved the change, `pending` reports the remaining draft. Use `preflight --archived` and `reconcile --archived` with its archived directory name after the canonical spec has been synced. Resolve diagnostics before promotion. Do not discard the stranded draft.

Do not edit canonical specs as a side effect of graph promotion. Review the state after any partial failure before retrying.
