import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ReactFlow, Background, Controls, Handle, MiniMap, Position, type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import { flowPaths, flowWouldCycle, pathBehavior, type Flow, type FlowCase, type FlowNode, type ScenarioRef } from '../shared/model.js';
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
  const [newType, setNewType] = useState<FlowNode['type']>('action');
  const [newLabel, setNewLabel] = useState('');
  const [caseName, setCaseName] = useState('');
  const [caseRequirement, setCaseRequirement] = useState('');
  const [casePath, setCasePath] = useState('');
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
  const availablePaths = flowPaths(flow);
  const chosenPath = availablePaths.find((edges) => edges.join('|') === casePath) ?? availablePaths.find((edges) => !flow.cases.some((item) => item.edgeIds.join('|') === edges.join('|')));
  const draftBehavior = pathBehavior(flow, chosenPath ?? []);
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
  const canAddCase = !!change && !!selectedRequirement && !!caseName.trim() && !!chosenPath && draftBehavior.complete &&
    !flow.cases.some((item) => item.edgeIds.join('|') === chosenPath.join('|'));
  const nodes: Node[] = flow.nodes.map((item) => ({ id: item.id, type: 'behavior', position: item.position,
    initialWidth: 150, initialHeight: 65,
    data: { label: item.label, kind: item.type }, selected: item.id === selectedNode }));
  const edges: Edge[] = flow.edges.map((item) => ({ id: item.id, source: item.source, target: item.target,
    label: flow.nodes.find((node) => node.id === item.source)?.type === 'decision' ?
      (item.label || flow.nodes.find((node) => node.id === item.source)?.whens?.[item.id]?.trim().slice(0, 28) || 'WHEN?') : item.label || undefined,
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
    onChange({ ...flow, nodes: next.map((node) => node.whens ? { ...node, whens: Object.fromEntries(Object.entries(node.whens).filter(([id]) => edgeIds.has(id))) } : node),
      edges: remainingEdges, cases: flow.cases.map((item) => ({ ...item, edgeIds: item.edgeIds.filter((id) => edgeIds.has(id)) })) });
  }

  function changeEdges(changes: EdgeChange[]): void {
    const removed = new Set(changes.filter((item) => item.type === 'remove').map((item) => item.id));
    if (!removed.size) return;
    onChange({ ...flow, nodes: flow.nodes.map((node) => node.whens ? { ...node, whens: Object.fromEntries(Object.entries(node.whens).filter(([id]) => !removed.has(id))) } : node),
      edges: flow.edges.filter((item) => !removed.has(item.id)),
      cases: flow.cases.map((item) => ({ ...item, edgeIds: item.edgeIds.filter((id) => !removed.has(id)) })) });
  }

  function connectNodes(source: string, target: string): void {
    const from = flow.nodes.find((node) => node.id === source);
    const to = flow.nodes.find((node) => node.id === target);
    if (!from || !to || from.type === 'outcome' || (from.type === 'decision' && to.type !== 'decision' && to.type !== 'outcome') || flowWouldCycle(flow, source, target)) return;
    const id = crypto.randomUUID();
    onChange({ ...flow, edges: [...flow.edges, { id, source, target }] });
    setSelectedNode(source);
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
    if (!canAddCase || !chosenPath) return;
    const name = caseName.trim();
    const existing = scenarios.find((item) => item.ref.requirement === selectedRequirement && item.ref.scenario === name && item.ref.scope === 'change')
      ?? scenarios.find((item) => item.ref.requirement === selectedRequirement && item.ref.scenario === name && item.ref.scope === 'current');
    const scenario: ScenarioRef = existing?.ref ?? { capability: flow.capability, requirement: selectedRequirement, scenario: name, scope: 'change', change };
    const id = crypto.randomUUID();
    onChange({ ...flow, cases: [...flow.cases, { id, name, edgeIds: chosenPath, scenario, pendingSpec: !existing }] });
    onSelectCase(id);
    setCaseName(''); setCasePath('');
  }

  function updateWhen(nodeId: string, edgeId: string, value: string): void {
    onChange({ ...flow, nodes: flow.nodes.map((node) => node.id === nodeId ? { ...node, whens: { ...node.whens, [edgeId]: value } } : node) });
  }

  function updateThen(nodeId: string, value: string): void {
    onChange({ ...flow, nodes: flow.nodes.map((node) => node.id === nodeId ? { ...node, then: value } : node) });
  }

  function addWhen(nodeId: string, target: string): void {
    if (!target || flowWouldCycle(flow, nodeId, target)) return;
    const id = crypto.randomUUID();
    onChange({ ...flow, edges: [...flow.edges, { id, source: nodeId, target }],
      nodes: flow.nodes.map((node) => node.id === nodeId ? { ...node, whens: { ...node.whens, [id]: '' } } : node) });
    setConnectionTarget('');
  }

  function changeBranchTarget(edgeId: string, target: string): void {
    const edge = flow.edges.find((item) => item.id === edgeId);
    if (!edge || !target || flowWouldCycle(flow, edge.source, target, edgeId)) return;
    onChange({ ...flow, edges: flow.edges.map((edge) => edge.id === edgeId ? { ...edge, target, label: undefined } : edge) });
  }

  const selectedNodeValue = flow.nodes.find((item) => item.id === selectedNode);
  const outgoingEdges = selectedNodeValue ? flow.edges.filter((item) => item.source === selectedNodeValue.id) : [];
  const selectedSummary = selectedNodeValue ? `${selectedNodeValue.type}: ${selectedNodeValue.label}` : 'Select a block in the graph.';

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
        onConnect={connect} onNodeClick={(_event, node) => { setSelectedNode(node.id); }}
        onEdgeClick={(_event, edge) => { setSelectedNode(edge.source); }}
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
        <p>Select a block. On a Decision, write each WHEN and choose where it leads. An Outcome holds its THEN. A path through several Decisions becomes one OpenSpec scenario.</p>
        <p className="flow-form-context">{change ? <>Active change: <strong>{change}</strong>. Edits will be saved as a draft in this change.</> : 'Select an active change in the Project sidebar to save behavior edits.'}</p>
      </div>
      <section>
        <div className="flow-section-heading"><span className="flow-step-number">1</span><div><h3>Edit the selected block</h3><p>Click a block or its connection in the graph.</p></div></div>
        {selectedNodeValue ? <>
          <div className="flow-form-card">
            <span className="flow-form-kicker">{selectedNodeValue.type.toUpperCase()}</span>
            <h4>{selectedNodeValue.label || 'Untitled'}</h4>
            <label>Block name <input value={selectedNodeValue.label} onChange={(event) => onChange({ ...flow, nodes: flow.nodes.map((item) => item.id === selectedNode ? { ...item, label: event.target.value } : item) })} /></label>
            {selectedNodeValue.type === 'decision' ? <div className="flow-node-behavior"><h5>WHEN branches</h5><p>Each condition leads to an Outcome or another Decision. A second Decision adds an AND to the same scenario.</p>
              {outgoingEdges.map((edge, index) => <div className="flow-when-row" key={edge.id}><div className="flow-when-heading"><strong>WHEN {index + 1}</strong><button className="quiet danger" onClick={() => changeEdges([{ type: 'remove', id: edge.id }])}>Remove</button></div><label>Condition
                <textarea rows={2} placeholder="E.g. the submitted credentials are valid" value={selectedNodeValue.whens?.[edge.id] ?? ''} onChange={(event) => updateWhen(selectedNodeValue.id, edge.id, event.target.value)} />
              </label><label>Leads to <select value={edge.target} onChange={(event) => changeBranchTarget(edge.id, event.target.value)}>
                {flow.nodes.filter((item) => (item.id === edge.target || !flowWouldCycle(flow, selectedNodeValue.id, item.id, edge.id)) && (item.type === 'decision' || item.type === 'outcome')).map((item) => <option key={item.id} value={item.id}>{item.type === 'decision' ? 'Decision' : 'Outcome'} · {item.label || item.id}</option>)}
              </select></label>
                {!selectedNodeValue.whens?.[edge.id]?.trim() && linkedWhens(edge.id).length ? <div className="flow-linked-source"><strong>Text already in OpenSpec</strong>
                  {linkedWhens(edge.id).map((hint, index) => <div key={`${hint.caseName}-${index}`}><small>{hint.caseName}: {hint.text ?? hint.rawText.replaceAll('**', '')}</small>
                    {hint.text ? <button type="button" className="quiet" onClick={() => updateWhen(selectedNodeValue.id, edge.id, hint.text!)}>Use this WHEN</button> : null}
                  </div>)}
                </div> : null}
              </div>)}
              <div className="flow-connect-row"><label>New WHEN leads to <select value={connectionTarget} onChange={(event) => setConnectionTarget(event.target.value)}><option value="">Choose an Outcome or Decision…</option>
                {flow.nodes.filter((item) => !flowWouldCycle(flow, selectedNodeValue.id, item.id) && (item.type === 'decision' || item.type === 'outcome')).map((item) => <option key={item.id} value={item.id}>{item.type === 'decision' ? 'Decision' : 'Outcome'} · {item.label || item.id}</option>)}
              </select></label><button disabled={!connectionTarget} onClick={() => addWhen(selectedNodeValue.id, connectionTarget)}>Add WHEN</button></div>
              {!flow.nodes.some((item) => item.id !== selectedNodeValue.id && (item.type === 'decision' || item.type === 'outcome')) ? <p className="flow-field-help">Add an Outcome or another Decision above first.</p> : null}
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
          {selectedNodeValue.type === 'event' || selectedNodeValue.type === 'action' ? <div className="flow-form-card">
            <h4>Next step</h4>
            {outgoingEdges.map((edge) => <div className="flow-simple-connection" key={edge.id}><span>→ {nodeName(edge.target)}</span><button className="quiet danger" onClick={() => changeEdges([{ type: 'remove', id: edge.id }])}>Remove</button></div>)}
            <div className="flow-connect-row"><label>Connect to <select value={connectionTarget} onChange={(event) => setConnectionTarget(event.target.value)}><option value="">Choose a block…</option>{flow.nodes.filter((item) => item.id !== selectedNode && !flow.edges.some((edge) => edge.source === selectedNode && edge.target === item.id)).map((item) => <option key={item.id} value={item.id}>{item.label || item.id}</option>)}</select></label>
              <button disabled={!connectionTarget} onClick={() => { if (selectedNode && connectionTarget) connectNodes(selectedNode, connectionTarget); }}>Connect</button></div>
          </div> : null}
          <div className="flow-remove-row"><button className="quiet danger" onClick={() => { if (selectedNode) changeNodes([{ type: 'remove', id: selectedNode }]); setSelectedNode(null); }}>Remove node</button><small>This also removes its connections from paths.</small></div>
        </> : <div className="flow-form-empty"><p>No block selected. Show the graph and click a block to edit it.</p><button className="quiet" onClick={() => setGraphCollapsed(false)}>Show graph</button></div>}
      </section>
      <section>
        <div className="flow-section-heading"><span className="flow-step-number">2</span><div><h3>Link paths to OpenSpec scenarios</h3><p>Complete routes are found automatically from Event to Outcome, including routes through multiple Decisions.</p></div></div>
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
          <h4>Link a path</h4>
          <p>Choose a route, name its scenario, then save the flow. The skill writes its WHEN, AND, and THEN lines into the OpenSpec change.</p>
          {availablePaths.length ? <div className="flow-route-options">{availablePaths.map((edges) => {
            const key = edges.join('|');
            const alreadyLinked = flow.cases.some((item) => item.edgeIds.join('|') === key);
            const route = { edgeIds: edges } as FlowCase;
            return <label className={`flow-route-option ${chosenPath?.join('|') === key ? 'active' : ''}`} key={key}><input type="radio" name="case-route" checked={chosenPath?.join('|') === key} onChange={() => setCasePath(key)} disabled={alreadyLinked} /><span>{caseRoute(route)}{alreadyLinked ? <small>Already linked</small> : null}</span></label>;
          })}</div> : <p className="flow-field-help">Connect an Event through a Decision to an Outcome to create a complete route.</p>}
          <div className="flow-field-grid">
            <label>Case name <input placeholder="E.g. Valid credentials" value={caseName} onChange={(event) => setCaseName(event.target.value)} /></label>
            <label>Spec requirement <select value={selectedRequirement} onChange={(event) => setCaseRequirement(event.target.value)} disabled={!requirementNames.length}>
              {requirementNames.length ? requirementNames.map((name) => <option key={name} value={name}>{name}</option>) : <option value="">No requirements available</option>}
            </select></label>
          </div>
          {chosenPath ? <>
            {draftBehavior.whens.length || draftBehavior.then ? <div className="flow-scenario-preview"><strong>Statements ready for the spec</strong><ul className="flow-behavior-steps">{draftBehavior.whens.map((when, index) => <li key={index}><b>{index ? 'AND' : 'WHEN'}</b><span>{when}</span></li>)}{draftBehavior.then ? <li><b>THEN</b><span>{draftBehavior.then}</span></li> : null}</ul></div> : null}
            <p className={`flow-path-feedback ${!draftBehavior.complete ? 'warning' : canAddCase ? 'ready' : ''}`}>{!draftBehavior.complete ? 'Complete every Decision WHEN and the final Outcome THEN on their blocks.' : !change ? 'Select an active change to save the case.' : 'The path is ready to link to a scenario.'}</p>
          </> : null}
          <button className="flow-associate-button" onClick={addCase} disabled={!canAddCase}>Create case in flow</button>
        </div>
      </section>
    </div> : null}
  </div>;
}
