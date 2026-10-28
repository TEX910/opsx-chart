# Diagram contract

The package has no graph editor, server, watcher, or graph-to-spec path. Persistent state consists of generated Markdown views and `sources.json` (source inventory, scenario index and file hashes for freshness). The agent's rendering model is temporary, not a second maintained specification. No graph YAML is read or promoted. Legacy opsx-chart graph files are retained when installing into another project and are not imported automatically.

## 1. Snapshot the actual spec scope

Use the helper's absolute path beneath this installed skill and the resolved planning root. It reads only; redirect its JSON to a uniquely named temporary file outside the project.

```sh
node "<skill-dir>/scripts/chart.mjs" snapshot --root "<planning-root>"
node "<skill-dir>/scripts/chart.mjs" snapshot --root "<planning-root>" --change-dir "<changeRoot>" --spec-file "<concrete-delta-path>"
```

Repeat `--spec-file` for every selected spec artifact. Do not request change snapshots without concrete delta paths. Current snapshots cover current specs; change snapshots cover the effective scenarios of affected specs, with unrelated current specs included only as map context. Retirements, removed requirements, and renames are explicitly labeled. The heading index handles standard OpenSpec requirement deltas, not arbitrary custom spec languages; report unsupported structure instead of changing the schema.

## 2. Conceptualize, then render

Read the selected specs in full, including current plus delta text for a change. The packet supplies the expected effective requirement/scenario names. Summarize conditions and results in the spec's language. Preserve negation, actors, constraints, GIVEN preconditions, AND conditions/results, and error cases; no extra behavior.

First identify the common logical predicates of related scenarios. Represent positive/negative cases of the same check with one decision and labeled branches. Preserve additional preconditions as branch guards: an active member with valid credentials versus a member with invalid credentials can share “Credentials valid?”, with “Yes · active member” and “No” branches. A bare “Yes” must not silently discard the active-member guard. Unspecified combinations remain unspecified, not an invented else outcome. Merge outcomes only when the complete result, including side effects, is equivalent.

Build a coherent shared graph per related case family, normally within one requirement. Use nested decisions only when the source supports that logical decomposition; diagram connectivity is not permission to invent an execution order, priority or exclusivity. In the login demo, a locked account can also submit invalid credentials: without a source-defined priority, do not move the locked-account case underneath a successful credential check or hide the overlap. Keep that case separate and explain the ambiguity. Unrelated cases can remain separate. Small shared graphs are preferable to both disconnected copies of the same predicate and an unreadable mega-flow.

Create a temporary UTF-8 JSON model. Include exactly one flow entry per packet spec (an empty cases array for retirement) and one case summary per effective scenario. Headings must match exactly. Use `graphs` for related cases; cases not assigned to a graph retain the simple WHEN → THEN fallback. Never copy the illustrative names below unless they match the source.

```json
{
  "snapshot": "<id from snapshot>",
  "flows": [{
    "capability": "identity/authentication",
    "cases": [{
      "requirement": "Sign in",
      "scenario": "Valid credentials",
      "when": "An active member provides valid credentials",
      "then": "A session starts"
    }, {
      "requirement": "Sign in",
      "scenario": "Invalid credentials",
      "when": "A member provides invalid credentials",
      "then": "Access is denied"
    }],
    "graphs": [{
      "requirement": "Sign in",
      "title": "Credential check",
      "nodes": [
        { "id": "credentials", "type": "decision", "label": "Credentials valid?" },
        { "id": "session", "type": "outcome", "label": "A session starts" },
        { "id": "denied", "type": "outcome", "label": "Access is denied" }
      ],
      "edges": [
        { "id": "valid", "source": "credentials", "target": "session", "label": "Yes · active member" },
        { "id": "invalid", "source": "credentials", "target": "denied", "label": "No" }
      ],
      "paths": [
        { "scenario": "Valid credentials", "edgeIds": ["valid"] },
        { "scenario": "Invalid credentials", "edgeIds": ["invalid"] }
      ]
    }]
  }],
  "relations": [{
    "source": "identity/authentication",
    "target": "notifications",
    "type": "emits-to",
    "basis": "explicit",
    "evidence": {
      "path": "openspec/specs/identity/authentication/spec.md",
      "quote": "<exact supporting excerpt from this spec>"
    }
  }]
}
```

Map relation types: `depends-on` (source relies on target's contract), `invokes`, `emits-to`, `shares-data-with` (symmetric), `related-to` (symmetric association). Endpoints are full capability paths. A typed edge requires explicit supporting behavior in the source specification, with a short exact quote. A co-mentioned capability or shared change is not a dependency. When an interpretation materially helps readability, use `related-to` plus `basis: inferred`; it renders dotted. Otherwise leave the relation out. Empty relations are valid. Read source evidence even for specs that appear only as map context. In a change, do not cite behavior removed or superseded by that delta.

Each graph belongs to an existing `requirement` and has a nonempty `title`. Node types are `context` (neutral grouping), `condition` (WHEN), `decision` (shared predicate) and `outcome` (THEN). Nodes and edges have unique ids; decision exits need explicit labels. Use exactly one root and end every scenario path at an outcome whose label equals that case's complete `then` summary. `paths[].edgeIds` trace each included source scenario from the root to its outcome. A scenario may appear in only one graph. All graph nodes/edges must be used by those paths; every root-to-outcome route must be declared. This prevents shared joins and splits from creating accidental extra case combinations. Optional `note` explains a material source ambiguity or partial coverage of predicate combinations. The model is temporary input to rendering, not persistent editable graph state.

```sh
node "<skill-dir>/scripts/chart.mjs" render --packet "<temporary-snapshot.json>" --model "<temporary-model.json>"
node "<skill-dir>/scripts/chart.mjs" check --root "<planning-root>" --graph-dir "<outputDir from snapshot>"
```

The renderer checks scenario coverage, connected paths, endpoint existence, outcome preservation, undeclared path combinations, exact evidence quotes, source freshness and output ownership. Shared graphs include a compact table connecting each source scenario to its WHEN conditions. It escapes text for Mermaid, uses basic `flowchart LR` syntax and writes source links. It cannot prove the logical equivalence of a shared predicate, a summary or an evidence excerpt: review semantics yourself. Diagrams require a Markdown preview with Mermaid support; source links in ordinary Markdown remain usable without Mermaid click handlers or relaxed security settings.

## 3. Refresh and historical views

Refresh only from specs, using a fresh snapshot and temporary model. `render` replaces only its own unedited output files; removed/renamed capabilities have their obsolete generated files pruned. Original specs and user-authored files are preserved. `check` is read-only and detects changed/deleted/new spec sources, missing views and manual view edits. Generated files and manifests are portable together when cloning a project.

After the original archive moves a change, retain its existing proposed diagrams as a historical snapshot rather than recomputing the old delta against already-synced specs:

```sh
node "<skill-dir>/scripts/chart.mjs" freeze --root "<planning-root>" --graph-dir "<actual-archive-path>/graph"
```

Freeze rebases project-relative links and manifest paths. Historical checks verify the archived delta and generated outputs; they deliberately do not compare the old base-spec hashes against today's specs. Separately generate the current scope after archive. If a change had no preview, do not invent a historical one after its specs have been merged; report its absence and generate only the current view. No timestamps or saved canvas positions are needed.
