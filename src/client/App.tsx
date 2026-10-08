import { useEffect, useMemo, useRef, useState } from 'react';
import type { Flow, Relation, Relations, Diagnostic, MapLayout, MapPosition } from '../shared/model.js';
import { emptyFlow, validateFlow } from '../shared/model.js';
import type { CapabilityInfo, ProjectSnapshot } from '../server/openspec.js';
import { api, post, put, remove } from './api.js';
import { MapView } from './MapView.js';
import { FlowEditor } from './FlowEditor.js';

type FlowSummary = { capability: string; id: string; name: string; scope: 'current' | 'change'; change?: string };
type Suggestion = { source: string; target: string; change: string };
type PendingDraft = { change: string; archived: boolean; files: string[] };
type DeltaFile = { path: string; content: string };
type GraphWorkspace = { path: string; initialized: boolean };

const query = (values: Record<string, string | undefined>) => new URLSearchParams(Object.entries(values).filter((entry): entry is [string, string] => typeof entry[1] === 'string')).toString();

export function App() {
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [projectInput, setProjectInput] = useState('');
  const [page, setPage] = useState<'map' | 'flow'>('map');
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null);
  const [selectedChange, setSelectedChange] = useState('');
  const [search, setSearch] = useState('');
  const [focus, setFocus] = useState(false);
  const [relations, setRelations] = useState<Relations>({ version: 1, edges: [] });
  const [mapLayout, setMapLayout] = useState<MapLayout | null>(null);
  const [mapLayoutRevision, setMapLayoutRevision] = useState(0);
  const [mapSaving, setMapSaving] = useState(false);
  const [graphWorkspace, setGraphWorkspace] = useState<GraphWorkspace | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [relationshipTarget, setRelationshipTarget] = useState('');
  const [relationshipType, setRelationshipType] = useState<Relation['type']>('depends-on');
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [flowScope, setFlowScope] = useState<'current' | 'change'>('current');
  const [flowLoading, setFlowLoading] = useState(true);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [dirtyFlow, setDirtyFlow] = useState(false);
  const [externalChanged, setExternalChanged] = useState(false);
  const helpDialog = useRef<HTMLDialogElement | null>(null);
  const [newChangeName, setNewChangeName] = useState('');
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [pending, setPending] = useState<PendingDraft[]>([]);
  const [delta, setDelta] = useState<DeltaFile | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dirtyRef = useRef(false);

  const currentCapability = project?.current.find((item) => item.id === selectedCapability);
  const proposedCapability = project?.proposed.find((item) => item.id === selectedCapability && item.change === selectedChange);
  const capabilityIds = useMemo(() => project ? [...new Set([...project.current, ...project.proposed].map((item) => item.id))].sort() : [], [project]);
  const flowChoices = flows.filter((item) => item.capability === selectedCapability);
  const legacyFlowIds = [...new Set(flowChoices.map((item) => item.id))];
  const needsConsolidation = legacyFlowIds.length > 1;
  const visibleDiagnostics = [...diagnostics, ...(flow && dirtyFlow ? validateFlow(flow) : [])];

  function refresh(external = false): void {
    if (external && dirtyRef.current) { setExternalChanged(true); return; }
    setFlowLoading(true);
    setReloadVersion((value) => value + 1);
  }

  useEffect(() => {
    void api<ProjectSnapshot | { root: null }>('/project').then((value) => {
      if (!value.root) return;
      const next = value as ProjectSnapshot;
      setProject(next); setProjectInput(next.root);
      setSelectedCapability(next.current[0]?.id ?? next.proposed[0]?.id ?? null);
      if (!next.current.length) setSelectedChange(next.changes[0]?.name ?? '');
    }).catch((failure) => setError(String(failure)));
    const stream = new EventSource('/api/events');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    stream.onmessage = () => { clearTimeout(timeout); timeout = setTimeout(() => refresh(true), 450); };
    return () => { stream.close(); clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    if (!project || !selectedCapability) { setFlows([]); setFlow(null); setFlowLoading(false); return; }
    let cancelled = false;
    setFlowLoading(true);
    void (async () => {
      const nextProject = await api<ProjectSnapshot>('/refresh');
      if (!nextProject.changes.some((item) => item.name === selectedChange) && selectedChange) {
        if (!cancelled) setSelectedChange('');
        return;
      }
      if (![...nextProject.current, ...nextProject.proposed].some((item) => item.id === selectedCapability)) {
        if (!cancelled) setSelectedCapability(nextProject.current[0]?.id ?? nextProject.proposed[0]?.id ?? null);
        return;
      }
      const [list, nextDelta, nextDiagnostics, nextRelations, nextSuggestions, nextPending, nextGraphWorkspace, nextMapLayout] = await Promise.all([
        api<FlowSummary[]>(`/flows?${query({ change: selectedChange || undefined })}`),
        selectedChange ? api<DeltaFile>(`/delta?${query({ capability: selectedCapability, change: selectedChange })}`) : Promise.resolve(null),
        api<Diagnostic[]>(`/diagnostics?${query({ change: selectedChange || undefined })}`),
        api<Relations>('/relations'), api<Suggestion[]>('/suggestions'), api<PendingDraft[]>('/pending'),
        api<GraphWorkspace>('/graph-workspace'), api<MapLayout>('/map-layout'),
      ]);
      const matching = list.filter((item) => item.capability === selectedCapability);
      const ids = new Set(matching.map((item) => item.id));
      const chosen = ids.size === 1 ? matching.find((item) => item.scope === 'change') ?? matching[0] : undefined;
      const nextFlow = chosen ? await api<Flow>(`/flow?${query({ capability: selectedCapability, id: chosen.id, change: chosen.scope === 'change' ? selectedChange : undefined })}`)
        : ids.size === 0 && selectedChange ? emptyFlow(selectedCapability, 'main', selectedCapability) : null;
      if (cancelled) return;
      if (dirtyRef.current) { setExternalChanged(true); setFlowLoading(false); return; }
      setProject(nextProject); setFlows(list); setDelta(nextDelta); setDiagnostics(nextDiagnostics);
      setRelations(nextRelations); setSuggestions(nextSuggestions); setPending(nextPending);
      setGraphWorkspace(nextGraphWorkspace); setMapLayout(nextMapLayout);
      setFlow(nextFlow); setFlowScope(chosen?.scope ?? 'change'); setSelectedCase(null);
      setFlowLoading(false); setError('');
    })().catch((failure) => { if (!cancelled) { setFlowLoading(false); setError(String(failure)); } });
    return () => { cancelled = true; };
  }, [project?.root, selectedCapability, selectedChange, reloadVersion]);

  async function openProject(): Promise<void> {
    setBusy(true); setError(''); setMessage('');
    try {
      const next = await post<ProjectSnapshot>('/project', { path: projectInput });
      setGraphWorkspace(null);
      setMapLayout(null);
      setProject(next); setSelectedCapability(next.current[0]?.id ?? next.proposed[0]?.id ?? null);
      dirtyRef.current = false; setDirtyFlow(false); setExternalChanged(false);
      setSelectedChange(next.current.length ? '' : next.changes[0]?.name ?? ''); setFlow(null); setFlowLoading(true);
      setReloadVersion((value) => value + 1);
      setMessage(`Project opened: ${next.root}`);
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  }

  async function initializeGraphWorkspace(): Promise<void> {
    if (!selectedChange) { setError('Create or select an OpenSpec change before modifying this project.'); return; }
    setBusy(true);
    try {
      const result = await post<{ root: string; path: string; created: boolean }>('/graph-workspace', { change: selectedChange });
      setGraphWorkspace({ path: result.path, initialized: true });
      setMessage(result.created ? `Graph workspace created: ${result.path}` : `Graph workspace already exists: ${result.path}`);
      setError('');
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  }

  async function saveRelationship(next: Relations): Promise<void> {
    if (!selectedChange) { setError('Create or select an OpenSpec change before modifying relationships.'); return; }
    try {
      const result = await put<{ relations: Relations; diagnostics: Diagnostic[] }>('/relations', { change: selectedChange, relations: next });
      setRelations(result.relations); setDiagnostics(result.diagnostics); setMessage('Relations saved.'); setError('');
    } catch (failure) { setError(String(failure)); }
  }

  async function moveMapNode(id: string, position: MapPosition): Promise<void> {
    if (!selectedChange) { setError('Create or select an OpenSpec change before moving capabilities.'); return; }
    setMapSaving(true);
    try {
      const next = await put<MapLayout>('/map-layout', { capability: id, position, change: selectedChange });
      setMapLayout(next);
      setMessage(`Position saved for ${id}.`); setError('');
    } catch (failure) { setError(String(failure)); }
    finally { setMapSaving(false); }
  }

  async function resetMapPositions(): Promise<void> {
    if (!selectedChange) { setError('Create or select an OpenSpec change before resetting positions.'); return; }
    setMapSaving(true);
    try {
      setMapLayout(await remove<MapLayout>('/map-layout', { change: selectedChange }));
      setMapLayoutRevision((value) => value + 1);
      setMessage('Automatic map layout restored.'); setError('');
    } catch (failure) { setError(String(failure)); }
    finally { setMapSaving(false); }
  }

  async function addRelationship(): Promise<void> {
    if (!selectedCapability || !relationshipTarget) return;
    const next = { ...relations, edges: [...relations.edges, { id: crypto.randomUUID(), source: selectedCapability, target: relationshipTarget, type: relationshipType }] };
    await saveRelationship(next);
  }

  async function createChange(): Promise<void> {
    const name = newChangeName.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) { setError('Change names must use lowercase letters, numbers, and hyphens.'); return; }
    if (dirtyFlow && !window.confirm('You have unsaved changes. Create a new change?')) return;
    setBusy(true);
    try {
      const next = await post<ProjectSnapshot>('/change', { name });
      setProject(next); setSelectedChange(name); setNewChangeName(''); setPage('flow');
      dirtyRef.current = false; setDirtyFlow(false); setExternalChanged(false); setFlow(null); setFlowLoading(true);
      setMessage(`Change ${name} created. Edit this spec's flow, then complete the OpenSpec proposal, spec delta, and tasks.`); setError('');
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  }

  async function consolidateCurrentFlows(): Promise<void> {
    if (!selectedCapability || !selectedChange) return;
    setBusy(true);
    try {
      const result = await post<{ flow: Flow; backup: string }>('/flow/consolidate', { capability: selectedCapability, change: selectedChange });
      setFlows(await api<FlowSummary[]>(`/flows?${query({ change: selectedChange || undefined })}`));
      setFlow(result.flow); setFlowScope('current'); dirtyRef.current = false; setDirtyFlow(false);
      setMessage(`Existing flows combined. Original files backed up at ${result.backup}`); setError('');
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  }

  async function saveCurrentFlow(): Promise<void> {
    if (!flow || !selectedChange) return;
    if (externalChanged && !window.confirm('The flow changed on disk. Save your local edits over that version?')) return;
    setBusy(true);
    try {
      const result = await put<{ flow: Flow; scope: 'current' | 'change'; diagnostics: Diagnostic[] }>('/flow', { flow, change: selectedChange || undefined });
      setFlow(result.flow); setFlowScope(result.scope);
      dirtyRef.current = false; setDirtyFlow(false); setExternalChanged(false); setDiagnostics(result.diagnostics);
      setFlows(await api<FlowSummary[]>(`/flows?${query({ change: selectedChange || undefined })}`));
      setMessage(result.scope === 'change' ? 'Graph draft saved in the change.' : 'Layout saved in the current graph.'); setError('');
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  }

  async function reconcile(item: PendingDraft, execute: boolean): Promise<void> {
    setBusy(true);
    try {
      if (execute) {
        const result = await post<{ files: string[] }>('/reconcile', { change: item.change, archived: item.archived });
        setMessage(`Graphs reconciled: ${result.files.join(', ')}`);
        setPending(await api<PendingDraft[]>('/pending'));
        refresh();
      } else {
        const result = await post<{ diagnostics: Diagnostic[]; files: string[] }>('/preflight', { change: item.change, archived: item.archived });
        setDiagnostics(result.diagnostics); setMessage(result.diagnostics.length ? `${result.diagnostics.length} issues to review.` : `Preflight passed for ${item.change}.`);
      }
      setError('');
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  }

  function selectCapability(id: string): void {
    if (dirtyFlow && !window.confirm('You have unsaved changes. Switch capability?')) return;
    dirtyRef.current = false; setDirtyFlow(false); setExternalChanged(false);
    setSelectedCapability(id); setFlow(null); setFlowLoading(true);
    setSelectedCase(null); setError('');
  }

  function selectGraphCase(id: string | null): void {
    setSelectedCase(id);
  }

  function loadVersionOnDisk(): void {
    if (dirtyRef.current && !window.confirm('Discard unsaved graph edits and load the version on disk?')) return;
    dirtyRef.current = false; setDirtyFlow(false); setExternalChanged(false);
    refresh();
  }

  function renderSpecConnector(capability: CapabilityInfo) {
    return <section className="spec-section" key={`${capability.scope}-${capability.change ?? ''}-${capability.id}`}>
      <div className="section-heading"><span className={`pill ${capability.scope === 'change' ? 'amber' : ''}`}>{capability.scope === 'change' ? `DELTA SPEC · ${capability.change}` : 'CURRENT SPEC'}</span>
        <a href={`/api/source?${query({ capability: capability.id, change: capability.change })}`} target="_blank" rel="noreferrer">Open Markdown ↗</a></div>
      {capability.purpose ? <p>{capability.purpose}</p> : <p className="muted">{capability.scope === 'change' ? `Proposed changes for spec ${capability.id}.` : 'No description in this spec.'}</p>}
      <small className="source-path" title={capability.sourcePath}>{capability.sourcePath}</small>
    </section>;
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">◈</div><div><strong>OPSX Chart</strong><small>Connected specs, readable flows</small></div></div>
      <div className="project-picker"><input aria-label="OpenSpec project path" placeholder="OpenSpec project path" value={projectInput} onChange={(event) => setProjectInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void openProject(); }} /><button onClick={() => void openProject()} disabled={busy}>Open project</button></div>
      <button className="help-trigger" type="button" onClick={() => helpDialog.current?.showModal()}>Help</button>
      <div className="version">{project ? `OpenSpec ${project.openSpecVersion}` : 'No project'}</div>
    </header>
    <dialog ref={helpDialog} className="help-dialog" aria-labelledby="help-title">
      <div className="help-heading"><div><span className="eyebrow">OPSX CHART GUIDE</span><h2 id="help-title">Use Chart in an OpenSpec project</h2></div><button className="quiet" type="button" aria-label="Close help" onClick={() => helpDialog.current?.close()}>Close</button></div>
      <div className="help-content">
        <p>Chart connects OpenSpec specifications as a map and describes each capability's behavior as a graph. Chart skills use the same OpenSpec change and task list, so the graph and Markdown move through the same workflow.</p>
        <h3>Active change and flow</h3>
        <p><strong>Active change:</strong> the OpenSpec work you have selected. It groups the proposal, tasks, spec deltas, and any graph drafts.</p>
        <p><strong>Flow:</strong> each capability/spec has one behavior graph. A change holds its draft version. Saving a draft does not replace the current graph or update the spec Markdown; reconciliation promotes it.</p>
        <p>Create or select a change before editing the map, relationships, or flow. A Decision WHEN can lead to an Action, another Decision, or an Outcome; an Action can lead to an Outcome. The final Outcome supplies THEN. Scenario text and path associations are read only in the app: use <code>opsx-chart-graph-to-spec</code> to reconcile complete paths with OpenSpec scenarios.</p>
        <p>On the spec map, drag a capability card to change only its position. Positions save automatically; <strong>Reset positions</strong> restores automatic layout.</p>
        <h3>Set up another project</h3>
        <ol><li>Make sure the target project already uses OpenSpec and its OpenSpec phase skills are available.</li><li>In the OPSX Chart source checkout, run <code>npm run build</code> and <code>npm link</code>.</li><li>Initialize the target project:</li></ol>
        <pre><code>opsx-chart init --root /path/to/project --skills</code></pre>
        <p>This creates <code>openspec/graph/</code> and copies missing <code>opsx-chart-*</code> skills into the project's <code>.agents/skills/</code>. Existing graph files and skill directories are preserved. Open the target project with a skill-compatible assistant to use the skills and in Chart to view its graphs.</p>
        <p>For graphs only, omit <code>--skills</code> or use <strong>Initialize graph workspace</strong> in the project sidebar.</p>
        <h3>Skills at a glance</h3>
        <dl className="help-skills">
          <div><dt><code>init</code></dt><dd>Create the graph workspace and optionally install Chart skills.</dd></div>
          <div><dt><code>explore</code> · <code>propose</code> · <code>update</code> · <code>apply</code></dt><dd>Work through the matching OpenSpec phases with specs and graphs together.</dd></div>
          <div><dt><code>graph-to-spec</code> · <code>spec-to-graph</code></dt><dd>Carry WHEN/THEN between graph nodes and Markdown scenarios.</dd></div>
          <div><dt><code>sync</code> · <code>archive</code> · <code>reconcile</code></dt><dd>Promote, finish, or recover graph drafts alongside OpenSpec changes.</dd></div>
        </dl>
        <p>Ask your assistant to use a skill by name, such as <code>opsx-chart-propose</code>. Invocation syntax depends on the assistant.</p>
      </div>
    </dialog>
    {error ? <div className="banner error" role="alert">{error}<button onClick={() => setError('')}>×</button></div> : null}
    {message ? <div className="banner success">{message}<button onClick={() => setMessage('')}>×</button></div> : null}
    {externalChanged ? <div className="banner warning" role="status">OpenSpec files changed on disk. Your unsaved graph edits are preserved. <button onClick={loadVersionOnDisk}>Load version on disk</button></div> : null}
    {!project ? <main className="welcome"><span className="eyebrow">LOCAL WORKSPACE</span><h1>See what your specs describe.</h1><p>Open a folder containing <code>openspec/</code> to explore capabilities, relationships, and flows. Browsing does not change any files.</p><div className="welcome-card">Enter a project path in the bar above to get started.</div></main> :
      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-header"><span className="eyebrow">PROJECT</span><strong title={project.root}>{project.root.split('/').pop()}</strong><small>{project.current.length} current specs · {project.proposed.length} delta</small></div>
          {graphWorkspace?.initialized === false ? <div className="graph-setup"><strong>Graph workspace is not initialized</strong><small>Create <code>openspec/graph/</code> to store project relationships and flows. Select a change first.</small><button onClick={() => void initializeGraphWorkspace()} disabled={busy || !selectedChange}>Initialize graph workspace</button></div> : null}
          <div className="sidebar-controls"><input placeholder="Search specs…" value={search} onChange={(event) => setSearch(event.target.value)} /><label className="checkline"><input type="checkbox" checked={focus} onChange={(event) => setFocus(event.target.checked)} /> Connected only</label></div>
          <div className="capability-list">{capabilityIds.filter((id) => id.toLowerCase().includes(search.toLowerCase())).map((id) => <button key={id} className={selectedCapability === id ? 'active' : ''} onClick={() => selectCapability(id)}><span className="cap-dot" />{id}{!project.current.some((item) => item.id === id) ? <em>new</em> : null}</button>)}</div>
          <div className="sidebar-footer"><label>Active change<select value={selectedChange} onChange={(event) => { if (dirtyFlow && !window.confirm('You have unsaved changes. Switch change?')) return; dirtyRef.current = false; setDirtyFlow(false); setExternalChanged(false); setSelectedChange(event.target.value); setFlow(null); setFlowLoading(true); }}><option value="">None</option>{project.changes.map((item) => <option key={item.name} value={item.name}>{item.name} · {item.completedTasks}/{item.totalTasks}</option>)}</select></label><small>Select a change or create one in the Flow view before making edits.</small></div>
        </aside>
        <main className="main-panel">
          <div className="view-header"><div><span className="eyebrow">{page === 'map' ? 'ONE CAPABILITY PER SPEC' : 'BEHAVIOR'}</span><h1>{page === 'map' ? 'Specification map' : selectedCapability ?? 'Flows'}</h1>{page === 'map' ? <small className="map-help">{selectedChange ? 'Drag spec cards to reposition them. Positions save automatically.' : 'Select or create a change to move spec cards.'}</small> : null}</div><div className="view-actions">{page === 'map' && mapLayout && Object.keys(mapLayout.positions).length ? <button className="quiet" onClick={() => void resetMapPositions()} disabled={mapSaving || !selectedChange}>Reset positions</button> : null}<div className="tabs"><button className={page === 'map' ? 'active' : ''} onClick={() => setPage('map')}>Map</button><button className={page === 'flow' ? 'active' : ''} onClick={() => setPage('flow')}>Flow</button></div></div></div>
          {page === 'map' ? mapLayout ? <MapView key={`${project.root}:${mapLayoutRevision}`} project={project} relations={relations.edges} suggestions={suggestions} selected={selectedCapability} onSelect={selectCapability} search={search} focus={focus} savedPositions={mapLayout.positions} saving={mapSaving} editable={!!selectedChange} onMove={moveMapNode} /> : <div className="empty-canvas">Loading map…</div> :
            <div className="flow-page"><div className="flow-selection"><div className="flow-identity"><strong>{selectedCapability ?? 'Select a spec'}</strong><small>One flow for this spec · {selectedChange ? `Change: ${selectedChange}` : 'Select or create a change to edit'}</small></div>
              {flow && !needsConsolidation && !flowLoading ? <><span className={`pill ${flowScope === 'change' ? 'amber' : ''}`}>{flowScope === 'change' ? 'DRAFT' : 'CURRENT'}</span><button onClick={() => void saveCurrentFlow()} disabled={!dirtyFlow || !selectedChange || busy}>Save flow</button></> : null}</div>
              <div className="change-create"><label>New change <input placeholder="e.g. improve-login" value={newChangeName} onChange={(event) => setNewChangeName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void createChange(); }} /></label><button onClick={() => void createChange()} disabled={!newChangeName.trim() || busy}>Create change</button></div>
              {flowLoading ? <div className="empty-canvas" role="status">Loading flow…</div> : needsConsolidation ? <div className="flow-legacy"><h2>Combine existing flows for this spec</h2><p>This project has {legacyFlowIds.length} older flows for {selectedCapability}. Combine them into one graph before editing. Original YAML files are backed up.</p><button onClick={() => void consolidateCurrentFlows()} disabled={busy || !selectedChange}>Combine flows</button>{!selectedChange ? <p>Select or create a change first.</p> : null}</div> : flow ? <FlowEditor key={`${selectedCapability}:${selectedChange}`} flow={flow} project={project} change={selectedChange} editable={!!selectedChange} dirty={dirtyFlow} saving={busy} onSave={() => void saveCurrentFlow()} selectedCase={selectedCase} onSelectCase={selectGraphCase} onChange={(next) => { dirtyRef.current = true; setFlow(next); setDirtyFlow(true); }} /> : <div className="empty-canvas"><h2>No flow yet</h2><p>Create or select a change to start this spec's single flow.</p></div>}
              {selectedChange && delta && !flowLoading ? <section className="flow-delta-editor"><h3>Proposed OpenSpec behavior</h3><p>Read only in Chart. Use <code>opsx-chart-graph-to-spec</code> to reconcile scenarios in this change.</p><small className="source-path">{delta.path}</small><pre className="delta-preview">{delta.content || 'No spec delta yet. Run the Chart skill to create one.'}</pre><button className="quiet" onClick={() => void post('/openspec-validate', { change: selectedChange }).then(() => setMessage('OpenSpec change is valid.')).catch((failure) => setError(String(failure)))}>Validate OpenSpec</button></section> : null}
            </div>}
        </main>
        <aside className="inspector"><div className="inspector-heading"><span className="eyebrow">SPEC AND CONNECTIONS</span><h2>{selectedCapability ?? 'Select a spec'}</h2></div>
          {selectedCapability ? <>
            <div className="inspector-scroll">
              {currentCapability ? renderSpecConnector(currentCapability) : null}
              {proposedCapability ? renderSpecConnector(proposedCapability) : null}
              {!currentCapability && !proposedCapability ? <p className="muted">No spec for the current selection.</p> : null}
              <section><h3>Connections between specs</h3>{relations.edges.filter((item) => item.source === selectedCapability || item.target === selectedCapability).map((item) => <div className="relation-row" key={item.id}><span>{item.source} <em>{item.type}</em> {item.target}</span>{selectedChange ? <button className="icon-button" title="Remove relationship" onClick={() => void saveRelationship({ ...relations, edges: relations.edges.filter((edge) => edge.id !== item.id) })}>×</button> : null}</div>)}
                {selectedChange ? <div className="add-relation"><select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as Relation['type'])}><option value="depends-on">depends on</option><option value="invokes">invokes</option><option value="emits-to">emits to</option><option value="shares-data-with">shares data with</option></select><select value={relationshipTarget} onChange={(event) => setRelationshipTarget(event.target.value)}><option value="">Target…</option>{capabilityIds.filter((id) => id !== selectedCapability).map((id) => <option key={id} value={id}>{id}</option>)}</select><button onClick={() => void addRelationship()} disabled={!relationshipTarget}>Add</button></div> : <p className="muted">Select or create a change to edit spec relationships.</p>}
                {suggestions.filter((item) => item.source === selectedCapability || item.target === selectedCapability).map((item, index) => <div className="suggestion" key={index}><span>Possible link to {item.source === selectedCapability ? item.target : item.source} · {item.change}</span><button className="quiet" onClick={() => setRelationshipTarget(item.source === selectedCapability ? item.target : item.source)}>Choose target</button></div>)}
              </section>
              <section><h3>Diagnostics</h3>{flowLoading ? <p className="muted">Loading diagnostics…</p> : visibleDiagnostics.length ? visibleDiagnostics.map((item, index) => <div className={`diagnostic ${item.severity}`} key={`${item.code}-${index}`}><strong>{item.code}</strong><span>{item.message}</span>{item.candidate ? <small>Use <code>opsx-chart-graph-to-spec</code> to review the suggested scenario reference.</small> : null}</div>) : <p className="muted">No issues found.</p>}</section>
              {pending.length ? <section><h3>Graphs to reconcile</h3>{pending.map((item) => <div className="pending" key={`${item.archived}-${item.change}`}><strong>{item.change}{item.archived ? ' · archived' : ''}</strong><small>{item.files.length} draft graph files</small><div className="inline-fields"><button className="quiet" onClick={() => void reconcile(item, false)}>Preflight</button><button onClick={() => void reconcile(item, true)} disabled={busy}>Reconcile</button></div></div>)}</section> : null}
            </div>
          </> : null}
        </aside>
      </div>}
  </div>;
}
