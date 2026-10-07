# OPSX Chart

**See how an OpenSpec project fits together, then edit each feature as a visual flow.** OPSX Chart is a local companion for OpenSpec projects. Each capability on the map represents one OpenSpec spec. The map shows the spec's purpose and connections; the flow lets you write behavior on decision and outcome nodes.

The graph stores behavior drafts. An OPSX Chart skill reconciles them into the OpenSpec Markdown contract. OPSX Chart adds visual files to the project; it does not require a fork or migration.

## What you can do

- Browse a map of capabilities and their declared relationships.
- Open a capability to see its spec description and connections, then inspect its scenarios inside the flow editor.
- Draw events, actions, decisions, and outcomes. Write a WHEN on each decision branch and a THEN on its outcome, then create a case from the path.
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
2. Select an active OpenSpec change before editing behavior. Click a node, then choose **Collassa grafo e modifica** to edit its details. Write a WHEN for each outgoing branch of a **Decisione** and a THEN on each **Esito**. Existing text from linked OpenSpec scenarios appears beside an empty descriptor, where you can copy it into the node. Finish with **Salva flusso** to save the graph draft under the change.
3. In **Crea una nuova casistica**, choose the requirement and add connections from an **Evento** to an **Esito**. You can write the WHEN and THEN there as well, then click **Crea casistica nel flusso**. The OpenSpec scenario can be created afterward with `$opsx-chart-graph-to-spec`.
4. Review the graph behavior and generated spec delta together. When the change is ready, sync its specification and graph drafts, then archive it. The Chart skills guide these phases from the same change.

| Phase | Skill |
| --- | --- |
| Explore | `$opsx-chart-explore` |
| Propose | `$opsx-chart-propose` |
| Revise the plan | `$opsx-chart-update` |
| Implement | `$opsx-chart-apply` |
| Write graph behavior into the spec delta | `$opsx-chart-graph-to-spec` |
| Sync specs and graphs | `$opsx-chart-sync` |
| Archive | `$opsx-chart-archive` |

The skills are included in this repository under `.agents/skills/`. They use OpenSpec's artifacts and tasks while adding the graph work to the same change.

## Contributing

For development setup, file formats, CLI commands, validation, and the reconciliation process, see the [README for contributors](docs/README-CONTRIBUTORS.md).
