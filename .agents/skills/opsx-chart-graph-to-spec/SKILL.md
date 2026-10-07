---
name: opsx-chart-graph-to-spec
description: Reconcile OPSX Chart decision WHENs and outcome THENs into OpenSpec scenario Markdown for the active change.
---

# Reconcile graph behavior into a spec delta

The flow is the editing surface for behavior. Decision nodes store `whens` keyed by outgoing edge ID; outcome nodes store `then`. A case supplies the ordered edge path and its target requirement/scenario name. The Markdown delta records the reviewed OpenSpec contract.

1. Use the active change and inspect the target flow with `npm run --silent cli -- inspect --root <project> --capability <id> --flow <flow-id> --change <change-id>`. Read `caseBehaviors` and the corresponding node descriptors. A changed Decision branch or Outcome may be shared by several cases: include every affected case. Each case needs every traversed Decision branch's WHEN and its final Outcome's THEN. Stop and repair missing descriptors rather than inventing text from node labels.
2. Run `npm run --silent cli -- scenario-template --root <project> --capability <id> --requirement <name> --scenario <name> --change <change-id>` for the target file and existing requirement. Write the first decision condition as `- **WHEN**`, subsequent conditions as `- **AND**`, and the outcome result as `- **THEN**`. Preserve the wording stored in node descriptors. A modified requirement delta must include the complete requirement text and all its scenarios; preserve unrelated requirements and scenarios already in the delta.
3. Review the resulting Markdown against every affected case, then write only `openspec/changes/<change>/specs/<capability>/spec.md`. Keep canonical specs untouched until the normal sync phase. Refresh the OpenSpec snapshot, update every reconciled case's scenario reference to the change scope and new fingerprint, clear `pendingSpec`, and save the flow draft under the same change.
4. Run `openspec validate <change> --strict --json` and `npm run --silent cli -- validate --root <project> --change <change>`. Resolve missing scenario links and incomplete node descriptors. Report any case whose Markdown still differs from its graph WHEN/THEN.

This skill reconciles behavior text; it does not archive or promote the change. Use `opsx-chart-sync` after implementation is reviewed.
