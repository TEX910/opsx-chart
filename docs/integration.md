# Integrating OPSX Chart

## Initial project setup

1. Initialize the target project with OpenSpec and select your assistant as you normally would. Chart requires that original setup and never performs it implicitly.
2. Download this suite with `git clone https://github.com/TEX910/opsx-chart.git` (or GitHub **Code → Download ZIP**), then open a terminal in the downloaded `opsx-chart` directory. Run `node bin/opsx-chart.mjs install --root "/absolute/path/to/project"`. No npm dependency installation or build is required. Use `--target agents` for `.agents/skills`, `--target claude` for `.claude/skills`, or the appropriate explicit target when several exist.
3. Reload the assistant's skill discovery if necessary. Use the `opsx-chart-*` skill for each operation you want to extend.

An installation with original propose/apply/archive/etc. skills receives their matching Chart wrappers and one self-contained `opsx-chart-diagrams` skill. The latter contains the shared contracts and a dependency-free Node helper. All installed files stay in the chosen skill directory. It does not require an app, service, global package link, or a path back to the Chart repository.

## How a change flows

For a request such as "lock accounts after repeated failed logins":

1. `opsx-chart-propose` reads and executes the installed `openspec-propose` instructions. It uses the same change, schema and planning root selected by OpenSpec.
2. After the spec delta is written, the shared skill reads the complete current and proposed behavior. It conceptualizes every effective scenario and evidenced relationship into temporary summaries.
3. A bundled helper writes Mermaid Markdown under that change's `graph/`, including source links and a coverage/freshness manifest. No code is implemented by this planning operation.
4. `opsx-chart-update` follows the original plan-update operation, then refreshes these views if spec content changes.
5. `opsx-chart-apply` follows original implementation tasks. The diagrams are reading aids, not another behavior definition or implementation plan.
6. `opsx-chart-sync` follows the original spec sync and then refreshes `openspec/graph/` from actual current specs.
7. `opsx-chart-archive` preserves the preview in the archived change and fixes its relative links after the move. It regenerates today's views from current specs on disk, even if the user explicitly archived without syncing. It never merges specs itself.

Graph logic is shared; wrapper files remain short. A normal OpenSpec update changes the originals without replacing Chart files. The next Chart invocation reads the newly installed original. Compatibility still needs validation when OpenSpec changes its contracts; the suite does not claim transparent support for any future version.

## What is and is not automatic

The agent follows the wrapper, loads the original skill and adds the graph step before the combined report. A skill name in Markdown is not a function call or a runtime hook. If you invoke native OpenSpec directly, the graph step is bypassed. Ask for `opsx-chart-diagrams` to catch up.

Persistent generation only occurs where the operation authorizes writing relevant documentation. Explore remains read-only unless the user explicitly requests capture; new remains scaffold-only; verify checks and reports rather than silently repairing diagrams. A selected store uses its resolved planning root for graph files, not the current code checkout. Tools whose OpenSpec support consists only of commands need original skill files installed as well; this installer does not synthesize slash-command adapters.

Current views describe canonical specs. Change views describe proposed effective specs, not applied code. Historical views describe a past proposal, not today's behavior. Archive without sync must never turn a proposed drawing into a current one. If rendering fails after a native operation succeeded, repair the documentation scope; do not rerun the native operation.

## Existing opsx-chart installations

The 0.1 application had a React UI, server, behavior YAML, node positions, scenario fingerprints and graph promotion. Version 0.2 replaces those with derived Mermaid views. There is no graph-to-spec or reconciliation workflow.

For another project's old installation:

1. Commit or back up any work, especially graph-only WHEN/THEN drafts not yet captured in an OpenSpec spec. They may represent behavior absent from Markdown.
2. Review and move its old `opsx-chart-*` skill folders outside the assistant's skill discovery directory. Installation deliberately refuses to overwrite them.
3. Preserve old `openspec/graph/*.yaml` and change graph drafts as historical data outside the new generated paths, or review them before retiring them. Installation never deletes them.
4. Install the new suite, then explicitly ask `opsx-chart-diagrams` to generate current views from specs. Existing unowned `map.md`/`sources.json` paths are preserved; review or move conflicts before regeneration.

Typed relationships from old YAML are not silently promoted into new specs or treated as documented behavior. An agent may consult them as historical context, but the new map requires evidence from current/effective specifications. Do not fabricate requirements to reproduce the old picture.

## Checks and limitations

The helper detects missing/duplicate scenario views, missing references, edits since the snapshot, newly added/deleted current specs, invalid relationship endpoints, hand-edited diagrams, and stale generated outputs. It safely retains unrelated graph files. Generated views move between project checkouts without absolute source links.

Checks do not prove the meaning of an AI summary, source excerpt or relation; the agent reviews those against the specs. The small heading index supports standard OpenSpec spec/delta Markdown and explicitly reports unsupported or ambiguous content. It does not implement a replacement OpenSpec validator or merge engine. Mermaid preview availability depends on the IDE; no renderer is bundled and no Mermaid security settings are relaxed.

Logically related scenarios share decision nodes, guarded branches and equivalent results. The agent supplies a temporary shared graph with one trace per scenario; the renderer checks connectivity, cycles, result consistency and any accidental additional root-to-result paths. It preserves source conditions in a compact scenario table. Grouping does not imply an unspecified runtime order: for example, a locked-account case that overlaps invalid credentials stays separate until the spec defines their relationship. Views made by an older rendering contract are reported as needing refresh; historical archives remain historical.

## Maintenance and removal

Run normal OpenSpec updates independently. In the Chart checkout, run `git pull --ff-only` (or download a newer ZIP), then rerun Chart install with `--update` to refresh its managed files in each target project. Pulling the suite repository alone does not update the copies installed into other projects. The receipt `.opsx-chart-install.json` lets the installer preserve local edits and refuse ambiguous replacement. Enable any expanded original operations through normal OpenSpec setup first, then rerun installation; wrappers are installed only when their corresponding originals exist.

To remove Chart, remove only the `opsx-chart-*` folders and its `.opsx-chart-install.json` receipt from the chosen skill directory. Generated diagrams can be kept as documentation, or their generated outputs removed after review. Keep original `openspec-*` skills, specifications and OpenSpec configuration.
