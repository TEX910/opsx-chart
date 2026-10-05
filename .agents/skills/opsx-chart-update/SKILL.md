---
name: opsx-chart-update
description: Revise an existing OPSX Chart and OpenSpec change plan so its scenarios, graph design, and tasks remain aligned before implementation.
---

# Update a paired change plan

Use the repository's `openspec-update-change` skill for artifact selection, dependency order, and planning-only edits. Keep the existing change ID; do not create another change for visual work. This is different from the `openspec update` command, which refreshes generated instruction files.

1. Read the change's `openspec status --change <name> --json` and relevant planning artifacts. Compare them with `npm run --silent cli -- snapshot --root <project>` and `npm run --silent cli -- inspect --root <project> --capability <id> --change <name>`.
2. Revise the same proposal, delta specs, design, and task list as needed. Keep scenario wording and graph case references traceable, and add or adjust graph tasks next to the behavior they represent. Preserve OpenSpec's artifact instructions and any selected store.
3. Validate the OpenSpec change and report which graph drafts will need adjustment during `opsx-chart-apply`. Do not silently alter canonical specs or graph files in this planning phase.
