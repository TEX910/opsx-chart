#!/usr/bin/env node
const [command, ...args] = process.argv.slice(2);
try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 20 || (major === 20 && minor < 19)) throw new Error('OPSX Chart requires Node.js 20.19 or newer. Select a supported Node version and retry.');
  const { main } = await import('../skills/opsx-chart-diagrams/scripts/chart.mjs');
  const { installMain } = await import('../scripts/install.mjs');
  if (command === 'install') await installMain(args);
  else {
    if (!command || command === '--help' || command === 'help') console.log('Install suite: opsx-chart install --root PROJECT [--target agents|claude|cursor|github-copilot|opencode|gemini] [--update]\nOther skill hosts: --skills-dir relative/path\nOnly installed OpenSpec operations receive wrappers. No build or server needed.\n');
    await main(process.argv.slice(2));
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
