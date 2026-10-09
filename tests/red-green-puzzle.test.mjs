import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {buildSolution,canFlip,validSize,restoreSize,flowText} from '../examples/red-green-puzzle/core.js';
import {verifyRedGreenSource} from '../scripts/red-green-source.mjs';

const original = readFileSync(new URL('fixtures/red-green-upstream.txt', import.meta.url), 'utf8');
const originalCore = original.slice(original.indexOf('function gray('), original.indexOf('function changedIndex('));
const originalBuild = vm.runInNewContext(originalCore + ';buildSolution');
test('adaptation retains exact frozen HTML fixture, full MIT and reviewed output hashes', () => {
  const proof = verifyRedGreenSource();
  assert.equal(proof.revision,'592027dbc5cab9cb83f91b904f4f23a9e3cbe24b');
  assert.deepEqual(proof.outputs.map(o=>o.path),['LICENSE','app.js','core.js','index.html']);
});

// Enumerate legal neighbours with integer bit masks, independently of the string/Gray implementation.
function shortest(size) {
  const queue = [0], distances = new Map([[0, 0]]), target = 2 ** size - 1;
  for (let head = 0; head < queue.length; head++) {
    const state = queue[head], distance = distances.get(state);
    if (state === target) return distance;
    for (let bit = 0; bit < size; bit++) {
      if (bit && ((state & (1 << (bit - 1))) === 0 || (state & ((1 << (bit - 1)) - 1)) !== 0)) continue;
      const next = state ^ (1 << bit);
      if (!distances.has(next)) { distances.set(next, distance + 1); queue.push(next); }
    }
  }
  throw new Error('Unreachable target');
}
test('every supported size preserves frozen algorithm, legal edges and independent BFS distance', () => {
  for (let size = 1; size <= 10; size++) {
    const states = buildSolution(size);
    assert.deepEqual(states, Array.from(originalBuild(size)));
    assert.equal(states[0], '0'.repeat(size)); assert.equal(states.at(-1), '1'.repeat(size));
    assert.equal(new Set(states).size, states.length);
    assert.ok(states.every((s,i) => !i || canFlip(states[i-1],s)));
    assert.equal(states.length - 1, shortest(size));
  }
  assert.equal(buildSolution(10).length, 683);
});
test('invalid sizes are rejected before building and bounded text remains complete', () => {
  for (const size of [0,11,20,-1,1.5,NaN,Infinity,undefined,null,'10']) {
    assert.equal(validSize(size), false); assert.throws(() => buildSolution(size), RangeError);
  }
  assert.equal(flowText(buildSolution(1)), '0: 0\n1: 1');
  assert.ok(flowText(buildSolution(10)).endsWith('682: 1111111111'));
});
test('only valid versioned parameters restore, invalid storage defaults safely', () => {
  assert.equal(restoreSize('{"schemaVersion":1,"size":10}'), 10);
  for (const raw of [null,'','{','null','{}','{"size":10}','{"schemaVersion":2,"size":10}','{"schemaVersion":1,"size":20}','{"schemaVersion":1,"size":"10"}']) assert.equal(restoreSize(raw),6);
});
