import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp, rename, readdir, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { snapshot, render, check, freeze, parseSpec, effectiveRequirements, exists } from '../skills/opsx-chart-diagrams/scripts/chart.mjs';
import { install, workflows } from '../scripts/install.mjs';

const auth = `# Authentication\n\n## Purpose\nAuthenticate members.\n\n## Requirements\n\n### Requirement: Sign in\nThe system SHALL authenticate members.\n\n#### Scenario: Valid credentials\n- **WHEN** an active member provides valid credentials\n- **THEN** the system starts a session\n\n#### Scenario: Invalid credentials\n- **WHEN** a member provides invalid credentials\n- **THEN** the system denies access\n`;
const notice = `# Notifications\n\n## Purpose\nNotify members.\n\n## Requirements\n\n### Requirement: Deliver notice\nThe system SHALL deliver a notice to the member.\n\n#### Scenario: Delivery\n- **WHEN** a notice is requested\n- **THEN** the member receives a notice\n`;
const delta = `## MODIFIED Requirements\n\n### Requirement: Sign in\nThe system SHALL authenticate active members.\n\n#### Scenario: Valid credentials\n- **WHEN** an active member provides valid credentials\n- **THEN** the system starts a session\n\n#### Scenario: Invalid credentials\n- **WHEN** a member provides invalid credentials\n- **THEN** the system denies access\n\n#### Scenario: Locked account\n- **WHEN** the member's account is locked\n- **THEN** the system denies access and explains the lock\n`;
async function put(root, relative, text) { const file = path.join(root, relative); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, text); return file; }
async function fixture(t, { change = false } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'opsx-chart-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(root, 'openspec/specs/identity/authentication/spec.md', auth);
  await put(root, 'openspec/specs/notifications/spec.md', notice);
  await put(root, 'openspec/config.yaml', 'schema: spec-driven\n');
  if (change) await put(root, 'openspec/changes/adjust-login/specs/identity/authentication/spec.md', delta);
  return root;
}
function modelFor(packet) {
  return { snapshot: packet.id, relations: [], flows: packet.specs.map(spec => ({ capability: spec.capability,
    cases: spec.requirements.flatMap(requirement => requirement.scenarios.map(scenario => ({ requirement: requirement.name, scenario: scenario.name,
      when: `Condition for ${scenario.name}`, then: `Result for ${scenario.name}` }))) })) };
}
const preview = root => snapshot({ root, changeDir: 'openspec/changes/adjust-login', specFiles: ['openspec/changes/adjust-login/specs/identity/authentication/spec.md'] });

function credentialGraph(flow) {
  const result = name => flow.cases.find(item => item.scenario === name).then;
  return {
    requirement: 'Sign in', title: 'Credential check',
    nodes: [{ id: 'credentials', type: 'decision', label: 'Credentials valid?' },
      { id: 'accepted', type: 'outcome', label: result('Valid credentials') },
      { id: 'denied', type: 'outcome', label: result('Invalid credentials') }],
    edges: [{ id: 'yes', source: 'credentials', target: 'accepted', label: 'Yes · active member' },
      { id: 'no', source: 'credentials', target: 'denied', label: 'No' }],
    paths: [{ scenario: 'Valid credentials', edgeIds: ['yes'] }, { scenario: 'Invalid credentials', edgeIds: ['no'] }],
  };
}

