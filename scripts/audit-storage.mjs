import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../android/app/src/main/assets/games/', import.meta.url));
const expected = {
  conway: ['conway-life-game.custom-patterns.v1', 'conway-life-game.logic-functions.v1'],
  eml: ['eml_workbench_v2'],
  light: ['light-game/save'],
  turing: ['turing-machine-simulator.project.v1', 'turing-machine-simulator.campaign.v1'],
};

function sourceText(directory) {
  return readdirSync(directory, { withFileTypes: true }).map((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceText(path);
    return /\.(?:js|html)$/.test(entry.name) ? readFileSync(path, 'utf8') : '';
  }).join('\n');
}

const keys = new Map();
for (const [game, names] of Object.entries(expected)) {
  const source = sourceText(join(root, game));
  if (/\b(?:localStorage|sessionStorage)\s*(?:\.\s*clear|\[\s*['"]clear['"]\s*\])\s*\(/.test(source)) {
    throw new Error(`${game}: broad storage clear found`);
  }
  for (const name of names) {
    if (!source.includes(name)) throw new Error(`${game}: missing storage key ${name}`);
    if (keys.has(name)) throw new Error(`${game}: storage key ${name} already belongs to ${keys.get(name)}`);
    keys.set(name, game);
  }
}
console.log(`Verified ${keys.size} distinct storage keys in four pinned bundles; no direct broad clear`);
