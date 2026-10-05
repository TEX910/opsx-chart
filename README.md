# OPSX Chart

Local visual companion for OpenSpec projects. OpenSpec Markdown remains the behavioral contract; versioned YAML files in `openspec/graph/` hold capability relationships and flow topology. This is a separate application, so an ordinary OpenSpec project can be opened without migration or a fork of OPSX.

## Requirements

- Node.js 22 or newer
- OpenSpec CLI 1.14.0 or newer (`npm install -g @fission-ai/openspec@latest`)

## Develop

```sh
npm install
npm run dev
```

The API listens on `127.0.0.1:4317` and the development UI on `127.0.0.1:5173`. The first project defaults to the current directory; enter another local project path in the UI to switch. For a built local server, run `npm run build`, then `npm start`, and open `http://127.0.0.1:4317`.

Select an active change before editing flow behavior. A moved node or viewport saves as layout in the current graph. Adding or changing nodes, edges, or scenario paths saves a draft in the change's `graph/` directory. The inspector shows current and proposed specification text separately, with links to the source Markdown. An external Markdown edit refreshes the workspace; unsaved graph edits stay in the editor for review.

## Files and ownership

- `openspec/specs/<capability>/spec.md`: normative current requirement and scenario text.
- `openspec/changes/<change>/specs/<capability>/spec.md`: proposed OpenSpec delta.
- `openspec/graph/relations.yaml`: version 1 directed capability relationships with stable edge IDs and types (`depends-on`, `invokes`, `emits-to`, `shares-data-with`).
- `openspec/graph/flows/<capability>/<flow-id>.yaml`: version 1 behavior nodes, edges, ordered case paths, scenario references and fingerprints, and layout.
- `openspec/changes/<change>/graph/flows/...`: behavioral draft with `baseDigest` of the canonical graph. A draft can also mark a flow `deleted: true`.
- `openspec/changes/<change>/graph/reconciliation.json`: record written after graph promotion.

The UI validates relationship endpoints and dependency cycles, flow topology, and scenario links. Suggested relationships are dashed and remain suggestions until saved as declared relationships. Graph files do not generate canonical spec Markdown automatically.

## Completing a paired change

1. Review the graph draft and delta spec; run OpenSpec and graph validation.
2. Sync the OpenSpec delta into canonical specs using OpenSpec.
3. Run graph preflight, review any conflict or drift diagnostics, and reconcile the graph draft.
4. Archive the OpenSpec change. If archive happened first, the pending-drafts view finds the graph under `changes/archive/` and offers preflight and reconciliation there.

The repository-local skills `opsx-chart-graph-to-spec`, `opsx-chart-spec-to-graph`, and `opsx-chart-reconcile` guide assistant work through these steps. They use the same CLI operations as the UI; they do not make generated behavior authoritative without review.

## CLI

Run `npm run --silent cli -- --help` during development. The CLI reads the same project and graph model as the UI. It provides JSON inspection, validation, draft preparation, and graph reconciliation for assistant skills. For example:

```sh
npm run --silent cli -- snapshot --root /path/to/project
npm run --silent cli -- inspect --root /path/to/project --capability authentication --flow sign-in --change adjust-login
npm run --silent cli -- pending --root /path/to/project
```

Run `npm run typecheck` and `npm test` to verify the implementation. Integration tests copy the fixture under `test/fixtures/project` and never alter it.

The initial implementation is tracked in `openspec/changes/initial-visual-spec-workspace/`.
