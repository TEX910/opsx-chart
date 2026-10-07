import { useEffect, useMemo, useRef, useState } from 'react';
import type { Flow, Relation, Relations, Diagnostic } from '../shared/model.js';
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
    const [nextRelations, nextSuggestions, nextPending, nextGraphWorkspace] = await Promise.all([
      api<Relations>('/relations'), api<Suggestion[]>('/suggestions'), api<PendingDraft[]>('/pending'), api<GraphWorkspace>('/graph-workspace'),
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
      setProject(next); setSelectedCapability(next.current[0]?.id ?? next.proposed[0]?.id ?? null);
      setSelectedChange(next.current.length ? '' : next.changes[0]?.name ?? ''); setFlow(null); setFlowSelection(''); setDirtyFlow(false); setDeltaDirty(false);
      await loadSecondary();
      setMessage(`Progetto aperto: ${next.root}`);
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  }

  async function initializeGraphWorkspace(): Promise<void> {
    setBusy(true);
    try {
      const result = await post<{ root: string; path: string; created: boolean }>('/graph-workspace', {});
      setGraphWorkspace({ path: result.path, initialized: true });
      setMessage(result.created ? `Spazio grafi creato: ${result.path}` : `Spazio grafi già presente: ${result.path}`);
      setError('');
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  }

  async function saveRelationship(next: Relations): Promise<void> {
    try {
      const result = await put<{ relations: Relations; diagnostics: Diagnostic[] }>('/relations', next);
      setRelations(result.relations); setDiagnostics(result.diagnostics); setMessage('Relazioni salvate.'); setError('');
    } catch (failure) { setError(String(failure)); }
  }

  async function addRelationship(): Promise<void> {
    if (!selectedCapability || !relationshipTarget) return;
    const next = { ...relations, edges: [...relations.edges, { id: crypto.randomUUID(), source: selectedCapability, target: relationshipTarget, type: relationshipType }] };
    await saveRelationship(next);
  }

  async function createFlow(): Promise<void> {
    if (!selectedCapability || !/^[a-z0-9-]+$/.test(newFlowId)) { setError('L’ID del flusso deve usare lettere minuscole, numeri e trattini.'); return; }
    try {
      const result = await put<{ flow: Flow; scope: 'current' | 'change' }>('/flow', { flow: emptyFlow(selectedCapability, newFlowId, newFlowName.trim() || newFlowId), change: selectedChange || undefined });
      setFlow(result.flow); setFlowScope(result.scope); setFlowSelection(`${result.scope}:${newFlowId}`);
      setDirtyFlow(false); setNewFlowId(''); setNewFlowName(''); setPage('flow');
      setFlows(await api<FlowSummary[]>(`/flows?${query({ change: selectedChange || undefined })}`));
      setMessage('Flusso creato.'); setError('');
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
      setMessage(result.scope === 'change' ? 'Bozza grafica salvata nel change.' : 'Layout salvato nel grafo corrente.'); setError('');
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  }

  async function deleteCurrentFlow(): Promise<void> {
    if (!flow || !selectedChange || !window.confirm(`Segnare “${flow.name}” per l’eliminazione nel change ${selectedChange}?`)) return;
    try {
      const result = await remove<Flow>('/flow', { capability: flow.capability, id: flow.id, change: selectedChange });
      setFlow(result); setFlowScope('change'); setFlowSelection(`change:${flow.id}`);
      setFlows(await api<FlowSummary[]>(`/flows?${query({ change: selectedChange })}`));
      setMessage('Eliminazione proposta nel change.'); setError('');
    } catch (failure) { setError(String(failure)); }
  }

  async function saveDelta(): Promise<void> {
    if (!selectedCapability || !selectedChange || !delta) return;
    try {
      const next = await put<{ path: string; digest: string }>('/delta', { capability: selectedCapability, change: selectedChange, content: deltaText, baseDigest: delta.digest });
      setDelta({ path: next.path, digest: next.digest, content: deltaText }); setDeltaDirty(false);
      setMessage('Delta spec salvata. Verifica il change prima della riconciliazione.'); setError('');
    } catch (failure) { setError(String(failure)); }
  }

  async function reconcile(item: PendingDraft, execute: boolean): Promise<void> {
    setBusy(true);
    try {
      if (execute) {
        const result = await post<{ files: string[] }>('/reconcile', { change: item.change, archived: item.archived });
        setMessage(`Grafi riconciliati: ${result.files.join(', ')}`);
        setPending(await api<PendingDraft[]>('/pending'));
        await refresh();
      } else {
        const result = await post<{ diagnostics: Diagnostic[]; files: string[] }>('/preflight', { change: item.change, archived: item.archived });
        setDiagnostics(result.diagnostics); setMessage(result.diagnostics.length ? `${result.diagnostics.length} problemi da rivedere.` : `Preflight superato per ${item.change}.`);
      }
      setError('');
    } catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  }

  function selectCapability(id: string): void {
    if ((dirtyFlow || deltaDirty) && !window.confirm('Ci sono modifiche non salvate. Cambiare capability?')) return;
    setSelectedCapability(id); setFlow(null); setFlowSelection(''); setDirtyFlow(false); setDeltaDirty(false);
    setSelectedCase(null); setError('');
  }

  function selectGraphCase(id: string | null): void {
    setSelectedCase(id);
  }

  function renderSpecConnector(capability: CapabilityInfo) {
    return <section className="spec-section" key={`${capability.scope}-${capability.change ?? ''}-${capability.id}`}>
      <div className="section-heading"><span className={`pill ${capability.scope === 'change' ? 'amber' : ''}`}>{capability.scope === 'change' ? `DELTA SPEC · ${capability.change}` : 'SPEC ATTUALE'}</span>
        <a href={`/api/source?${query({ capability: capability.id, change: capability.change })}`} target="_blank" rel="noreferrer">Apri Markdown ↗</a></div>
      {capability.purpose ? <p>{capability.purpose}</p> : <p className="muted">{capability.scope === 'change' ? `Modifiche proposte per la spec ${capability.id}.` : 'Descrizione non presente nella spec.'}</p>}
      <small className="source-path" title={capability.sourcePath}>{capability.sourcePath}</small>
    </section>;
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">◈</div><div><strong>OPSX Chart</strong><small>Specifiche connesse, flussi leggibili</small></div></div>
      <div className="project-picker"><input aria-label="Percorso progetto OpenSpec" placeholder="Percorso del progetto OpenSpec" value={projectInput} onChange={(event) => setProjectInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void openProject(); }} /><button onClick={() => void openProject()} disabled={busy}>Apri progetto</button></div>
      <div className="version">{project ? `OpenSpec ${project.openSpecVersion}` : 'Nessun progetto'}</div>
    </header>
    {error ? <div className="banner error" role="alert">{error}<button onClick={() => setError('')}>×</button></div> : null}
    {message ? <div className="banner success">{message}<button onClick={() => setMessage('')}>×</button></div> : null}
    {externalChanged ? <div className="banner warning">I file OpenSpec sono cambiati. Le modifiche non salvate al grafo sono ancora qui. <button onClick={() => { setExternalChanged(false); void refresh(); }}>Aggiorna dati</button></div> : null}
    {!project ? <main className="welcome"><span className="eyebrow">LOCAL WORKSPACE</span><h1>Disegna ciò che le specifiche raccontano.</h1><p>Apri una cartella con <code>openspec/</code> per esplorare capability, relazioni e flussi. La lettura non modifica i file.</p><div className="welcome-card">Inizia inserendo il percorso del progetto nella barra in alto.</div></main> :
      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-header"><span className="eyebrow">PROGETTO</span><strong title={project.root}>{project.root.split('/').pop()}</strong><small>{project.current.length} spec attuali · {project.proposed.length} delta</small></div>
          {graphWorkspace?.initialized === false ? <div className="graph-setup"><strong>Spazio grafi non inizializzato</strong><small>Crea <code>openspec/graph/</code> per salvare relazioni e flussi nel progetto.</small><button onClick={() => void initializeGraphWorkspace()} disabled={busy}>Attiva spazio grafi</button></div> : null}
          <div className="sidebar-controls"><input placeholder="Cerca spec…" value={search} onChange={(event) => setSearch(event.target.value)} /><label className="checkline"><input type="checkbox" checked={focus} onChange={(event) => setFocus(event.target.checked)} /> Solo vicine</label></div>
          <div className="capability-list">{capabilityIds.filter((id) => id.toLowerCase().includes(search.toLowerCase())).map((id) => <button key={id} className={selectedCapability === id ? 'active' : ''} onClick={() => selectCapability(id)}><span className="cap-dot" />{id}{!project.current.some((item) => item.id === id) ? <em>nuova</em> : null}</button>)}</div>
          <div className="sidebar-footer"><label>Change attivo<select value={selectedChange} onChange={(event) => { if (dirtyFlow || deltaDirty) { if (!window.confirm('Ci sono modifiche non salvate. Cambiare change?')) return; } setSelectedChange(event.target.value); setDirtyFlow(false); setDeltaDirty(false); }}><option value="">Nessuno</option>{project.changes.map((item) => <option key={item.name} value={item.name}>{item.name} · {item.completedTasks}/{item.totalTasks}</option>)}</select></label><small>Le modifiche al comportamento richiedono un change.</small></div>
        </aside>
        <main className="main-panel">
          <div className="view-header"><div><span className="eyebrow">{page === 'map' ? 'UNA CAPABILITY PER SPEC' : 'COMPORTAMENTO'}</span><h1>{page === 'map' ? 'Mappa delle specifiche' : selectedCapability ?? 'Flussi'}</h1></div><div className="tabs"><button className={page === 'map' ? 'active' : ''} onClick={() => setPage('map')}>Mappa</button><button className={page === 'flow' ? 'active' : ''} onClick={() => setPage('flow')}>Flusso</button></div></div>
          {page === 'map' ? <MapView project={project} relations={relations.edges} suggestions={suggestions} selected={selectedCapability} onSelect={selectCapability} search={search} focus={focus} /> :
            <div className="flow-page"><div className="flow-selection"><label>Flusso<select value={flowSelection} onChange={(event) => { if (dirtyFlow && !window.confirm('Ci sono modifiche non salvate. Cambiare flusso?')) return; setDirtyFlow(false); setFlowSelection(event.target.value); }}><option value="">Seleziona…</option>{flowChoices.map((item) => <option key={`${item.scope}:${item.id}`} value={`${item.scope}:${item.id}`}>{item.name} {item.scope === 'change' ? '· bozza' : '· attuale'}</option>)}</select></label>
              {flow ? <><span className={`pill ${flowScope === 'change' ? 'amber' : ''}`}>{flowScope === 'change' ? 'BOZZA' : 'ATTUALE'}</span><button onClick={() => void saveCurrentFlow()} disabled={!dirtyFlow || busy}>Salva flusso</button><button className="quiet danger" onClick={() => void deleteCurrentFlow()} disabled={!selectedChange}>Elimina</button></> : null}</div>
              {flow ? <FlowEditor flow={flow} project={project} change={selectedChange} dirty={dirtyFlow} saving={busy} onSave={() => void saveCurrentFlow()} selectedCase={selectedCase} onSelectCase={selectGraphCase} onChange={(next) => { setFlow(next); setDirtyFlow(true); }} /> : <div className="empty-canvas"><h2>Nessun flusso selezionato</h2><p>Crea un flusso per questa spec o selezionane uno esistente.</p></div>}
              <div className="create-flow"><h3>Nuovo flusso</h3><input placeholder="ID, es. login" value={newFlowId} onChange={(event) => setNewFlowId(event.target.value)} /><input placeholder="Nome visualizzato" value={newFlowName} onChange={(event) => setNewFlowName(event.target.value)} /><button onClick={() => void createFlow()} disabled={!selectedCapability}>Crea</button></div>
              {selectedChange && delta ? <section className="flow-delta-editor"><h3>Testo OpenSpec del comportamento proposto</h3><p>Qui trovi i requisiti e gli scenari WHEN/THEN del change. Confrontali con i percorsi disegnati sopra.</p><small className="source-path">{delta.path}</small><textarea className="delta-editor" spellCheck={false} value={deltaText} onChange={(event) => { setDeltaText(event.target.value); setDeltaDirty(true); }} placeholder="# Spec Delta\n\n## ADDED Requirements\n..." /><div className="inline-fields"><button disabled={!deltaDirty} onClick={() => void saveDelta()}>Salva delta</button><button className="quiet" onClick={() => void post('/openspec-validate', { change: selectedChange }).then(() => setMessage('Change OpenSpec valido.')).catch((failure) => setError(String(failure)))}>Valida OpenSpec</button></div></section> : null}
            </div>}
        </main>
        <aside className="inspector"><div className="inspector-heading"><span className="eyebrow">SPEC E CONNESSIONI</span><h2>{selectedCapability ?? 'Seleziona una spec'}</h2></div>
          {selectedCapability ? <>
            <div className="inspector-scroll">
              {currentCapability ? renderSpecConnector(currentCapability) : null}
              {proposedCapability ? renderSpecConnector(proposedCapability) : null}
              {!currentCapability && !proposedCapability ? <p className="muted">Nessuna specifica per la selezione corrente.</p> : null}
              <section><h3>Connessioni tra specifiche</h3>{relations.edges.filter((item) => item.source === selectedCapability || item.target === selectedCapability).map((item) => <div className="relation-row" key={item.id}><span>{item.source} <em>{item.type}</em> {item.target}</span><button className="icon-button" title="Rimuovi relazione" onClick={() => void saveRelationship({ ...relations, edges: relations.edges.filter((edge) => edge.id !== item.id) })}>×</button></div>)}
                <div className="add-relation"><select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as Relation['type'])}><option value="depends-on">dipende da</option><option value="invokes">invoca</option><option value="emits-to">emette verso</option><option value="shares-data-with">condivide dati con</option></select><select value={relationshipTarget} onChange={(event) => setRelationshipTarget(event.target.value)}><option value="">Destinazione…</option>{capabilityIds.filter((id) => id !== selectedCapability).map((id) => <option key={id} value={id}>{id}</option>)}</select><button onClick={() => void addRelationship()} disabled={!relationshipTarget}>Aggiungi</button></div>
                {suggestions.filter((item) => item.source === selectedCapability || item.target === selectedCapability).map((item, index) => <div className="suggestion" key={index}><span>Possibile legame con {item.source === selectedCapability ? item.target : item.source} · {item.change}</span><button className="quiet" onClick={() => setRelationshipTarget(item.source === selectedCapability ? item.target : item.source)}>Scegli destinazione</button></div>)}
              </section>
              <section><h3>Diagnostica</h3>{[...diagnostics, ...(flow && dirtyFlow ? validateFlow(flow) : [])].length ? [...diagnostics, ...(flow && dirtyFlow ? validateFlow(flow) : [])].map((item, index) => <div className={`diagnostic ${item.severity}`} key={`${item.code}-${index}`}><strong>{item.code}</strong><span>{item.message}</span>{item.candidate ? <button className="quiet" onClick={() => { if (!flow) return; setFlow({ ...flow, cases: flow.cases.map((graphCase) => graphCase.id === item.target?.split(':').pop() ? { ...graphCase, scenario: item.candidate! } : graphCase) }); setDirtyFlow(true); }}>Usa riferimento suggerito</button> : null}</div>) : <p className="muted">Nessun problema rilevato.</p>}</section>
              {pending.length ? <section><h3>Grafi da riconciliare</h3>{pending.map((item) => <div className="pending" key={`${item.archived}-${item.change}`}><strong>{item.change}{item.archived ? ' · archiviato' : ''}</strong><small>{item.files.length} file grafici in bozza</small><div className="inline-fields"><button className="quiet" onClick={() => void reconcile(item, false)}>Preflight</button><button onClick={() => void reconcile(item, true)} disabled={busy}>Riconcilia</button></div></div>)}</section> : null}
            </div>
          </> : null}
        </aside>
      </div>}
  </div>;
}
