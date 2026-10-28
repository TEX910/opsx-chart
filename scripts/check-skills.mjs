import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { workflows } from './install.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skills = path.join(root, 'skills');
let count = 0;
for (const entry of await readdir(skills, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('opsx-chart-')) continue;
  const directory = path.join(skills, entry.name);
  const text = await readFile(path.join(directory, 'SKILL.md'), 'utf8');
  if (!text.startsWith(`---\nname: ${entry.name}\n`) || !/^description: .+/m.test(text)) throw new Error(`Invalid skill frontmatter: ${entry.name}`);
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    if (!match[1].includes('://')) await access(path.resolve(directory, match[1]));
  }
  const operation = entry.name.slice('opsx-chart-'.length);
  if (workflows[operation] && !text.includes(`${workflows[operation]}/SKILL.md`)) throw new Error(`Missing original workflow reference: ${entry.name}`);
  const metadata = await readFile(path.join(directory, 'agents/openai.yaml'), 'utf8');
  const short = /^  short_description: "(.+)"$/m.exec(metadata)?.[1];
  if (!short || short.length < 25 || short.length > 64) throw new Error(`Invalid short description: ${entry.name}`);
  count++;
}
if (count !== 13) throw new Error(`Expected 12 workflow wrappers and one shared skill, found ${count}`);
console.log(`Validated ${count} skills, workflow mappings, metadata and shared references.`);
