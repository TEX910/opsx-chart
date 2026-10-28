import { readdir, readFile, mkdir, cp, rm, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { exists, safePath, readJSON, parseArgs } from '../skills/opsx-chart-diagrams/scripts/chart.mjs';

export const workflows = {
  explore: 'openspec-explore', propose: 'openspec-propose', update: 'openspec-update-change',
  apply: 'openspec-apply-change', sync: 'openspec-sync-specs', archive: 'openspec-archive-change',
  new: 'openspec-new-change', continue: 'openspec-continue-change', ff: 'openspec-ff-change',
  verify: 'openspec-verify-change', 'bulk-archive': 'openspec-bulk-archive-change', onboard: 'openspec-onboard',
};
const targets = { agents: '.agents/skills', claude: '.claude/skills', cursor: '.cursor/skills',
  'github-copilot': '.github/skills', opencode: '.opencode/skills', gemini: '.gemini/skills' };
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceSkills = path.join(packageRoot, 'skills');
const receiptName = '.opsx-chart-install.json';
async function fileHashes(directory) {
  const result = {};
  async function visit(folder) {
    for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Skill bundle contains a symlink: ${file}`);
      if (entry.isDirectory()) await visit(file);
      else result[path.relative(directory, file).split(path.sep).join('/')] = createHash('sha256').update(await readFile(file)).digest('hex');
    }
  }
  await visit(directory);
  return result;
}
async function selectSkillsDir(root, options) {
  if (options.skillsDir && options.target) throw new Error('Use --target or --skills-dir, not both');
  if (options.skillsDir) return options.skillsDir;
  if (options.target) { if (!targets[options.target]) throw new Error(`Unknown target: ${options.target}`); return targets[options.target]; }
  const found = [];
  for (const directory of Object.values(targets)) {
    const absolute = await safePath(root, directory);
    if (!await exists(absolute)) continue;
    if (await exists(path.join(absolute, 'openspec-propose/SKILL.md'))) found.push(directory);
  }
  if (found.length !== 1) throw new Error(found.length ? `Multiple OpenSpec skill targets found (${found.join(', ')}). Select --target or --skills-dir.` : 'No original OpenSpec skills found. Run openspec init for your assistant first, or select --skills-dir.');
  return found[0];
}
export async function install(options) {
  if (!options.root) throw new Error('--root is required');
  const root = path.resolve(options.root);
  const directory = await selectSkillsDir(root, options);
  const destination = await safePath(root, directory);
  if (!await exists(destination)) throw new Error('Selected skill directory does not exist. Initialize OpenSpec separately.');
  if (path.resolve(destination) === path.resolve(sourceSkills)) throw new Error('This is already the suite source directory; choose a target project.');
  const selected = ['opsx-chart-diagrams'];
  const skipped = [];
  for (const [operation, original] of Object.entries(workflows)) {
    const originalFile = await safePath(root, `${directory}/${original}/SKILL.md`);
    if (await exists(originalFile)) {
      const content = await readFile(originalFile, 'utf8');
      if (!new RegExp(`^name:\\s*["']?${original}["']?\\s*$`, 'm').test(content)) throw new Error(`Original skill name does not match: ${originalFile}`);
      selected.push(`opsx-chart-${operation}`);
    } else skipped.push(operation);
  }
  if (selected.length === 1) throw new Error('No supported original OpenSpec skills in selected directory');
  const receiptFile = await safePath(root, `${directory}/${receiptName}`);
  const previous = await exists(receiptFile) ? await readJSON(receiptFile) : null;
  if (previous && (previous.generator !== 'opsx-chart' || previous.version !== 1 || typeof previous.skills !== 'object')) throw new Error('Invalid OPSX Chart installation receipt');
  const next = { generator: 'opsx-chart', version: 1, skills: { ...(previous?.skills ?? {}) } };
  const changes = [];
  for (const name of selected) {
    const dest = await safePath(root, `${directory}/${name}`);
    const hashes = await fileHashes(path.join(sourceSkills, name));
    if (await exists(dest)) {
      const current = await fileHashes(dest);
      const same = JSON.stringify(current) === JSON.stringify(hashes);
      if (same) { next.skills[name] = hashes; continue; }
      if (!options.update || !previous?.skills[name]) throw new Error(`Existing skill ${name} differs. Move legacy/local files aside; use --update only for a managed installation.`);
      if (JSON.stringify(current) !== JSON.stringify(previous.skills[name])) throw new Error(`Local edits in ${name}; review them before updating.`);
    }
    changes.push({ name, dest, hashes });
  }
  // Stage every bundle first; the originals and project config are never modified.
  const staging = await safePath(root, `${directory}/.opsx-chart-stage-${randomUUID()}`);
  await mkdir(staging);
  const committed = [];
  try {
    for (const item of changes) await cp(path.join(sourceSkills, item.name), path.join(staging, item.name), { recursive: true });
    for (const item of changes) {
      item.previous = await exists(item.dest);
      if (item.previous) await rename(item.dest, path.join(staging, `${item.name}.previous`));
      committed.push(item);
      await rename(path.join(staging, item.name), item.dest);
      next.skills[item.name] = item.hashes;
    }
    const { writeFile } = await import('node:fs/promises');
    const temporaryReceipt = path.join(staging, 'receipt.json');
    await writeFile(temporaryReceipt, `${JSON.stringify(next, null, 2)}\n`);
    await rename(temporaryReceipt, receiptFile);
  } catch (error) {
    for (const item of committed.reverse()) {
      await rm(item.dest, { recursive: true, force: true });
      if (item.previous) await rename(path.join(staging, `${item.name}.previous`), item.dest);
    }
    throw error;
  } finally { await rm(staging, { recursive: true, force: true }); }
  return { skillsDir: destination, installed: changes.map(item => item.name), available: selected, skipped,
    note: 'Only wrappers with an installed original were selected. No OpenSpec configuration, schema, specs, or original skills were modified.' };
}
export async function installMain(args) {
  const options = parseArgs(args);
  if (options._.length) throw new Error(`Unexpected argument: ${options._[0]}`);
  console.log(JSON.stringify(await install(options), null, 2));
}
