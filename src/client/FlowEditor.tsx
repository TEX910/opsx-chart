import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ReactFlow, Background, Controls, Handle, MiniMap, Position, type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import type { Flow, FlowNode, ScenarioRef } from '../shared/model.js';
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
  highlightedScenario: ScenarioRef | null;
  onChange: (flow: Flow) => void;
};

const nodeColors: Record<FlowNode['type'], string> = {
  event: '#6e9b8b', action: '#4f91a1', decision: '#d59b56', outcome: '#987cab',
};

const nodeTypeHelp: Record<FlowNode['type'], string> = {
  event: 'Punto di partenza: qualcosa avvia il flusso.',
  action: 'Operazione eseguita durante il flusso.',
  decision: 'Bivio: i collegamenti in uscita richiedono un nome, per esempio “Sì” e “No”.',
  outcome: 'Risultato finale del percorso.',
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

export function FlowEditor({ flow, project, change, dirty, saving, onSave, selectedCase, onSelectCase, highlightedScenario, onChange }: Props) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [newType, setNewType] = useState<FlowNode['type']>('action');
  const [newLabel, setNewLabel] = useState('');
  const [caseName, setCaseName] = useState('');
  const [caseEdges, setCaseEdges] = useState<string[]>([]);
  const [caseScenarioIndex, setCaseScenarioIndex] = useState(0);
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

  useEffect(() => { setConnectionTarget(''); }, [selectedNode]);

  useEffect(() => {
    if (previousGraphCollapsed.current === graphCollapsed) return;
    previousGraphCollapsed.current = graphCollapsed;
    (graphCollapsed ? graphToggleRef.current : graphRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [graphCollapsed]);

  const activeCase = flow.cases.find((item) => item.id === selectedCase);
  const activePath = new Set(activeCase?.edgeIds ?? []);
  const nodeName = (id: string) => flow.nodes.find((item) => item.id === id)?.label || id;
  const edgeName = (edge: Flow['edges'][number]) => `${nodeName(edge.source)} → ${nodeName(edge.target)}${edge.label ? ` · ${edge.label}` : ''}`;
  const pathEdges = caseEdges.map((id) => flow.edges.find((item) => item.id === id));
  const pathConnected = pathEdges.every((edge, index) => edge && (index === 0 || pathEdges[index - 1]?.target === edge.source));
  const firstPathEdge = pathEdges[0];
  const lastPathEdge = pathEdges.at(-1);
  const pathStartsAtEvent = !!firstPathEdge && flow.nodes.some((item) => item.id === firstPathEdge.source && item.type === 'event');
  const pathEndsAtOutcome = !!lastPathEdge && flow.nodes.some((item) => item.id === lastPathEdge.target && item.type === 'outcome');
  const nextPathEdges = flow.edges.filter((item) => !caseEdges.includes(item.id) && !pathEndsAtOutcome &&
    (caseEdges.length ? item.source === lastPathEdge?.target : flow.nodes.some((node) => node.id === item.source && node.type === 'event')));
  const canAppendEdge = nextPathEdges.some((item) => item.id === edgeToAppend);
  const canAddCase = !!scenarios.length && !!caseName.trim() && !!caseEdges.length && pathConnected && pathStartsAtEvent && pathEndsAtOutcome;
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
    onChange({ ...flow, nodes: next, edges: remainingEdges, cases: flow.cases.map((item) => ({ ...item, edgeIds: item.edgeIds.filter((id) => edgeIds.has(id)) })) });
  }

  function changeEdges(changes: EdgeChange[]): void {
    const removed = new Set(changes.filter((item) => item.type === 'remove').map((item) => item.id));
    if (!removed.size) return;
    setCaseEdges((current) => current.filter((id) => !removed.has(id)));
    onChange({ ...flow, edges: flow.edges.filter((item) => !removed.has(item.id)),
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
    const scenario = scenarios[caseScenarioIndex];
    if (!scenario || !canAddCase) return;
    const id = crypto.randomUUID();
    onChange({ ...flow, cases: [...flow.cases, { id, name: caseName.trim(), edgeIds: caseEdges, scenario: scenario.ref }] });
    onSelectCase(id);
    setCaseName(''); setCaseEdges([]); setEdgeToAppend('');
  }

  const selectedNodeValue = flow.nodes.find((item) => item.id === selectedNode);
  const selectedEdgeValue = flow.edges.find((item) => item.id === selectedEdge);
  const selectedSummary = selectedNodeValue ? `Nodo: ${selectedNodeValue.label}` : selectedEdgeValue
    ? `Collegamento: ${nodeName(selectedEdgeValue.source)} → ${nodeName(selectedEdgeValue.target)}`
    : 'Seleziona un nodo o un collegamento nel grafo.';

  return <div className="flow-editor">
    <div className="flow-toolbar">
      <label>Nome flusso <input value={flow.name} onChange={(event) => onChange({ ...flow, name: event.target.value })} /></label>
      <label className="new-node-type">Tipo nuovo nodo <select value={newType} onChange={(event) => setNewType(event.target.value as FlowNode['type'])}>
        <option value="event">Evento</option><option value="action">Azione</option><option value="decision">Decisione</option><option value="outcome">Esito</option>
      </select></label>
      <label className="new-node-name">Nome nuovo nodo <input placeholder="Es. Verifica credenziali" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addNode(); }} /></label>
      <button onClick={addNode} disabled={!newLabel.trim()}>Aggiungi nodo</button>
    </div>
    {flow.deleted ? <div className="banner warning">Questo flusso è segnato per l'eliminazione nel change selezionato.</div> : null}
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
      <div className="flow-selection-summary"><strong>Elemento selezionato</strong><span>{selectedSummary}</span></div>
      <div className="flow-editor-actions">
        {graphCollapsed ? <button onClick={onSave} disabled={!dirty || saving}>{saving ? 'Salvataggio…' : 'Salva flusso'}</button> : null}
        <button className="quiet" aria-expanded={graphCollapsed} aria-controls="flow-forms" onClick={() => setGraphCollapsed((value) => !value)}>{graphCollapsed ? 'Mostra grafo' : 'Collassa grafo e modifica'}</button>
      </div>
    </div>
    {graphCollapsed ? <div id="flow-forms" className="flow-bottom flow-forms">
      <div className="flow-form-intro">
        <h2>Modifica il flusso</h2>
        <p>Modifica il passaggio selezionato, collega i nodi e associa una sequenza di collegamenti a uno scenario OpenSpec.</p>
        <p className="flow-form-context">{change ? <>Change attivo: <strong>{change}</strong>. Le modifiche saranno salvate come bozza del change.</> : 'Per salvare modifiche al comportamento, seleziona un change attivo nella colonna Progetto.'}</p>
      </div>
      <section>
        <div className="flow-section-heading"><span className="flow-step-number">1</span><div><h3>Modifica l’elemento selezionato</h3><p>Seleziona un nodo o un collegamento nel grafo, poi modifica qui i suoi dettagli.</p></div></div>
        {selectedNodeValue ? <>
          <div className="flow-form-card">
            <span className="flow-form-kicker">NODO SELEZIONATO</span>
            <h4>{selectedNodeValue.label || 'Senza etichetta'}</h4>
            <div className="flow-field-grid">
              <label>Nome del passaggio <input value={selectedNodeValue.label} onChange={(event) => onChange({ ...flow, nodes: flow.nodes.map((item) => item.id === selectedNode ? { ...item, label: event.target.value } : item) })} /></label>
              <label>Tipo di passaggio <select value={selectedNodeValue.type} onChange={(event) => onChange({ ...flow, nodes: flow.nodes.map((item) => item.id === selectedNode ? { ...item, type: event.target.value as FlowNode['type'] } : item) })}>
                <option value="event">Evento · avvio</option><option value="action">Azione · operazione</option><option value="decision">Decisione · bivio</option><option value="outcome">Esito · risultato</option>
              </select></label>
            </div>
            <p className="flow-field-help">{nodeTypeHelp[selectedNodeValue.type]}</p>
          </div>
          <div className="flow-form-card">
            <h4>Collega questo nodo al successivo</h4>
            <p>Il nuovo collegamento partirà da <strong>{selectedNodeValue.label || 'questo nodo'}</strong> e arriverà al nodo scelto qui sotto.</p>
            <div className="flow-connect-row"><label>Nodo di destinazione <select value={connectionTarget} onChange={(event) => setConnectionTarget(event.target.value)}><option value="">Scegli il nodo successivo…</option>{flow.nodes.filter((item) => item.id !== selectedNode && !flow.edges.some((edge) => edge.source === selectedNode && edge.target === item.id)).map((item) => <option key={item.id} value={item.id}>{item.label || item.id}</option>)}</select></label>
              <button disabled={!connectionTarget} onClick={() => { if (selectedNode && connectionTarget) connectNodes(selectedNode, connectionTarget); }}>Crea collegamento</button></div>
            {flow.nodes.length < 2 ? <p className="flow-field-help">Aggiungi prima un altro nodo usando il comando sopra il grafo.</p> : null}
          </div>
          <div className="flow-remove-row"><button className="quiet danger" onClick={() => { if (selectedNode) changeNodes([{ type: 'remove', id: selectedNode }]); setSelectedNode(null); }}>Rimuovi nodo</button><small>Rimuove anche i suoi collegamenti dai percorsi.</small></div>
        </> : selectedEdgeValue ? <>
          <div className="flow-form-card">
            <span className="flow-form-kicker">COLLEGAMENTO SELEZIONATO</span>
            <h4>{edgeName(selectedEdgeValue)}</h4>
            <label>{flow.nodes.find((item) => item.id === selectedEdgeValue.source)?.type === 'decision' ? 'Nome del ramo' : 'Etichetta del collegamento (facoltativa)'} <input value={selectedEdgeValue.label ?? ''} placeholder="Es. Valido, Non valido" onChange={(event) => onChange({ ...flow, edges: flow.edges.map((item) => item.id === selectedEdge ? { ...item, label: event.target.value } : item) })} /></label>
            {flow.nodes.find((item) => item.id === selectedEdgeValue.source)?.type === 'decision' ? <p className="flow-field-help">Questo collegamento esce da una decisione: dai un nome al ramo per distinguere le alternative.</p> : null}
          </div>
          <div className="flow-remove-row"><button className="quiet danger" onClick={() => { if (selectedEdge) changeEdges([{ type: 'remove', id: selectedEdge }]); setSelectedEdge(null); }}>Rimuovi collegamento</button><small>Lo rimuove anche dai percorsi che lo contengono.</small></div>
        </> : <div className="flow-form-empty"><p>Non hai selezionato un elemento. Mostra il grafo e clicca un nodo o un collegamento per modificarlo.</p><button className="quiet" onClick={() => setGraphCollapsed(false)}>Mostra grafo</button></div>}
      </section>
      <section>
        <div className="flow-section-heading"><span className="flow-step-number">2</span><div><h3>Associa un percorso a uno scenario</h3><p>Un percorso è la sequenza dei collegamenti attraversati, dall’evento iniziale all’esito.</p></div></div>
        <div className="flow-form-card">
          <h4>Percorsi già associati</h4>
          {flow.cases.length ? <div className="case-list">{flow.cases.map((item) => <button key={item.id} className={`case-item ${selectedCase === item.id ? 'active' : ''}`} onClick={() => onSelectCase(item.id)}>
            <strong>{item.name}</strong><small>{item.scenario.requirement} / {item.scenario.scenario}</small>
          </button>)}</div> : <p className="flow-field-help">Nessun percorso associato a uno scenario.</p>}
          {activeCase ? <div className="flow-active-case"><p><strong>Scenario OpenSpec:</strong> {activeCase.scenario.requirement} / {activeCase.scenario.scenario}</p>
            <ol className="flow-path-list">{activeCase.edgeIds.map((id, index) => { const edge = flow.edges.find((item) => item.id === id); return <li key={`${id}-${index}`}>{edge ? edgeName(edge) : 'Collegamento non più presente'}</li>; })}</ol>
            <button className="quiet danger" onClick={() => { onChange({ ...flow, cases: flow.cases.filter((item) => item.id !== activeCase.id) }); onSelectCase(null); }}>Rimuovi questo percorso</button>
          </div> : null}
        </div>
        <div className="flow-form-card">
          <h4>Crea un nuovo percorso</h4>
          <p>Scegli uno scenario OpenSpec e aggiungi, in ordine, i collegamenti che lo rappresentano nel grafo.</p>
          <div className="flow-field-grid">
            <label>Nome del percorso <input placeholder="Es. Accesso riuscito" value={caseName} onChange={(event) => setCaseName(event.target.value)} /></label>
            <label>Scenario OpenSpec <select value={caseScenarioIndex} onChange={(event) => setCaseScenarioIndex(Number(event.target.value))} disabled={!scenarios.length}>
              {scenarios.length ? scenarios.map((item, index) => <option key={`${item.label}-${index}`} value={index}>{item.label}</option>) : <option value={0}>Nessuno scenario disponibile</option>}
            </select></label>
          </div>
          <div className="flow-connect-row"><label>Collegamento successivo <select value={canAppendEdge ? edgeToAppend : ''} onChange={(event) => setEdgeToAppend(event.target.value)} disabled={!nextPathEdges.length}>
            <option value="">{!flow.edges.length ? 'Crea prima un collegamento tra nodi' : pathEndsAtOutcome ? 'Percorso concluso in un Esito' : caseEdges.length ? 'Scegli un collegamento che continua il percorso…' : nextPathEdges.length ? 'Scegli un collegamento che parte da un Evento…' : 'Crea un collegamento che parte da un Evento'}</option>
            {nextPathEdges.map((item) => <option key={item.id} value={item.id}>{edgeName(item)}</option>)}
          </select></label><button className="quiet" disabled={!canAppendEdge} onClick={() => { setCaseEdges([...caseEdges, edgeToAppend]); setEdgeToAppend(''); }}>Aggiungi al percorso</button></div>
          {caseEdges.length ? <><h5>Collegamenti nel percorso, in ordine</h5><ol className="flow-path-list">{pathEdges.map((edge, index) => <li key={`${caseEdges[index]}-${index}`}>{edge ? edgeName(edge) : 'Collegamento non più presente'}</li>)}</ol>
            <button className="quiet" onClick={() => setCaseEdges((current) => current.slice(0, -1))}>Rimuovi ultimo collegamento</button>
            <p className={`flow-path-feedback ${!pathConnected ? 'warning' : pathEndsAtOutcome && pathStartsAtEvent ? 'ready' : ''}`}>{!pathConnected ? 'Il percorso contiene collegamenti non consecutivi o rimossi.' : !pathStartsAtEvent ? 'Suggerimento: inizia da un nodo Evento.' : pathEndsAtOutcome ? 'Il percorso parte da un Evento e termina in un Esito.' : nextPathEdges.length ? `Continua dal nodo “${nodeName(lastPathEdge!.target)}”.` : 'Non ci sono collegamenti successivi: torna al grafo e aggiungi il ramo mancante.'}</p>
          </> : <p className="flow-field-help">I collegamenti che aggiungi compariranno qui in sequenza. Per crearne altri, torna al grafo.</p>}
          <button className="flow-associate-button" onClick={addCase} disabled={!canAddCase}>Associa percorso allo scenario</button>
        </div>
      </section>
    </div> : null}
  </div>;
}
