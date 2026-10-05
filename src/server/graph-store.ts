import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  FlowSchema, RelationsSchema, emptyFlow, emptyRelations, isLayoutOnly,
  validateFlow, validateRelations, type Diagnostic, type Flow, type Relations,
} from '../shared/model.js';
import { projectSnapshot, scenarioLookup, validateOpenSpecChange, type ProjectSnapshot } from './openspec.js';

const safeId = /^[a-z0-9-]+$/;
const safeCapability = /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/;

function checkId(value: string, label: string, pattern = safeId): void {
  if (!pattern.test(value)) throw new Error(`Invalid ${label}: ${value}`);
}

function flowRelativePath(capability: string, id: string): string {
  checkId(capability, 'capability', safeCapability);
  checkId(id, 'flow ID');
  return path.join('flows', capability, `${id}.yaml`);
}

function graphRoot(root: string): string { return path.join(root, 'openspec', 'graph'); }
function changeRoot(root: string, change: string, archived = false): string {
  checkId(change, 'change ID');
  return path.join(root, 'openspec', 'changes', ...(archived ? ['archive'] : []), change);
}

export function graphPath(root: string, relative: string, change?: string, archived = false): string {
  return path.join(change ? path.join(changeRoot(root, change, archived), 'graph') : graphRoot(root), relative);
}

async function readText(file: string): Promise<string | null> {
  try { return await fs.readFile(file, 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}

export function digest(text: string | null): string | null {
  return text === null ? null : createHash('sha256').update(text).digest('hex');
}

async function writeAtomic(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, content, { flag: 'wx' });
    await fs.rename(temporary, file);
  } finally { await fs.rm(temporary, { force: true }); }
}

async function readYaml<T>(file: string, parser: { parse: (value: unknown) => T }, fallback: () => T): Promise<T> {
  const content = await readText(file);
  if (content === null) return fallback();
  try { return parser.parse(YAML.parse(content) as unknown); }
  catch (error) { throw new Error(`Invalid graph file ${file}: ${String(error)}`); }
}

export async function loadRelations(root: string): Promise<Relations> {
  return readYaml(graphPath(root, 'relations.yaml'), RelationsSchema, emptyRelations);
}

export async function saveRelations(root: string, value: unknown, snapshot?: ProjectSnapshot): Promise<{ relations: Relations; diagnostics: Diagnostic[] }> {
  const relations = RelationsSchema.parse(value);
  const project = snapshot ?? await projectSnapshot(root);
  const capabilities = [...project.current, ...project.proposed].map((item) => item.id);
  const diagnostics = validateRelations(relations, capabilities);
  if (diagnostics.some((item) => item.severity === 'error')) return { relations, diagnostics };
  const clean = { ...relations, baseDigest: undefined };
  await writeAtomic(graphPath(root, 'relations.yaml'), YAML.stringify(clean));
  return { relations: clean, diagnostics };
}

export async function loadFlow(root: string, capability: string, id: string, change?: string, archived = false): Promise<Flow> {
  const relative = flowRelativePath(capability, id);
  return readYaml(graphPath(root, relative, change, archived), FlowSchema, () => emptyFlow(capability, id));
}

async function walkYaml(directory: string, prefix = ''): Promise<string[]> {
  let entries: import('node:fs').Dirent[];
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const result: string[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await walkYaml(path.join(directory, entry.name), relative));
    else if (entry.isFile() && entry.name.endsWith('.yaml')) result.push(relative);
  }
  return result;
}

export type FlowSummary = { capability: string; id: string; name: string; scope: 'current' | 'change'; change?: string; archived?: boolean };

export async function listFlows(root: string, change?: string): Promise<FlowSummary[]> {
  const locations: Array<{ directory: string; scope: 'current' | 'change'; change?: string }> = [{ directory: graphRoot(root), scope: 'current' }];
  if (change) locations.push({ directory: path.join(changeRoot(root, change), 'graph'), scope: 'change', change });
  const result: FlowSummary[] = [];
  for (const location of locations) {
    for (const relative of await walkYaml(path.join(location.directory, 'flows'))) {
      const fullPath = path.join(location.directory, 'flows', relative);
      const flow = await readYaml(fullPath, FlowSchema, () => { throw new Error(`Missing flow: ${fullPath}`); });
      if (path.join('flows', relative) !== flowRelativePath(flow.capability, flow.id)) throw new Error(`Flow path does not match its identity: ${fullPath}`);
      result.push({ capability: flow.capability, id: flow.id, name: flow.name, scope: location.scope, change: location.change });
    }
  }
  return result;
}

