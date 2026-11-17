import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTuringFiniteLimit } from '../scripts/turing-compatibility-ui.mjs';

test('Max uses the finite number already present rather than requesting another choice', () => {
  assert.equal(resolveTuringFiniteLimit('327', 99), 327);
  assert.equal(resolveTuringFiniteLimit('1', null), 1);
  assert.equal(resolveTuringFiniteLimit('1000000', null), 1000000);
});
test('missing or invalid field safely falls back to the known saved limit then the original default', () => {
  assert.equal(resolveTuringFiniteLimit('', 99), 99);
  assert.equal(resolveTuringFiniteLimit('1000001', 99), 99);
  assert.equal(resolveTuringFiniteLimit('', null), 10000);
});
