# OPSX Chart

**Explore OpenSpec specifications as a map and describe behavior as a graph.** OPSX Chart is a local app that works alongside OpenSpec. Each capability on the map corresponds to **one spec**. The map shows relationships between specs; a flow shows the behavior of one spec.

You can draft and edit behavior in the graph. A skill carries the graph's WHEN/THEN statements into the change's Markdown spec delta for review. OPSX Chart does not require a fork of OpenSpec.

After selecting an active change, drag capability cards on the specification map to adjust their positions. The app saves positions automatically in `openspec/graph/map-layout.yaml`; **Reset positions** restores automatic layout. Position changes do not edit spec text or capability relationships. Without an active change, map, relationship, and flow editing controls are disabled.

## Core concepts

| In the app | Meaning |
| --- | --- |
| **Capability** | One OpenSpec spec. Its details describe the spec and its connections to other capabilities, rather than listing WHEN/THEN cases. |
| **Flow** | The single behavior graph for a capability. It can contain events, actions, decisions, and outcomes. A change holds a draft version of this graph. |
| **WHEN** | The condition on a branch leaving a **Decision** node. Each branch can have its own WHEN. |
| **THEN** | The result on an **Outcome** node. |
| **Case** | A complete path from an **Event** to an **Outcome**. It uses the WHEN statements on branches it crosses and the THEN on its outcome, and maps to an OpenSpec requirement scenario. |

For example, the “Valid” branch of a *Valid credentials?* decision might contain `WHEN a member submits valid credentials`. The *Start session* outcome might contain `THEN the system starts a session`. If a path crosses multiple decisions, the skill writes the first condition as `WHEN` and subsequent conditions as `AND` in Markdown.

### Active change and draft flow

The **active change** is the selected OpenSpec change, such as `adjust-login`. It collects the proposal, tasks, spec deltas, and graph drafts.

A **draft flow** is the modified version of a capability's graph inside that change. Editing a WHEN, THEN, node, or connection and clicking **Save flow** saves a graph draft in the change. The **current** flow stays as it was until the draft is reconciled. A change may affect several capabilities, each with one flow.

If an external tool changes OpenSpec Markdown or graph YAML while Chart is open, the selected flow, paths, scenarios, and diagnostics refresh together. Chart shows **Loading flow…** while reading the files. If you have unsaved graph edits, Chart keeps them and displays **Load version on disk**; choosing it replaces those local edits after confirmation. Saving your local edits over a newer disk version also requires confirmation.

## Edit behavior

1. Select a capability and open **Flow**. The right column shows its associated spec and a link to the Markdown source.
2. Select an **Active change**, or enter a name under **New change** and click **Create change**. This creates the OpenSpec change shell; its proposal, spec delta, and tasks still need to be planned and reviewed through the OpenSpec workflow.
3. Select a **Decision** and click **Collapse graph to edit**. Its editor is a list of WHEN conditions. Each can lead to an **Action**, another **Decision**, or an **Outcome**. Use **Add WHEN** for another branch. An Action can lead to an Outcome.
4. Select an **Outcome** and write its **THEN**. Actions between a Decision and Outcome remain steps in the path; a later Decision adds another condition.
5. Click **Save flow**. Under **OpenSpec scenarios and paths**, review linked cases, unlinked routes, and scenario text. These associations and the spec delta are read only in the app. Ask a skill-compatible assistant to use `opsx-chart-graph-to-spec` for the active change: it matches each complete path to a scenario, creates missing cases and scenarios, and writes the change's Markdown delta.

The skill reads the node statements and writes or updates the scenario in the change's spec delta. Saving the graph alone does not modify Markdown. After reviewing both, `opsx-chart-sync` synchronizes the spec and reconciles the graph; `opsx-chart-archive` closes the change. Creating, removing, or changing a graph path's scenario association is handled by the skills, not by form controls in the app.

For projects created with older versions that have several flows for one capability, the Flow view offers **Combine flows**. It copies the original YAML files into `openspec/graph/legacy-flows/` before writing one combined graph. Pending graph drafts must be reconciled first.

## Run locally

You need Node.js 22 or later and the [OpenSpec CLI](https://github.com/Fission-AI/OpenSpec) 1.14.0 or later. If OpenSpec is not installed:

```sh
npm install -g @fission-ai/openspec@latest
```

Clone the repository and start the app:

```sh
git clone https://github.com/TEX910/opsx-chart.git
cd opsx-chart
npm install
npm run build
npm start
```

Open **http://127.0.0.1:4317**, enter the path to a local project containing `openspec/`, and click **Open project**. On startup, the app first tries the current directory.

### Add OPSX Chart to another OpenSpec project

The target project must already use OpenSpec. After `npm run build` in the OPSX Chart repository, make the CLI available locally and initialize the target project:

```sh
npm link
opsx-chart init --root /path/to/project --skills
```

This creates `openspec/graph/relations.yaml` and `openspec/graph/flows/`, then copies missing `opsx-chart-*` skills into the project's `.agents/skills/`. Repeating the command preserves existing graphs and skill directories. Chart phase skills call the corresponding OpenSpec skills, which must be available through the project's normal OpenSpec setup. Open the target project with a skill-compatible assistant to use its skills and in OPSX Chart to view its map and flows.

To add only the graph workspace, select a change and click **Initialize graph workspace** in the app, or run `opsx-chart init --root /path/to/project` without `--skills`. The app's **Help** popup also contains these setup steps and a skill summary.

### Try the demo

Run `npm run demo` from this repository and open **http://127.0.0.1:4317**. The demo loads `examples/demo-project/` with two connected capabilities, one flow for each capability, and the `adjust-login` change. Select **authentication → Flow** and choose the active change to view its draft. Edits you save in the demo are written to `examples/demo-project/`.

## Available skills

Chart skills use the same OpenSpec change and task list while adding graph work to the normal development workflow.

| Phase | Skill |
| --- | --- |
| Set up an OpenSpec project | `opsx-chart-init` |
| Explore | `opsx-chart-explore` |
| Propose a change | `opsx-chart-propose` |
| Update a plan | `opsx-chart-update` |
| Implement | `opsx-chart-apply` |
| Carry graph WHEN/THEN into the spec | `opsx-chart-graph-to-spec` |
| Propose graph updates from a changed spec | `opsx-chart-spec-to-graph` |
| Synchronize specs and graphs | `opsx-chart-sync` |
| Archive | `opsx-chart-archive` |
| Inspect or recover unreconciled drafts | `opsx-chart-reconcile` |

Skill files live in `.agents/skills/`. Ask a skill-compatible assistant to use one by its name; invocation syntax varies by assistant.

## Contribute

For development setup, file formats, CLI commands, and reconciliation details, read the [contributor README](docs/README-CONTRIBUTORS.md).

Propose changes through a pull request targeting `main`. The repository owner reviews changes before they are merged.
