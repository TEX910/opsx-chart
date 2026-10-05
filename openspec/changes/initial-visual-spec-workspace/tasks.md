# Tasks: initial visual specification workspace

## 1. Foundation and OpenSpec reading

- [x] 1.1 Scaffold the local application, companion CLI, and shared domain model with a documented minimum OpenSpec CLI version.
- [x] 1.2 Implement project-root selection and an OpenSpec CLI JSON adapter for canonical specs, active changes, scenario content, and validation results.
- [x] 1.3 Show current and proposed capability content separately, including clear diagnostics for missing roots or incompatible CLI output.
- [x] 1.4 Refresh external file changes while preserving unsaved graph edits for review.

## 2. Capability relationships

- [x] 2.1 Define and validate the versioned `openspec/graph/relations.yaml` format with typed directed edges and stable IDs.
- [x] 2.2 Build the navigable capability map with selection, search, neighborhood focus, and links to source specifications.
- [x] 2.3 Add relationship editing and diagnostics for missing endpoints, self-dependencies, and dependency cycles.
- [x] 2.4 Keep inferred connection suggestions visually distinct until explicitly confirmed.

## 3. Behavioral flow editor

- [x] 3.1 Define and validate the versioned flow format: nodes, edges, finite cases, scenario references, fingerprints, and layout.
- [x] 3.2 Build per-capability flow selection and the editable canvas for event, action, decision, and outcome nodes.
- [x] 3.3 Implement bidirectional navigation between a graph case and its current or proposed OpenSpec scenario.
- [x] 3.4 Report incomplete topology and unresolved links without inventing missing behavior.

## 4. Paired changes and reconciliation

- [x] 4.1 Classify layout-only and behavioral edits; require an active OpenSpec change for the latter.
- [x] 4.2 Save behavioral graph drafts under the selected change with a base digest and expose the corresponding delta scenario for review.
- [x] 4.3 Detect heading changes and content drift after external Markdown edits; offer candidate relinks without applying them automatically.
- [x] 4.4 Provide deterministic preflight validation and graph promotion after OpenSpec spec sync, with conflict detection and a reconciliation record.
- [x] 4.5 Detect graph drafts left in active or archived changes and offer reviewable recovery.

## 5. Assistant guidance and verification

- [x] 5.1 Write graph-to-spec and spec-to-graph skills that call shared inspection, draft, and validation operations, leaving generated changes for user review.
- [x] 5.2 Write workflow guidance for spec sync, graph reconciliation, and archive, including incomplete-state recovery.
- [x] 5.3 Verify the acceptance scenarios with a fixture OpenSpec project covering new, modified, renamed, and externally edited scenarios.
- [x] 5.4 Verify that opening a standard OpenSpec project without graph files remains read-only and that layout changes never create spec deltas.
