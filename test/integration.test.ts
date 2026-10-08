import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { emptyFlow, flowPaths, flowWouldCycle, pathBehavior, validateFlow, type Relations } from '../src/shared/model.js';
import { createOpenSpecChange, projectSnapshot, scenarioLookup, validateOpenSpecChange } from '../src/server/openspec.js';
import { consolidateFlows, graphPath, graphWorkspaceStatus, initGraphWorkspace, listFlows, loadFlow, loadMapLayout, loadRelations, pendingDrafts, preflightReconciliation, reconcileGraph, resetMapLayout, saveFlow, saveMapPosition, saveRelations } from '../src/server/graph-store.js';

const fixture = fileURLToPath(new URL('./fixtures/project/', import.meta.url));
let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-chart-test-'));
  await fs.cp(fixture, root, { recursive: true });
});
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

describe('OpenSpec project and graph coordination', () => {
  it('reads current and proposed specs without writing graph files', async () => {
    const snapshot = await projectSnapshot(root);
    expect(snapshot.current.map((item) => item.id)).toEqual(['authentication', 'notifications']);
    expect(snapshot.proposed[0].requirements[0].scenarios.some((item) => item.name === 'Locked account')).toBe(true);
    expect(await loadRelations(root)).toEqual({ version: 1, edges: [] });
    expect(await listFlows(root)).toEqual([]);
    await expect(fs.stat(path.join(root, 'openspec', 'graph'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('initializes a graph workspace without overwriting existing graph data', async () => {
    expect((await graphWorkspaceStatus(root)).initialized).toBe(false);
    expect((await initGraphWorkspace(root)).created).toBe(true);
    expect((await graphWorkspaceStatus(root)).initialized).toBe(true);
    expect(await loadRelations(root)).toEqual({ version: 1, edges: [] });
    expect(await fs.readFile(graphPath(root, 'flows/.gitkeep'), 'utf8')).toBe('');
    const relation: Relations = { version: 1, edges: [{ id: 'auth-mail', type: 'invokes', source: 'authentication', target: 'notifications' }] };
    await saveRelations(root, relation);
    expect((await initGraphWorkspace(root)).created).toBe(false);
    expect(await loadRelations(root)).toEqual(relation);
  });

  it('creates a change through OpenSpec for the single-flow editing workflow', async () => {
    const project = await createOpenSpecChange(root, 'one-flow-edit');
    expect(project.changes.some((item) => item.name === 'one-flow-edit')).toBe(true);
    expect(await fs.readFile(path.join(root, 'openspec/changes/one-flow-edit/.openspec.yaml'), 'utf8')).toContain('schema: spec-driven');
    await expect(createOpenSpecChange(root, 'Invalid Name')).rejects.toThrow('Change names');
    await saveFlow(root, { ...emptyFlow('authentication', 'main'), nodes: [{ id: 'start', type: 'event', label: 'Start', position: { x: 0, y: 0 } }] }, 'one-flow-edit');
    await createOpenSpecChange(root, 'other-edit');
    await expect(saveFlow(root, emptyFlow('authentication', 'alternate'), 'other-edit')).rejects.toThrow('already has a flow');
  });

  it('combines legacy flows without losing cases or their original files', async () => {
    const original = (id: string) => ({ ...emptyFlow('authentication', id, id),
      nodes: [
        { id: 'start', type: 'event' as const, label: 'Start', position: { x: 0, y: 0 } },
        { id: 'check', type: 'decision' as const, label: 'Check', whens: { branch: `${id} condition` }, position: { x: 200, y: 0 } },
        { id: 'done', type: 'outcome' as const, label: 'Done', then: `${id} result`, position: { x: 400, y: 0 } },
      ],
      edges: [{ id: 'next', source: 'start', target: 'check' }, { id: 'branch', source: 'check', target: 'done' }],
      cases: [{ id: 'case', name: id, edgeIds: ['next', 'branch'], scenario: { capability: 'authentication', requirement: 'Sign in', scenario: 'Valid credentials', scope: 'current' as const } }],
    });
    for (const id of ['login', 'logout']) {
      const file = graphPath(root, `flows/authentication/${id}.yaml`);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, YAML.stringify(original(id)));
    }
    await expect(saveFlow(root, emptyFlow('authentication', 'other'), 'adjust-login')).rejects.toThrow('Combine existing flows');
    const { flow, backup } = await consolidateFlows(root, 'authentication');
    expect((await listFlows(root)).filter((item) => item.capability === 'authentication').map((item) => item.id)).toEqual(['main']);
    expect(flow.cases).toHaveLength(2);
    expect(flow.cases.map((item) => pathBehavior(flow, item.edgeIds).complete)).toEqual([true, true]);
    expect(await fs.readFile(path.join(backup, 'login.yaml'), 'utf8')).toContain('id: login');
    expect(await fs.readFile(path.join(backup, 'logout.yaml'), 'utf8')).toContain('id: logout');
    await expect(fs.stat(graphPath(root, 'flows/authentication/login.yaml'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('persists map positions separately from capability relationships and resets them', async () => {
    expect(await loadMapLayout(root)).toEqual({ version: 1, positions: {} });
    expect(await saveMapPosition(root, 'authentication', { x: 360, y: 120 })).toEqual({ version: 1, positions: { authentication: { x: 360, y: 120 } } });
    expect(await saveMapPosition(root, 'notifications', { x: 820, y: 300 })).toEqual({ version: 1, positions: {
      authentication: { x: 360, y: 120 }, notifications: { x: 820, y: 300 },
    } });
    expect(await loadMapLayout(root)).toEqual({ version: 1, positions: {
      authentication: { x: 360, y: 120 }, notifications: { x: 820, y: 300 },
    } });
    await expect(fs.stat(graphPath(root, 'relations.yaml'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(saveMapPosition(root, 'missing', { x: 0, y: 0 })).rejects.toThrow('Capability does not exist');
    await expect(saveMapPosition(root, 'authentication', { x: Infinity, y: 0 })).rejects.toThrow();
    expect(await resetMapLayout(root)).toEqual({ version: 1, positions: {} });
    expect(await loadMapLayout(root)).toEqual({ version: 1, positions: {} });
  });

  it('persists typed relationships and rejects a dependency cycle', async () => {
    const relation: Relations = { version: 1, edges: [{ id: 'auth-needs-mail', type: 'depends-on', source: 'authentication', target: 'notifications' }] };
    expect((await saveRelations(root, relation)).diagnostics).toEqual([]);
    expect(await loadRelations(root)).toEqual(relation);
    const invalid: Relations = { ...relation, edges: [...relation.edges, { id: 'mail-needs-auth', type: 'depends-on', source: 'notifications', target: 'authentication' }] };
    const rejected = await saveRelations(root, invalid);
    expect(rejected.diagnostics.some((item) => item.code === 'dependency-cycle')).toBe(true);
    expect(await loadRelations(root)).toEqual(relation);
  });

  it('keeps layout changes canonical and behavior changes in a digest-backed draft', async () => {
    const base = emptyFlow('authentication', 'sign-in', 'Sign in');
    expect((await saveFlow(root, base)).scope).toBe('current');
    const layout = { ...base, viewport: { x: 15, y: 22, zoom: 1.25 } };
    expect((await saveFlow(root, layout)).scope).toBe('current');
    expect(await fs.readFile(graphPath(root, 'flows/authentication/sign-in.yaml'), 'utf8')).toContain('zoom: 1.25');
    await expect(fs.stat(path.join(root, 'openspec', 'changes', 'adjust-login', 'graph'))).rejects.toMatchObject({ code: 'ENOENT' });

    const project = await projectSnapshot(root);
    const scenario = project.proposed[0].requirements[0].scenarios.find((item) => item.name === 'Locked account')!;
    const behavior = {
      ...layout,
      nodes: [
        { id: 'start', type: 'event' as const, label: 'Credentials sent', position: { x: 0, y: 0 } },
        { id: 'check', type: 'decision' as const, label: 'Account locked?', whens: { e2: 'a locked member submits credentials' }, position: { x: 200, y: 0 } },
        { id: 'locked', type: 'outcome' as const, label: 'Explain lock', then: 'the system denies access and explains the lock', position: { x: 400, y: 0 } },
      ],
      edges: [{ id: 'e1', source: 'start', target: 'check' }, { id: 'e2', source: 'check', target: 'locked', label: 'Locked' }],
      cases: [{ id: 'locked-case', name: 'Locked account', edgeIds: ['e1', 'e2'], scenario: {
        capability: 'authentication', requirement: 'Sign in', scenario: 'Locked account', scope: 'change' as const,
        change: 'adjust-login', fingerprint: scenario.fingerprint,
      } }],
    };
    await expect(saveFlow(root, behavior)).rejects.toThrow('require an active OpenSpec change');
    const saved = await saveFlow(root, behavior, 'adjust-login');
    expect(saved.scope).toBe('change');
    expect(pathBehavior(saved.flow, saved.flow.cases[0].edgeIds)).toEqual({ whens: ['a locked member submits credentials'], then: 'the system denies access and explains the lock', complete: true });
    expect(saved.flow.baseDigest).toMatch(/^[a-f0-9]{64}$/);
    expect((await loadFlow(root, 'authentication', 'sign-in')).nodes).toEqual([]);
    expect((await pendingDrafts(root))[0].files).toContain('flows/authentication/sign-in.yaml');
    expect((await preflightReconciliation(root, 'adjust-login')).diagnostics.some((item) => item.code === 'spec-not-synced')).toBe(true);

    const canonicalPath = path.join(root, 'openspec/specs/authentication/spec.md');
    const original = await fs.readFile(canonicalPath, 'utf8');
    await fs.writeFile(canonicalPath, original.replace('with valid credentials.', 'with valid credentials and reject a locked account.') + '\n#### Scenario: Locked account\n- **WHEN** a locked member submits credentials\n- **THEN** the system denies access and explains the lock\n');
    await fs.mkdir(path.join(root, 'openspec/changes/archive'));
    await fs.rename(path.join(root, 'openspec/changes/adjust-login'), path.join(root, 'openspec/changes/archive/adjust-login'));
    const pending = await pendingDrafts(root);
    expect(pending).toEqual([{ change: 'adjust-login', archived: true, files: ['flows/authentication/sign-in.yaml'] }]);
    const preflight = await preflightReconciliation(root, 'adjust-login', true);
    expect(preflight.diagnostics).toEqual([]);
    await reconcileGraph(root, 'adjust-login', true);
    expect(await pendingDrafts(root)).toEqual([]);
    const promoted = await loadFlow(root, 'authentication', 'sign-in');
    expect(promoted.cases[0].scenario.scope).toBe('current');
    expect(promoted.cases[0].scenario.change).toBeUndefined();
    expect(promoted.cases[0].scenario.fingerprint).toBe(scenario.fingerprint);
    expect(promoted.nodes.find((node) => node.id === 'check')?.whens?.e2).toBe('a locked member submits credentials');
  });

  it('flags external scenario edits and offers a fingerprint-based rename candidate', async () => {
    const project = await projectSnapshot(root);
    const original = project.current[0].requirements[0].scenarios[0];
    const ref = { capability: 'authentication', requirement: 'Sign in', scenario: original.name, scope: 'current' as const, fingerprint: original.fingerprint };
    const canonicalPath = path.join(root, 'openspec/specs/authentication/spec.md');
    const content = await fs.readFile(canonicalPath, 'utf8');
    await fs.writeFile(canonicalPath, content.replace('Scenario: Valid credentials', 'Scenario: Accepted credentials'));
    const renamed = await projectSnapshot(root);
    expect(scenarioLookup(renamed)(ref).candidate?.scenario).toBe('Accepted credentials');
    await fs.writeFile(canonicalPath, content.replace('starts a session', 'creates a secure session'));
    const changed = await projectSnapshot(root);
    const flow = { ...emptyFlow('authentication', 'check'), cases: [{ id: 'case', name: 'Valid credentials', edgeIds: [], scenario: ref }] };
    expect(validateFlow(flow, scenarioLookup(changed)).some((item) => item.code === 'stale-scenario')).toBe(true);
  });

  it('allows a graph-first case to await its OpenSpec scenario', () => {
    const flow = {
      ...emptyFlow('authentication', 'new-case'),
      nodes: [
        { id: 'start', type: 'event' as const, label: 'Sign-in begins', position: { x: 0, y: 0 } },
        { id: 'check', type: 'decision' as const, label: 'Account locked?', whens: { branch: 'the account is locked' }, position: { x: 200, y: 0 } },
        { id: 'denied', type: 'outcome' as const, label: 'Deny access', then: 'the system denies access', position: { x: 400, y: 0 } },
      ],
      edges: [{ id: 'start-check', source: 'start', target: 'check' }, { id: 'branch', source: 'check', target: 'denied', label: 'Locked' }],
      cases: [{ id: 'new', name: 'Locked sign-in', edgeIds: ['start-check', 'branch'], pendingSpec: true,
        scenario: { capability: 'authentication', requirement: 'Sign in', scenario: 'Locked sign-in', scope: 'change' as const, change: 'adjust-login' } }],
    };
    expect(pathBehavior(flow, flow.cases[0].edgeIds).complete).toBe(true);
    const pending = validateFlow(flow, () => ({ exists: false }));
    expect(pending.find((item) => item.code === 'scenario-awaiting-sync')?.severity).toBe('warning');
    const promoted = { ...flow, cases: flow.cases.map((item) => ({ ...item, scenario: { ...item.scenario, scope: 'current' as const } })) };
    expect(validateFlow(promoted, () => ({ exists: false })).find((item) => item.code === 'missing-scenario')?.severity).toBe('error');
  });

  it('discovers a route through two decisions and emits ordered WHEN and AND conditions', () => {
    const flow = {
      ...emptyFlow('authentication', 'two-checks'),
      nodes: [
        { id: 'start', type: 'event' as const, label: 'Sign in', position: { x: 0, y: 0 } },
        { id: 'credentials', type: 'decision' as const, label: 'Credentials valid?', whens: { valid: 'credentials are valid' }, position: { x: 200, y: 0 } },
        { id: 'account', type: 'decision' as const, label: 'Account active?', whens: { active: 'the account is active' }, position: { x: 400, y: 0 } },
        { id: 'session', type: 'outcome' as const, label: 'Start session', then: 'the system starts a session', position: { x: 600, y: 0 } },
      ],
      edges: [
        { id: 'begin', source: 'start', target: 'credentials' },
        { id: 'valid', source: 'credentials', target: 'account' },
        { id: 'active', source: 'account', target: 'session' },
      ],
    };
    expect(flowPaths(flow)).toEqual([['begin', 'valid', 'active']]);
    expect(pathBehavior(flow, flowPaths(flow)[0])).toEqual({ whens: ['credentials are valid', 'the account is active'], then: 'the system starts a session', complete: true });
    expect(validateFlow(flow).some((item) => item.code === 'unlabeled-branch')).toBe(false);
    expect(flowWouldCycle(flow, 'account', 'credentials')).toBe(true);
    expect(validateFlow({ ...flow, edges: [...flow.edges, { id: 'back', source: 'account', target: 'credentials' }] }).some((item) => item.code === 'flow-cycle')).toBe(true);
  });

  it('allows a Decision WHEN to pass through an Action before the Outcome THEN', () => {
    const flow = { ...emptyFlow('authentication', 'main'),
      nodes: [
        { id: 'start', type: 'event' as const, label: 'Start', position: { x: 0, y: 0 } },
        { id: 'check', type: 'decision' as const, label: 'Eligible?', whens: { yes: 'the member is eligible' }, position: { x: 200, y: 0 } },
        { id: 'record', type: 'action' as const, label: 'Record approval', position: { x: 400, y: 0 } },
        { id: 'done', type: 'outcome' as const, label: 'Approved', then: 'the member sees approval', position: { x: 600, y: 0 } },
      ],
      edges: [{ id: 'begin', source: 'start', target: 'check' }, { id: 'yes', source: 'check', target: 'record' }, { id: 'finish', source: 'record', target: 'done' }],
    };
    expect(validateFlow(flow).filter((item) => item.severity === 'error')).toEqual([]);
    expect(flowPaths(flow)).toEqual([['begin', 'yes', 'finish']]);
    expect(pathBehavior(flow, flowPaths(flow)[0])).toEqual({ whens: ['the member is eligible'], then: 'the member sees approval', complete: true });
  });

  it('does not accept an invalid OpenSpec validation payload as success', async () => {
    const deltaPath = path.join(root, 'openspec/changes/adjust-login/specs/authentication/spec.md');
    await fs.writeFile(deltaPath, '## MODIFIED Requirements\n\n### Requirement: Missing target\nThe system SHALL fail validation.\n\n#### Scenario: Unmatched\n- **WHEN** checked\n- **THEN** rejected\n');
    await expect(validateOpenSpecChange(root, 'adjust-login')).rejects.toThrow();
  });
});
