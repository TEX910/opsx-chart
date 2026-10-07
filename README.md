# OPSX Chart

**Explore OpenSpec specifications as a map and describe behavior as a graph.** OPSX Chart is a local app that works alongside OpenSpec. Each capability on the map corresponds to **one spec**. The map shows relationships between specs; a flow shows the behavior of one spec.

You can draft and edit behavior in the graph. A skill carries the graph's WHEN/THEN statements into the change's Markdown spec delta for review. OPSX Chart does not require a fork of OpenSpec.

## Core concepts

| In the app | Meaning |
| --- | --- |
| **Capability** | One OpenSpec spec. Its details describe the spec and its connections to other capabilities, rather than listing WHEN/THEN cases. |
| **Flow** | A behavior graph for a capability. It can contain events, actions, decisions, and outcomes. A capability can have multiple flows. |
| **WHEN** | The condition on a branch leaving a **Decision** node. Each branch can have its own WHEN. |
| **THEN** | The result on an **Outcome** node. |
| **Case** | A complete path from an **Event** to an **Outcome**. It uses the WHEN statements on branches it crosses and the THEN on its outcome, and maps to an OpenSpec requirement scenario. |

For example, the “Valid” branch of a *Valid credentials?* decision might contain `WHEN a member submits valid credentials`. The *Start session* outcome might contain `THEN the system starts a session`. If a path crosses multiple decisions, the skill writes the first condition as `WHEN` and subsequent conditions as `AND` in Markdown.

### Active change and draft flow

The **active change** is the selected OpenSpec change, such as `adjust-login`. It collects the proposal, tasks, spec deltas, and graph drafts.

A **draft flow** is the modified version of *one graph* inside that change. Editing a WHEN, THEN, node, or connection and clicking **Save flow** saves a graph draft in the change. The **current** flow stays as it was until the draft is reconciled. One change can contain several draft flows.

## Edit a case

1. Select a capability and open **Flow**. The right column shows its associated spec and a link to the Markdown source.
2. Select an **Active change** before editing behavior. Open a draft flow, or edit the current flow to create a draft in the change.
3. Select a **Decision** node and click **Collapse graph to edit**. Enter a condition under **WHEN for each branch**. If the linked OpenSpec scenario already has text, you can view it and copy it with **Use this WHEN**.
4. Click **Show graph**, select an **Outcome**, and enter its **THEN**. You can also view and copy an existing THEN from the linked scenario.
5. Under **Create a new case**, choose a requirement and add the path's connections in order from Event to Outcome. Complete the WHEN and THEN fields, click **Create case in flow**, then **Save flow**.

You can create a case before its Markdown scenario exists. It will show as *pending reconciliation*. The `opsx-chart-graph-to-spec` skill reads the node statements and writes or updates the scenario in the change's spec delta. Saving the graph alone does not modify Markdown. After reviewing both, `opsx-chart-sync` synchronizes the spec and reconciles the graph; `opsx-chart-archive` closes the change.

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

To add only the graph workspace, click **Initialize graph workspace** in the app or run `opsx-chart init --root /path/to/project` without `--skills`. The app's **Help** popup also contains these setup steps and a skill summary.

### Try the demo

Run `npm run demo` from this repository and open **http://127.0.0.1:4317**. The demo loads `examples/demo-project/` with two connected capabilities, login and notification flows, and the `adjust-login` change. Select **authentication → Flow** to compare the current flow with its draft. Edits you save in the demo are written to `examples/demo-project/`.

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
