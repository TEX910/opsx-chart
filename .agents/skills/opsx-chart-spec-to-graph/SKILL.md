---
name: opsx-chart-spec-to-graph
description: Propose an OPSX Chart behavior flow update from a changed OpenSpec requirement or scenario. Use when Markdown changes should be reflected in a linked graph path.
---

# OpenSpec scenario to graph

Use the current and proposed scenario text to propose graph topology and node descriptors. Keep the reviewed OpenSpec text authoritative and identify any behavior the text does not specify.

1. Use the active OpenSpec change selected by `opsx-chart-apply`; do not open another change for the graph. Run `opsx-chart snapshot --root <project>` and `opsx-chart inspect --root <project> --capability <id> --flow <flow-id> --change <change-id>`. Compare the current and proposed scenario and find the case that points to it. Inspect the case edge order and linked node labels.
2. Draft a patch to the capability's single flow in a separate YAML file using the version 1 flow schema (`nodes`, directed `edges`, ordered `cases[].edgeIds`, `scenario` reference with current or change scope, fingerprint, and optional positions/viewport). Represent each scenario WHEN or AND as a traversed Decision branch: store its text in the source Decision's `whens[<outgoing-edge-id>]`. A branch may lead to an Action, another Decision, or the final Outcome. Actions may then lead to Outcomes; they do not supply WHEN or THEN text. Keep the conditions in scenario order along one Event-to-Outcome case path and store the final THEN on that Outcome node as `then`. Edge labels are optional and do not replace WHEN text. If several cases share a branch or outcome, check that their text agrees before changing that shared descriptor; surface conflicts for review. Preserve stable IDs for unchanged nodes and edges. Do not add outcomes absent from the scenario or create a second flow for the capability.
3. Review the proposed path and relevant scenario text together. When the user's task authorizes the edit, save with `opsx-chart save-flow --root <project> --file <patch.yaml> --change <change-id>`. The command classifies layout versus behavior and saves behavior under `openspec/changes/<change-id>/graph/` with a base digest.
4. Run `opsx-chart validate --root <project> --change <change-id>`. Correct missing links, Decision branches without WHEN text, disconnected cases, and drift before claiming the graph is ready.

If the scenario heading changed, use a diagnostic's candidate reference only after checking the text; never silently relink a case.
