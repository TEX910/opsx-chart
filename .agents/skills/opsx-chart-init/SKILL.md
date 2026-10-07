---
name: opsx-chart-init
description: Add the OPSX Chart graph workspace and project skills to an existing local OpenSpec project.
---

# Initialize OPSX Chart in a project

Use this when a project already uses OpenSpec and needs OPSX Chart graphs or Chart skills. Keep the project's existing specs, changes, graph files, and skill edits intact.

1. Resolve the intended local project with `openspec list --json`. If it is not an OpenSpec project, ask which project to use instead of creating OpenSpec files implicitly.
2. Run `opsx-chart init --root <project> --skills`. This creates `openspec/graph/relations.yaml` and `openspec/graph/flows/` when absent, then copies missing `opsx-chart-*` skills into the project's `.agents/skills/`. Existing relations, flows, and skill directories are preserved. If the CLI has not been linked, run `npm run --silent cli -- init --root <project> --skills` from the OPSX Chart source checkout.
3. Check the command's `created`, `installed`, and `alreadyPresent` results. Run `opsx-chart validate --root <project>` and inspect the new files. Chart phase skills also depend on the corresponding OpenSpec skills being available in the agent's environment; use the normal OpenSpec setup when they are missing.

The graph workspace can be initialized without copying skills by omitting `--skills`, including through the **Initialize graph workspace** button in the app. The command is safe to repeat and does not overwrite existing skill copies; update those separately when needed.
