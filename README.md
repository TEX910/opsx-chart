# OPSX Chart

**The OpenSpec workflow, with read-only Mermaid views of specs and their WHEN/THEN cases.**

OPSX Chart is a suite of thin skills around the original OpenSpec skills. Write specifications with OpenSpec as usual; Chart conceptualizes their scenarios as small diagrams and shows relationships between capabilities. Specifications remain the source of truth. There is no visual editor, graph-to-spec synchronization, local server, watcher, build step, or runtime npm dependency.

## Install in an existing OpenSpec project

Requirements: Node.js **20.19+**, an existing OpenSpec project, and original OpenSpec skills installed for your assistant. Chart follows those installed originals rather than vendoring their workflow.

Clone this repository and install the suite into your existing OpenSpec project:

```sh
git clone https://github.com/TEX910/opsx-chart.git
cd opsx-chart
node bin/opsx-chart.mjs install --root "/absolute/path/to/your-project"
```

No `npm install`, compilation, local service, or global CLI installation is needed. For a ZIP download, use **Code → Download ZIP** on GitHub, extract it and run the same `node bin/opsx-chart.mjs install ...` command from the extracted directory. `--root` must point to the project receiving the skills, not this suite's checkout. If that project is new, initialize it with OpenSpec for your assistant before running Chart installation.

The installer detects the existing skill directory when there is one supported target. Select explicitly if your project has several:

```sh
node bin/opsx-chart.mjs install --root /absolute/path/to/your-project --target agents
node bin/opsx-chart.mjs install --root /absolute/path/to/your-project --target claude
```

Built-in directory presets: `agents`, `claude`, `cursor`, `github-copilot`, `opencode`, `gemini`. For another assistant that reads skill folders, pass `--skills-dir relative/path/to/skills`. These are directory presets, not a promise of identical invocation syntax across IDEs. Chart installs skills, not tool-specific slash-command adapters. Reopen/reload the assistant if it scans skills only at startup.

The installer adds the shared diagram skill and wrappers **only for originals actually present**. A core OpenSpec installation gets six workflow wrappers plus the shared diagram skill. With all expanded originals installed, it gets twelve wrappers plus the shared skill. It does not initialize OpenSpec, change your schema/configuration, overwrite original skills, install a CLI globally, or create diagram files before there are specs to draw.

## Use the same workflow

In an assistant that supports `$skill-name` invocation, for example:

```text
$opsx-chart-explore
$opsx-chart-propose add-account-lock
$opsx-chart-apply add-account-lock
$opsx-chart-archive add-account-lock
```

Otherwise request the skill by name using your assistant's skill invocation format. `opsx-chart-update` revises a change plan; `opsx-chart-sync` syncs its specs. Both retain the original OpenSpec meaning and stopping points.

| Chart skill suffix | Installed original | Diagram addition |
| --- | --- | --- |
| `explore` | `openspec-explore` | Read existing views or sketch inline; no automatic file writes |
| `propose` | `openspec-propose` | Draw the spec artifacts written in the change |
| `update` | `openspec-update-change` | Refresh views of revised change specs |
| `apply` | `openspec-apply-change` | Read diagrams; refresh if specs changed or views are stale/missing |
| `sync` | `openspec-sync-specs` | Refresh current views after successful sync |
| `archive` | `openspec-archive-change` | Retain a historical preview and refresh current views from disk |
| `new` | `openspec-new-change` | Preserve scaffold-only stop; no diagrams yet |
| `continue` | `openspec-continue-change` | Draw only when the next artifact actually writes specs |
| `ff` | `openspec-ff-change` | Draw specs after the original planning pass |
| `verify` | `openspec-verify-change` | Read-only diagram freshness findings |
| `bulk-archive` | `openspec-bulk-archive-change` | Retain only actually archived previews; refresh current once |
| `onboard` | `openspec-onboard` | Add views at actual spec-writing points, preserving interaction pauses |

