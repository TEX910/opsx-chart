---
name: opsx-chart-diagrams
description: Generate or refresh read-only Mermaid maps and WHEN/THEN scenario views from existing OpenSpec specifications. Use directly for diagram maintenance, or as the shared rendering step of opsx-chart workflow skills.
---

# Readable OpenSpec views

Read [the diagram contract](references/diagrams.md) before generating views. Workflow wrappers also read [integration](references/integration.md).

Resolve the existing planning root with OpenSpec before any project write. Follow its selected store and artifact paths. Use `scripts/chart.mjs snapshot`, write a temporary model of concise scenario summaries and evidenced relationships, then `render` and `check` as described in the contract. The helper is bundled with this skill; it does not require installing an application or npm dependencies in the target project.

Conceptualize related cases together: share the same logical condition/decision and equivalent outcomes, with labeled branches and one traced path per source scenario. Preserve residual preconditions on the appropriate branch. Separate a case only when no faithful common graph is established; do not default to a disconnected WHEN/THEN pair for every scenario.

The reviewed specification is authoritative. Diagrams are derived reading aids: never edit a spec to fit a drawing, interpret Mermaid as behavior input, infer missing WHEN/THEN behavior, or start a new change just to draw an existing one. Keep current views separate from proposed views. Reading/exploration alone authorizes an inline diagram, not persistent files.

Summarize the views written and any interpretation requiring review. A successful structural/freshness check does not establish semantic fidelity; read each summary against its source scenario before reporting completion.
