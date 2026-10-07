import { z } from 'zod';

const identifier = z.string().min(1);
const capabilityPath = z.string().min(1).regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/);
const position = z.object({ x: z.number().finite(), y: z.number().finite() });

export const RelationType = z.enum(['depends-on', 'invokes', 'emits-to', 'shares-data-with']);
export const RelationSchema = z.object({
  id: identifier,
  type: RelationType,
  source: capabilityPath,
  target: capabilityPath,
});
export const RelationsSchema = z.object({
  version: z.literal(1),
  baseDigest: z.string().nullable().optional(),
  edges: z.array(RelationSchema),
});

export const ScenarioRefSchema = z.object({
  capability: capabilityPath,
  requirement: identifier,
  scenario: identifier,
  scope: z.enum(['current', 'change']),
  change: identifier.optional(),
  fingerprint: z.string().optional(),
});
export const FlowSchema = z.object({
  version: z.literal(1),
  baseDigest: z.string().nullable().optional(),
  deleted: z.boolean().optional(),
  capability: capabilityPath,
  id: identifier.regex(/^[a-z0-9-]+$/),
  name: identifier,
  nodes: z.array(z.object({
    id: identifier,
    type: z.enum(['event', 'action', 'decision', 'outcome']),
    label: z.string(),
    position,
    whens: z.record(identifier, z.string()).optional(),
    then: z.string().optional(),
  })),
  edges: z.array(z.object({
    id: identifier,
    source: identifier,
    target: identifier,
    label: z.string().optional(),
  })),
  cases: z.array(z.object({
    id: identifier,
    name: identifier,
    edgeIds: z.array(identifier),
    scenario: ScenarioRefSchema,
    pendingSpec: z.boolean().optional(),
  })),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number().positive() }).optional(),
});

export type Relation = z.infer<typeof RelationSchema>;
export type Relations = z.infer<typeof RelationsSchema>;
export type ScenarioRef = z.infer<typeof ScenarioRefSchema>;
export type Flow = z.infer<typeof FlowSchema>;
export type FlowNode = Flow['nodes'][number];
export type FlowEdge = Flow['edges'][number];
export type FlowCase = Flow['cases'][number];

export function pathBehavior(flow: Flow, edgeIds: string[]): { whens: string[]; then: string | null; complete: boolean } {
  const nodes = new Map(flow.nodes.map((node) => [node.id, node]));
  const edges = new Map(flow.edges.map((edge) => [edge.id, edge]));
  const whens: string[] = [];
  let missingWhen = false;
  let lastTarget: string | undefined;
  for (const edgeId of edgeIds) {
    const edge = edges.get(edgeId);
    if (!edge || (lastTarget && edge.source !== lastTarget)) return { whens, then: null, complete: false };
    const source = nodes.get(edge.source);
    if (source?.type === 'decision') {
      const when = source.whens?.[edge.id]?.trim();
      if (when) whens.push(when);
      else missingWhen = true;
    }
    lastTarget = edge.target;
  }
  const outcome = lastTarget ? nodes.get(lastTarget) : undefined;
  const then = outcome?.type === 'outcome' ? outcome.then?.trim() || null : null;
  return { whens, then, complete: !missingWhen && whens.length > 0 && !!then };
}

export type Diagnostic = {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  target?: string;
  candidate?: ScenarioRef;
};

export type ScenarioLookup = (ref: ScenarioRef) => {
  exists: boolean;
  fingerprint?: string;
  candidate?: ScenarioRef;
};

export const emptyRelations = (): Relations => ({ version: 1, edges: [] });
export const emptyFlow = (capability: string, id: string, name = id): Flow => ({
  version: 1, capability, id, name, nodes: [], edges: [], cases: [],
});

export function semanticFlow(flow: Flow): unknown {
  return {
    deleted: flow.deleted ?? false,
    capability: flow.capability,
    id: flow.id,
    nodes: flow.nodes.map(({ id, type, label, whens, then }) => ({ id, type, label, whens, then })),
    edges: flow.edges,
    cases: flow.cases,
  };
}

export function isLayoutOnly(previous: Flow, next: Flow): boolean {
  return JSON.stringify(semanticFlow(previous)) === JSON.stringify(semanticFlow(next));
}

