#!/usr/bin/env node
import { readFile, writeFile, readdir, mkdir, lstat, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const marker = '<!-- opsx-chart:generated v1 -->';
const renderVersion = 2;
const manifestName = 'sources.json';
const hash = value => createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex');
const slash = value => value.split(path.sep).join('/');
const fail = message => { throw new Error(message); };
const inside = (parent, child) => { const relative = path.relative(parent, child); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); };
export const exists = async file => { try { await lstat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
export async function readJSON(file) { return JSON.parse(await readFile(file, 'utf8')); }
export async function safePath(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || path.isAbsolute(relative)) fail(`Expected a project-relative path: ${relative}`);
  const target = path.resolve(root, relative);
  if (!inside(root, target)) fail(`Path leaves project: ${relative}`);
  const parts = path.relative(root, target).split(path.sep);
  let cursor = root;
  for (const part of parts) {
    cursor = path.join(cursor, part);
    if (await exists(cursor)) {
      const stat = await lstat(cursor);
      if (stat.isSymbolicLink()) fail(`Symlink is not supported in generated-file paths: ${cursor}`);
    }
  }
  return target;
}
async function projectRoot(root) {
  const resolved = await realpath(path.resolve(root));
  const specs = await safePath(resolved, 'openspec/specs');
  if (!await exists(specs)) fail('Expected an existing OpenSpec planning root with openspec/specs. Initialize OpenSpec separately, or pass its resolved planning root.');
  return resolved;
}
async function specFiles(root, directory) {
  const absolute = await safePath(root, directory);
  if (!await exists(absolute)) return [];
  const result = [];
  async function visit(folder) {
    const entries = await readdir(folder, { withFileTypes: true });
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      const file = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) fail(`Spec inventory contains a symlink: ${file}. Use the real planning root.`);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && entry.name === 'spec.md') result.push(slash(path.relative(root, file)));
    }
  }
  await visit(absolute);
  return result;
}
function visibleLines(markdown) {
  let fence = null;
  let comment = false;
  return markdown.split(/\r?\n/).map(line => {
    if (fence) { if (new RegExp(`^\\s{0,3}${fence.char}{${fence.length},}\\s*$`).test(line)) fence = null; return ''; }
    const start = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (!comment && start) { fence = { char: start[1][0], length: start[1].length }; return ''; }
    let output = '';
    while (line.length) {
      if (comment) { const end = line.indexOf('-->'); if (end === -1) return output; line = line.slice(end + 3); comment = false; }
      else { const index = line.indexOf('<!--'); if (index === -1) { output += line; break; } output += line.slice(0, index); line = line.slice(index + 4); comment = true; }
    }
    return output;
  });
}
// This indexes headings for coverage, not normative prose or OpenSpec validation.
export function parseSpec(markdown, delta = false) {
  const requirements = [];
  const renames = [];
  let operation = delta ? null : 'CURRENT';
  let requirement = null;
  let scenario = null;
  let renameFrom = null;
  for (const line of visibleLines(markdown)) {
    const section = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/i.exec(line);
    if (section) { operation = section[1].toUpperCase(); requirement = null; scenario = null; continue; }
    if (/^##\s+/.test(line)) { operation = delta ? null : 'CURRENT'; requirement = null; scenario = null; continue; }
    if (operation === 'RENAMED') {
      const rename = /^\s*-?\s*(FROM|TO):\s*`?###\s+Requirement:\s*(.+?)`?\s*$/i.exec(line);
      if (rename) {
        const name = rename[2].replace(/`$/, '').trim();
        if (rename[1].toUpperCase() === 'FROM') { if (renameFrom) fail('Unpaired RENAMED FROM'); renameFrom = name; }
        else { if (!renameFrom) fail('RENAMED TO has no FROM'); renames.push({ from: renameFrom, to: name }); renameFrom = null; }
      }
      continue;
    }
    const heading = /^###\s+Requirement:\s*(.+?)\s*$/i.exec(line);
    if (heading && operation) {
      requirement = { name: heading[1], operation, scenarios: [], text: line };
      if (requirements.some(item => item.name === requirement.name && item.operation === operation)) fail(`Ambiguous requirement: ${requirement.name}`);
      requirements.push(requirement); scenario = null; continue;
    }
    const scenarioHeading = /^####\s+Scenario:\s*(.+?)\s*$/i.exec(line);
    if (scenarioHeading && requirement) {
      if (requirement.scenarios.some(item => item.name === scenarioHeading[1])) fail(`Ambiguous scenario: ${scenarioHeading[1]}`);
      scenario = { name: scenarioHeading[1], text: line };
      requirement.scenarios.push(scenario);
    } else if (scenario) scenario.text += `\n${line}`;
    if (requirement) requirement.text += `\n${line}`;
  }
  if (renameFrom) fail('Unpaired RENAMED FROM');
  return { requirements, renames };
}
export function effectiveRequirements(base, delta) {
  const result = new Map(base.requirements.map(item => [item.name, { ...item, scenarios: [...item.scenarios] }]));
  if (!delta) return [...result.values()];
  for (const { from, to } of delta.renames) {
    if (!result.has(from) || result.has(to)) fail(`Cannot resolve requirement rename: ${from} -> ${to}`);
    const item = result.get(from); result.delete(from); result.set(to, { ...item, name: to });
  }
  for (const item of delta.requirements) {
    if (item.operation === 'REMOVED') { result.delete(item.name); continue; }
    if (item.operation === 'MODIFIED' && !result.has(item.name)) fail(`Modified requirement has no current source: ${item.name}`);
    if (item.operation === 'MODIFIED') {
      const names = new Set(item.scenarios.map(scenario => scenario.name));
      for (const scenario of result.get(item.name).scenarios) if (!names.has(scenario.name)) fail(`Modified requirement drops scenario ${item.name} / ${scenario.name}; fix or validate the OpenSpec delta first.`);
    }
    result.set(item.name, item);
  }
  return [...result.values()];
}
function capabilityFrom(file, prefix) {
  if (!file.startsWith(`${prefix}/`) || !file.endsWith('/spec.md')) fail(`Not a capability spec beneath ${prefix}: ${file}`);
  const capability = file.slice(prefix.length + 1, -'/spec.md'.length);
  if (!capability || capability.split('/').some(part => !part || part === '.' || part === '..')) fail(`Invalid capability: ${capability}`);
  return capability;
}
export async function snapshot(options) {
  const root = await projectRoot(options.root);
  const currentFiles = await specFiles(root, 'openspec/specs');
  const changeDir = options.changeDir ? slash(path.relative(root, path.resolve(root, options.changeDir))) : null;
  if (changeDir) {
    if (!/^openspec\/changes\/(?:archive\/)?[^/]+$/.test(changeDir) || changeDir === 'openspec/changes/archive') fail('Pass the exact active or archived OpenSpec changeRoot beneath openspec/changes.');
    if (!await exists(await safePath(root, changeDir))) fail(`Missing change: ${changeDir}`);
    if (!options.specFiles?.length) fail('Change views require --spec-file entries from OpenSpec artifactPaths.specs.existingOutputPaths. No spec artifacts means no diagrams to create.');
  } else if (options.specFiles?.length) fail('--spec-file requires --change-dir');
  const deltaFiles = (options.specFiles ?? []).map(file => slash(path.relative(root, path.resolve(root, file)))).sort();
  if (new Set(deltaFiles).size !== deltaFiles.length) fail('Duplicate delta spec path');
  const sources = [];
  const contents = new Map();
  for (const file of [...currentFiles, ...deltaFiles]) {
    await safePath(root, file);
    if (changeDir && deltaFiles.includes(file)) capabilityFrom(file, `${changeDir}/specs`);
    const text = await readFile(path.join(root, file), 'utf8');
    sources.push({ path: file, sha256: hash(text) }); contents.set(file, text);
  }
  const current = new Map(currentFiles.map(file => [capabilityFrom(file, 'openspec/specs'), file]));
  const selected = changeDir ? deltaFiles.map(file => capabilityFrom(file, `${changeDir}/specs`)) : [...current.keys()];
  const specs = [];
  const knownCapabilities = new Set(current.keys());
  for (const capability of selected) {
    const basePath = current.get(capability) ?? null;
    const deltaPath = changeDir ? deltaFiles.find(file => capabilityFrom(file, `${changeDir}/specs`) === capability) : null;
    const base = parseSpec(basePath ? contents.get(basePath) : '');
    const delta = deltaPath ? parseSpec(contents.get(deltaPath), true) : null;
    if (delta && !delta.requirements.length && !delta.renames.length) fail(`No supported requirement deltas in ${deltaPath}`);
    const requirements = effectiveRequirements(base, delta);
    const retired = !!delta && requirements.length === 0;
    if (retired) knownCapabilities.delete(capability); else knownCapabilities.add(capability);
    specs.push({ capability, basePath, deltaPath, retired, requirements,
      removedRequirements: delta?.requirements.filter(item => item.operation === 'REMOVED').map(item => item.name) ?? [],
      renames: delta?.renames ?? [] });
  }
  const packet = { version: 1, root, scope: changeDir ? 'change' : 'current', changeDir,
    outputDir: changeDir ? `${changeDir}/graph` : 'openspec/graph',
    inventory: currentFiles, deltaFiles, sources, knownCapabilities: [...knownCapabilities].sort(), specs };
  packet.id = hash(JSON.stringify(packet));
  return packet;
}
async function verifyPacket(packet, expectedRoot = packet.root) {
  if (packet.version !== 1) fail('Unsupported snapshot version');
  const { id, ...unsigned } = packet;
  if (hash(JSON.stringify(unsigned)) !== id) fail('Snapshot was edited; take a fresh snapshot.');
  const root = await projectRoot(expectedRoot);
  if (root !== packet.root) fail('Snapshot belongs to a different planning root');
  const fresh = await snapshot({ root, changeDir: packet.changeDir, specFiles: packet.deltaFiles });
  if (fresh.id !== packet.id) fail('Specs changed since the snapshot; read the current specs and regenerate the view.');
  return root;
}
const plain = value => String(value).replace(/[\r\n]+/g, ' ').trim();
const md = value => plain(value).replace(/[\\`*_{}\[\]<>#|]/g, '\\$&');
const label = value => plain(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/#/g, '&#35;');
function nonempty(value, name) { if (typeof value !== 'string' || !value.trim()) fail(`Expected nonempty ${name}`); return value; }
const caseKey = item => JSON.stringify([item.requirement, item.scenario]);
function documentLink(from, target) { return slash(path.relative(path.dirname(from), target)).split('/').map(part => encodeURIComponent(part)).join('/'); }
function intro(title, packet) { return `${marker}\n# ${md(title)}\n\n${packet.scope === 'change' ? '**Proposed view:** current specs with this change\'s deltas applied for reading only. OpenSpec remains responsible for validation and merging.' : '**Current view:** derived from the current OpenSpec specifications.'}\n\nGenerated for reading. Change the specification and regenerate this view.\n`; }
function caseGraph(graph, cases) {
  nonempty(graph.title, 'graph title');
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || !Array.isArray(graph.paths) || !graph.paths.length) fail('A shared graph needs nodes, edges and scenario paths');
  const nodes = new Map();
  const edges = new Map();
  const outgoing = new Map();
  const incoming = new Map();
  const types = new Set(['context', 'condition', 'decision', 'outcome']);
  for (const node of graph.nodes) {
    nonempty(node.id, 'node id'); nonempty(node.label, 'node label');
    if (nodes.has(node.id) || !types.has(node.type)) fail('Duplicate node id or unsupported graph node type');
    nodes.set(node.id, node); outgoing.set(node.id, []); incoming.set(node.id, []);
  }
  for (const edge of graph.edges) {
    nonempty(edge.id, 'edge id');
    if (edges.has(edge.id) || !nodes.has(edge.source) || !nodes.has(edge.target)) fail('Duplicate graph edge or missing endpoint');
    if (edge.label !== undefined) nonempty(edge.label, 'branch label');
    if (nodes.get(edge.source).type === 'decision') nonempty(edge.label, 'decision branch label');
    edges.set(edge.id, edge); outgoing.get(edge.source).push(edge); incoming.get(edge.target).push(edge);
  }
  const roots = graph.nodes.filter(node => !incoming.get(node.id).length);
  if (roots.length !== 1 || roots[0].type === 'outcome') fail('A shared graph needs one condition/decision/context root');
  for (const node of graph.nodes) {
    if (node.type === 'outcome' && outgoing.get(node.id).length) fail('An outcome cannot have outgoing edges');
    if (node.type !== 'outcome' && !outgoing.get(node.id).length) fail('A non-outcome node has no result path');
  }
  const visiting = new Set(); const visited = new Set();
  function visit(node) {
    if (visiting.has(node)) fail('Shared scenario graph contains a cycle');
    if (visited.has(node)) return;
    visiting.add(node);
    for (const edge of outgoing.get(node)) visit(edge.target);
    visiting.delete(node); visited.add(node);
  }
  for (const node of nodes.keys()) visit(node);
  const byName = new Map(cases.map(item => [item.scenario, item]));
  const represented = new Set(); const usedEdges = new Set(); const usedNodes = new Set();
  const declaredRoutes = new Set();
  for (const route of graph.paths) {
    if (!byName.has(route.scenario) || represented.has(route.scenario)) fail(`Unknown or duplicate shared-graph scenario: ${route.scenario}`);
    if (!Array.isArray(route.edgeIds) || !route.edgeIds.length) fail('A scenario graph path needs edgeIds');
    let cursor = roots[0].id; usedNodes.add(cursor);
    for (const id of route.edgeIds) {
      const edge = edges.get(id);
      if (!edge || edge.source !== cursor) fail(`Disconnected or missing scenario edge: ${id}`);
      usedEdges.add(id); cursor = edge.target; usedNodes.add(cursor);
    }
    const outcome = nodes.get(cursor);
    if (outcome.type !== 'outcome' || plain(outcome.label) !== plain(byName.get(route.scenario).then)) fail(`Scenario path does not preserve its THEN result: ${route.scenario}`);
    represented.add(route.scenario); declaredRoutes.add(JSON.stringify(route.edgeIds));
  }
  if (usedEdges.size !== edges.size || usedNodes.size !== nodes.size) fail('Shared graph contains nodes or branches not supported by a scenario');
  // Sharing a join and then splitting it can manufacture case combinations.
  // Require every complete route to correspond to an explicit source scenario.
  function verifyRoutes(node, route) {
    if (nodes.get(node).type === 'outcome') {
      if (!declaredRoutes.has(JSON.stringify(route))) fail('Shared graph introduces an undeclared scenario path; split the shared node or correct its branches');
      return;
    }
    for (const edge of outgoing.get(node)) verifyRoutes(edge.target, [...route, edge.id]);
  }
  verifyRoutes(roots[0].id, []);
  const ids = new Map(graph.nodes.map((node, index) => [node.id, `node${index}`]));
  let text = `\n### ${md(graph.title)}\n\n\`\`\`mermaid\nflowchart LR\n`;
  for (const node of graph.nodes) {
    const id = ids.get(node.id); const value = label(node.label);
    text += node.type === 'decision' ? `    ${id}{"${value}"}\n`
      : node.type === 'context' ? `    ${id}(["${value}"])\n`
      : `    ${id}["${node.type === 'condition' ? 'WHEN ' : 'THEN '}${value}"]\n`;
  }
  for (const edge of graph.edges) text += `    ${ids.get(edge.source)} -->${edge.label ? `|"${label(edge.label)}"|` : ''} ${ids.get(edge.target)}\n`;
  text += '```\n';
  if (graph.note) text += `\n${md(nonempty(graph.note, 'graph note'))}\n`;
  text += '\n| Source scenario | WHEN conditions |\n| --- | --- |\n';
  for (const route of graph.paths) text += `| ${md(route.scenario)} | ${md(byName.get(route.scenario).when)} |\n`;
  return { text, represented };
}
export function buildDocuments(packet, model) {
  if (model.snapshot !== packet.id) fail('Model does not reference the current snapshot id');
  if (!Array.isArray(model.flows) || !Array.isArray(model.relations)) fail('Model needs flows and relations arrays');
  const documents = new Map();
  const flows = new Map();
  for (const flow of model.flows) { if (flows.has(flow.capability)) fail(`Duplicate flow: ${flow.capability}`); flows.set(flow.capability, flow); }
  if (flows.size !== packet.specs.length || packet.specs.some(spec => !flows.has(spec.capability))) fail('Provide exactly one flow entry per selected capability, including retired ones.');
  for (const spec of packet.specs) {
    const flow = flows.get(spec.capability);
    if (!Array.isArray(flow.cases)) fail(`Missing cases: ${spec.capability}`);
    const expected = new Map(spec.requirements.flatMap(requirement => requirement.scenarios.map(scenario => [caseKey({ requirement: requirement.name, scenario: scenario.name }), scenario])));
    const seen = new Set();
    for (const item of flow.cases) {
      const key = caseKey(item);
      if (!expected.has(key) || seen.has(key)) fail(`Unknown or duplicate scenario: ${spec.capability} / ${item.requirement} / ${item.scenario}`);
      seen.add(key);
      nonempty(item.when, 'WHEN summary'); nonempty(item.then, 'THEN summary');
      const source = expected.get(key).text;
      if (!/\bWHEN\b/i.test(source) || !/\bTHEN\b/i.test(source)) fail(`Scenario has no explicit WHEN/THEN: ${item.scenario}. Report the missing source content instead of inventing it.`);
    }
    if (seen.size !== expected.size) fail(`Scenario coverage is incomplete or invalid for ${spec.capability}`);
    const graphs = flow.graphs ?? [];
    if (!Array.isArray(graphs)) fail('Flow graphs must be an array');
    if (graphs.some(graph => !spec.requirements.some(item => item.name === graph.requirement))) fail('Shared graph refers to an unknown requirement');
    let text = intro(spec.capability, packet);
    const output = `flows/${spec.capability}.md`;
    const fullOutput = path.posix.join(packet.outputDir, output);
    text += '\n## Sources\n\n';
    for (const source of [spec.basePath, spec.deltaPath].filter(Boolean)) text += `- [${md(source)}](${documentLink(fullOutput, source)})\n`;
    if (spec.retired) text += '\nThis change removes all requirements from this capability. No WHEN/THEN cases remain in this preview.\n';
    for (const removed of spec.removedRequirements) text += `\nRemoved requirement: **${md(removed)}**.\n`;
    for (const rename of spec.renames) text += `\nRenamed requirement: **${md(rename.from)}** → **${md(rename.to)}**.\n`;
    for (const requirement of spec.requirements) {
      text += `\n## ${md(requirement.name)}\n`;
      const cases = flow.cases.filter(item => item.requirement === requirement.name);
      if (!requirement.scenarios.length) text += '\nNo scenarios are specified; no behavior is inferred.\n';
      const grouped = new Set();
      for (const graph of graphs.filter(item => item.requirement === requirement.name)) {
        const result = caseGraph(graph, cases);
        for (const scenario of result.represented) {
          if (grouped.has(scenario)) fail(`Scenario appears in multiple shared graphs: ${scenario}`);
          grouped.add(scenario);
        }
        text += result.text;
      }
      for (const item of cases.filter(item => !grouped.has(item.scenario))) {
        text += `\n### ${md(item.scenario)}\n\n\`\`\`mermaid\nflowchart LR\n    condition["WHEN ${label(item.when)}"] --> outcome["THEN ${label(item.then)}"]\n\`\`\`\n`;
      }
    }
    documents.set(output, `${text.trimEnd()}\n`);
  }
  const known = new Set(packet.knownCapabilities);
  const nodes = new Map([...known].map((capability, index) => [capability, `spec${index}`]));
  let map = intro('Specification map', packet);
  map += '\nArrows run from the referring/dependent spec to the referenced spec. Dotted edges are interpretations, not declared dependencies.\n\n```mermaid\nflowchart LR\n';
  if (!nodes.size) map += '    empty["No current capabilities"]\n';
  for (const [capability, id] of nodes) map += `    ${id}["${label(capability)}"]\n`;
  const relationsSeen = new Set();
  const relationTypes = new Set(['depends-on', 'invokes', 'emits-to', 'shares-data-with', 'related-to']);
  for (const relation of model.relations) {
    if (!known.has(relation.source) || !known.has(relation.target) || relation.source === relation.target) fail('Relation has a missing or identical endpoint');
    if (!relationTypes.has(relation.type) || !['explicit', 'inferred'].includes(relation.basis)) fail('Invalid relation type or basis');
    const key = JSON.stringify([relation.source, relation.type, relation.target]);
    if (relationsSeen.has(key)) fail('Duplicate relation'); relationsSeen.add(key);
    nonempty(relation.evidence?.quote, 'relation evidence quote');
    const sourcePaths = [`openspec/specs/${relation.source}/spec.md`, ...(packet.changeDir ? [`${packet.changeDir}/specs/${relation.source}/spec.md`] : [])];
    if (!sourcePaths.includes(relation.evidence.path) || !packet.sources.some(source => source.path === relation.evidence.path)) fail('Relation evidence must refer to a source spec in this snapshot');
    if (relation.basis === 'inferred' && relation.type !== 'related-to') fail('Use related-to for inferred relationships; never infer a typed dependency');
    const arrow = relation.basis === 'inferred' ? '-.->' : relation.type === 'shares-data-with' || relation.type === 'related-to' ? '---' : '-->';
    map += `    ${nodes.get(relation.source)} ${arrow}|"${label(relation.type)}"| ${nodes.get(relation.target)}\n`;
  }
  map += '```\n\n## Evidence\n';
  if (!model.relations.length) map += '\nNo relationships were established from the source specifications.\n';
  for (const relation of model.relations) {
    map += `\n- **${md(relation.source)} → ${md(relation.target)}** (${relation.type}, ${relation.basis}): “${md(relation.evidence.quote)}” — [source](${documentLink(path.posix.join(packet.outputDir, 'map.md'), relation.evidence.path)}).\n`;
  }
  map += '\n## Scenario views\n';
  for (const spec of packet.specs) map += `\n- [${md(spec.capability)}](flows/${spec.capability.split('/').map(encodeURIComponent).join('/')}.md)${spec.retired ? ' — retired in this preview' : ''}\n`;
  documents.set('map.md', `${map.trimEnd()}\n`);
  return documents;
}
async function atomicWrite(file, text) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, text, { flag: 'wx' }); await rename(temporary, file); }
  finally { if (await exists(temporary)) await unlink(temporary); }
}
async function existingManifest(root, outputDir) {
  const file = await safePath(root, `${outputDir}/${manifestName}`);
  if (!await exists(file)) return null;
  const value = await readJSON(file);
  if (value.generator !== 'opsx-chart' || value.version !== 1 || !Array.isArray(value.outputs)) fail('Existing sources.json is not an OPSX Chart manifest');
  const paths = new Set();
  for (const entry of value.outputs) {
    if (typeof entry.path !== 'string' || !(entry.path === 'map.md' || /^flows\/(?!.*(?:^|\/)\.\.?(?:\/|$))[^\\]+\.md$/.test(entry.path)) || paths.has(entry.path)) fail('Invalid or duplicate generated output path in manifest');
    paths.add(entry.path);
  }
  return value;
}
export async function render(packet, model) {
  const root = await verifyPacket(packet);
  for (const relation of model.relations ?? []) {
    const file = await safePath(root, relation.evidence?.path ?? '');
    const text = await readFile(file, 'utf8');
    if (!text.includes(relation.evidence.quote)) fail('Relationship evidence quote is absent from the source');
  }
  const documents = buildDocuments(packet, model);
  const previous = await existingManifest(root, packet.outputDir);
  // Preflight every write/removal before changing any file. Preserve hand edits.
  for (const [relative] of documents) {
    const file = await safePath(root, `${packet.outputDir}/${relative}`);
    if (await exists(file)) {
      const text = await readFile(file, 'utf8');
      const managed = previous?.outputs.find(item => item.path === relative);
      if (!managed || !text.startsWith(marker) || hash(text) !== managed.sha256) fail(`Refusing to overwrite unmanaged or manually edited diagram: ${relative}`);
    }
  }
  for (const entry of previous?.outputs ?? []) {
    const file = await safePath(root, `${packet.outputDir}/${entry.path}`);
    if (await exists(file) && hash(await readFile(file, 'utf8')) !== entry.sha256) fail(`Generated file was edited: ${entry.path}. Review or move it before regeneration.`);
  }
  await verifyPacket(packet);
  const storedPacket = { ...packet, root: '.' };
  const { id: temporaryId, ...storedUnsigned } = storedPacket;
  storedPacket.id = hash(JSON.stringify(storedUnsigned));
  const manifest = { generator: 'opsx-chart', version: 1, renderVersion, snapshot: storedPacket,
    outputs: [...documents].map(([relative, text]) => ({ path: relative, sha256: hash(text) })) };
  for (const [relative, text] of documents) await atomicWrite(await safePath(root, `${packet.outputDir}/${relative}`), text);
  for (const entry of previous?.outputs ?? []) if (!documents.has(entry.path)) {
    const file = await safePath(root, `${packet.outputDir}/${entry.path}`); if (await exists(file)) await unlink(file);
  }
  await atomicWrite(await safePath(root, `${packet.outputDir}/${manifestName}`), `${JSON.stringify(manifest, null, 2)}\n`);
  return { outputDir: path.join(root, packet.outputDir), diagrams: documents.size };
}
export async function check({ root: inputRoot, graphDir = 'openspec/graph' }) {
  const root = await projectRoot(inputRoot);
  const relative = slash(path.relative(root, path.resolve(root, graphDir)));
  const manifest = await existingManifest(root, relative);
  if (!manifest) fail(`No generated view in ${relative}; generate diagrams first.`);
  const packet = manifest.snapshot;
  if (packet.outputDir !== relative) fail('Manifest belongs to another graph directory');
  // Manifests use project-relative paths and can move with an archived change
  // or a cloned project. A moved archive is regenerated by the archive wrapper.
  const { id: originalId, ...originalUnsigned } = packet;
  if (hash(JSON.stringify(originalUnsigned)) !== originalId) fail('Manifest snapshot was edited');
  const relocated = { ...packet, root };
  const { id: ignored, ...unsigned } = relocated;
  relocated.id = hash(JSON.stringify(unsigned));
  const problems = [];
  if (!manifest.historical && manifest.renderVersion !== renderVersion) problems.push('The diagram rendering contract changed; refresh this view with opsx-chart-diagrams.');
  if (manifest.historical) {
    for (const source of packet.sources.filter(source => packet.deltaFiles.includes(source.path))) {
      const file = await safePath(root, source.path);
      if (!await exists(file) || hash(await readFile(file, 'utf8')) !== source.sha256) problems.push(`Archived delta changed: ${source.path}`);
    }
  } else {
    try { await verifyPacket(relocated, root); } catch (error) { problems.push(error.message); }
  }
  for (const entry of manifest.outputs) {
    const file = await safePath(root, `${relative}/${entry.path}`);
    if (!await exists(file)) problems.push(`Missing diagram: ${entry.path}`);
    else if (hash(await readFile(file, 'utf8')) !== entry.sha256) problems.push(`Diagram edited outside generation: ${entry.path}`);
  }
  return { valid: problems.length === 0, scope: packet.scope, graphDir: path.join(root, relative), problems };
}
export async function freeze({ root: inputRoot, graphDir }) {
  if (!graphDir) fail('--graph-dir is required');
  const root = await projectRoot(inputRoot);
  const relative = slash(path.relative(root, path.resolve(root, graphDir)));
  if (!/^openspec\/changes\/archive\/[^/]+\/graph$/.test(relative)) fail('Freeze needs the actual archived change graph directory');
  const manifest = await existingManifest(root, relative);
  if (!manifest || manifest.snapshot.scope !== 'change') fail('No existing change preview to freeze');
  if (manifest.historical) return check({ root, graphDir: relative });
  const packet = manifest.snapshot;
  const { id, ...unsigned } = packet;
  if (hash(JSON.stringify(unsigned)) !== id) fail('Manifest snapshot was edited');
  const oldChange = packet.changeDir;
  const newChange = path.posix.dirname(relative);
  if (oldChange.startsWith('openspec/changes/archive/')) fail('Expected an active change preview moved by OpenSpec');
  const move = value => value === oldChange || value.startsWith(`${oldChange}/`) ? `${newChange}${value.slice(oldChange.length)}` : value;
  const documents = new Map();
  for (const entry of manifest.outputs) {
    const file = await safePath(root, `${relative}/${entry.path}`);
    let text = await readFile(file, 'utf8');
    if (hash(text) !== entry.sha256 || !text.startsWith(marker)) fail(`Diagram edited before archive: ${entry.path}`);
    const oldFile = path.posix.join(packet.outputDir, entry.path);
    const newFile = path.posix.join(relative, entry.path);
    text = text.replace(/\]\(([^)]+)\)/g, (match, target) => {
      if (/^(?:[a-z]+:|#|\/)/i.test(target)) return match;
      const absolute = path.posix.normalize(path.posix.join(path.posix.dirname(oldFile), decodeURIComponent(target)));
      return `](${documentLink(newFile, move(absolute))})`;
    });
    text = text.replace(/\*\*Proposed view:\*\*[^\n]*/, '**Historical proposed view:** captured before archive. Source hashes retain the original reading context; base-spec links may now lead to later revisions.');
    documents.set(entry.path, text);
  }
  for (const source of packet.sources.filter(source => packet.deltaFiles.includes(source.path))) {
    const file = await safePath(root, move(source.path));
    if (hash(await readFile(file, 'utf8')) !== source.sha256) fail(`Archived source differs: ${source.path}`);
  }
  const nextPacket = { ...packet, root: '.', changeDir: newChange, outputDir: relative,
    deltaFiles: packet.deltaFiles.map(move), sources: packet.sources.map(item => ({ ...item, path: move(item.path) })),
    specs: packet.specs.map(item => ({ ...item, deltaPath: item.deltaPath ? move(item.deltaPath) : null })) };
  const { id: previousId, ...nextUnsigned } = nextPacket;
  nextPacket.id = hash(JSON.stringify(nextUnsigned));
  const next = { ...manifest, historical: true, snapshot: nextPacket,
    outputs: [...documents].map(([file, text]) => ({ path: file, sha256: hash(text) })) };
  for (const [file, text] of documents) await atomicWrite(await safePath(root, `${relative}/${file}`), text);
  await atomicWrite(await safePath(root, `${relative}/${manifestName}`), `${JSON.stringify(next, null, 2)}\n`);
  return check({ root, graphDir: relative });
}
export function parseArgs(args) {
  const result = { _: [], specFiles: [] };
  const values = new Map([['--root', 'root'], ['--change-dir', 'changeDir'], ['--spec-file', 'specFiles'], ['--packet', 'packet'], ['--model', 'model'], ['--graph-dir', 'graphDir'], ['--target', 'target'], ['--skills-dir', 'skillsDir']]);
  for (let i = 0; i < args.length; i++) {
    const argument = args[i];
    if (argument === '--update') result.update = true;
    else if (values.has(argument)) { if (!args[i + 1] || args[i + 1].startsWith('--')) fail(`Missing value for ${argument}`); const key = values.get(argument); if (key === 'specFiles') result.specFiles.push(args[++i]); else result[key] = args[++i]; }
    else if (argument.startsWith('-')) fail(`Unknown option: ${argument}`);
    else result._.push(argument);
  }
  return result;
}
export async function main(args = process.argv.slice(2)) {
  const [command, ...rest] = args;
  if (!command || command === '--help' || command === 'help') {
    console.log('OPSX Chart: read-only Mermaid views managed by OpenSpec skills.\n\nsnapshot --root PATH [--change-dir PATH --spec-file PATH ...]\nrender --packet SNAPSHOT.json --model SUMMARIES.json\ncheck --root PATH [--graph-dir PATH]\nfreeze --root PATH --graph-dir ARCHIVED_CHANGE/graph\n\nSnapshot and check never write project files. Redirect snapshot JSON to a temporary file.'); return;
  }
  const options = parseArgs(rest);
  if (options._.length) fail(`Unexpected argument: ${options._[0]}`);
  let result;
  if (command === 'snapshot') { if (!options.root) fail('--root is required'); result = await snapshot(options); }
  else if (command === 'render') { if (!options.packet || !options.model) fail('--packet and --model are required'); result = await render(await readJSON(options.packet), await readJSON(options.model)); }
  else if (command === 'check') { if (!options.root) fail('--root is required'); result = await check(options); if (!result.valid) process.exitCode = 1; }
  else if (command === 'freeze') { if (!options.root) fail('--root is required'); result = await freeze(options); if (!result.valid) process.exitCode = 1; }
  else fail(`Unknown command: ${command}`);
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
