import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ReactFlow, Background, Controls, Handle, MiniMap, Position, type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import { pathBehavior, type Flow, type FlowCase, type FlowNode, type ScenarioRef } from '../shared/model.js';
import type { ProjectSnapshot } from '../server/openspec.js';

type Props = {
  flow: Flow;
  project: ProjectSnapshot;
  change: string;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  selectedCase: string | null;
  onSelectCase: (id: string | null) => void;
  onChange: (flow: Flow) => void;
};

const nodeColors: Record<FlowNode['type'], string> = {
  event: '#6e9b8b', action: '#4f91a1', decision: '#d59b56', outcome: '#987cab',
};

const nodeTypeHelp: Record<FlowNode['type'], string> = {
  event: 'Starting point: something begins the flow.',
  action: 'An operation performed during the flow.',
  decision: 'Branching point: describe the WHEN for each outgoing branch.',
  outcome: 'Final outcome: describe the THEN here.',
};

function BehaviorNode({ data, selected }: NodeProps<Node<{ label: string; kind: FlowNode['type'] }>>) {
  return <div className={`behavior-node ${selected ? 'selected' : ''}`} style={{ '--node-accent': nodeColors[data.kind] } as CSSProperties}>
    <Handle type="target" position={Position.Left} />
    <span>{data.kind}</span>
    <strong>{data.label || 'Untitled'}</strong>
    <Handle type="source" position={Position.Right} />
  </div>;
}

const nodeTypes = { behavior: BehaviorNode };

