# Design: initial visual specification workspace

## Context

OpenSpec owns the current behavioral contract in `openspec/specs/**/spec.md` and proposed behavior in `openspec/changes/<change>/specs/**/spec.md`. Its schema DAG orders planning artifacts; it does not define relationships among capabilities or a capability's operational topology. OpenSpec 1.14.0 exposes JSON for discovery, specification content, status, and validation. The initial product targets one local OpenSpec root at a time.

## Goals and non-goals

The first release must let a developer navigate capability relationships and edit behavioral flows without losing the existing Markdown workflow. A graph path and its linked scenario must be traceable in either direction. External edits must be detected. Assistant skills may help draft changes, while deterministic application code owns persistence and validation.

The graph is descriptive, not executable. It does not generate application code or replace OpenSpec specs. Registered stores, multiple roots, live collaboration, and automatic inference of complete flow topology from prose are deferred.

## Decisions

### 1. Separate companion with a local UI and a small CLI

Keep opsx-chart independent from the OpenSpec package. A local service reads project files and invokes the installed OpenSpec CLI; a browser UI provides the map, flow canvas, and text panel. A companion CLI exposes the same deterministic operations to skills and scripts. Read OpenSpec through documented JSON commands (`list --specs`, `show --type spec`, `status --all`, `validate`) and use source Markdown only where exact edits or content fingerprints are needed. Do not import OpenSpec's internal source modules.

This avoids maintaining an OpenSpec fork and lets the UI evolve independently. It also means the adapter must detect incompatible CLI output and report it rather than guessing.

### 2. Keep two files with separate ownership

OpenSpec Markdown owns normative requirement and scenario text. The graph files own capability edges, flow nodes and edges, scenario-path links, and layout. Neither file is a complete automatic rendering of the other. The UI presents them together as one logical capability.

Proposed project layout:

```text
openspec/
  specs/<capability>/spec.md                 # current contract, owned by OpenSpec
  graph/
    relations.yaml                           # current capability relationships
    flows/<capability>/<flow-id>.yaml        # current flow topology and scenario links
  changes/<change>/
    specs/<capability>/spec.md               # OpenSpec delta
    graph/
      relations.yaml                         # optional proposed relationship snapshot
      flows/<capability>/<flow-id>.yaml      # optional proposed flow snapshot
      reconciliation.json                    # written only after graph promotion
```

The proposed graph files use the same relative paths as canonical graph files. A draft records the digest of the canonical file it was based on; promotion refuses a changed base and asks for review. Each graph file has a format version. Graph files remain plain text and Git-friendly. A first implementation may serialize them as YAML and validate them against an explicit schema.

### 3. Link graph cases to OpenSpec scenarios, not entire documents

A capability is identified by its path under `openspec/specs/`. A scenario reference identifies the capability, exact requirement heading, exact scenario heading, and whether it comes from the current spec or an active change. Graph node and edge IDs are stable independently of labels and canvas positions. A flow contains one or more finite `cases`; each case records an ordered path of edge IDs and one scenario reference. A path may revisit a node, but its recorded case remains finite.

OpenSpec currently matches requirement headings by name during delta operations. The adapter therefore resolves references by exact names and treats renames as an explicit migration. A stored fingerprint of linked scenario content identifies an external text edit even when headings stay the same. Missing references, ambiguous names, and changed fingerprints are diagnostics; the application does not guess a replacement.

### 4. Validate graph structure and behavior links independently

Validation checks unique IDs, allowed node and relationship types, existing edge endpoints, reachable nodes, labeled decision branches, valid case paths, and resolved scenario references. Only `depends-on` relationships are required to be acyclic; behavioral flows may have loops. Incomplete flow topology can be saved as a draft with visible diagnostics. Promotion to canonical graph files requires valid references and a successful OpenSpec validation of the corresponding change.

The map may show suggestions derived from co-changes or textual mentions. These are marked as unconfirmed and remain outside `relations.yaml` until a person accepts a typed edge.

### 5. Use OpenSpec changes for semantic edits

Moving nodes or changing viewport state updates only graph layout. Adding, removing, or changing a path's behavioral meaning requires an active OpenSpec change. The graph draft is stored under that change, and the UI displays the delta scenario that expresses the intended outcome. A scenario may be drafted by an assistant skill or written directly by the user; either way, it remains reviewable before graph promotion.

For the first integration, reconciliation follows this order:

1. Preflight the graph draft, its base digests, its scenario links, and the OpenSpec change.
2. Use OpenSpec's normal sync workflow to merge delta specs into canonical specs.
3. Re-resolve graph links against those canonical specs, then promote graph drafts into `openspec/graph/` and record the promotion in `reconciliation.json`.
4. Archive the change through OpenSpec's normal archive workflow.

The UI reports the intermediate state after step 2 until step 3 succeeds. If a user archives directly, the archived graph draft remains discoverable; a recovery operation can preflight and promote it. The first release does not claim these separate tools provide an atomic cross-file transaction.

### 6. Make skills orchestration, not the source of correctness

Plan two companion skills: graph-to-spec drafts a scenario delta from a selected path and its requirement context; spec-to-graph suggests a graph patch from a changed scenario and the existing flow. A third workflow skill may guide sync, graph reconciliation, and archive. The skills call deterministic CLI operations for inspection, drafting, validation, and promotion; they do not implement their own parsers or silently overwrite canonical files. The application works for manual editing when no assistant is connected.

## Risks and mitigations

- **Text and graph drift:** fingerprints, exact references, and preflight diagnostics make drift visible before promotion.
- **External or parallel edits:** compare base digests before writing; refuse promotion on conflict and retain the draft.
- **OpenSpec lifecycle bypass:** scan active and archived changes for unreconciled graph drafts and provide recovery.
- **Diagram mistaken for executable logic:** use behavioral language and scenario links; do not expose run or code-generation actions.
- **Large maps become unreadable:** begin with search, neighborhood focus, and automatic layout; keep layout separate from semantic edges.

## Delivery sequence

First establish the OpenSpec adapter and read-only views, then explicit relationship storage, then editable flows and scenario links, then drift detection and coordinated change drafting, and finally assisted reconciliation skills. Every stage must preserve the ability to open a standard OpenSpec project without graph files.
