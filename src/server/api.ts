import express, { type Request, type Response } from 'express';
import chokidar, { type FSWatcher } from 'chokidar';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  consolidateFlows, deleteFlow, graphWorkspaceStatus, initGraphWorkspace, listFlows, loadFlow, loadMapLayout, loadRelations, pendingDrafts,
  preflightReconciliation, reconcileGraph, resetMapLayout, saveFlow, saveMapPosition, saveRelations, validateGraph, digest,
} from './graph-store.js';
import { createOpenSpecChange, projectSnapshot, resolveProjectRoot, validateOpenSpecChange, type ProjectSnapshot } from './openspec.js';

type Handler = (req: Request, res: Response) => Promise<unknown>;
function route(handler: Handler) {
  return (req: Request, res: Response) => { void handler(req, res).catch((error: unknown) => {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }); };
}
function input(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value;
}
function projectPath(root: string, capability: string, change?: string): string {
  if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(capability)) throw new Error('Invalid capability path');
  if (change && !/^[a-z0-9-]+$/.test(change)) throw new Error('Invalid change ID');
  return change
    ? path.join(root, 'openspec', 'changes', change, 'specs', capability, 'spec.md')
    : path.join(root, 'openspec', 'specs', capability, 'spec.md');
}

export async function createApi(initialDirectory: string): Promise<express.Express> {
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  let root: string | null = null;
  let snapshot: ProjectSnapshot | null = null;
  let watcher: FSWatcher | null = null;
  const listeners = new Set<Response>();

  async function selectProject(directory: string) {
    const selected = await resolveProjectRoot(directory);
    const next = await projectSnapshot(selected);
    if (watcher) await watcher.close();
    root = selected;
    snapshot = next;
    watcher = chokidar.watch(path.join(selected, 'openspec'), { ignoreInitial: true, ignored: (file) => file.endsWith('.tmp') });
    watcher.on('all', (_event, file) => {
      for (const response of listeners) response.write(`data: ${JSON.stringify({ kind: 'refresh', file })}\n\n`);
    });
    return next;
  }
  try { await selectProject(initialDirectory); } catch { /* UI can select a project. */ }
  function currentRoot(): string {
    if (!root) throw new Error('Open a local OpenSpec project first');
    return root;
  }
  async function fresh(): Promise<ProjectSnapshot> {
    const next = await projectSnapshot(currentRoot());
    snapshot = next;
    return next;
  }
  async function activeChange(value: unknown): Promise<{ name: string; project: ProjectSnapshot }> {
    const name = input(value, 'active change');
    const project = await fresh();
    if (!project.changes.some((item) => item.name === name)) throw new Error(`Active OpenSpec change does not exist: ${name}`);
    return { name, project };
  }

  app.get('/api/health', route(async (_req, res) => res.json({ ok: true, root })));
  app.get('/api/project', route(async (_req, res) => res.json(snapshot ?? { root: null })));
  app.post('/api/project', route(async (req, res) => res.json(await selectProject(input(req.body?.path, 'path')))));
  app.get('/api/refresh', route(async (_req, res) => res.json(await fresh())));
  app.post('/api/change', route(async (req, res) => {
    const name = input(req.body?.name, 'change name');
    const next = await createOpenSpecChange(currentRoot(), name);
    snapshot = next;
    res.json(next);
  }));
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(': connected\n\n');
    listeners.add(res);
    req.on('close', () => listeners.delete(res));
  });
  app.get('/api/graph-workspace', route(async (_req, res) => res.json(await graphWorkspaceStatus(currentRoot()))));
  app.post('/api/graph-workspace', route(async (req, res) => {
    await activeChange(req.body?.change);
    res.json(await initGraphWorkspace(currentRoot()));
  }));
  app.get('/api/relations', route(async (_req, res) => res.json(await loadRelations(currentRoot()))));
  app.get('/api/map-layout', route(async (_req, res) => res.json(await loadMapLayout(currentRoot()))));
  app.put('/api/map-layout', route(async (req, res) => {
    const { project } = await activeChange(req.body?.change);
    res.json(await saveMapPosition(currentRoot(), input(req.body?.capability, 'capability'), req.body?.position, project));
  }));
  app.delete('/api/map-layout', route(async (req, res) => {
    await activeChange(req.body?.change);
    res.json(await resetMapLayout(currentRoot()));
  }));
  app.put('/api/relations', route(async (req, res) => {
    const { project } = await activeChange(req.body?.change);
    const result = await saveRelations(currentRoot(), req.body?.relations, project);
    res.status(result.diagnostics.some((item) => item.severity === 'error') ? 422 : 200).json({ ...result, error: result.diagnostics.filter((item) => item.severity === 'error').map((item) => item.message).join('; ') || undefined });
  }));
  app.get('/api/flows', route(async (req, res) => res.json(await listFlows(currentRoot(), typeof req.query.change === 'string' ? req.query.change : undefined))));
  app.post('/api/flow/consolidate', route(async (req, res) => {
    await activeChange(req.body?.change);
    res.json(await consolidateFlows(currentRoot(), input(req.body?.capability, 'capability')));
  }));
  app.get('/api/flow', route(async (req, res) => {
    res.json(await loadFlow(currentRoot(), input(req.query.capability, 'capability'), input(req.query.id, 'flow ID'), typeof req.query.change === 'string' ? req.query.change : undefined));
  }));
  app.put('/api/flow', route(async (req, res) => {
    const { name, project } = await activeChange(req.body?.change);
    res.json(await saveFlow(currentRoot(), req.body?.flow, name, project));
  }));
  app.delete('/api/flow', route(async (req, res) => {
    res.json(await deleteFlow(currentRoot(), input(req.body?.capability, 'capability'), input(req.body?.id, 'flow ID'), input(req.body?.change, 'change')));
  }));
  app.get('/api/delta', route(async (req, res) => {
    const file = projectPath(currentRoot(), input(req.query.capability, 'capability'), input(req.query.change, 'change'));
    let content: string | null;
    try { content = await fs.readFile(file, 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') content = null; else throw error; }
    res.json({ path: file, content: content ?? '', digest: digest(content) });
  }));
  app.get('/api/source', route(async (req, res) => {
    const file = projectPath(currentRoot(), input(req.query.capability, 'capability'), typeof req.query.change === 'string' ? req.query.change : undefined);
    res.type('text/markdown').send(await fs.readFile(file, 'utf8'));
  }));
  app.get('/api/diagnostics', route(async (req, res) => res.json(await validateGraph(currentRoot(), typeof req.query.change === 'string' ? req.query.change : undefined, await fresh()))));
  app.get('/api/pending', route(async (_req, res) => res.json(await pendingDrafts(currentRoot()))));
  app.post('/api/preflight', route(async (req, res) => res.json(await preflightReconciliation(currentRoot(), input(req.body?.change, 'change'), req.body?.archived === true))));
  app.post('/api/reconcile', route(async (req, res) => res.json(await reconcileGraph(currentRoot(), input(req.body?.change, 'change'), req.body?.archived === true))));
  app.post('/api/openspec-validate', route(async (req, res) => res.json(await validateOpenSpecChange(currentRoot(), input(req.body?.change, 'change')))));
  app.get('/api/suggestions', route(async (_req, res) => {
    const project = await fresh();
    const existing = await loadRelations(currentRoot());
    const suggestions: Array<{ source: string; target: string; change: string }> = [];
    for (const change of project.changes) {
      const ids = [...new Set(project.proposed.filter((item) => item.change === change.name).map((item) => item.id))];
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        if (!existing.edges.some((item) => item.source === ids[i] && item.target === ids[j] || item.source === ids[j] && item.target === ids[i]))
          suggestions.push({ source: ids[i], target: ids[j], change: change.name });
      }
    }
    res.json(suggestions);
  }));

  const webRoot = fileURLToPath(new URL('../../web-dist/', import.meta.url));
  app.use(express.static(webRoot));
  app.get('/{*path}', route(async (_req, res) => { res.sendFile(path.join(webRoot, 'index.html')); }));
  return app;
}
