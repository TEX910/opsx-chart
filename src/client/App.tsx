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
type DeltaFile = { path: string; content: string; digest: string | null };
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
  const [flowSelection, setFlowSelection] = useState('');
  const [flow, setFlow] = useState<Flow | null>(null);
  const [flowScope, setFlowScope] = useState<'current' | 'change'>('current');
  const [dirtyFlow, setDirtyFlow] = useState(false);
  const [externalChanged, setExternalChanged] = useState(false);
  const helpDialog = useRef<HTMLDialogElement | null>(null);
  const [newFlowId, setNewFlowId] = useState('');
  const [newFlowName, setNewFlowName] = useState('');
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [pending, setPending] = useState<PendingDraft[]>([]);
  const [delta, setDelta] = useState<DeltaFile | null>(null);
  const [deltaText, setDeltaText] = useState('');
  const [deltaDirty, setDeltaDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dirtyRef = useRef(false);
  const deltaDirtyRef = useRef(false);
  useEffect(() => { dirtyRef.current = dirtyFlow || deltaDirty; }, [dirtyFlow, deltaDirty]);
  useEffect(() => { deltaDirtyRef.current = deltaDirty; }, [deltaDirty]);

  const currentCapability = project?.current.find((item) => item.id === selectedCapability);
  const proposedCapability = project?.proposed.find((item) => item.id === selectedCapability && item.change === selectedChange);
  const capabilityIds = useMemo(() => project ? [...new Set([...project.current, ...project.proposed].map((item) => item.id))].sort() : [], [project]);
  const flowChoices = flows.filter((item) => item.capability === selectedCapability);
  const selectedFlowSummary = flowChoices.find((item) => `${item.scope}:${item.id}` === flowSelection);

  async function loadSecondary(): Promise<void> {
    const layout = api<MapLayout>('/map-layout').then((next) => { setMapLayout(next); return next; });
    const [nextRelations, nextSuggestions, nextPending, nextGraphWorkspace] = await Promise.all([
      api<Relations>('/relations'), api<Suggestion[]>('/suggestions'), api<PendingDraft[]>('/pending'), api<GraphWorkspace>('/graph-workspace'), layout,
    ]);
    setRelations(nextRelations); setSuggestions(nextSuggestions); setPending(nextPending); setGraphWorkspace(nextGraphWorkspace);
  }

  async function refresh(external = false): Promise<void> {
    try {
      const next = await api<ProjectSnapshot>('/refresh');
      setProject(next);
      setSelectedCapability((current) => current && [...next.current, ...next.proposed].some((item) => item.id === current)
        ? current : next.current[0]?.id ?? next.proposed[0]?.id ?? null);
      await loadSecondary();
      if (external && dirtyRef.current) setExternalChanged(true);
      setError('');
    } catch (failure) { setError(String(failure)); }
  }

  useEffect(() => {
    void api<ProjectSnapshot | { root: null }>('/project').then(async (value) => {
      if (!value.root) return;
      const next = value as ProjectSnapshot;
      setProject(next); setProjectInput(next.root);
      setSelectedCapability(next.current[0]?.id ?? next.proposed[0]?.id ?? null);
      if (!next.current.length) setSelectedChange(next.changes[0]?.name ?? '');
      await loadSecondary();
    }).catch((failure) => setError(String(failure)));
    const stream = new EventSource('/api/events');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    stream.onmessage = () => { clearTimeout(timeout); timeout = setTimeout(() => void refresh(true), 450); };
    return () => { stream.close(); clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    if (!project || !selectedCapability) { setFlows([]); setFlow(null); return; }
    let cancelled = false;
    void Promise.all([
      api<FlowSummary[]>(`/flows?${query({ change: selectedChange || undefined })}`),
      selectedChange ? api<DeltaFile>(`/delta?${query({ capability: selectedCapability, change: selectedChange })}`) : Promise.resolve(null),
      api<Diagnostic[]>(`/diagnostics?${query({ change: selectedChange || undefined })}`),
    ]).then(([list, nextDelta, nextDiagnostics]) => {
      if (cancelled) return;
      setFlows(list); setDiagnostics(nextDiagnostics);
      if (!deltaDirtyRef.current) { setDelta(nextDelta); setDeltaText(nextDelta?.content ?? ''); setDeltaDirty(false); }
      const matching = list.filter((item) => item.capability === selectedCapability);
      if (!matching.some((item) => `${item.scope}:${item.id}` === flowSelection)) setFlowSelection(matching[0] ? `${matching[0].scope}:${matching[0].id}` : '');
    }).catch((failure) => setError(String(failure)));
    return () => { cancelled = true; };
  }, [project, selectedCapability, selectedChange]);

  useEffect(() => {
    if (!selectedCapability || !selectedFlowSummary || !project || dirtyFlow) return;
    let cancelled = false;
    void api<Flow>(`/flow?${query({ capability: selectedCapability, id: selectedFlowSummary.id, change: selectedFlowSummary.scope === 'change' ? selectedChange : undefined })}`)
      .then((next) => { if (!cancelled) { setFlow(next); setFlowScope(selectedFlowSummary.scope); setSelectedCase(null); } })
      .catch((failure) => setError(String(failure)));
    return () => { cancelled = true; };
  }, [selectedCapability, flowSelection, selectedChange, project]);

  async function openProject(): Promise<void> {
    setBusy(true); setError(''); setMessage('');
    try {
      const next = await post<ProjectSnapshot>('/project', { path: projectInput });
      setGraphWorkspace(null);
      setMapLayout(null);
      setProject(next); setSelectedCapability(next.current[0]?.id ?? next.proposed[0]?.id ?? null);
      setSelectedChange(next.current.length ? '' : next.changes[0]?.name ?? ''); setFlow(null); setFlowSelection(''); setDirtyFlow(false); setDeltaDirty(false);
      await loadSecondary();
      setMessage(`Project opened: ${next.root}`);
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  }

  async function initializeGraphWorkspace(): Promise<void> {
    setBusy(true);
    try {
      const result = await post<{ root: string; path: string; created: boolean }>('/graph-workspace', {});
      setGraphWorkspace({ path: result.path, initialized: true });
      setMessage(result.created ? `Graph workspace created: ${result.path}` : `Graph workspace already exists: ${result.path}`);
      setError('');
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  }

  async function saveRelationship(next: Relations): Promise<void> {
    try {
      const result = await put<{ relations: Relations; diagnostics: Diagnostic[] }>('/relations', next);
      setRelations(result.relations); setDiagnostics(result.diagnostics); setMessage('Relations saved.'); setError('');
    } catch (failure) { setError(String(failure)); }
  }

  async function moveMapNode(id: string, position: MapPosition): Promise<void> {
    setMapSaving(true);
    try {
      const next = await put<MapLayout>('/map-layout', { capability: id, position });
      setMapLayout(next);
      setMessage(`Position saved for ${id}.`); setError('');
    } catch (failure) { setError(String(failure)); }
    finally { setMapSaving(false); }
  }

  async function resetMapPositions(): Promise<void> {
    setMapSaving(true);
    try {
      setMapLayout(await remove<MapLayout>('/map-layout', {}));
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

  async function createFlow(): Promise<void> {
    if (!selectedCapability || !/^[a-z0-9-]+$/.test(newFlowId)) { setError('Flow IDs must contain lowercase letters, numbers, and hyphens.'); return; }
    try {
      const result = await put<{ flow: Flow; scope: 'current' | 'change' }>('/flow', { flow: emptyFlow(selectedCapability, newFlowId, newFlowName.trim() || newFlowId), change: selectedChange || undefined });
      setFlow(result.flow); setFlowScope(result.scope); setFlowSelection(`${result.scope}:${newFlowId}`);
      setDirtyFlow(false); setNewFlowId(''); setNewFlowName(''); setPage('flow');
      setFlows(await api<FlowSummary[]>(`/flows?${query({ change: selectedChange || undefined })}`));
      setMessage('Flow created.'); setError('');
    } catch (failure) { setError(String(failure)); }
  }

  async function saveCurrentFlow(): Promise<void> {
    if (!flow) return;
    setBusy(true);
    try {
      const result = await put<{ flow: Flow; scope: 'current' | 'change'; diagnostics: Diagnostic[] }>('/flow', { flow, change: selectedChange || undefined });
      setFlow(result.flow); setFlowScope(result.scope); setFlowSelection(`${result.scope}:${flow.id}`);
      setDirtyFlow(false); setExternalChanged(false); setDiagnostics(result.diagnostics);
      setFlows(await api<FlowSummary[]>(`/flows?${query({ change: selectedChange || undefined })}`));
      setMessage(result.scope === 'change' ? 'Graph draft saved in the change.' : 'Layout saved in the current graph.'); setError('');
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  }

  async function deleteCurrentFlow(): Promise<void> {
    if (!flow || !selectedChange || !window.confirm(`Mark “${flow.name}” for deletion in change ${selectedChange}?`)) return;
    try {
      const result = await remove<Flow>('/flow', { capability: flow.capability, id: flow.id, change: selectedChange });
      setFlow(result); setFlowScope('change'); setFlowSelection(`change:${flow.id}`);
      setFlows(await api<FlowSummary[]>(`/flows?${query({ change: selectedChange })}`));
      setMessage('Deletion proposed in the change.'); setError('');
    } catch (failure) { setError(String(failure)); }
  }

  async function saveDelta(): Promise<void> {
    if (!selectedCapability || !selectedChange || !delta) return;
    try {
      const next = await put<{ path: string; digest: string }>('/delta', { capability: selectedCapability, change: selectedChange, content: deltaText, baseDigest: delta.digest });
      setDelta({ path: next.path, digest: next.digest, content: deltaText }); setDeltaDirty(false);
      setMessage('Spec delta saved. Verify the change before reconciliation.'); setError('');
    } catch (failure) { setError(String(failure)); }
  }

  async function reconcile(item: PendingDraft, execute: boolean): Promise<void> {
    setBusy(true);
    try {
      if (execute) {
        const result = await post<{ files: string[] }>('/reconcile', { change: item.change, archived: item.archived });
        setMessage(`Graphs reconciled: ${result.files.join(', ')}`);
        setPending(await api<PendingDraft[]>('/pending'));
        await refresh();
      } else {
        const result = await post<{ diagnostics: Diagnostic[]; files: string[] }>('/preflight', { change: item.change, archived: item.archived });
        setDiagnostics(result.diagnostics); setMessage(result.diagnostics.length ? `${result.diagnostics.length} issues to review.` : `Preflight passed for ${item.change}.`);
      }
      setError('');
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  }

  function selectCapability(id: string): void {
    if ((dirtyFlow || deltaDirty) && !window.confirm('You have unsaved changes. Switch capability?')) return;
    setSelectedCapability(id); setFlow(null); setFlowSelection(''); setDirtyFlow(false); setDeltaDirty(false);
    setSelectedCase(null); setError('');
  }

  function selectGraphCase(id: string | null): void {
    setSelectedCase(id);
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
        <p><strong>Flow:</strong> one behavior graph for a capability. A flow can be current or saved as a draft inside the active change. Saving a draft does not replace the current graph or update the spec Markdown; the graph is promoted when the change is reconciled. One change can contain several draft flows.</p>
        <p>Edit a Decision as a list of WHEN conditions. Each condition leads to an Outcome or another Decision. Write the THEN on the final Outcome. Chart finds complete paths automatically; link each path to an OpenSpec scenario. The reconciliation skill writes the first condition as WHEN and later conditions as AND.</p>
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
    {externalChanged ? <div className="banner warning">OpenSpec files changed. Your unsaved graph edits are still here. <button onClick={() => { setExternalChanged(false); void refresh(); }}>Refresh data</button></div> : null}
    {!project ? <main className="welcome"><span className="eyebrow">LOCAL WORKSPACE</span><h1>See what your specs describe.</h1><p>Open a folder containing <code>openspec/</code> to explore capabilities, relationships, and flows. Browsing does not change any files.</p><div className="welcome-card">Enter a project path in the bar above to get started.</div></main> :
      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-header"><span className="eyebrow">PROJECT</span><strong title={project.root}>{project.root.split('/').pop()}</strong><small>{project.current.length} current specs · {project.proposed.length} delta</small></div>
          {graphWorkspace?.initialized === false ? <div className="graph-setup"><strong>Graph workspace is not initialized</strong><small>Create <code>openspec/graph/</code> to store project relationships and flows.</small><button onClick={() => void initializeGraphWorkspace()} disabled={busy}>Initialize graph workspace</button></div> : null}
          <div className="sidebar-controls"><input placeholder="Search specs…" value={search} onChange={(event) => setSearch(event.target.value)} /><label className="checkline"><input type="checkbox" checked={focus} onChange={(event) => setFocus(event.target.checked)} /> Connected only</label></div>
          <div className="capability-list">{capabilityIds.filter((id) => id.toLowerCase().includes(search.toLowerCase())).map((id) => <button key={id} className={selectedCapability === id ? 'active' : ''} onClick={() => selectCapability(id)}><span className="cap-dot" />{id}{!project.current.some((item) => item.id === id) ? <em>new</em> : null}</button>)}</div>
          <div className="sidebar-footer"><label>Active change<select value={selectedChange} onChange={(event) => { if (dirtyFlow || deltaDirty) { if (!window.confirm('You have unsaved changes. Switch change?')) return; } setSelectedChange(event.target.value); setDirtyFlow(false); setDeltaDirty(false); }}><option value="">None</option>{project.changes.map((item) => <option key={item.name} value={item.name}>{item.name} · {item.completedTasks}/{item.totalTasks}</option>)}</select></label><small>Behavior edits require an active change.</small></div>
        </aside>
        <main className="main-panel">
          <div className="view-header"><div><span className="eyebrow">{page === 'map' ? 'ONE CAPABILITY PER SPEC' : 'BEHAVIOR'}</span><h1>{page === 'map' ? 'Specification map' : selectedCapability ?? 'Flows'}</h1>{page === 'map' ? <small className="map-help">Drag spec cards to reposition them. Changes save automatically.</small> : null}</div><div className="view-actions">{page === 'map' && mapLayout && Object.keys(mapLayout.positions).length ? <button className="quiet" onClick={() => void resetMapPositions()} disabled={mapSaving}>Reset positions</button> : null}<div className="tabs"><button className={page === 'map' ? 'active' : ''} onClick={() => setPage('map')}>Map</button><button className={page === 'flow' ? 'active' : ''} onClick={() => setPage('flow')}>Flow</button></div></div></div>
          {page === 'map' ? mapLayout ? <MapView key={`${project.root}:${mapLayoutRevision}`} project={project} relations={relations.edges} suggestions={suggestions} selected={selectedCapability} onSelect={selectCapability} search={search} focus={focus} savedPositions={mapLayout.positions} saving={mapSaving} onMove={moveMapNode} /> : <div className="empty-canvas">Loading map…</div> :
            <div className="flow-page"><div className="flow-selection"><label>Flow<select value={flowSelection} onChange={(event) => { if (dirtyFlow && !window.confirm('You have unsaved changes. Switch flow?')) return; setDirtyFlow(false); setFlowSelection(event.target.value); }}><option value="">Select…</option>{flowChoices.map((item) => <option key={`${item.scope}:${item.id}`} value={`${item.scope}:${item.id}`}>{item.name} {item.scope === 'change' ? '· draft' : '· current'}</option>)}</select></label>
              {flow ? <><span className={`pill ${flowScope === 'change' ? 'amber' : ''}`}>{flowScope === 'change' ? 'DRAFT' : 'CURRENT'}</span><button onClick={() => void saveCurrentFlow()} disabled={!dirtyFlow || busy}>Save flow</button><button className="quiet danger" onClick={() => void deleteCurrentFlow()} disabled={!selectedChange}>Delete</button></> : null}</div>
              {flow ? <FlowEditor flow={flow} project={project} change={selectedChange} dirty={dirtyFlow} saving={busy} onSave={() => void saveCurrentFlow()} selectedCase={selectedCase} onSelectCase={selectGraphCase} onChange={(next) => { setFlow(next); setDirtyFlow(true); }} /> : <div className="empty-canvas"><h2>No flow selected</h2><p>Create a flow for this spec or select an existing one.</p></div>}
              <div className="create-flow"><h3>New flow</h3><input placeholder="ID, e.g. login" value={newFlowId} onChange={(event) => setNewFlowId(event.target.value)} /><input placeholder="Display name" value={newFlowName} onChange={(event) => setNewFlowName(event.target.value)} /><button onClick={() => void createFlow()} disabled={!selectedCapability}>Create</button></div>
              {selectedChange && delta ? <section className="flow-delta-editor"><h3>Proposed OpenSpec behavior</h3><p>Review the change's requirements and WHEN/THEN scenarios against the paths above.</p><small className="source-path">{delta.path}</small><textarea className="delta-editor" spellCheck={false} value={deltaText} onChange={(event) => { setDeltaText(event.target.value); setDeltaDirty(true); }} placeholder="# Spec Delta\n\n## ADDED Requirements\n..." /><div className="inline-fields"><button disabled={!deltaDirty} onClick={() => void saveDelta()}>Save delta</button><button className="quiet" onClick={() => void post('/openspec-validate', { change: selectedChange }).then(() => setMessage('OpenSpec change is valid.')).catch((failure) => setError(String(failure)))}>Validate OpenSpec</button></div></section> : null}
            </div>}
        </main>
        <aside className="inspector"><div className="inspector-heading"><span className="eyebrow">SPEC AND CONNECTIONS</span><h2>{selectedCapability ?? 'Select a spec'}</h2></div>
          {selectedCapability ? <>
            <div className="inspector-scroll">
              {currentCapability ? renderSpecConnector(currentCapability) : null}
              {proposedCapability ? renderSpecConnector(proposedCapability) : null}
              {!currentCapability && !proposedCapability ? <p className="muted">No spec for the current selection.</p> : null}
              <section><h3>Connections between specs</h3>{relations.edges.filter((item) => item.source === selectedCapability || item.target === selectedCapability).map((item) => <div className="relation-row" key={item.id}><span>{item.source} <em>{item.type}</em> {item.target}</span><button className="icon-button" title="Remove relationship" onClick={() => void saveRelationship({ ...relations, edges: relations.edges.filter((edge) => edge.id !== item.id) })}>×</button></div>)}
                <div className="add-relation"><select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as Relation['type'])}><option value="depends-on">depends on</option><option value="invokes">invokes</option><option value="emits-to">emits to</option><option value="shares-data-with">shares data with</option></select><select value={relationshipTarget} onChange={(event) => setRelationshipTarget(event.target.value)}><option value="">Target…</option>{capabilityIds.filter((id) => id !== selectedCapability).map((id) => <option key={id} value={id}>{id}</option>)}</select><button onClick={() => void addRelationship()} disabled={!relationshipTarget}>Add</button></div>
                {suggestions.filter((item) => item.source === selectedCapability || item.target === selectedCapability).map((item, index) => <div className="suggestion" key={index}><span>Possible link to {item.source === selectedCapability ? item.target : item.source} · {item.change}</span><button className="quiet" onClick={() => setRelationshipTarget(item.source === selectedCapability ? item.target : item.source)}>Choose target</button></div>)}
              </section>
              <section><h3>Diagnostics</h3>{[...diagnostics, ...(flow && dirtyFlow ? validateFlow(flow) : [])].length ? [...diagnostics, ...(flow && dirtyFlow ? validateFlow(flow) : [])].map((item, index) => <div className={`diagnostic ${item.severity}`} key={`${item.code}-${index}`}><strong>{item.code}</strong><span>{item.message}</span>{item.candidate ? <button className="quiet" onClick={() => { if (!flow) return; setFlow({ ...flow, cases: flow.cases.map((graphCase) => graphCase.id === item.target?.split(':').pop() ? { ...graphCase, scenario: item.candidate! } : graphCase) }); setDirtyFlow(true); }}>Use suggested reference</button> : null}</div>) : <p className="muted">No issues found.</p>}</section>
              {pending.length ? <section><h3>Graphs to reconcile</h3>{pending.map((item) => <div className="pending" key={`${item.archived}-${item.change}`}><strong>{item.change}{item.archived ? ' · archived' : ''}</strong><small>{item.files.length} draft graph files</small><div className="inline-fields"><button className="quiet" onClick={() => void reconcile(item, false)}>Preflight</button><button onClick={() => void reconcile(item, true)} disabled={busy}>Reconcile</button></div></div>)}</section> : null}
            </div>
          </> : null}
        </aside>
      </div>}
  </div>;
}
