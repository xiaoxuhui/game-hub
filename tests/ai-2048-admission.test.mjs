import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dynamicSources, packDynamic, verifyPackedDynamic } from '../scripts/dynamic-resources.mjs';

test('AI 2048 admission freezes the complete source and leaves all existing games unchanged', () => {
  const root = new URL('../', import.meta.url);
  const { sources } = dynamicSources(readFileSync(new URL('dynamic-sources.lock.json', root)));
  const source = sources.find(game => game.id === 'ai-2048');
  assert.ok(source);
  assert.equal(source.directory, 'examples/ai-2048');
  assert.equal(source.storageContract, 'ai-2048-dynamic-v1');
  assert.equal(source.version, '1.1.0');
  assert.equal(source.contentCode, 2);
  const beforeAnimation = JSON.parse(execFileSync('git', ['show', `${source.revision}:dynamic-sources.lock.json`], { cwd: root }));
  assert.deepEqual(JSON.parse(JSON.stringify(sources.filter(game => ![source.id, 'lambda-diagram-game', 'cube-step-solver'].includes(game.id)))), beforeAnimation.sources.filter(game => ![source.id, 'lambda-diagram-game', 'cube-step-solver'].includes(game.id)));
  const previous = JSON.parse(execFileSync('git', ['show', '1136592da3bfafc201dbee53f35244f7186aba6f:dynamic-sources.lock.json'], { cwd: root }));
  assert.deepEqual(JSON.parse(JSON.stringify(sources.filter(game => ![source.id, 'lambda-diagram-game', 'particle-life-lab', 'cube-step-solver'].includes(game.id)))), previous.sources.filter(game => !['lambda-diagram-game','cube-step-solver'].includes(game.id)));
  const base = new URL(`${source.directory}/`, root);
  assert.deepEqual(readdirSync(base).sort(), [...source.files].sort());
  const entries = source.files.map(path => ({ path, data: readFileSync(new URL(path, base)) }));
  const committed = source.files.map(path => ({ path, data: execFileSync('git', ['show', `${source.revision}:${source.directory}/${path}`], { cwd: root }) }));
  for (let i = 0; i < entries.length; i++) assert.deepEqual(entries[i], committed[i]);
  const first = packDynamic(source, entries), second = packDynamic(source, [...committed].reverse());
  assert.deepEqual(first, second);
  verifyPackedDynamic(source, committed, first.game, first.archive);
});