export async function saveFlow(root: string, value: unknown, change?: string, snapshot?: ProjectSnapshot): Promise<{ flow: Flow; scope: 'current' | 'change'; diagnostics: Diagnostic[] }> {
  const flow = FlowSchema.parse(value);
  const relative = flowRelativePath(flow.capability, flow.id);
  const project = snapshot ?? await projectSnapshot(root);
  if (![...project.current, ...project.proposed].some((item) => item.id === flow.capability)) throw new Error(`Capability does not exist: ${flow.capability}`);
  if (change && !project.changes.some((item) => item.name === change)) throw new Error(`Active OpenSpec change does not exist: ${change}`);
  const canonicalPath = graphPath(root, relative);
  const canonicalText = await readText(canonicalPath);
  const canonical = canonicalText === null ? null : FlowSchema.parse(YAML.parse(canonicalText));
  const draftPath = change ? graphPath(root, relative, change) : null;
  const draftText = draftPath ? await readText(draftPath) : null;
  const draft = draftText === null ? null : FlowSchema.parse(YAML.parse(draftText));
  const previous = draft ?? canonical;
  const layoutOnly = previous ? isLayoutOnly(previous, flow) : flow.nodes.length === 0 && flow.edges.length === 0 && flow.cases.length === 0;
  const proposedOnly = !project.current.some((item) => item.id === flow.capability);
  if ((!layoutOnly || proposedOnly) && !change) throw new Error('Behavioral edits and flows for proposed capabilities require an active OpenSpec change');
  const scope = !layoutOnly || draft || proposedOnly ? 'change' : 'current';
  const target = scope === 'change' ? draftPath! : canonicalPath;
  const alreadyReconciled = scope === 'change' && await readText(graphPath(root, 'reconciliation.json', change));
  const saved = { ...flow, baseDigest: scope === 'change' ? alreadyReconciled ? digest(canonicalText) : draft?.baseDigest ?? digest(canonicalText) : undefined };
  const diagnostics = validateFlow(saved, scenarioLookup(project));
  await writeAtomic(target, YAML.stringify(saved));
  if (scope === 'change' && alreadyReconciled) await fs.rm(graphPath(root, 'reconciliation.json', change), { force: true });
  return { flow: saved, scope, diagnostics };
}

export async function deleteFlow(root: string, capability: string, id: string, change: string): Promise<Flow> {
  checkId(change, 'change ID');
  const project = await projectSnapshot(root);
  if (!project.changes.some((item) => item.name === change)) throw new Error(`Active OpenSpec change does not exist: ${change}`);
  const relative = flowRelativePath(capability, id);
  const canonicalText = await readText(graphPath(root, relative));
  const draftText = await readText(graphPath(root, relative, change));
  if (!canonicalText && !draftText) throw new Error(`Flow does not exist: ${capability}/${id}`);
  const source = FlowSchema.parse(YAML.parse(draftText ?? canonicalText!));
  const alreadyReconciled = await readText(graphPath(root, 'reconciliation.json', change));
  const deleted = { ...source, deleted: true, baseDigest: alreadyReconciled ? digest(canonicalText) : source.baseDigest ?? digest(canonicalText) };
  await writeAtomic(graphPath(root, relative, change), YAML.stringify(deleted));
  if (alreadyReconciled) await fs.rm(graphPath(root, 'reconciliation.json', change), { force: true });
  return deleted;
}

export type PendingDraft = { change: string; archived: boolean; files: string[] };

