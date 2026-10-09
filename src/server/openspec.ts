import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import type { ScenarioRef, ScenarioLookup } from '../shared/model.js';

const MIN_VERSION = [1, 14, 0];

export type ScenarioInfo = { name: string; rawText: string; fingerprint: string };
export type RequirementInfo = { name: string; text: string; scenarios: ScenarioInfo[] };
export type CapabilityInfo = {
  id: string;
  scope: 'current' | 'change';
  change?: string;
  purpose: string;
  requirements: RequirementInfo[];
  sourcePath: string;
  operation?: string;
};
export type ChangeInfo = { name: string; status: string; completedTasks: number; totalTasks: number; artifacts?: unknown[] };
export type ProjectSnapshot = {
  root: string;
  openSpecVersion: string;
  current: CapabilityInfo[];
  proposed: CapabilityInfo[];
  changes: ChangeInfo[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!isObject(value)) throw new Error(`OpenSpec returned incompatible ${label} JSON`);
  return value;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`OpenSpec returned incompatible ${label} JSON`);
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`OpenSpec returned incompatible ${label} JSON`);
  return value;
}

export function fingerprint(text: string): string {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n').trim()).digest('hex');
}

export async function openSpecVersion(): Promise<string> {
  let version: string;
  try {
    const result = await execa('openspec', ['--version'], { timeout: 10_000 });
    version = result.stdout.trim();
  } catch (error) {
    throw new Error(`OpenSpec CLI unavailable. Install @fission-ai/openspec 1.14.0 or newer and make sure its npm bin directory is on the PATH used to start Chart. ${String(error)}`);
  }
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  const numbers = match?.slice(1).map(Number);
  if (!numbers || MIN_VERSION.some((part, index) => part > numbers[index] && MIN_VERSION.slice(0, index).every((previous, prior) => previous === numbers[prior]))) {
    throw new Error(`OpenSpec ${version} is unsupported; version 1.14.0 or newer is required`);
  }
  return version;
}

export async function runOpenSpec(root: string, args: string[]): Promise<unknown> {
  // npm's Windows .cmd launcher passes arguments through cmd.exe, which cannot escape line breaks.
  if (args.some((arg) => /[\r\n]/.test(arg))) throw new Error('OpenSpec arguments cannot contain line breaks');
  try {
    const { stdout } = await execa('openspec', args, { cwd: root, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 });
    return JSON.parse(stdout) as unknown;
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    let details = failure.stderr?.trim() || failure.message;
    if (failure.stdout) {
      try {
        const payload = JSON.parse(failure.stdout) as Record<string, unknown>;
        const statuses = Array.isArray(payload.status) ? payload.status : [];
        details = statuses.map((item) => isObject(item) ? item.message : String(item)).join('; ') || details;
      } catch { details = failure.stdout.trim() || details; }
    }
    throw new Error(`OpenSpec ${args.join(' ')} failed: ${details}`);
  }
}

export async function createOpenSpecChange(root: string, name: string): Promise<ProjectSnapshot> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error('Change names must use lowercase letters, numbers, and hyphens');
  const projectRoot = await resolveProjectRoot(root);
  await runOpenSpec(projectRoot, ['new', 'change', name, '--json']);
  return projectSnapshot(projectRoot);
}

export async function validateOpenSpecChange(root: string, change: string): Promise<unknown> {
  const result = requireObject(await runOpenSpec(root, ['validate', change, '--strict', '--json']), 'validation');
  const items = requireArray(result.items, 'validation items');
  const failed = items.filter((item) => !isObject(item) || item.valid !== true);
  const archiveBlocked = items.flatMap((item) => isObject(item) && Array.isArray(item.issues) ? item.issues : [])
    .filter((item) => isObject(item) && typeof item.message === 'string' && /archive would refuse/i.test(item.message));
  if (failed.length || archiveBlocked.length) {
    const issues = [...failed.flatMap((item) => isObject(item) && Array.isArray(item.issues) ? item.issues : []), ...archiveBlocked];
    throw new Error(`OpenSpec change ${change} is invalid or cannot be archived: ${issues.map((item) => isObject(item) && typeof item.message === 'string' ? item.message : JSON.stringify(item)).join('; ') || 'validation failed'}`);
  }
  return result;
}

function parseRequirements(raw: unknown): RequirementInfo[] {
  return requireArray(raw, 'requirements').map((item) => {
    const requirement = requireObject(item, 'requirement');
    return {
      name: requireString(requirement.name, 'requirement name'),
      text: requireString(requirement.text, 'requirement text'),
      scenarios: requireArray(requirement.scenarios, 'scenarios').map((value) => {
        const scenario = requireObject(value, 'scenario');
        const rawText = requireString(scenario.rawText, 'scenario rawText');
        return { name: requireString(scenario.name, 'scenario name'), rawText, fingerprint: fingerprint(rawText) };
      }),
    };
  });
}

