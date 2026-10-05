---
name: opsx-chart-spec-to-graph
description: Propose an OPSX Chart behavior flow update from a changed OpenSpec requirement or scenario. Use when Markdown changes should be reflected in a linked graph path.
---

# OpenSpec scenario to graph

Use the current and proposed scenario text to propose graph topology. Keep the OpenSpec text authoritative and identify any behavior the text does not specify.

1. Use the active OpenSpec change selected by `opsx-chart-apply`; do not open another change for the graph. Run `npm run --silent cli -- snapshot --root <project>` and `npm run --silent cli -- inspect --root <project> --capability <id> --flow <flow-id> --change <change-id>`. Compare the current and proposed scenario and find the case that points to it. Inspect the case edge order and linked node labels.
2. Draft a graph patch in a separate YAML file using the version 1 flow schema (`nodes`, directed `edges`, ordered `cases[].edgeIds`, `scenario` reference with current or change scope, fingerprint, and optional positions/viewport). Preserve stable IDs for unchanged nodes and edges. Do not add outcomes absent from the scenario.
3. Review the proposed path and relevant scenario text together. When the user's task authorizes the edit, save with `npm run --silent cli -- save-flow --root <project> --file <patch.yaml> --change <change-id>`. The command classifies layout versus behavior and saves behavior under `openspec/changes/<change-id>/graph/` with a base digest.
4. Run `npm run --silent cli -- validate --root <project> --change <change-id>`. Correct missing links, unlabeled branches, disconnected cases, and drift before claiming the graph is ready.

If the scenario heading changed, use a diagnostic's candidate reference only after checking the text; never silently relink a case.