export async function pendingDrafts(root: string): Promise<PendingDraft[]> {
  const changesDir = path.join(root, 'openspec', 'changes');
  const result: PendingDraft[] = [];
  for (const archived of [false, true]) {
    const directory = archived ? path.join(changesDir, 'archive') : changesDir;
    let entries: import('node:fs').Dirent[];
    try { entries = await fs.readdir(directory, { withFileTypes: true }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    for (const entry of entries) {
      if (!entry.isDirectory() || (!archived && entry.name === 'archive')) continue;
      const change = entry.name;
      const graphDir = path.join(directory, change, 'graph');
      const files = (await walkYaml(graphDir)).filter((item) => item === 'relations.yaml' || item.startsWith(`flows${path.sep}`));
      if (!files.length) continue;
      const record = await readText(path.join(graphDir, 'reconciliation.json'));
      if (record === null) result.push({ change, archived, files });
    }
  }
  return result;
}

export async function validateGraph(root: string, change?: string, snapshot?: ProjectSnapshot): Promise<Diagnostic[]> {
  const project = snapshot ?? await projectSnapshot(root);
  const diagnostics: Diagnostic[] = [];
  const relations = await loadRelations(root);
  diagnostics.push(...validateRelations(relations, [...project.current, ...project.proposed].map((item) => item.id)));
  for (const summary of await listFlows(root, change)) {
    const flow = await loadFlow(root, summary.capability, summary.id, summary.scope === 'change' ? change : undefined);
    diagnostics.push(...validateFlow(flow, scenarioLookup(project)).map((item) => ({ ...item, target: `${summary.capability}/${summary.id}:${item.target ?? ''}` })));
  }
  return diagnostics;
}

export async function preflightReconciliation(root: string, change: string, archived = false): Promise<{ files: string[]; diagnostics: Diagnostic[] }> {
  const project = await projectSnapshot(root);
  const pending = (await pendingDrafts(root)).find((item) => item.change === change && item.archived === archived);
  if (!pending) throw new Error(`No unreconciled graph draft for ${change}`);
  if (!archived) await validateOpenSpecChange(root, change);
  const diagnostics: Diagnostic[] = [];
  if (!archived) {
    for (const capability of project.proposed.filter((item) => item.change === change)) {
      const canonical = project.current.find((item) => item.id === capability.id);
      for (const requirement of capability.requirements) for (const scenario of requirement.scenarios) {
        const applied = canonical?.requirements.find((item) => item.name === requirement.name)?.scenarios.find((item) => item.name === scenario.name);
        if (!applied || applied.fingerprint !== scenario.fingerprint) diagnostics.push({ severity: 'error', code: 'spec-not-synced',
          message: `OpenSpec scenario is not synchronized: ${capability.id} / ${requirement.name} / ${scenario.name}` });
      }
    }
  }
  const canonicalIds = project.current.map((item) => item.id);
  for (const relative of pending.files) {
    const draftPath = graphPath(root, relative, change, archived);
    const draftText = await readText(draftPath);
    const canonicalText = await readText(graphPath(root, relative));
    if (!draftText) continue;
    const raw = YAML.parse(draftText) as Record<string, unknown>;
    if (raw.baseDigest !== digest(canonicalText)) diagnostics.push({ severity: 'error', code: 'base-conflict', message: `Canonical graph changed since draft: ${relative}`, target: relative });
    if (relative === 'relations.yaml') {
      const relations = RelationsSchema.parse(raw);
      diagnostics.push(...validateRelations(relations, canonicalIds));
    } else {
      const flow = FlowSchema.parse(raw);
      if (flow.deleted) continue;
      const promoted: Flow = { ...flow, cases: flow.cases.map((item) => ({ ...item, scenario: { ...item.scenario, scope: 'current', change: undefined } })) };
      diagnostics.push(...validateFlow(promoted, scenarioLookup(project)));
    }
  }
  return { files: pending.files, diagnostics };
}

export async function reconcileGraph(root: string, change: string, archived = false): Promise<{ files: string[]; record: string }> {
  const preflight = await preflightReconciliation(root, change, archived);
  if (preflight.diagnostics.some((item) => item.severity === 'error')) throw new Error(preflight.diagnostics.map((item) => item.message).join('; '));
  const project = await projectSnapshot(root);
  const record: Record<string, string> = {};
  for (const relative of preflight.files) {
    const draftText = await readText(graphPath(root, relative, change, archived));
    if (!draftText) continue;
    if (relative === 'relations.yaml') {
      const value = RelationsSchema.parse(YAML.parse(draftText));
      const content = YAML.stringify({ ...value, baseDigest: undefined });
      await writeAtomic(graphPath(root, relative), content);
      record[relative] = digest(content)!;
    } else {
      const value = FlowSchema.parse(YAML.parse(draftText));
      if (value.deleted) {
        await fs.rm(graphPath(root, relative), { force: true });
        record[relative] = 'deleted';
        continue;
      }
      const lookup = scenarioLookup(project);
      const cases = value.cases.map((item) => {
        const ref = { ...item.scenario, scope: 'current' as const, change: undefined };
        return { ...item, scenario: { ...ref, fingerprint: lookup(ref).fingerprint } };
      });
      const content = YAML.stringify({ ...value, baseDigest: undefined, cases });
      await writeAtomic(graphPath(root, relative), content);
      record[relative] = digest(content)!;
    }
  }
  const recordPath = graphPath(root, 'reconciliation.json', change, archived);
  await writeAtomic(recordPath, `${JSON.stringify({ change, reconciledAt: new Date().toISOString(), files: record }, null, 2)}\n`);
  return { files: preflight.files, record: recordPath };
}
