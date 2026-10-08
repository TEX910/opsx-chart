# OPSX Chart: README for contributors

OPSX Chart is a separate local application built on top of OpenSpec's documented CLI output. OpenSpec Markdown owns normative requirements and scenarios; versioned YAML files under `openspec/graph/` own capability relationships, flow topology, node behavior drafts, case paths, scenario links, and layout. The app reads both and presents them as one workspace.

## Development setup

- Node.js 22 or newer
- OpenSpec CLI 1.14.0 or newer (`npm install -g @fission-ai/openspec@latest`)

```sh
npm install
npm run dev
```

The API listens on `127.0.0.1:4317` and the development UI on `127.0.0.1:5173`. The initial project defaults to the current directory; enter another local OpenSpec project path in the UI to switch. For a built local server, run `npm run build`, then `npm start`, and open `http://127.0.0.1:4317`.

To use Chart from another local OpenSpec checkout, run `npm run build && npm link` here, then `opsx-chart init --root /path/to/project --skills`. The CLI creates `openspec/graph/relations.yaml` and `flows/.gitkeep` only when absent and copies missing `opsx-chart-*` skill directories to the project's `.agents/skills/`. Existing files are not overwritten. Without `--skills`, it initializes only the graph workspace; the app exposes the same graph-only operation as **Initialize graph workspace** when the workspace is missing. The target project must also have access to the OpenSpec phase skills that the Chart phase skills call.

The map stores manually dragged capability positions in `openspec/graph/map-layout.yaml`. It loads the file if present and uses automatic ELK layout for all other capabilities. This file contains only coordinates; **Reset positions** clears them without changing `relations.yaml` or OpenSpec Markdown.

## File ownership

| File | Owner and purpose |
| --- | --- |
| `openspec/specs/<capability>/spec.md` | OpenSpec's current behavior contract |
| `openspec/changes/<change>/specs/<capability>/spec.md` | Proposed OpenSpec delta |
| `openspec/graph/relations.yaml` | Version 1 directed capability relationships with stable edge IDs and types (`depends-on`, `invokes`, `emits-to`, `shares-data-with`) |
| `openspec/graph/map-layout.yaml` | Version 1 manual capability positions; optional and independent of relationship data |
| `openspec/graph/flows/<capability>/<flow-id>.yaml` | Version 1 flow nodes, edges, ordered case paths, scenario references, fingerprints, and layout. Decision nodes carry `whens` keyed by outgoing edge ID; outcome nodes carry `then` |
| `openspec/changes/<change>/graph/flows/...` | Behavioral draft with a `baseDigest` of the canonical graph; a draft may mark a flow `deleted: true` |
| `openspec/changes/<change>/graph/relations.yaml` | Optional proposed relationship snapshot |
| `openspec/changes/<change>/graph/reconciliation.json` | Record written after graph promotion |

Graph files do not generate spec Markdown automatically. The `opsx-chart-graph-to-spec` skill enumerates complete paths, maintains their case-to-scenario associations, reads node descriptors, and writes the corresponding WHEN/AND/THEN scenarios in the active change's spec delta. When the change was created in the UI, the skill also fills missing OpenSpec planning artifacts required for apply (normally proposal, design, and tasks) in that same change, following the project's schema. A new case may set `pendingSpec: true` until that scenario exists. The UI displays cases, unlinked routes, scenario text, and delta Markdown read only. For older flows without node descriptors, the UI shows text from linked scenarios next to empty WHEN/THEN fields and lets the user copy it into the node. The scenario becomes normative after review and OpenSpec sync. The UI validates relationship endpoints and dependency cycles, flow topology, and scenario links. Suggested relationships are dashed until confirmed.

The flow editor treats a Decision's outgoing edges as its WHEN list. Each branch points to an Action, another Decision, or an Outcome. Actions may point to Outcomes and do not add condition text. Branch labels are optional because the WHEN descriptor names the condition. `flowPaths` discovers acyclic Event-to-Outcome routes for scenario linking, and `pathBehavior` collects each traversed Decision WHEN in route order plus the final Outcome THEN. Skills emit the first condition as WHEN and later conditions as AND.

The app exposes one flow per capability. A new capability starts with the flow ID `main`; an existing single flow keeps its ID across change drafts. `saveFlow` refuses a second flow ID. Legacy projects with several canonical flows can use **Combine flows**, which merges nodes, edges, cases, and positions into `main.yaml` and backs up each original under `openspec/graph/legacy-flows/`. It refuses to run while affected graph drafts are pending. The UI creates a new OpenSpec change with `openspec new change --json` before graph editing; `opsx-chart-propose` can finish that shell before drawing, or `opsx-chart-graph-to-spec` can finish missing planning artifacts after drawing.

## Editing and reconciliation

Select an active change before any app edit, including graph workspace setup, map positions, relationships, legacy flow consolidation, and flow behavior. The server requires a valid active change on those write endpoints. Node position and viewport changes save as layout in the current graph; node, edge, WHEN, and THEN changes save as drafts under the change's `graph/` directory. Map positions and UI relationship edits also save to the current graph after the change gate. Case-to-scenario links and delta Markdown are maintained by the skills. Each map capability corresponds to one OpenSpec spec ID. The inspector shows the associated spec document and relationships; the flow editor shows node behavior beside linked OpenSpec scenario text.

The API watches `openspec/` and sends file events to the client. With no unsaved graph edits, the client reloads the selected YAML flow, OpenSpec snapshot and delta, diagnostics, and graph metadata in one state update. It shows a loading state until the flow arrives. With unsaved edits, it retains the local graph and offers an explicit action to discard those edits and load the disk version. `test/app-refresh.test.tsx` covers a change left open while its flow draft and spec delta change externally, including the disappearance of stale path and diagnostic warnings.

To complete a paired change:

1. Reconcile each new or changed graph case into the change's spec delta with `opsx-chart-graph-to-spec`. It completes missing planning artifacts in the same change. Review the graph, delta, design, and tasks, then run validation.
2. Implement the task list with `opsx-chart-apply`.
3. Sync the OpenSpec delta into canonical specs and reconcile graph drafts with `opsx-chart-sync`.
4. Archive the OpenSpec change with `opsx-chart-archive`. If archive happened first, the pending drafts view finds its graph under `changes/archive/` for recovery.

The repository's `opsx-chart-explore`, `opsx-chart-propose`, `opsx-chart-update`, `opsx-chart-apply`, `opsx-chart-sync`, and `opsx-chart-archive` skills map to these OpenSpec phases and use the same change ID and task list. `opsx-chart-spec-to-graph` and `opsx-chart-graph-to-spec` help with individual linked scenarios; `opsx-chart-reconcile` handles graph conflicts and stranded drafts.

## CLI and verification

Run `npm run --silent cli -- --help` for all commands. The CLI uses the same project and graph model as the UI and provides JSON inspection, validation, draft preparation, and graph reconciliation for skills and scripts.

```sh
npm run --silent cli -- snapshot --root /path/to/project
npm run --silent cli -- inspect --root /path/to/project --capability authentication --flow sign-in --change adjust-login
npm run --silent cli -- combine-flows --root /path/to/project --capability authentication
npm run --silent cli -- pending --root /path/to/project
```

Run `npm run typecheck` and `npm test` to verify the implementation. Integration tests copy `test/fixtures/project` and do not alter it. The first release's canonical requirements live in `openspec/specs/`; the completed planning change is archived under `openspec/changes/archive/2026-10-08-initial-visual-spec-workspace/`.
