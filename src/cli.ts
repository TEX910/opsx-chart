#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { projectSnapshot, scenarioLookup, validateOpenSpecChange } from './server/openspec.js';
import { initGraphWorkspace, listFlows, loadFlow, loadRelations, pendingDrafts, preflightReconciliation, reconcileGraph, saveFlow, validateGraph } from './server/graph-store.js';
import { pathBehavior, validateFlow } from './shared/model.js';

const [command, ...tokens] = process.argv.slice(2);
const options = new Map<string, string>();
for (let i = 0; i < tokens.length; i++) {
  if (!tokens[i].startsWith('--')) continue;
  const key = tokens[i].slice(2);
  const value = tokens[i + 1];
  if (value && !value.startsWith('--')) { options.set(key, value); i++; }
  else options.set(key, 'true');
}
const option = (name: string) => options.get(name);
const required = (name: string) => {
  const value = option(name);
  if (!value) throw new Error(`--${name} is required`);
  return value;
};
const root = path.resolve(option('root') ?? process.cwd());
const print = (value: unknown) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

async function installProjectSkills(projectRoot: string): Promise<{ installed: string[]; alreadyPresent: string[] }> {
  const source = fileURLToPath(new URL('../.agents/skills/', import.meta.url));
  const names = (await fs.readdir(source, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('opsx-chart-')).map((entry) => entry.name).sort();
  const target = path.join(projectRoot, '.agents', 'skills');
  await fs.mkdir(target, { recursive: true });
  const installed: string[] = [];
  const alreadyPresent: string[] = [];
  for (const name of names) {
    const destination = path.join(target, name);
    try { await fs.lstat(destination); alreadyPresent.push(name); continue; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    await fs.cp(path.join(source, name), destination, { recursive: true, force: false, errorOnExist: true });
    installed.push(name);
  }
  return { installed, alreadyPresent };
}

async function main(): Promise<void> {
  if (!command || command === 'help' || command === '--help') {
    process.stdout.write(`OPSX Chart CLI\n\n` +
      `  init [--root PATH] [--skills]             Create openspec/graph; optionally install Chart skills\n` +
      `  snapshot [--root PATH]                    Current and proposed OpenSpec content\n` +
      `  inspect --capability ID [--flow ID] [--change ID] [--root PATH]\n` +
      `  validate [--change ID] [--root PATH]      Graph and optional OpenSpec validation\n` +
      `  pending [--root PATH]                    Unreconciled graph drafts\n` +
      `  save-flow --file PATH --change ID [--root PATH]\n` +
      `  preflight --change ID [--archived] [--root PATH]\n` +
      `  reconcile --change ID [--archived] [--root PATH]\n` +
      `  scenario-template --capability ID --requirement NAME --scenario NAME [--change ID] [--root PATH]\n`);
    return;
  }
  if (command === 'init') {
    const graph = await initGraphWorkspace(root);
    print({ graph, skills: option('skills') === 'true' ? await installProjectSkills(graph.root) : null });
    return;
  }
  if (command === 'snapshot') { print(await projectSnapshot(root)); return; }
  if (command === 'inspect') {
    const project = await projectSnapshot(root);
    const capability = required('capability');
    const change = option('change');
    const specs = change ? project.proposed.filter((item) => item.id === capability && item.change === change) : project.current.filter((item) => item.id === capability);
    const relations = await loadRelations(root);
    const flows = (await listFlows(root, change)).filter((item) => item.capability === capability);
    const flowId = option('flow');
    const selected = flowId ? flows.find((item) => item.id === flowId && item.scope === 'change')
      ?? flows.find((item) => item.id === flowId && item.scope === 'current') : undefined;
    if (flowId && !selected) throw new Error(`Flow not found: ${capability}/${flowId}`);
    const flow = selected ? await loadFlow(root, capability, selected.id, selected.scope === 'change' ? change : undefined) : undefined;
    print({ capability: specs, relations: relations.edges.filter((item) => item.source === capability || item.target === capability), flows, flow,
      caseBehaviors: flow?.cases.map((item) => ({ caseId: item.id, scenario: item.scenario, ...pathBehavior(flow, item.edgeIds) })) ?? [],
      diagnostics: flow ? validateFlow(flow, scenarioLookup(project)) : [] });
    return;
  }
  if (command === 'validate') {
    const change = option('change');
    const graph = await validateGraph(root, change);
    let openSpec: unknown;
    if (change) {
      try { openSpec = await validateOpenSpecChange(root, change); }
      catch (error) { openSpec = { error: String(error) }; }
    }
    print({ graph, openSpec });
    if (graph.some((item) => item.severity === 'error') || (openSpec && typeof openSpec === 'object' && 'error' in openSpec)) process.exitCode = 1;
    return;
  }
  if (command === 'pending') { print(await pendingDrafts(root)); return; }
  if (command === 'save-flow') {
    const text = await fs.readFile(required('file'), 'utf8');
    print(await saveFlow(root, YAML.parse(text), required('change')));
    return;
  }
  if (command === 'preflight') { print(await preflightReconciliation(root, required('change'), option('archived') === 'true')); return; }
  if (command === 'reconcile') { print(await reconcileGraph(root, required('change'), option('archived') === 'true')); return; }
  if (command === 'scenario-template') {
    const project = await projectSnapshot(root);
    const capability = required('capability');
    const requirementName = required('requirement');
    const scenarioName = required('scenario');
    const current = project.current.find((item) => item.id === capability);
    const requirement = current?.requirements.find((item) => item.name === requirementName);
    const change = option('change');
    if (change && !project.changes.some((item) => item.name === change)) throw new Error(`Unknown active change: ${change}`);
    print({
      target: change ? path.join(project.root, 'openspec', 'changes', change, 'specs', capability, 'spec.md') : null,
      note: requirement ? 'A MODIFIED delta must include the complete existing requirement and all scenarios.' : 'A new requirement may use ADDED Requirements.',
      existingRequirement: requirement ?? null,
      proposedScenario: `#### Scenario: ${scenarioName}\n- **WHEN** <observable condition>\n- **THEN** <observable outcome>`,
      writes: false,
    });
    return;
  }
  throw new Error(`Unknown command: ${command}. Run opsx-chart help.`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
