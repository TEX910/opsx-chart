# Integration with the original workflow

Each `opsx-chart-*` operation is a thin entry point around one installed `openspec-*` skill. Read the actual original `SKILL.md` in the sibling skill directory and execute its instructions inline, in this conversation. This is agent instruction composition, not a CLI command or an automatic runtime hook. Do not copy the original instructions into the wrapper, recursively call the wrapper, spawn another agent, or start the next phase. Original prompts, conditions, validation, selected roots, and stopping points still apply.

Pass through the user's arguments, selected change, schema, and store. Resolve an original that is absent by explaining which OpenSpec profile/tool setup is needed; never improvise its workflow. OpenSpec refreshes its own generated files independently of this suite. The wrapper's additive diagram step occurs before its combined completion report, within the same authorized phase. Do not perform it while the original is waiting for an answer or has stopped on an error.

## Boundaries and paths

- Use OpenSpec's returned planning root (`planningHome.root` or equivalent resolved root), `changeRoot`, and concrete spec artifact paths. Never substitute the code checkout for a selected store. The helper's `--root` is the planning project containing `openspec/specs`, not the `openspec/` directory itself.
- A change diagram reads current specs plus only delta files selected by the original workflow from its concrete spec outputs. Supply those exact entries as repeated `--spec-file` arguments. No spec outputs, skipped specs, or a non-spec artifact just created means no new change views. Do not scan arbitrary artifacts or create an empty spec to force a drawing.
- Diagram previews live in `<changeRoot>/graph/`. Current views live in `<planningRoot>/openspec/graph/`. Propose/update/continue/ff never update current views. `new` creates no diagrams because it creates no spec artifacts.
- `explore` reads existing views or shows a provisional inline Mermaid sketch. It does not persist diagrams or spec content unless the original workflow and user expressly authorize capturing that content.
- `apply` consults views; refresh its change views only if existing spec content changed or views are missing/stale. It does not create a graph implementation backlog. `verify` checks existing views read-only and reports missing/stale diagrams as documentation findings, without changing the original verification outcome.
- After standalone `sync`, regenerate current views from the specs actually present on disk. Preserve the change's preview as a record. A source delta does not mean canonical specs were merged.
- Before `archive`, refresh the selected change preview if its spec artifacts exist and generation is possible. If the user needs to resolve an OpenSpec prompt, stop there first. Complete the original archive workflow without duplicating its inline sync. After the move, run the helper's `freeze` on the actual archived graph directory to rebase source links and retain the preview as a historical view; then regenerate current views from disk. Do this even when archive was explicitly performed without sync: current views must describe what is on disk, not the proposed delta. Bulk archive applies the same steps only to changes the original actually archived. Never rerun archive because graph maintenance failed.
- Onboard follows the original teaching flow. Add views only at the points where actual specs are written/synced, preserving its interaction pauses.

## Shared generation and failures

Read [diagrams.md](diagrams.md), snapshot the selected scope, summarize its effective scenarios, render once, and check. The snapshot includes unchanged scenarios from affected requirements, full nested capability ids, renames and removals. It indexes headings for reading; OpenSpec still owns validation and normative merging.

If specs changed during rendering, discard the temporary snapshot/model and read a fresh one before retrying. Do not overwrite hand-edited or unowned files. Report the concrete conflict. If the original operation succeeded but diagrams failed, state both outcomes and the exact scope to refresh with `opsx-chart-diagrams`. Do not roll back specs, claim the diagrams are current, or continue into another OpenSpec phase. Graph maintenance adds documentation, not a new semantic gate or a separate proposal/task list.

When the original completion prompt names its next workflow, mention the corresponding installed `opsx-chart-*` entry point so the user can keep the extended flow. Do not rewrite original files. A user can still invoke native OpenSpec; that bypasses diagram updates until the next explicit refresh.
