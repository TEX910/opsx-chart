import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ReactFlow, Background, Controls, Handle, MiniMap, Position, type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps } from '@xyflow/react';
import type { Flow, FlowNode, ScenarioRef } from '../shared/model.js';
import type { ProjectSnapshot } from '../server/openspec.js';

type Props = {
  flow: Flow;
  project: ProjectSnapshot;
  change: string;
  selectedCase: string | null;
  onSelectCase: (id: string | null) => void;
  highlightedScenario: ScenarioRef | null;
  onChange: (flow: Flow) => void;
};

const nodeColors: Record<FlowNode['type'], string> = {
  event: '#6e9b8b', action: '#4f91a1', decision: '#d59b56', outcome: '#987cab',
};

function BehaviorNode({ data, selected }: NodeProps<Node<{ label: string; kind: FlowNode['type'] }>>) {
  return <div className={`behavior-node ${selected ? 'selected' : ''}`} style={{ '--node-accent': nodeColors[data.kind] } as CSSProperties}>
    <Handle type="target" position={Position.Left} />
    <span>{data.kind}</span>
    <strong>{data.label || 'Senza etichetta'}</strong>
    <Handle type="source" position={Position.Right} />
  </div>;
}

const nodeTypes = { behavior: BehaviorNode };

export function FlowEditor({ flow, project, change, selectedCase, onSelectCase, highlightedScenario, onChange }: Props) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [newType, setNewType] = useState<FlowNode['type']>('action');
  const [newLabel, setNewLabel] = useState('');
  const [caseName, setCaseName] = useState('');
  const [caseEdges, setCaseEdges] = useState<string[]>([]);
  const [caseScenarioIndex, setCaseScenarioIndex] = useState(0);
  const [edgeToAppend, setEdgeToAppend] = useState('');

  const scenarios = useMemo(() => [...project.current, ...project.proposed.filter((item) => item.change === change)]
    .filter((item) => item.id === flow.capability)
    .flatMap((item) => item.requirements.flatMap((requirement) => requirement.scenarios.map((scenario) => ({
      label: `${item.scope === 'change' ? 'Proposta' : 'Attuale'} · ${requirement.name} / ${scenario.name}`,
      ref: { capability: item.id, requirement: requirement.name, scenario: scenario.name,
        scope: item.scope, change: item.change, fingerprint: scenario.fingerprint } as ScenarioRef,
      rawText: scenario.rawText,
    })))), [project, flow.capability, change]);

  useEffect(() => {
    if (!highlightedScenario) return;
    const matching = flow.cases.find((item) => item.scenario.requirement === highlightedScenario.requirement &&
      item.scenario.scenario === highlightedScenario.scenario && item.scenario.scope === highlightedScenario.scope &&
      item.scenario.change === highlightedScenario.change);
    if (matching) onSelectCase(matching.id);
  }, [highlightedScenario, flow.cases]);

  const activeCase = flow.cases.find((item) => item.id === selectedCase);
  const activePath = new Set(activeCase?.edgeIds ?? []);
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
    onChange({ ...flow, nodes: next, edges: remainingEdges, cases: flow.cases.map((item) => ({ ...item, edgeIds: item.edgeIds.filter((id) => edgeIds.has(id)) })) });
  }

  function changeEdges(changes: EdgeChange[]): void {
    const removed = new Set(changes.filter((item) => item.type === 'remove').map((item) => item.id));
    if (!removed.size) return;
    onChange({ ...flow, edges: flow.edges.filter((item) => !removed.has(item.id)),
      cases: flow.cases.map((item) => ({ ...item, edgeIds: item.edgeIds.filter((id) => !removed.has(id)) })) });
  }

  function connect(connection: Connection): void {
    if (!connection.source || !connection.target) return;
    onChange({ ...flow, edges: [...flow.edges, { id: crypto.randomUUID(), source: connection.source, target: connection.target }] });
  }

  function addNode(): void {
    const label = newLabel.trim();
    if (!label) return;
    const id = crypto.randomUUID();
    onChange({ ...flow, nodes: [...flow.nodes, { id, type: newType, label, position: { x: 80 + flow.nodes.length * 55, y: 80 + flow.nodes.length * 65 } }] });
    setNewLabel('');
    setSelectedNode(id);
  }

  function addCase(): void {
    const scenario = scenarios[caseScenarioIndex];
    if (!scenario || !caseName.trim() || !caseEdges.length) return;
    const id = crypto.randomUUID();
    onChange({ ...flow, cases: [...flow.cases, { id, name: caseName.trim(), edgeIds: caseEdges, scenario: scenario.ref }] });
    onSelectCase(id);
    setCaseName(''); setCaseEdges([]);
  }

  const selectedNodeValue = flow.nodes.find((item) => item.id === selectedNode);
  const selectedEdgeValue = flow.edges.find((item) => item.id === selectedEdge);

  return <div className="flow-editor">
    <div className="flow-toolbar">
      <label>Nome flusso <input value={flow.name} onChange={(event) => onChange({ ...flow, name: event.target.value })} /></label>
      <span className="toolbar-separator" />
      <select aria-label="Tipo nodo" value={newType} onChange={(event) => setNewType(event.target.value as FlowNode['type'])}>
        <option value="event">Evento</option><option value="action">Azione</option><option value="decision">Decisione</option><option value="outcome">Esito</option>
      </select>
      <input className="new-node-label" placeholder="Etichetta del nuovo nodo" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addNode(); }} />
      <button onClick={addNode}>Aggiungi nodo</button>
    </div>
    {flow.deleted ? <div className="banner warning">Questo flusso è segnato per l'eliminazione nel change selezionato.</div> : null}
    <div className="canvas flow-canvas">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={changeNodes} onEdgesChange={changeEdges}
        onConnect={connect} onNodeClick={(_event, node) => { setSelectedNode(node.id); setSelectedEdge(null); }}
        onEdgeClick={(_event, edge) => { setSelectedEdge(edge.id); setSelectedNode(null); }}
        onMoveEnd={(_event, viewport) => onChange({ ...flow, viewport })}
        defaultViewport={flow.viewport} fitView={!flow.viewport} fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }} proOptions={{ hideAttribution: true }}>
        <Background color="#d5dee0" gap={22} size={1} /><Controls /><MiniMap pannable zoomable nodeColor={(node) => nodeColors[(node.data as { kind: FlowNode['type'] }).kind]} />
      </ReactFlow>
    </div>
    <div className="flow-bottom">
      <section>
        <h3>Elemento selezionato</h3>
        {selectedNodeValue ? <>
          <label>Etichetta <input value={selectedNodeValue.label} onChange={(event) => onChange({ ...flow, nodes: flow.nodes.map((item) => item.id === selectedNode ? { ...item, label: event.target.value } : item) })} /></label>
          <label>Tipo <select value={selectedNodeValue.type} onChange={(event) => onChange({ ...flow, nodes: flow.nodes.map((item) => item.id === selectedNode ? { ...item, type: event.target.value as FlowNode['type'] } : item) })}>
            <option value="event">Evento</option><option value="action">Azione</option><option value="decision">Decisione</option><option value="outcome">Esito</option>
          </select></label>
          <button className="quiet danger" onClick={() => { if (selectedNode) changeNodes([{ type: 'remove', id: selectedNode }]); setSelectedNode(null); }}>Rimuovi nodo</button>
        </> : selectedEdgeValue ? <>
          <label>Etichetta ramo <input value={selectedEdgeValue.label ?? ''} onChange={(event) => onChange({ ...flow, edges: flow.edges.map((item) => item.id === selectedEdge ? { ...item, label: event.target.value } : item) })} /></label>
          <button className="quiet danger" onClick={() => { if (selectedEdge) changeEdges([{ type: 'remove', id: selectedEdge }]); setSelectedEdge(null); }}>Rimuovi collegamento</button>
        </> : <p className="muted">Seleziona un nodo o un collegamento. Trascina tra i punti laterali dei nodi per unirli.</p>}
      </section>
      <section>
        <h3>Percorsi collegati a scenari</h3>
        <div className="case-list">{flow.cases.map((item) => <button key={item.id} className={`case-item ${selectedCase === item.id ? 'active' : ''}`} onClick={() => onSelectCase(item.id)}>
          <strong>{item.name}</strong><small>{item.scenario.requirement} / {item.scenario.scenario}</small>
        </button>)}</div>
        {activeCase ? <button className="quiet danger" onClick={() => { onChange({ ...flow, cases: flow.cases.filter((item) => item.id !== activeCase.id) }); onSelectCase(null); }}>Rimuovi percorso</button> : null}
        <div className="case-builder">
          <input placeholder="Nome del percorso" value={caseName} onChange={(event) => setCaseName(event.target.value)} />
          <select aria-label="Scenario da collegare" value={caseScenarioIndex} onChange={(event) => setCaseScenarioIndex(Number(event.target.value))}>
            {scenarios.map((item, index) => <option key={`${item.label}-${index}`} value={index}>{item.label}</option>)}
          </select>
          <div className="inline-fields"><select aria-label="Aggiungi collegamento al percorso" value={edgeToAppend} onChange={(event) => setEdgeToAppend(event.target.value)}>
            <option value="">Scegli un collegamento</option>{flow.edges.map((item) => <option key={item.id} value={item.id}>{flow.nodes.find((node) => node.id === item.source)?.label} → {flow.nodes.find((node) => node.id === item.target)?.label}</option>)}
          </select><button className="quiet" onClick={() => { if (edgeToAppend) setCaseEdges([...caseEdges, edgeToAppend]); }}>Aggiungi</button></div>
          <small className="muted">{caseEdges.length ? `${caseEdges.length} collegamenti nel percorso` : 'Aggiungi i collegamenti nell’ordine del percorso.'}</small>
          <button onClick={addCase} disabled={!scenarios.length || !caseEdges.length || !caseName.trim()}>Collega percorso e scenario</button>
        </div>
      </section>
    </div>
  </div>;
}