export function FlowEditor({ flow, project, change, dirty, saving, onSave, selectedCase, onSelectCase, onChange }: Props) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [newType, setNewType] = useState<FlowNode['type']>('action');
  const [newLabel, setNewLabel] = useState('');
  const [caseName, setCaseName] = useState('');
  const [caseRequirement, setCaseRequirement] = useState('');
  const [caseEdges, setCaseEdges] = useState<string[]>([]);
  const [edgeToAppend, setEdgeToAppend] = useState('');
  const [connectionTarget, setConnectionTarget] = useState('');
  const [graphCollapsed, setGraphCollapsed] = useState(false);
  const flowInstance = useRef<ReactFlowInstance | null>(null);
  const graphRef = useRef<HTMLDivElement | null>(null);
  const graphToggleRef = useRef<HTMLDivElement | null>(null);
  const previousGraphCollapsed = useRef(graphCollapsed);

  const scenarios = useMemo(() => [...project.current, ...project.proposed.filter((item) => item.change === change)]
    .filter((item) => item.id === flow.capability)
    .flatMap((item) => item.requirements.flatMap((requirement) => requirement.scenarios.map((scenario) => ({
      label: `${item.scope === 'change' ? 'Proposed' : 'Current'} · ${requirement.name} / ${scenario.name}`,
      ref: { capability: item.id, requirement: requirement.name, scenario: scenario.name,
        scope: item.scope, change: item.change, fingerprint: scenario.fingerprint } as ScenarioRef,
      rawText: scenario.rawText,
    })))), [project, flow.capability, change]);
  const requirementNames = [...new Set([...project.current, ...project.proposed.filter((item) => item.change === change)]
    .filter((item) => item.id === flow.capability).flatMap((item) => item.requirements.map((requirement) => requirement.name)))];
  const selectedRequirement = requirementNames.includes(caseRequirement) ? caseRequirement : requirementNames[0] ?? '';

  useEffect(() => { setConnectionTarget(''); }, [selectedNode]);

  useEffect(() => {
    if (previousGraphCollapsed.current === graphCollapsed) return;
    previousGraphCollapsed.current = graphCollapsed;
    (graphCollapsed ? graphToggleRef.current : graphRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [graphCollapsed]);

  const activeCase = flow.cases.find((item) => item.id === selectedCase);
  const activeScenario = activeCase && scenarios.find((item) => item.ref.requirement === activeCase.scenario.requirement &&
    item.ref.scenario === activeCase.scenario.scenario && item.ref.scope === activeCase.scenario.scope &&
    item.ref.change === activeCase.scenario.change);
  const activePath = new Set(activeCase?.edgeIds ?? []);
  const nodeName = (id: string) => flow.nodes.find((item) => item.id === id)?.label || id;
  const edgeName = (edge: Flow['edges'][number]) => `${nodeName(edge.source)} → ${nodeName(edge.target)}${edge.label ? ` · ${edge.label}` : ''}`;
  const activeBehavior = activeCase ? pathBehavior(flow, activeCase.edgeIds) : null;
  const draftBehavior = pathBehavior(flow, caseEdges);
  const linkedScenario = (item: FlowCase) => scenarios.find((scenario) => scenario.ref.requirement === item.scenario.requirement &&
    scenario.ref.scenario === item.scenario.scenario && scenario.ref.scope === item.scenario.scope && scenario.ref.change === item.scenario.change);
  const scenarioStatements = (rawText: string) => [...rawText.matchAll(/^\s*-\s*\*\*(WHEN|AND|THEN)\*\*\s*(.+)$/gm)]
    .map((match) => ({ keyword: match[1], text: match[2].trim() }));
  const linkedWhens = (edgeId: string) => flow.cases.flatMap((item) => {
    if (!item.edgeIds.includes(edgeId)) return [];
    const linked = linkedScenario(item);
    if (!linked) return [];
    const decisionEdges = item.edgeIds.filter((id) => flow.edges.some((edge) => edge.id === id && flow.nodes.some((node) => node.id === edge.source && node.type === 'decision')));
    const index = decisionEdges.indexOf(edgeId);
    const conditions = scenarioStatements(linked.rawText).filter((statement) => statement.keyword === 'WHEN' || statement.keyword === 'AND');
    return index < 0 ? [] : [{ caseName: item.name, text: conditions[index]?.text ?? null, rawText: linked.rawText }];
  });
  const linkedThens = (nodeId: string) => flow.cases.flatMap((item) => {
    const lastEdge = flow.edges.find((edge) => edge.id === item.edgeIds.at(-1));
    if (lastEdge?.target !== nodeId) return [];
    const linked = linkedScenario(item);
    if (!linked) return [];
    const result = scenarioStatements(linked.rawText).find((statement) => statement.keyword === 'THEN');
    return [{ caseName: item.name, text: result?.text ?? null, rawText: linked.rawText }];
  });
  const caseRoute = (item: FlowCase) => {
    const routeEdges = item.edgeIds.map((id) => flow.edges.find((edge) => edge.id === id));
    if (!routeEdges.length || routeEdges.some((edge) => !edge)) return 'Incomplete path';
    return nodeName(routeEdges[0]!.source) + routeEdges.map((edge) => `${edge!.label ? ` —${edge!.label}→ ` : ' → '}${nodeName(edge!.target)}`).join('');
  };
  const pathEdges = caseEdges.map((id) => flow.edges.find((item) => item.id === id));
  const pathConnected = pathEdges.every((edge, index) => edge && (index === 0 || pathEdges[index - 1]?.target === edge.source));
  const firstPathEdge = pathEdges[0];
  const lastPathEdge = pathEdges.at(-1);
  const pathStartsAtEvent = !!firstPathEdge && flow.nodes.some((item) => item.id === firstPathEdge.source && item.type === 'event');
  const pathEndsAtOutcome = !!lastPathEdge && flow.nodes.some((item) => item.id === lastPathEdge.target && item.type === 'outcome');
  const nextPathEdges = flow.edges.filter((item) => !caseEdges.includes(item.id) && !pathEndsAtOutcome &&
    (caseEdges.length ? item.source === lastPathEdge?.target : flow.nodes.some((node) => node.id === item.source && node.type === 'event')));
  const canAppendEdge = nextPathEdges.some((item) => item.id === edgeToAppend);
  const canAddCase = !!change && !!selectedRequirement && !!caseName.trim() && !!caseEdges.length && pathConnected && pathStartsAtEvent && pathEndsAtOutcome && draftBehavior.complete;
  const nodes: Node[] = flow.nodes.map((item) => ({ id: item.id, type: 'behavior', position: item.position,
    initialWidth: 150, initialHeight: 65,
    data: { label: item.label, kind: item.type }, selected: item.id === selectedNode }));
  const edges: Edge[] = flow.edges.map((item) => ({ id: item.id, source: item.source, target: item.target,
    label: item.label || undefined, selected: item.id === selectedEdge,
    style: { stroke: activePath.has(item.id) ? '#d56540' : '#567986', strokeWidth: activePath.has(item.id) ? 3 : 2 },
    labelStyle: { fill: '#435f68', fontSize: 12 },
  }));

  function changeNodes(changes: NodeChange[]): void {
    const relevant = changes.filter((item) => item.type === 'position' || item.type === 'remove');
    if (!relevant.length) return;
    let next = [...flow.nodes];
    for (const item of relevant) {
      if (item.type === 'position' && item.position) next = next.map((node) => node.id === item.id ? { ...node, position: item.position! } : node);
      if (item.type === 'remove') next = next.filter((node) => node.id !== item.id);
    }
    const ids = new Set(next.map((item) => item.id));
    const remainingEdges = flow.edges.filter((item) => ids.has(item.source) && ids.has(item.target));
    const edgeIds = new Set(remainingEdges.map((item) => item.id));
    setCaseEdges((current) => current.filter((id) => edgeIds.has(id)));
    onChange({ ...flow, nodes: next.map((node) => node.whens ? { ...node, whens: Object.fromEntries(Object.entries(node.whens).filter(([id]) => edgeIds.has(id))) } : node),
      edges: remainingEdges, cases: flow.cases.map((item) => ({ ...item, edgeIds: item.edgeIds.filter((id) => edgeIds.has(id)) })) });
  }

  function changeEdges(changes: EdgeChange[]): void {
    const removed = new Set(changes.filter((item) => item.type === 'remove').map((item) => item.id));
    if (!removed.size) return;
    setCaseEdges((current) => current.filter((id) => !removed.has(id)));
    onChange({ ...flow, nodes: flow.nodes.map((node) => node.whens ? { ...node, whens: Object.fromEntries(Object.entries(node.whens).filter(([id]) => !removed.has(id))) } : node),
      edges: flow.edges.filter((item) => !removed.has(item.id)),
      cases: flow.cases.map((item) => ({ ...item, edgeIds: item.edgeIds.filter((id) => !removed.has(id)) })) });
  }

  function connectNodes(source: string, target: string): void {
    if (source === target) return;
    const id = crypto.randomUUID();
    onChange({ ...flow, edges: [...flow.edges, { id, source, target }] });
    setSelectedNode(null);
    setSelectedEdge(id);
    setConnectionTarget('');
  }

  function connect(connection: Connection): void {
    if (connection.source && connection.target) connectNodes(connection.source, connection.target);
  }

  function addNode(): void {
    const label = newLabel.trim();
    if (!label) return;
    const id = crypto.randomUUID();
    const anchor = flow.nodes.find((item) => item.id === selectedNode);
    const position = { x: anchor ? anchor.position.x + 250 : Math.max(80, ...flow.nodes.map((item) => item.position.x + 250)), y: anchor?.position.y ?? 100 };
    onChange({ ...flow, nodes: [...flow.nodes, { id, type: newType, label, position }] });
    setNewLabel('');
    setSelectedNode(id);
    if (graphCollapsed) return;
    requestAnimationFrame(() => {
      const instance = flowInstance.current;
      if (instance) void instance.setCenter(position.x + 80, position.y + 35, { zoom: Math.min(instance.getZoom(), 1), duration: 250 });
    });
  }

  function addCase(): void {
    if (!canAddCase) return;
    const name = caseName.trim();
    const existing = scenarios.find((item) => item.ref.requirement === selectedRequirement && item.ref.scenario === name && item.ref.scope === 'change')
      ?? scenarios.find((item) => item.ref.requirement === selectedRequirement && item.ref.scenario === name && item.ref.scope === 'current');
    const scenario: ScenarioRef = existing?.ref ?? { capability: flow.capability, requirement: selectedRequirement, scenario: name, scope: 'change', change };
    const id = crypto.randomUUID();
    onChange({ ...flow, cases: [...flow.cases, { id, name, edgeIds: caseEdges, scenario, pendingSpec: !existing }] });
    onSelectCase(id);
    setCaseName(''); setCaseEdges([]); setEdgeToAppend('');
  }

  function updateWhen(nodeId: string, edgeId: string, value: string): void {
    onChange({ ...flow, nodes: flow.nodes.map((node) => node.id === nodeId ? { ...node, whens: { ...node.whens, [edgeId]: value } } : node) });
  }

  function updateThen(nodeId: string, value: string): void {
    onChange({ ...flow, nodes: flow.nodes.map((node) => node.id === nodeId ? { ...node, then: value } : node) });
  }

  const selectedNodeValue = flow.nodes.find((item) => item.id === selectedNode);
  const selectedEdgeValue = flow.edges.find((item) => item.id === selectedEdge);
  const outgoingEdges = selectedNodeValue ? flow.edges.filter((item) => item.source === selectedNodeValue.id) : [];
  const selectedSummary = selectedNodeValue ? `Node: ${selectedNodeValue.label}` : selectedEdgeValue
    ? `Connection: ${nodeName(selectedEdgeValue.source)} → ${nodeName(selectedEdgeValue.target)}`
    : 'Select a node or connection in the graph.';

  return <div className="flow-editor">
    <div className="flow-toolbar">
      <label>Flow name <input value={flow.name} onChange={(event) => onChange({ ...flow, name: event.target.value })} /></label>
      <label className="new-node-type">New node type <select value={newType} onChange={(event) => setNewType(event.target.value as FlowNode['type'])}>
        <option value="event">Event</option><option value="action">Action</option><option value="decision">Decision</option><option value="outcome">Outcome</option>
      </select></label>
      <label className="new-node-name">New node name <input placeholder="E.g. Check credentials" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addNode(); }} /></label>
      <button onClick={addNode} disabled={!newLabel.trim()}>Add node</button>
    </div>
    {flow.deleted ? <div className="banner warning">This flow is marked for deletion in the selected change.</div> : null}
    <div ref={graphRef} className={`canvas flow-canvas ${graphCollapsed ? 'collapsed' : ''}`} aria-hidden={graphCollapsed}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onInit={(instance) => { flowInstance.current = instance; }} onNodesChange={changeNodes} onEdgesChange={changeEdges}
        onConnect={connect} onNodeClick={(_event, node) => { setSelectedNode(node.id); setSelectedEdge(null); }}
        onEdgeClick={(_event, edge) => { setSelectedEdge(edge.id); setSelectedNode(null); }}
        onMoveEnd={(_event, viewport) => onChange({ ...flow, viewport })}
        defaultViewport={flow.viewport} fitView={!flow.viewport} fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }} proOptions={{ hideAttribution: true }}>
        <Background color="#d5dee0" gap={22} size={1} /><Controls /><MiniMap pannable zoomable nodeColor={(node) => nodeColors[(node.data as { kind: FlowNode['type'] }).kind]} />
      </ReactFlow>
    </div>
    <div ref={graphToggleRef} className={`flow-editor-summary ${graphCollapsed ? 'editing' : ''}`}>
      <div className="flow-selection-summary"><strong>Selected element</strong><span>{selectedSummary}</span></div>
      <div className="flow-editor-actions">
        {graphCollapsed ? <button onClick={onSave} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save flow'}</button> : null}
        <button className="quiet" aria-expanded={graphCollapsed} aria-controls="flow-forms" onClick={() => setGraphCollapsed((value) => !value)}>{graphCollapsed ? 'Show graph' : 'Collapse graph to edit'}</button>
      </div>
    </div>
    {graphCollapsed ? <div id="flow-forms" className="flow-bottom flow-forms">
      <div className="flow-form-intro">
        <h2>Edit the flow</h2>
        <p>Edit nodes, connect steps, and describe cases. Their WHEN and THEN statements will be reconciled with the OpenSpec spec.</p>
        <p className="flow-form-context">{change ? <>Active change: <strong>{change}</strong>. Edits will be saved as a draft in this change.</> : 'Select an active change in the Project sidebar to save behavior edits.'}</p>
      </div>
      <section>
        <div className="flow-section-heading"><span className="flow-step-number">1</span><div><h3>Edit the selected element</h3><p>Select a node or connection in the graph, then edit its details here.</p></div></div>
        {selectedNodeValue ? <>
          <div className="flow-form-card">
            <span className="flow-form-kicker">SELECTED NODE</span>
            <h4>{selectedNodeValue.label || 'Untitled'}</h4>
            <div className="flow-field-grid">
              <label>Step name <input value={selectedNodeValue.label} onChange={(event) => onChange({ ...flow, nodes: flow.nodes.map((item) => item.id === selectedNode ? { ...item, label: event.target.value } : item) })} /></label>
              <label>Step type <select value={selectedNodeValue.type} onChange={(event) => onChange({ ...flow, nodes: flow.nodes.map((item) => item.id === selectedNode ? { ...item, type: event.target.value as FlowNode['type'], whens: event.target.value === 'decision' ? item.whens : undefined, then: event.target.value === 'outcome' ? item.then : undefined } : item) })}>
                <option value="event">Event · start</option><option value="action">Action · operation</option><option value="decision">Decision · branch</option><option value="outcome">Outcome · result</option>
              </select></label>
            </div>
            <p className="flow-field-help">{nodeTypeHelp[selectedNodeValue.type]}</p>
            {selectedNodeValue.type === 'decision' ? <div className="flow-node-behavior"><h5>WHEN for each branch</h5>
              {outgoingEdges.length ? outgoingEdges.map((edge) => <div key={edge.id}><label>Branch “{edge.label || nodeName(edge.target)}” → {nodeName(edge.target)}
                <textarea rows={2} placeholder="E.g. a member submits valid credentials" value={selectedNodeValue.whens?.[edge.id] ?? ''} onChange={(event) => updateWhen(selectedNodeValue.id, edge.id, event.target.value)} />
              </label>
                {!selectedNodeValue.whens?.[edge.id]?.trim() && linkedWhens(edge.id).length ? <div className="flow-linked-source"><strong>Text already in OpenSpec</strong>
                  {linkedWhens(edge.id).map((hint, index) => <div key={`${hint.caseName}-${index}`}><small>{hint.caseName}: {hint.text ?? hint.rawText.replaceAll('**', '')}</small>
                    {hint.text ? <button type="button" className="quiet" onClick={() => updateWhen(selectedNodeValue.id, edge.id, hint.text!)}>Use this WHEN</button> : null}
                  </div>)}
                </div> : null}
              </div>) : <p className="flow-field-help">Create an outgoing connection to define its WHEN.</p>}
            </div> : null}
            {selectedNodeValue.type === 'outcome' ? <div className="flow-node-behavior"><label>THEN for this outcome
              <textarea rows={2} placeholder="E.g. the system starts a session" value={selectedNodeValue.then ?? ''} onChange={(event) => updateThen(selectedNodeValue.id, event.target.value)} />
            </label>
              {!selectedNodeValue.then?.trim() && linkedThens(selectedNodeValue.id).length ? <div className="flow-linked-source"><strong>Text already in OpenSpec</strong>
                {linkedThens(selectedNodeValue.id).map((hint, index) => <div key={`${hint.caseName}-${index}`}><small>{hint.caseName}: {hint.text ?? hint.rawText.replaceAll('**', '')}</small>
                  {hint.text ? <button type="button" className="quiet" onClick={() => updateThen(selectedNodeValue.id, hint.text!)}>Use this THEN</button> : null}
                </div>)}
              </div> : null}
            </div> : null}
          </div>
          <div className="flow-form-card">
            <h4>Connect this node to the next one</h4>
            <p>Direct outgoing connections from <strong>{selectedNodeValue.label || 'this node'}</strong>:</p>
            {outgoingEdges.length ? <ul className="flow-existing-connections">{outgoingEdges.map((edge) => <li key={edge.id}>
              <div><strong>→ {nodeName(edge.target)}</strong>{edge.label ? <small>Branch: {edge.label}</small> : null}</div>
              <button className="quiet" onClick={() => { setSelectedEdge(edge.id); setSelectedNode(null); }}>Edit connection</button>
            </li>)}</ul> : <p className="flow-field-help">This node has no outgoing connections yet.</p>}
            <div className="flow-connect-row"><label>{outgoingEdges.length ? 'Add another connection to' : 'Connect to node'} <select value={connectionTarget} onChange={(event) => setConnectionTarget(event.target.value)}><option value="">Choose the next node…</option>{flow.nodes.filter((item) => item.id !== selectedNode && !flow.edges.some((edge) => edge.source === selectedNode && edge.target === item.id)).map((item) => <option key={item.id} value={item.id}>{item.label || item.id}</option>)}</select></label>
              <button disabled={!connectionTarget} onClick={() => { if (selectedNode && connectionTarget) connectNodes(selectedNode, connectionTarget); }}>Create connection</button></div>
            {flow.nodes.length < 2 ? <p className="flow-field-help">Add another node using the control above the graph first.</p> : null}
          </div>
          <div className="flow-remove-row"><button className="quiet danger" onClick={() => { if (selectedNode) changeNodes([{ type: 'remove', id: selectedNode }]); setSelectedNode(null); }}>Remove node</button><small>This also removes its connections from paths.</small></div>
        </> : selectedEdgeValue ? <>
          <div className="flow-form-card">
            <span className="flow-form-kicker">SELECTED CONNECTION</span>
            <h4>{edgeName(selectedEdgeValue)}</h4>
            <label>{flow.nodes.find((item) => item.id === selectedEdgeValue.source)?.type === 'decision' ? 'Branch name' : 'Connection label (optional)'} <input value={selectedEdgeValue.label ?? ''} placeholder="E.g. Valid, Invalid" onChange={(event) => onChange({ ...flow, edges: flow.edges.map((item) => item.id === selectedEdge ? { ...item, label: event.target.value } : item) })} /></label>
            {flow.nodes.find((item) => item.id === selectedEdgeValue.source)?.type === 'decision' ? <p className="flow-field-help">This connection leaves a decision: name the branch to distinguish the alternatives.</p> : null}
            <button className="quiet flow-back-to-node" onClick={() => { setSelectedNode(selectedEdgeValue.source); setSelectedEdge(null); }}>Back to node “{nodeName(selectedEdgeValue.source)}”</button>
          </div>
          <div className="flow-remove-row"><button className="quiet danger" onClick={() => { if (selectedEdge) changeEdges([{ type: 'remove', id: selectedEdge }]); setSelectedEdge(null); }}>Remove connection</button><small>This also removes it from paths that contain it.</small></div>
        </> : <div className="flow-form-empty"><p>No element selected. Show the graph and click a node or connection to edit it.</p><button className="quiet" onClick={() => setGraphCollapsed(false)}>Show graph</button></div>}
      </section>
      <section>
        <div className="flow-section-heading"><span className="flow-step-number">2</span><div><h3>Define cases</h3><p>Each case follows a sequence of connections from the starting event to an outcome.</p></div></div>
        <div className="flow-form-card">
          <h4>Flow cases</h4>
          <p>Each case uses the WHEN statements on the decision branches it crosses and the THEN on its outcome node. A skill reconciles them with the OpenSpec spec.</p>
          {flow.cases.length ? <div className="case-list">{flow.cases.map((item) => <button key={item.id} className={`case-item ${selectedCase === item.id ? 'active' : ''}`} onClick={() => onSelectCase(item.id)}>
            <strong>{item.name}</strong><small>{item.scenario.requirement} / {item.scenario.scenario}{item.pendingSpec ? ' · pending reconciliation' : ''}</small><span className="case-route">{caseRoute(item)}</span>
          </button>)}</div> : <p className="flow-field-help">No cases defined.</p>}
          {activeCase ? <div className="flow-active-case"><p><strong>OpenSpec destination:</strong> {activeCase.scenario.requirement} / {activeCase.scenario.scenario}</p>
            <ol className="flow-path-list">{activeCase.edgeIds.map((id, index) => { const edge = flow.edges.find((item) => item.id === id); return <li key={`${id}-${index}`}>{edge ? edgeName(edge) : 'Connection no longer exists'}</li>; })}</ol>
            {activeBehavior ? <div className="flow-scenario-preview"><strong>Node WHEN / THEN</strong><ul className="flow-behavior-steps">{activeBehavior.whens.map((when, index) => <li key={index}><b>{index ? 'AND' : 'WHEN'}</b><span>{when}</span></li>)}{activeBehavior.then ? <li><b>THEN</b><span>{activeBehavior.then}</span></li> : null}</ul></div> : null}
            {activeScenario ? <div className="flow-scenario-preview"><strong>OpenSpec scenario text</strong><pre>{activeScenario.rawText.replaceAll('**', '')}</pre></div> : null}
            <button className="quiet danger" onClick={() => { onChange({ ...flow, cases: flow.cases.filter((item) => item.id !== activeCase.id) }); onSelectCase(null); }}>Remove this path</button>
          </div> : null}
        </div>
        <div className="flow-form-card">
          <h4>Create a new case</h4>
          <p>Build the path in the graph. Write WHEN on decision branches and THEN on the outcome; these are stored on the nodes.</p>
          <div className="flow-field-grid">
            <label>Case name <input placeholder="E.g. Valid credentials" value={caseName} onChange={(event) => setCaseName(event.target.value)} /></label>
            <label>Spec requirement <select value={selectedRequirement} onChange={(event) => setCaseRequirement(event.target.value)} disabled={!requirementNames.length}>
              {requirementNames.length ? requirementNames.map((name) => <option key={name} value={name}>{name}</option>) : <option value="">No requirements available</option>}
            </select></label>
          </div>
          <div className="flow-connect-row"><label>Next connection <select value={canAppendEdge ? edgeToAppend : ''} onChange={(event) => setEdgeToAppend(event.target.value)} disabled={!nextPathEdges.length}>
            <option value="">{!flow.edges.length ? 'Create a connection between nodes first' : pathEndsAtOutcome ? 'Path ends at an outcome' : caseEdges.length ? 'Choose a connection that continues the path…' : nextPathEdges.length ? 'Choose a connection from an event…' : 'Create a connection from an event'}</option>
            {nextPathEdges.map((item) => <option key={item.id} value={item.id}>{edgeName(item)}</option>)}
          </select></label><button className="quiet" disabled={!canAppendEdge} onClick={() => { setCaseEdges([...caseEdges, edgeToAppend]); setEdgeToAppend(''); }}>Add to path</button></div>
          {caseEdges.length ? <><h5>Path connections, in order</h5><ol className="flow-path-list">{pathEdges.map((edge, index) => <li key={`${caseEdges[index]}-${index}`}>{edge ? edgeName(edge) : 'Connection no longer exists'}</li>)}</ol>
            <div className="flow-node-behavior"><h5>Node WHEN and THEN in this path</h5>
              {pathEdges.filter((edge) => edge && flow.nodes.some((node) => node.id === edge.source && node.type === 'decision')).map((edge) => {
                const decision = flow.nodes.find((node) => node.id === edge!.source)!;
                return <label key={edge!.id}>WHEN · {decision.label} / {edge!.label || nodeName(edge!.target)}
                  <textarea rows={2} placeholder="Describe the observable condition" value={decision.whens?.[edge!.id] ?? ''} onChange={(event) => updateWhen(decision.id, edge!.id, event.target.value)} />
                </label>;
              })}
              {lastPathEdge && pathEndsAtOutcome ? <label>THEN · {nodeName(lastPathEdge.target)}
                <textarea rows={2} placeholder="Describe the observable outcome" value={flow.nodes.find((node) => node.id === lastPathEdge.target)?.then ?? ''} onChange={(event) => updateThen(lastPathEdge.target, event.target.value)} />
              </label> : null}
              {!pathEdges.some((edge) => edge && flow.nodes.some((node) => node.id === edge.source && node.type === 'decision')) ? <p className="flow-field-help">Add a decision to the path to define its WHEN.</p> : null}
            </div>
            {draftBehavior.whens.length || draftBehavior.then ? <div className="flow-scenario-preview"><strong>Statements ready for the spec</strong><ul className="flow-behavior-steps">{draftBehavior.whens.map((when, index) => <li key={index}><b>{index ? 'AND' : 'WHEN'}</b><span>{when}</span></li>)}{draftBehavior.then ? <li><b>THEN</b><span>{draftBehavior.then}</span></li> : null}</ul></div> : null}
            <button className="quiet" onClick={() => setCaseEdges((current) => current.slice(0, -1))}>Remove last connection</button>
            <p className={`flow-path-feedback ${!pathConnected ? 'warning' : canAddCase ? 'ready' : ''}`}>{!pathConnected ? 'The path contains disconnected or removed connections.' : !pathStartsAtEvent ? 'Start from an event node.' : !pathEndsAtOutcome ? nextPathEdges.length ? `Continue from node “${nodeName(lastPathEdge!.target)}”.` : 'Add a branch that reaches an outcome.' : !draftBehavior.complete ? 'Complete at least one WHEN on a decision and the THEN on the outcome.' : !change ? 'Select an active change to save the case.' : 'The case is ready. A skill will write its scenario in the spec.'}</p>
          </> : <p className="flow-field-help">Connections you add will appear here in order. Return to the graph to create more.</p>}
          <button className="flow-associate-button" onClick={addCase} disabled={!canAddCase}>Create case in flow</button>
        </div>
      </section>
    </div> : null}
  </div>;
}
