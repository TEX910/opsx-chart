---
name: opsx-chart-apply
description: Implement an OPSX Chart OpenSpec change, completing code, scenario deltas, and linked graph drafts from one task list.
---

# Apply a paired change

Use the repository's `openspec-apply-change` skill for change selection, `instructions apply --json`, task tracking, and completion rules. The change's OpenSpec task list is the only implementation checklist. Use the same change ID for behavior graph drafts; do not create a second visual backlog.

1. Read every `contextFiles` path returned by OpenSpec apply instructions. Inspect the affected scenario and graph with `npm run --silent cli -- snapshot --root <project>` and `npm run --silent cli -- inspect --root <project> --capability <id> [--flow <id>] --change <name>`.
2. Implement each task's code and spec work. For graph-relevant tasks, use `opsx-chart-spec-to-graph` or `opsx-chart-graph-to-spec` as needed. Decision nodes hold `whens` keyed by outgoing edge ID, outcome nodes hold `then`, and case paths connect them to a target OpenSpec scenario. A graph-first case may have `pendingSpec: true` until `opsx-chart-graph-to-spec` writes the delta. Save a behavioral flow with `npm run --silent cli -- save-flow --root <project> --file <draft.yaml> --change <name>`; it belongs to that change's `graph/` directory. Stable IDs and scenario references must survive unaffected paths. Layout-only edits may save to the current graph without a delta.
3. For capability relationship changes, create or update `openspec/changes/<name>/graph/relations.yaml` using the version 1 relation schema. Copy the complete intended edge set and preserve unaffected IDs. Set `baseDigest` to the SHA-256 of the exact current `openspec/graph/relations.yaml` file, or `null` if that file does not exist. The existing UI relation save writes canonical graph state, so use the change draft for behavior-affecting relation edits. Preflight validates that draft after spec sync.
4. Validate with `openspec validate <name> --strict --json` and `npm run --silent cli -- validate --root <project> --change <name>`. Resolve errors and review warnings that affect linked behavior. Mark a task complete only when all its code, Markdown, and graph work is done, using the exact task location returned by OpenSpec apply instructions. Re-run those instructions after each completed task.
5. Stop at implementation completion. `opsx-chart-sync` promotes the paired artifacts, and `opsx-chart-archive` finalizes the change.