export async function resolveProjectRoot(directory: string): Promise<string> {
  await openSpecVersion();
  const listed = requireObject(await runOpenSpec(directory, ['list', '--json']), 'list');
  const root = requireObject(listed.root, 'root');
  const selected = requireString(root.path, 'root path');
  // The first release operates only on a normal local project root.
  if (root.source !== 'nearest') throw new Error('Select a local OpenSpec project root; registered stores are not supported yet');
  return path.resolve(selected);
}

export async function projectSnapshot(directory: string): Promise<ProjectSnapshot> {
  const root = await resolveProjectRoot(directory);
  const version = await openSpecVersion();
  const [rawSpecs, rawChanges, rawStatuses] = await Promise.all([
    runOpenSpec(root, ['list', '--specs', '--json']),
    runOpenSpec(root, ['list', '--json']),
    runOpenSpec(root, ['status', '--all', '--json']),
  ]);
  const specRows = requireArray(requireObject(rawSpecs, 'spec listing').specs, 'spec list');
  const changeRows = requireArray(requireObject(rawChanges, 'change listing').changes, 'change list');
  const statusRows = requireArray(requireObject(rawStatuses, 'status listing').changes, 'status list');
  const current = await Promise.all(specRows.map(async (value): Promise<CapabilityInfo> => {
    const row = requireObject(value, 'spec row');
    const id = requireString(row.id, 'spec id');
    const detail = requireObject(await runOpenSpec(root, ['show', id, '--type', 'spec', '--json']), 'spec detail');
    return {
      id, scope: 'current', purpose: typeof detail.overview === 'string' ? detail.overview : '',
      requirements: parseRequirements(detail.requirements),
      sourcePath: path.join(root, 'openspec', 'specs', id, 'spec.md'),
    };
  }));
  const changes: ChangeInfo[] = changeRows.map((value) => {
    const row = requireObject(value, 'change row');
    const name = requireString(row.name, 'change name');
    const status = statusRows.find((item) => isObject(item) && item.changeName === name);
    return {
      name, status: typeof row.status === 'string' ? row.status : 'unknown',
      completedTasks: typeof row.completedTasks === 'number' ? row.completedTasks : 0,
      totalTasks: typeof row.totalTasks === 'number' ? row.totalTasks : 0,
      artifacts: isObject(status) && Array.isArray(status.artifacts) ? status.artifacts : undefined,
    };
  });
  const proposed: CapabilityInfo[] = [];
  for (const change of changes) {
    try { await fs.access(path.join(root, 'openspec', 'changes', change.name, 'proposal.md')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    const detail = requireObject(await runOpenSpec(root, ['show', change.name, '--type', 'change', '--json']), 'change detail');
    const grouped = new Map<string, { requirements: RequirementInfo[]; operation: string }>();
    for (const item of requireArray(detail.deltas, 'change deltas')) {
      const delta = requireObject(item, 'delta');
      const id = requireString(delta.spec, 'delta spec');
      const group = grouped.get(id) ?? { requirements: [], operation: '' };
      if (!group.operation) group.operation = typeof delta.operation === 'string' ? delta.operation : 'MODIFIED';
      if (delta.requirement) group.requirements.push(...parseRequirements([delta.requirement]));
      grouped.set(id, group);
    }
    for (const [id, group] of grouped) {
      proposed.push({
        id, scope: 'change', change: change.name, purpose: '', requirements: group.requirements,
        operation: group.operation,
        sourcePath: path.join(root, 'openspec', 'changes', change.name, 'specs', id, 'spec.md'),
      });
    }
  }
  return { root, openSpecVersion: version, current, proposed, changes };
}

export function scenarioLookup(snapshot: ProjectSnapshot): ScenarioLookup {
  return (ref: ScenarioRef) => {
    const sources = ref.scope === 'current' ? snapshot.current : snapshot.proposed.filter((capability) => capability.change === ref.change);
    const capability = sources.find((item) => item.id === ref.capability);
    const requirement = capability?.requirements.find((item) => item.name === ref.requirement);
    const scenario = requirement?.scenarios.find((item) => item.name === ref.scenario);
    if (scenario) return { exists: true, fingerprint: scenario.fingerprint };
    const candidates = capability?.requirements.flatMap((item) => item.scenarios.map((scenario) => ({ requirement: item.name, scenario: scenario.name, fingerprint: scenario.fingerprint }))) ?? [];
    const candidate = candidates.find((item) => !!ref.fingerprint && item.fingerprint === ref.fingerprint)
      ?? candidates.find((item) => item.scenario.toLowerCase() === ref.scenario.toLowerCase() || item.requirement.toLowerCase() === ref.requirement.toLowerCase());
    return { exists: false, candidate: candidate ? { ...ref, ...candidate } : undefined };
  };
}
