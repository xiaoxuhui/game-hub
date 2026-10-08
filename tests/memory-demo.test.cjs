const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../examples/memory-demo/core.js');
test('demo preserves progress, counts wins once and validates imported state', () => {
  let state = core.initial();
  for (const i of [0, 3, 1, 5, 2, 4]) state = core.flip(state, i);
  assert.equal(state.complete, true); assert.equal(state.moves, 3); assert.equal(state.wins, 1);
  assert.deepEqual(core.flip(state, 0), state); assert.deepEqual(core.validate(JSON.parse(JSON.stringify(state))), state);
  assert.equal(core.initial(state.wins).wins, 1);
  for (const changes of [{ matched: [0] }, { open: [0, 3] }, { wins: -1 }, { complete: false }, { open: [6] }]) assert.throws(() => core.validate({ ...state, ...changes }));
});
test('nonmatching pair stays visible until next flip; duplicate flip does not count', () => {
  let state = core.flip(core.initial(), 0); assert.deepEqual(core.flip(state, 0), state);
  state = core.flip(state, 1); assert.deepEqual(state.open, [0, 1]); assert.equal(state.moves, 1);
  state = core.flip(state, 2); assert.deepEqual(state.open, [2]); assert.equal(state.moves, 1);
});
