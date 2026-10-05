---
name: opsx-chart-graph-to-spec
description: Draft or update an OpenSpec scenario from an OPSX Chart behavior flow or branch. Use when a graph edit needs corresponding normative scenario text.
---

# Graph to OpenSpec scenario

The OpenSpec Markdown is the behavior contract; the graph records topology, paths, and layout. A graph path does not become normative until a human reviews a matching scenario delta.

1. Read the selected change, capability, and flow with `npm run --silent cli -- inspect --root <project> --capability <id> --flow <flow-id> --change <change-id>`. Inspect the selected case's ordered edge IDs, node labels, branch labels, and existing scenario reference. Use `snapshot` if current and proposed requirements need comparison.
2. Run `scenario-template --root <project> --capability <id> --requirement <name> --scenario <name> --change <change-id>` to find the delta target and existing requirement context. Draft observable WHEN/THEN text from the path. Do not infer unrepresented behavior. For a MODIFIED requirement, include the complete requirement and all existing scenarios in the delta, as OpenSpec requires.
3. Present the proposed Markdown and the graph path together for review. If authorized to save, write only the change's `specs/<capability>/spec.md` delta. Do not rewrite canonical `openspec/specs/.../spec.md`.
4. Run `openspec validate <change-id> --strict --json` and `npm run --silent cli -- validate --root <project> --change <change-id>`. Report unresolved scenario links and graph diagnostics; a skill suggestion is never a validation result.

Behavior edits need an active OpenSpec change. Layout-only node positions and viewport changes do not need a scenario delta.
