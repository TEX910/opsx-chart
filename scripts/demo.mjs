import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshot, render, check } from '../skills/opsx-chart-diagrams/scripts/chart.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../examples/demo-project');
// These are reviewed example summaries, not an automatic prose-to-behavior parser.
const summaries = {
  'Valid credentials': ['An active member supplies valid credentials', 'Start a session and request a sign-in notice'],
  'Invalid credentials': ['A member supplies invalid credentials', 'Deny access'],
  'Locked account': ['A locked member account attempts sign-in', 'Deny access, explain the lock, and request a security notice'],
  'Notice requested': ['A sign-in or security notice is requested for a member', 'Send that notice to the member'],
};
const quote = 'The system SHALL request sign-in notices from [notifications](../notifications/spec.md).';
for (const options of [{ root }, { root, changeDir: 'openspec/changes/adjust-login', specFiles: ['openspec/changes/adjust-login/specs/authentication/spec.md'] }]) {
  const packet = await snapshot(options);
  const model = { snapshot: packet.id, flows: packet.specs.map(spec => ({ capability: spec.capability,
    cases: spec.requirements.flatMap(requirement => requirement.scenarios.map(scenario => ({ requirement: requirement.name, scenario: scenario.name,
      when: summaries[scenario.name][0], then: summaries[scenario.name][1] }))) })),
    relations: [{ source: 'authentication', target: 'notifications', type: 'invokes', basis: 'explicit',
      evidence: { path: packet.scope === 'change' ? 'openspec/changes/adjust-login/specs/authentication/spec.md' : 'openspec/specs/authentication/spec.md', quote } }] };
  model.flows.find(flow => flow.capability === 'authentication').graphs = [{
    requirement: 'Sign in', title: 'Credential check',
    nodes: [
      { id: 'credentials', type: 'decision', label: 'Credentials valid?' },
      { id: 'session', type: 'outcome', label: summaries['Valid credentials'][1] },
      { id: 'denied', type: 'outcome', label: summaries['Invalid credentials'][1] },
    ],
    edges: [
      { id: 'valid', source: 'credentials', target: 'session', label: 'Yes · active member' },
      { id: 'invalid', source: 'credentials', target: 'denied', label: 'No' },
    ],
    paths: [
      { scenario: 'Valid credentials', edgeIds: ['valid'] },
      { scenario: 'Invalid credentials', edgeIds: ['invalid'] },
    ],
    ...(packet.scope === 'change' ? { note: 'The locked-account case can overlap invalid credentials. The spec does not establish priority, so that case is shown separately.' } : {}),
  }];
  await render(packet, model);
  const report = await check({ root, graphDir: packet.outputDir });
  if (!report.valid) throw new Error(report.problems.join('\n'));
  console.log(`${packet.scope}: ${path.join(report.graphDir, 'map.md')}`);
}
