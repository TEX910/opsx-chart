---
name: opsx-chart-archive
description: Archive a completed OPSX Chart OpenSpec change after validating its canonical specs and reconciling every graph draft.
---

# Archive a paired change

Use the repository's `openspec-archive-change` skill for OpenSpec's completion checks and archive operation. Add a graph gate first so an archive never hides an unreconciled draft. Keep the same change ID and any selected store.

1. Run `npm run --silent cli -- pending --root <project>` and `npm run --silent cli -- validate --root <project> --change <name>`. If this change still has a graph draft, run `opsx-chart-sync` or recover it with `opsx-chart-reconcile`; do not claim the paired change is archived cleanly while a draft remains.
2. Check OpenSpec artifacts, tasks, and validation through `openspec-archive-change`. Confirm canonical spec sync status before archiving; because `openspec archive` can also update specs, review its proposed spec effects even if `opsx-chart-sync` already ran. An explicit archive request authorizes ordinary archiving when these checks pass; seek a decision only for an unresolved warning or an unexpected spec update.
3. Archive the selected change using the OpenSpec workflow, then rerun Chart `pending` and check that no draft from this change remains. Report the archive path and any remaining diagnostics. Do not delete a stranded draft to make the check pass.
