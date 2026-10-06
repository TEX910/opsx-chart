# OPSX Chart

**See how an OpenSpec project fits together, then edit each feature as a visual flow.** OPSX Chart is a local companion for OpenSpec projects. It shows relationships between capabilities, connects flow paths to scenarios, and keeps the current specification visible beside proposed changes.

OpenSpec Markdown remains the source of truth for behavior. OPSX Chart adds visual files to the project; it does not require a fork or migration.

## What you can do

- Browse a map of capabilities and their declared relationships.
- Open a capability to read its requirements and scenarios alongside its flow diagram.
- Draw events, actions, decisions, and outcomes, then link a path to an OpenSpec scenario.
- Work on proposed behavior inside an existing OpenSpec change and see validation problems before completing it.
- Use the OPSX Chart skills to move through the OpenSpec workflow with one change and one task list.

## Get started

You need Node.js 22 or newer and the [OpenSpec CLI](https://github.com/Fission-AI/OpenSpec) version 1.14.0 or newer. Install OpenSpec if you have not already:

```sh
npm install -g @fission-ai/openspec@latest
```

Clone this repository, then run:

```sh
git clone https://github.com/TEX910/opsx-chart.git
cd opsx-chart
npm install
npm run build
npm start
```

Open **http://127.0.0.1:4317**. Enter the path to a local project containing an `openspec/` directory and select **Apri progetto**. At startup, OPSX Chart first tries the current working directory.

### Try the included demo

From this repository, run `npm run demo` and open **http://127.0.0.1:4317**. The demo opens automatically with two connected capabilities, a current sign-in flow, an email flow, and a proposed locked-account branch in the `adjust-login` change. Select **authentication → Flusso**, then switch between the current and draft flow to compare them. The demo is a local OpenSpec project under `examples/demo-project/`, so edits to it are saved there.

## Work with a change

1. Select a capability on the map and open **Flusso** to inspect its diagram and linked scenarios.
2. Select an active OpenSpec change before editing behavior. Moving nodes or the viewport only changes the visual layout; changing a path saves a graph draft under the selected change.
3. Review the scenario text and diagnostics together. The graph describes the path; the OpenSpec scenario defines the behavior.
4. When the change is ready, sync its specification and graph drafts, then archive it. The Chart skills can guide these phases from the same change.

| Phase | Skill |
| --- | --- |
| Explore | `$opsx-chart-explore` |
| Propose | `$opsx-chart-propose` |
| Revise the plan | `$opsx-chart-update` |
| Implement | `$opsx-chart-apply` |
| Sync specs and graphs | `$opsx-chart-sync` |
| Archive | `$opsx-chart-archive` |

The skills are included in this repository under `.agents/skills/`. They use OpenSpec's artifacts and tasks while adding the graph work to the same change.

## Contributing

For development setup, file formats, CLI commands, validation, and the reconciliation process, see the [README for contributors](docs/README-CONTRIBUTORS.md).