Use `opsx-chart-diagrams` directly to create/refresh views of existing specs. The rendering helper is bundled inside that skill, so the source repository need not remain available after installation.

## What is stored in your project

```text
openspec/
  specs/<capability>/spec.md             # authoritative current behavior
  graph/
    map.md                              # generated map and evidence
    flows/<capability>.md               # generated scenario views
    sources.json                        # freshness/coverage manifest
  changes/<change>/
    specs/<capability>/spec.md           # authoritative proposed delta
    graph/                              # generated proposed views, same shape
```

Nested capability paths are retained. A change view uses current specs plus its selected deltas, keeping unchanged scenarios, additions, removals and renames visible. It never promotes proposed behavior to the current map just because a proposal exists. An archived change retains a historical view; today's spec edits do not invalidate that historical snapshot. OpenSpec still owns validation, syncing and archiving.

Related scenarios share logical conditions and decisions: valid/invalid credentials become the two branches of one credential check. Branch guards preserve additional preconditions, and complete equivalent outcomes may be shared. Each source scenario has a traced path through the graph. Unrelated or ambiguously overlapping cases remain separate, without inventing priority or an execution sequence. Summary and grouping fidelity are reviewed by the agent against the original text.

The map shows explicit, evidenced relationships (`depends-on`, `invokes`, `emits-to`, `shares-data-with`, `related-to`). Helpful inferred associations are dotted and labeled as interpretations. No maintained graph model or relationship registry is required. An exact source excerpt accompanies each edge; that evidence still requires semantic review.

Open the `.md` views in a Markdown preview with Mermaid support. Ordinary source links work independently of Mermaid click handlers. Hand edits to generated views are detected and preserved rather than overwritten; edit the source spec and ask for regeneration.

## Updates and existing projects

Update OpenSpec normally. Then rerun Chart installation to add wrappers for newly installed operations. To update a managed Chart installation:

```sh
git pull --ff-only
node bin/opsx-chart.mjs install --root "/absolute/path/to/your-project" --update
```

Run these commands from your Chart checkout. For a ZIP installation, download/extract the newer source first, then run the install command with `--update` from that directory. Updating the checkout alone does not refresh skills previously copied into another project.

Chart refuses to overwrite local skill edits or old untracked Chart skill folders. Move legacy folders aside after review before installing this version. Legacy graph YAML is not read or removed in target projects. See [integration and migration](docs/integration.md).

Calling an original OpenSpec skill or the CLI directly bypasses Chart's additions. Chart is instruction composition by the agent, not an automatic hook. A manual refresh catches up later. Graph generation failures are reported separately from the original workflow result; a completed archive is never repeated to repair documentation.

## Distribution from GitHub

The repository itself is the distribution: users clone it or download its ZIP and run the installer above. An npm registry publication is not required. A GitHub release can also attach the distributable created by `npm pack`; after extracting that archive, users run the same installer from its `package/` directory.

Before sharing these instructions, commit the suite changes, push them and merge them into the default branch so a normal clone receives this version. A local working-tree conversion or a local `.tgz` file does not update GitHub. Versioned tags/releases can then identify a specific tested version; create the tag before advertising a tag-specific install command.

## Development

```sh
npm test
npm run check
npm run demo
```

No install/build step is needed. Tests use Node's built-in runner and temporary projects. The demo refreshes committed current and proposed Mermaid examples in [examples/demo-project](examples/demo-project/openspec/graph/map.md). The shared [diagram contract](skills/opsx-chart-diagrams/references/diagrams.md) describes snapshot/render/check/freeze helpers.

Edit the distributable bundles under `skills/`. Copies installed into a project's `.agents/skills` or another host directory are managed outputs; update them through the installer rather than editing both places.

This repository's original OpenSpec skills remain untouched. Historical specifications of the old visual application are retained only in the existing archive; current specs describe the skill suite.