test('related positive/negative cases share one decision while retaining guards and scenario traces', async t => {
  const root = await fixture(t); const packet = await snapshot({ root }); const model = modelFor(packet);
  const flow = model.flows.find(item => item.capability === 'identity/authentication');
  flow.cases[0].when = 'An active member provides valid credentials';
  flow.cases[1].when = 'A member provides invalid credentials';
  flow.graphs = [credentialGraph(flow)];
  await render(packet, model);
  const text = await readFile(path.join(root, packet.outputDir, 'flows/identity/authentication.md'), 'utf8');
  assert.equal((text.match(/```mermaid/g) ?? []).length, 1);
  assert.equal((text.match(/Credentials valid\?/g) ?? []).length, 1);
  assert.match(text, /node0\{"Credentials valid\?"\}/);
  assert.match(text, /node0 -->\|"Yes · active member"\| node1/);
  assert.match(text, /node0 -->\|"No"\| node2/);
  assert.match(text, /\| Valid credentials \| An active member provides valid credentials \|/);
  assert.match(text, /\| Invalid credentials \| A member provides invalid credentials \|/);
  assert.doesNotMatch(text, /### Valid credentials/);
  assert.equal(await readFile(path.join(root, 'openspec/specs/identity/authentication/spec.md'), 'utf8'), auth);
  assert.equal((await check({ root })).valid, true);
});

test('an ambiguously overlapping case stays separate from the shared credential decision', async t => {
  const root = await fixture(t, { change: true }); const packet = await preview(root); const model = modelFor(packet);
  const flow = model.flows[0]; flow.graphs = [credentialGraph(flow)];
  flow.graphs[0].note = 'Locked account overlaps invalid credentials; priority is not specified.';
  await render(packet, model);
  const text = await readFile(path.join(root, packet.outputDir, 'flows/identity/authentication.md'), 'utf8');
  assert.equal((text.match(/```mermaid/g) ?? []).length, 2);
  assert.match(text, /### Locked account/);
  assert.match(text, /priority is not specified/);
  assert.doesNotMatch(text.split('### Locked account')[0], /THEN Result for Locked account/);
});

test('nested decisions can share a complete equivalent outcome without losing scenarios', async t => {
  const root = await fixture(t);
  await put(root, 'openspec/specs/identity/authentication/spec.md', auth + '\n#### Scenario: Missing credentials\n- **WHEN** credentials are absent\n- **THEN** the system denies access\n');
  const packet = await snapshot({ root }); const model = modelFor(packet); const flow = model.flows[0];
  for (const item of flow.cases) if (item.scenario !== 'Valid credentials') item.then = 'Deny access';
  const graph = credentialGraph(flow);
  graph.nodes.unshift({ id: 'present', type: 'decision', label: 'Credentials supplied?' });
  graph.edges.unshift({ id: 'present', source: 'present', target: 'credentials', label: 'Yes' },
    { id: 'absent', source: 'present', target: 'denied', label: 'No' });
  for (const route of graph.paths) route.edgeIds.unshift('present');
  graph.paths.push({ scenario: 'Missing credentials', edgeIds: ['absent'] });
  flow.graphs = [graph];
  await render(packet, model);
  const text = await readFile(path.join(root, packet.outputDir, 'flows/identity/authentication.md'), 'utf8');
  assert.equal((text.match(/THEN Deny access/g) ?? []).length, 1);
  assert.match(text, /Credentials supplied\?/);
  assert.match(text, /Missing credentials/);
  assert.equal((text.match(/```mermaid/g) ?? []).length, 1);
});

test('a shared scenario route cannot silently replace its complete THEN result', async t => {
  const root = await fixture(t); const packet = await snapshot({ root }); const model = modelFor(packet); const flow = model.flows[0];
  flow.graphs = [credentialGraph(flow)]; flow.graphs[0].paths[1].edgeIds = ['yes'];
  await assert.rejects(render(packet, model), /does not preserve its THEN result/);
  assert.equal(await exists(path.join(root, 'openspec/graph')), false);
});

test('sharing a join and split must not invent additional scenario combinations', async t => {
  const root = await fixture(t); const packet = await snapshot({ root }); const model = modelFor(packet); const flow = model.flows[0];
  const graph = credentialGraph(flow);
  graph.nodes.unshift({ id: 'root', type: 'decision', label: 'Input family?' },
    { id: 'first', type: 'condition', label: 'First input' }, { id: 'second', type: 'condition', label: 'Second input' });
  graph.edges.unshift({ id: 'first', source: 'root', target: 'first', label: 'A' },
    { id: 'second', source: 'root', target: 'second', label: 'B' },
    { id: 'join-a', source: 'first', target: 'credentials' }, { id: 'join-b', source: 'second', target: 'credentials' });
  graph.paths[0].edgeIds = ['first', 'join-a', 'yes']; graph.paths[1].edgeIds = ['second', 'join-b', 'no'];
  flow.graphs = [graph];
  await assert.rejects(render(packet, model), /undeclared scenario path/);
  assert.equal(await exists(path.join(root, 'openspec/graph')), false);
});

test('shared graphs reject cycles and paths assigned to more than one graph', async t => {
  const root = await fixture(t); const packet = await snapshot({ root }); const model = modelFor(packet); const flow = model.flows[0];
  const graph = credentialGraph(flow); flow.graphs = [graph, structuredClone(graph)];
  await assert.rejects(render(packet, model), /multiple shared graphs/);
  flow.graphs = [graph];
  graph.nodes.unshift({ id: 'start', type: 'context', label: 'Sign in' });
  graph.nodes.push({ id: 'loop', type: 'condition', label: 'Loop' });
  graph.edges.push({ id: 'start', source: 'start', target: 'credentials' },
    { id: 'loop', source: 'credentials', target: 'loop', label: 'Extra' },
    { id: 'back', source: 'loop', target: 'credentials' });
  await assert.rejects(render(packet, model), /contains a cycle/);
});

test('old rendering contracts require current-view refresh without changing specs', async t => {
  const root = await fixture(t); const packet = await snapshot({ root }); await render(packet, modelFor(packet));
  const file = path.join(root, 'openspec/graph/sources.json'); const manifest = JSON.parse(await readFile(file, 'utf8'));
  delete manifest.renderVersion; await writeFile(file, JSON.stringify(manifest));
  const result = await check({ root }); assert.equal(result.valid, false); assert.match(result.problems.join(' '), /rendering contract changed/);
  assert.equal(await readFile(path.join(root, 'openspec/specs/identity/authentication/spec.md'), 'utf8'), auth);
});

test('current views preserve spec sources, cover scenarios, escape labels, and regenerate deterministically', async t => {
  const root = await fixture(t);
  const packet = await snapshot({ root });
  const model = modelFor(packet);
  model.flows[0].cases[0].when = 'Account "admin" <active> & enabled';
  await render(packet, model);
  const before = await readFile(path.join(root, 'openspec/graph/flows/identity/authentication.md'), 'utf8');
  assert.match(before, /&quot;admin&quot; &lt;active&gt; &amp; enabled/);
  assert.equal((before.match(/```mermaid/g) ?? []).length, 2);
  assert.equal(await readFile(path.join(root, 'openspec/specs/identity/authentication/spec.md'), 'utf8'), auth);
  assert.equal((await check({ root })).valid, true);
  await render(await snapshot({ root }), model);
  assert.equal(await readFile(path.join(root, 'openspec/graph/flows/identity/authentication.md'), 'utf8'), before);
});

test('snapshot and check do not create missing projects or graph files', async t => {
  const root = await fixture(t);
  await snapshot({ root });
  assert.equal(await exists(path.join(root, 'openspec/graph')), false);
  await assert.rejects(check({ root }), /No generated view/);
  const empty = await mkdtemp(path.join(os.tmpdir(), 'opsx-empty-'));
  t.after(() => rm(empty, { recursive: true, force: true }));
  await assert.rejects(snapshot({ root: empty }), /existing OpenSpec/);
  assert.deepEqual(await readdir(empty), []);
});

test('proposed views use named delta artifacts and keep current views unchanged', async t => {
  const root = await fixture(t, { change: true });
  const current = await snapshot({ root }); await render(current, modelFor(current));
  const currentMap = await readFile(path.join(root, 'openspec/graph/map.md'), 'utf8');
  const packet = await preview(root);
  assert.equal(packet.specs.length, 1);
  assert.equal(packet.specs[0].requirements[0].scenarios.length, 3);
  await render(packet, modelFor(packet));
  assert.match(await readFile(path.join(root, packet.outputDir, 'flows/identity/authentication.md'), 'utf8'), /Locked account/);
  assert.equal(await readFile(path.join(root, 'openspec/graph/map.md'), 'utf8'), currentMap);
  assert.equal((await check({ root, graphDir: packet.outputDir })).valid, true);
  await assert.rejects(snapshot({ root, changeDir: 'openspec/changes/adjust-login' }), /--spec-file/);
  await assert.rejects(snapshot({ root, changeDir: 'openspec/changes/adjust-login', specFiles: ['openspec/specs/notifications/spec.md'] }), /Not a capability spec/);
});

test('render rejects missing, duplicate and fabricated scenarios before any writes', async t => {
  const root = await fixture(t);
  const packet = await snapshot({ root });
  const model = modelFor(packet); model.flows[0].cases.pop();
  await assert.rejects(render(packet, model), /coverage/);
  assert.equal(await exists(path.join(root, 'openspec/graph')), false);
  const fabricated = modelFor(packet); fabricated.flows[0].cases[0].scenario = 'Invented';
  await assert.rejects(render(packet, fabricated), /Unknown or duplicate/);
  const duplicate = modelFor(packet); duplicate.flows[0].cases.push(duplicate.flows[0].cases[0]);
  await assert.rejects(render(packet, duplicate), /Unknown or duplicate/);
});

test('freshness detects edited, deleted, and newly added source specs', async t => {
  const root = await fixture(t);
  const packet = await snapshot({ root }); await render(packet, modelFor(packet));
  await put(root, 'openspec/specs/new-capability/spec.md', notice);
  assert.equal((await check({ root })).valid, false);
  await assert.rejects(render(packet, modelFor(packet)), /Specs changed/);
  await rm(path.join(root, 'openspec/specs/new-capability'), { recursive: true });
  await put(root, 'openspec/specs/notifications/spec.md', notice + '\nAdditional context.\n');
  assert.equal((await check({ root })).valid, false);
  await rm(path.join(root, 'openspec/specs/notifications/spec.md'));
  assert.equal((await check({ root })).valid, false);
});

test('unmanaged and manually edited diagrams are preserved', async t => {
  const root = await fixture(t);
  const packet = await snapshot({ root });
  await put(root, 'openspec/graph/map.md', 'My handwritten map\n');
  await assert.rejects(render(packet, modelFor(packet)), /unmanaged/);
  assert.equal(await exists(path.join(root, 'openspec/graph/flows')), false);
  await rm(path.join(root, 'openspec/graph/map.md'));
  await render(packet, modelFor(packet));
  await put(root, 'openspec/graph/map.md', 'Local edit\n');
  assert.equal((await check({ root })).valid, false);
  await assert.rejects(render(packet, modelFor(packet)), /manually edited/);
  assert.equal(await readFile(path.join(root, 'openspec/graph/map.md'), 'utf8'), 'Local edit\n');
});

test('render prunes only obsolete generated flows and preserves unrelated graph files', async t => {
  const root = await fixture(t);
  const packet = await snapshot({ root }); await render(packet, modelFor(packet));
  await put(root, 'openspec/graph/notes.md', 'Keep this\n');
  await rm(path.join(root, 'openspec/specs/notifications'), { recursive: true });
  const fresh = await snapshot({ root }); await render(fresh, modelFor(fresh));
  assert.equal(await exists(path.join(root, 'openspec/graph/flows/notifications.md')), false);
  assert.equal(await readFile(path.join(root, 'openspec/graph/notes.md'), 'utf8'), 'Keep this\n');
});

test('maps require source evidence and distinguish inference from dependency', async t => {
  const root = await fixture(t); const packet = await snapshot({ root });
  const model = modelFor(packet);
  model.relations.push({ source: 'identity/authentication', target: 'notifications', type: 'related-to', basis: 'inferred',
    evidence: { path: 'openspec/specs/identity/authentication/spec.md', quote: 'The system SHALL authenticate members.' } });
  await render(packet, model);
  assert.match(await readFile(path.join(root, 'openspec/graph/map.md'), 'utf8'), /-.->/);
  model.relations[0].type = 'depends-on';
  await assert.rejects(render(packet, model), /never infer a typed dependency/);
  model.relations[0].basis = 'explicit'; model.relations[0].evidence.quote = 'Absent text';
  await assert.rejects(render(packet, model), /quote is absent/);
});

test('heading index excludes code fences/comments and resolves removals and renames', () => {
  const base = parseSpec(auth + '\n```md\n### Requirement: Not real\n#### Scenario: Fake\n```\n<!--\n### Requirement: Hidden\n-->\n');
  assert.equal(base.requirements.length, 1);
  const deltaSpec = parseSpec('## RENAMED Requirements\n- FROM: `### Requirement: Sign in`\n- TO: `### Requirement: Authenticate`\n', true);
  assert.equal(effectiveRequirements(base, deltaSpec)[0].name, 'Authenticate');
  assert.equal(effectiveRequirements(base, parseSpec('## REMOVED Requirements\n### Requirement: Sign in\n', true)).length, 0);
  assert.throws(() => effectiveRequirements(base, parseSpec('## MODIFIED Requirements\n### Requirement: Sign in\n#### Scenario: Valid credentials\nWHEN x THEN y\n', true)), /drops scenario/);
});

test('retired specs have no invented cases or map endpoints in a change preview', async t => {
  const root = await fixture(t, { change: true });
  await put(root, 'openspec/changes/adjust-login/specs/identity/authentication/spec.md', '## REMOVED Requirements\n### Requirement: Sign in\n');
  const packet = await preview(root); assert.equal(packet.specs[0].retired, true);
  assert.equal(packet.knownCapabilities.includes('identity/authentication'), false);
  await render(packet, modelFor(packet));
  const flow = await readFile(path.join(root, packet.outputDir, 'flows/identity/authentication.md'), 'utf8');
  assert.match(flow, /No WHEN\/THEN cases remain/); assert.doesNotMatch(flow, /```mermaid/);
});

test('cloned generated files check successfully at a new absolute project path', async t => {
  const root = await fixture(t); const packet = await snapshot({ root }); await render(packet, modelFor(packet));
  const clone = await mkdtemp(path.join(os.tmpdir(), 'opsx-clone-'));
  t.after(() => rm(clone, { recursive: true, force: true }));
  await cp(path.join(root, 'openspec'), path.join(clone, 'openspec'), { recursive: true });
  assert.equal((await check({ root: clone })).valid, true);
});

test('archive freezes pre-sync preview, fixes links and checks historical delta separately', async t => {
  const root = await fixture(t, { change: true });
  const packet = await preview(root); await render(packet, modelFor(packet));
  // Native OpenSpec would merge first and move the entire change. Its result is
  // simulated here to verify documentation behavior without executing a merge.
  await put(root, 'openspec/specs/identity/authentication/spec.md', auth.replace('Authenticate members.', 'Current specs have changed.'));
  await mkdir(path.join(root, 'openspec/changes/archive'), { recursive: true });
  const archived = 'openspec/changes/archive/2026-10-28-adjust-login';
  await rename(path.join(root, 'openspec/changes/adjust-login'), path.join(root, archived));
  const result = await freeze({ root, graphDir: `${archived}/graph` }); assert.equal(result.valid, true);
  const diagram = await readFile(path.join(root, archived, 'graph/flows/identity/authentication.md'), 'utf8');
  assert.match(diagram, /Historical proposed view/);
  assert.match(diagram, /\.\.\/\.\.\/\.\.\/specs\/identity\/authentication\/spec.md/);
  assert.equal((await freeze({ root, graphDir: `${archived}/graph` })).valid, true);
  await put(root, `${archived}/specs/identity/authentication/spec.md`, delta + '\nchanged');
  assert.equal((await check({ root, graphDir: `${archived}/graph` })).valid, false);
});

test('symlink output paths are rejected without writing outside the project', async t => {
  const root = await fixture(t);
  const outside = await mkdtemp(path.join(os.tmpdir(), 'opsx-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  try { await symlink(outside, path.join(root, 'openspec/graph'), 'dir'); }
  catch (error) { if (error.code === 'EPERM') { t.skip('Symlink privilege unavailable'); return; } throw error; }
  const packet = await snapshot({ root });
  await assert.rejects(render(packet, modelFor(packet)), /Symlink/);
  assert.deepEqual(await readdir(outside), []);
});

test('installer selects available original operations, preserves originals and supports safe updates', async t => {
  const root = await fixture(t);
  const original = '---\nname: openspec-propose\ndescription: Original workflow\n---\nOriginal instructions.\n';
  await put(root, '.agents/skills/openspec-propose/SKILL.md', original);
  const result = await install({ root });
  assert.deepEqual(result.available, ['opsx-chart-diagrams', 'opsx-chart-propose']);
  assert.equal(result.skipped.includes('continue'), true);
  assert.equal(await readFile(path.join(root, '.agents/skills/openspec-propose/SKILL.md'), 'utf8'), original);
  assert.deepEqual((await install({ root })).installed, []);
  const wrapper = path.join(root, '.agents/skills/opsx-chart-propose/SKILL.md');
  await writeFile(wrapper, (await readFile(wrapper, 'utf8')) + '\nLocal edit.\n');
  await assert.rejects(install({ root, update: true }), /Local edits/);
});

test('installer refuses a legacy wrapper and unknown/multiple targets before partial installation', async t => {
  const root = await fixture(t);
  await put(root, '.agents/skills/openspec-propose/SKILL.md', '---\nname: openspec-propose\n---\n');
  await put(root, '.agents/skills/opsx-chart-propose/SKILL.md', 'legacy graph editor workflow');
  await assert.rejects(install({ root }), /Existing skill/);
  assert.equal(await exists(path.join(root, '.agents/skills/opsx-chart-diagrams')), false);
  await put(root, '.claude/skills/openspec-propose/SKILL.md', '---\nname: openspec-propose\n---\n');
  await assert.rejects(install({ root }), /Multiple OpenSpec/);
  await assert.rejects(install({ root, target: 'unknown' }), /Unknown target/);
});

test('expanded installation follows the originals that are actually installed', async t => {
  const root = await fixture(t);
  for (const original of Object.values(workflows)) await put(root, `.claude/skills/${original}/SKILL.md`, `---\nname: ${original}\n---\nOriginal.\n`);
  const result = await install({ root, target: 'claude' });
  assert.equal(result.available.length, 13); assert.deepEqual(result.skipped, []);
  assert.equal(await exists(path.join(root, '.claude/skills/opsx-chart-continue/SKILL.md')), true);
  assert.equal(await readFile(path.join(root, 'openspec/config.yaml'), 'utf8'), 'schema: spec-driven\n');
});
