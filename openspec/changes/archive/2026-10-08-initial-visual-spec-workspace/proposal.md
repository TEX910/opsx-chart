# Initial visual specification workspace

## Why

OpenSpec makes capabilities and change proposals reviewable as text, but it does not provide an editable map of relationships between capabilities or an operational view of a capability's scenarios. Developers need both views while retaining OpenSpec's Markdown contract and change lifecycle.

## What Changes

- Add a local workspace that reads an existing OpenSpec project and shows its capabilities, requirements, scenarios, and active changes.
- Let users declare typed relationships between capabilities and navigate their impact.
- Let users draw one behavioral flow per capability, with Decision WHENs, Outcome THENs, and paths linked to OpenSpec scenarios through skills.
- Keep graph files and OpenSpec delta specs coherent when behavior changes; provide deterministic validation and skills for reconciling updates in either direction.
- Keep graph data in versioned files beside OpenSpec content so it remains available without the visual application.

## Capabilities

### New Capabilities

- `project-workspace`: Discover and display a local OpenSpec project and its current or proposed specification content.
- `capability-map`: Maintain and navigate explicit, typed relationships among OpenSpec capabilities.
- `behavior-flows`: Edit visual flows and connect their paths to requirements and scenarios in one capability.
- `spec-graph-coordination`: Detect drift, prepare coordinated behavior changes, and reconcile graph drafts with the OpenSpec lifecycle.

### Modified Capabilities

None.

## Impact

- A local application and companion command-line entry point will read OpenSpec CLI JSON and versioned project files.
- Projects using opsx-chart will gain an `openspec/graph/` directory and graph drafts inside active OpenSpec changes.
- The initial implementation will work with one local OpenSpec root at a time. Registered stores, multi-repository aggregation, code generation, and executable workflows are outside this change.