export function validateRelations(relations: Relations, capabilities: Iterable<string>): Diagnostic[] {
  const known = new Set(capabilities);
  const diagnostics: Diagnostic[] = [];
  const ids = new Set<string>();
  for (const edge of relations.edges) {
    if (ids.has(edge.id)) diagnostics.push({ severity: 'error', code: 'duplicate-edge', message: `Duplicate relationship ID: ${edge.id}`, target: edge.id });
    ids.add(edge.id);
    if (!known.has(edge.source)) diagnostics.push({ severity: 'error', code: 'missing-source', message: `Missing capability: ${edge.source}`, target: edge.id });
    if (!known.has(edge.target)) diagnostics.push({ severity: 'error', code: 'missing-target', message: `Missing capability: ${edge.target}`, target: edge.id });
    if (edge.source === edge.target) diagnostics.push({ severity: 'error', code: 'self-relation', message: `A capability cannot relate to itself: ${edge.source}`, target: edge.id });
  }
  const adjacency = new Map<string, string[]>();
  for (const edge of relations.edges.filter((item) => item.type === 'depends-on')) {
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const reported = new Set<string>();
  function visit(node: string, stack: string[]): void {
    if (visiting.has(node)) {
      const cycle = [...stack.slice(stack.indexOf(node)), node].join(' → ');
      if (!reported.has(cycle)) diagnostics.push({ severity: 'error', code: 'dependency-cycle', message: `Dependency cycle: ${cycle}` });
      reported.add(cycle);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of adjacency.get(node) ?? []) visit(next, [...stack, node]);
    visiting.delete(node);
    visited.add(node);
  }
  for (const node of adjacency.keys()) visit(node, []);
  return diagnostics;
}

export function validateFlow(flow: Flow, lookup?: ScenarioLookup): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (flow.deleted) return diagnostics;
  const nodes = new Map(flow.nodes.map((node) => [node.id, node]));
  const edges = new Map(flow.edges.map((edge) => [edge.id, edge]));
  for (const [kind, values] of [['node', flow.nodes], ['edge', flow.edges], ['case', flow.cases]] as const) {
    const ids = new Set<string>();
    for (const value of values) {
      if (ids.has(value.id)) diagnostics.push({ severity: 'error', code: 'duplicate-id', message: `Duplicate ${kind} ID: ${value.id}`, target: value.id });
      ids.add(value.id);
    }
  }
  for (const edge of flow.edges) {
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) diagnostics.push({ severity: 'error', code: 'missing-node', message: `Edge ${edge.id} has a missing endpoint`, target: edge.id });
    if (nodes.get(edge.source)?.type === 'decision' && !edge.label?.trim()) diagnostics.push({ severity: 'error', code: 'unlabeled-branch', message: `Decision branch ${edge.id} needs a label`, target: edge.id });
  }
  for (const node of flow.nodes) {
    if (node.type === 'decision') for (const edge of flow.edges.filter((item) => item.source === node.id)) {
      if (!node.whens?.[edge.id]?.trim()) diagnostics.push({ severity: 'warning', code: 'missing-when', message: `Decision branch ${edge.id} needs a WHEN description`, target: node.id });
    }
    if (node.type === 'outcome' && !node.then?.trim()) diagnostics.push({ severity: 'warning', code: 'missing-then', message: `Outcome ${node.id} needs a THEN description`, target: node.id });
  }
  const incoming = new Map(flow.nodes.map((node) => [node.id, 0]));
  for (const edge of flow.edges) incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  const starts = flow.nodes.filter((node) => node.type === 'event' && (incoming.get(node.id) ?? 0) === 0);
  if (flow.nodes.length && starts.length === 0) diagnostics.push({ severity: 'warning', code: 'no-start', message: 'Flow has no reachable starting event' });
  if (flow.nodes.length && !flow.nodes.some((node) => node.type === 'outcome')) diagnostics.push({ severity: 'warning', code: 'no-outcome', message: 'Flow has no outcome node' });
  const reachable = new Set<string>();
  const queue = starts.map((node) => node.id);
  while (queue.length) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const edge of flow.edges) if (edge.source === id) queue.push(edge.target);
  }
  for (const node of flow.nodes) {
    if (!reachable.has(node.id)) diagnostics.push({ severity: 'warning', code: 'unreachable-node', message: `Node ${node.id} is unreachable`, target: node.id });
  }
  for (const graphCase of flow.cases) {
    if (graphCase.scenario.capability !== flow.capability) diagnostics.push({ severity: 'error', code: 'cross-capability-scenario', message: `Case ${graphCase.id} points outside ${flow.capability}`, target: graphCase.id });
    if (graphCase.edgeIds.length === 0) diagnostics.push({ severity: 'warning', code: 'empty-case', message: `Case ${graphCase.id} has no path`, target: graphCase.id });
    let lastTarget: string | undefined;
    const firstEdge = edges.get(graphCase.edgeIds[0]);
    if (firstEdge && nodes.get(firstEdge.source)?.type !== 'event') diagnostics.push({ severity: 'warning', code: 'case-no-event', message: `Case ${graphCase.id} does not start at an event`, target: graphCase.id });
    for (const edgeId of graphCase.edgeIds) {
      const edge = edges.get(edgeId);
      if (!edge) diagnostics.push({ severity: 'error', code: 'missing-case-edge', message: `Case ${graphCase.id} refers to missing edge ${edgeId}`, target: graphCase.id });
      else {
        if (lastTarget && edge.source !== lastTarget) diagnostics.push({ severity: 'error', code: 'disconnected-case', message: `Case ${graphCase.id} has disconnected edges`, target: graphCase.id });
        lastTarget = edge.target;
      }
    }
    if (lastTarget && nodes.get(lastTarget)?.type !== 'outcome') diagnostics.push({ severity: 'warning', code: 'case-no-outcome', message: `Case ${graphCase.id} does not end at an outcome`, target: graphCase.id });
    if (lookup) {
      const resolved = lookup(graphCase.scenario);
      if (!resolved.exists) diagnostics.push({ severity: graphCase.pendingSpec && graphCase.scenario.scope === 'change' ? 'warning' : 'error', code: graphCase.pendingSpec && graphCase.scenario.scope === 'change' ? 'scenario-awaiting-sync' : 'missing-scenario', message: `Scenario not found: ${graphCase.scenario.requirement} / ${graphCase.scenario.scenario}`, target: graphCase.id, candidate: resolved.candidate });
      else if (graphCase.scenario.fingerprint && resolved.fingerprint !== graphCase.scenario.fingerprint) diagnostics.push({ severity: 'warning', code: 'stale-scenario', message: `Scenario text changed: ${graphCase.scenario.requirement} / ${graphCase.scenario.scenario}`, target: graphCase.id });
    }
  }
  return diagnostics;
}
