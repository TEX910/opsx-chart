---
name: opsx-chart-graph-to-spec
description: Reconcile OPSX Chart decision WHENs and outcome THENs into OpenSpec scenario Markdown for the active change.
---

# Reconcile graph behavior into a spec delta

Each capability has one behavior flow. Each outgoing edge of a Decision is one WHEN row, stored in `whens[edge.id]`, and may lead to an Action, another Decision, or an Outcome. Actions are path steps and may lead to Outcomes; they add no WHEN or THEN text. Outcome nodes store `then`. A case supplies the ordered Event-to-Outcome edge path and its target requirement/scenario name. The Markdown delta records the reviewed OpenSpec contract.

1. Use the active change and inspect the capability's flow with `opsx-chart inspect --root <project> --capability <id> --change <change-id>` (provide `--flow <flow-id>` for a legacy project with several flows). Read `caseBehaviors`, `cases[].edgeIds`, and the corresponding node descriptors. Follow each case's edges in order, passing through Actions without generating scenario lines. Collect the WHEN on each traversed Decision's outgoing edge, then the THEN on the final Outcome. A changed branch or Outcome may be shared by several cases: include every affected case. Stop and repair missing descriptors, disconnected paths, cycles, or conflicting shared text rather than inventing text from node or edge labels.
2. Run `opsx-chart scenario-template --root <project> --capability <id> --requirement <name> --scenario <name> --change <change-id>` for the target file and existing requirement. Write the first Decision condition as `- **WHEN**`, every subsequent Decision condition as `- **AND**` in path order, and the final Outcome result as `- **THEN**`. Do not create separate scenarios for intermediate Decisions. Preserve the wording stored in node descriptors. A modified requirement delta must include the complete requirement text and all its scenarios; preserve unrelated requirements and scenarios already in the delta.
3. Review the resulting Markdown against every affected case, then write only `openspec/changes/<change>/specs/<capability>/spec.md`. Keep canonical specs untouched until the normal sync phase. Refresh the OpenSpec snapshot, update every reconciled case's scenario reference to the change scope and new fingerprint, clear `pendingSpec`, and save the flow draft under the same change.
4. Run `openspec validate <change> --strict --json` and `opsx-chart validate --root <project> --change <change>`. Resolve missing scenario links and incomplete node descriptors. Report any case whose Markdown still differs from its graph WHEN/THEN.

This skill reconciles behavior text; it does not archive or promote the change. Use `opsx-chart-sync` after implementation is reviewed.
