// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Flow, Diagnostic } from '../src/shared/model.js';
import type { ProjectSnapshot } from '../src/server/openspec.js';

vi.mock('../src/client/MapView.js', () => ({ MapView: () => <div>Specification map</div> }));
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, children, onMoveEnd }: {
    nodes: { id: string; data: { label: string } }[];
    children: React.ReactNode;
    onMoveEnd?: (event: object, viewport: { x: number; y: number; zoom: number }) => void;
  }) => <div data-testid="graph">{nodes.map((node) => <span key={node.id}>{node.data.label}</span>)}
    <button onClick={() => onMoveEnd?.({ type: 'pointerup' }, { x: 10, y: 0, zoom: 1 })}>Pan graph locally</button>{children}</div>,
  Background: () => null, Controls: () => null, Handle: () => null, MiniMap: () => null,
  Position: { Left: 'left', Right: 'right' },
}));

import { App } from '../src/client/App.js';

const change = 'transazione-condivisa';
const capability = 'transazioni/registrazione';
const scenario = (index: number) => ({ name: `Path ${index}`, rawText: `- **WHEN** condition ${index}\n- **THEN** result ${index}`, fingerprint: `fingerprint-${index}` });
const snapshot = (count: number): ProjectSnapshot => ({
  root: '/tmp/budget', openSpecVersion: '1.14.0', current: [],
  proposed: [{ id: capability, scope: 'change', change, purpose: 'Record shared transactions', sourcePath: '/tmp/budget/spec.md',
    requirements: [{ name: 'Shared transaction', text: '', scenarios: Array.from({ length: count }, (_, index) => scenario(index + 1)) }] }],
  changes: [{ name: change, status: 'in-progress', completedTasks: 0, totalTasks: 1 }],
});
const pathRef = (index: number) => ({ capability, requirement: 'Shared transaction', scenario: `Path ${index}`, scope: 'change' as const, change });
const flow = (complete: boolean): Flow => ({
  version: 1, capability, id: 'main', name: 'Registration',
  nodes: [
    { id: 'event', type: 'event', label: 'Transaction requested', position: { x: 0, y: 0 } },
    { id: 'decision', type: 'decision', label: 'Check transaction', position: { x: 200, y: 0 },
      whens: Object.fromEntries(Array.from({ length: complete ? 4 : 1 }, (_, index) => [`branch-${index + 1}`, `condition ${index + 1}`])) },
    ...Array.from({ length: complete ? 4 : 1 }, (_, index) => ({ id: `outcome-${index + 1}`, type: 'outcome' as const,
      label: `Result ${index + 1}`, then: `result ${index + 1}`, position: { x: 400, y: index * 100 } })),
  ],
  edges: [{ id: 'start', source: 'event', target: 'decision' },
    ...Array.from({ length: complete ? 4 : 1 }, (_, index) => ({ id: `branch-${index + 1}`, source: 'decision', target: `outcome-${index + 1}` }))],
  cases: complete ? Array.from({ length: 4 }, (_, index) => ({ id: `case-${index + 1}`, name: `Path ${index + 1}`,
    edgeIds: ['start', `branch-${index + 1}`], scenario: pathRef(index + 1) }))
    : [{ id: 'case-1', name: 'Path 1', edgeIds: ['start'], scenario: pathRef(1) }],
});

type Disk = { project: ProjectSnapshot; flow: Flow; diagnostics: Diagnostic[]; delta: string };
const diskState = (complete: boolean): Disk => ({
  project: snapshot(complete ? 4 : 1), flow: flow(complete),
  diagnostics: complete ? [] : [{ severity: 'warning', code: 'case-no-outcome', message: 'Case does not end at an outcome' }],
  delta: complete ? 'Four reconciled scenarios' : 'Old scenario',
});

class MockEventSource {
  static current: MockEventSource;
  onmessage: (() => void) | null = null;
  constructor(_url: string) { MockEventSource.current = this; }
  emit() { this.onmessage?.(); }
  close() {}
}

let root: Root;
let container: HTMLDivElement;
let disk: Disk;
let flowGate: Promise<void> | null;

const text = () => container.textContent ?? '';
const button = (label: string) => [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
async function click(label: string) {
  const target = button(label);
  expect(target, `button ${label}`).toBeDefined();
  await act(async () => { target!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}
async function waitForText(value: string) {
  await vi.waitFor(() => expect(text()).toContain(value), { timeout: 4000 });
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('EventSource', MockEventSource);
  disk = diskState(false);
  flowGate = null;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = new URL(input, 'http://localhost');
    if (url.pathname === '/api/flow' && flowGate) await flowGate;
    const data = (() => {
      switch (url.pathname) {
        case '/api/project': case '/api/refresh': return disk.project;
        case '/api/flows': return [{ capability, id: 'main', name: 'Registration', scope: 'change', change }];
        case '/api/flow': return disk.flow;
        case '/api/delta': return { path: '/tmp/budget/spec.md', content: disk.delta };
        case '/api/diagnostics': return disk.diagnostics;
        case '/api/relations': return { version: 1, edges: [] };
        case '/api/suggestions': case '/api/pending': return [];
        case '/api/graph-workspace': return { path: '/tmp/budget/openspec/graph', initialized: true };
        case '/api/map-layout': return { version: 1, positions: {} };
        default: throw new Error(`Unexpected API request: ${url.pathname}`);
      }
    })();
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  }));
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(<App />); });
  await waitForText('case-no-outcome');
  expect((container.querySelector('.sidebar-footer select') as HTMLSelectElement).value).toBe(change);
  await click('Flow');
  await waitForText('Old scenario');
  await click('Collapse graph to edit');
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe('external OpenSpec refresh with a change open', () => {
  it('reloads the selected YAML flow, scenarios, paths, and diagnostics together', async () => {
    expect(text()).toContain('Paths awaiting reconciliation');
    expect(text()).toContain('case-no-outcome');
    disk = diskState(true);
    let releaseFlow!: () => void;
    flowGate = new Promise<void>((resolve) => { releaseFlow = resolve; });
    await act(async () => { MockEventSource.current.emit(); await new Promise((resolve) => setTimeout(resolve, 600)); });
    expect(text()).toContain('Loading flow…');
    expect(text()).not.toContain('No flow yet');
    await act(async () => { releaseFlow(); });
    await waitForText('Four reconciled scenarios');
    await click('Collapse graph to edit');
    expect(text()).toContain('Path 4');
    expect(text()).toContain('Result 4');
    expect(text()).toContain('Every complete graph path is linked to a spec scenario.');
    expect(text()).not.toContain('Paths awaiting reconciliation');
    expect(text()).not.toContain('case-no-outcome');
    expect(text()).not.toContain('No flow yet');
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.some(([url]) => String(url).includes('/api/flow?'))).toBe(true);
  });

  it('preserves unsaved edits until the user explicitly loads the disk version', async () => {
    await click('Pan graph locally');
    expect(button('Save flow')?.hasAttribute('disabled')).toBe(false);
    disk = diskState(true);
    await act(async () => { MockEventSource.current.emit(); await new Promise((resolve) => setTimeout(resolve, 600)); });
    await waitForText('Load version on disk');
    expect(text()).toContain('Paths awaiting reconciliation');
    expect(text()).toContain('Old scenario');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await click('Load version on disk');
    await waitForText('Four reconciled scenarios');
    expect(text()).not.toContain('Paths awaiting reconciliation');
    expect(text()).not.toContain('case-no-outcome');
  });
});
