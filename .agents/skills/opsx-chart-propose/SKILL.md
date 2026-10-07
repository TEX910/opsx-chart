---
name: opsx-chart-propose
description: Plan a new OpenSpec change from OPSX Chart with one proposal, spec delta, design, and task list covering both behavior and graph work.
---

# Propose a paired change

Use the repository's `openspec-propose` skill as the planning workflow, including its root check, schema-driven artifact order, and planning-only boundary. OPSX Chart adds visual context to those same artifacts; it does not create a parallel proposal or a second change ID.

1. Inspect the relevant current specs and graphs with `opsx-chart snapshot --root <project>` and `opsx-chart inspect --root <project> --capability <id> [--flow <id>]`. A purely visual layout edit needs no OpenSpec change; handle it as an editor task. For behavior or capability relationship changes, select the OpenSpec change name once and use `openspec new change <name>` through the OpenSpec workflow, not a hand-made directory.
2. In the change's proposal, specs, design, and tasks, include graph effects only where they help specify the requested behavior: affected capabilities and relations, flow cases and scenario references, Decision WHEN and Outcome THEN descriptors, topology changes, validation, and promotion. Put each behavior and its graph work under the same change and task list. For a relationship-only change with no spec-level behavior change, use OpenSpec's `skip_specs: true` marker and keep the graph work in the same design and tasks; do not invent an empty scenario delta.
3. Let OpenSpec's `status --json` and `instructions <artifact> --json` determine artifact paths and requirements. Preserve the selected store on supported OpenSpec commands. Keep Markdown as the normative behavior contract; describe graph paths without inventing outcomes.
4. Validate the proposed OpenSpec change. Report one change ID and the combined task list. Do not implement or save graph drafts during this planning phase; `opsx-chart-apply` handles those tasks after planning.
