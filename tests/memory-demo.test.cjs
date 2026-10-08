const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../examples/memory-demo/core.js');
test('demo preserves progress, counts wins once and validates imported state', () => {
  let state = core.initial();
  for (const i of [0, 3, 1, 5, 2, 4]) state = core.flip(state, i);
  assert.equal(state.complete, true); assert.equal(state.moves, 3); assert.equal(state.wins, 1);
  assert.deepEqual(core.flip(state, 0), state); assert.deepEqual(core.validate(JSON.parse(JSON.stringify(state))), state);
  assert.equal(core.initial(state.wins).wins, 1);
  for (const changes of [{ matched: [0] }, { open: [0, 3] }, { wins: -1 }, { wins: 0 }, { moves: 2 }, { complete: false }, { open: [6] }]) assert.throws(() => core.validate({ ...state, ...changes }));
});
test('actual import handler never claims durable success after storage write failure', async () => {
  const { readFileSync } = require('node:fs'); const vm = require('node:vm');
  function element() { return { textContent:'', value:'', replaceChildren(){}, setAttribute(){} }; }
  for (const fails of [true, false]) {
    const elements=Object.fromEntries(['message','status','cards','restart','export','import'].map(id=>[id,element()]));
    const context={ MemoryDemo:core, document:{getElementById:id=>elements[id],createElement:element}, localStorage:{getItem:()=>null,setItem(){if(fails) throw new Error('QuotaExceededError');}},setTimeout };
    vm.runInNewContext(readFileSync(require('node:path').join(__dirname,'../examples/memory-demo/app.js'),'utf8'),context);
    const candidate=core.flip(core.flip(core.initial(),0),3);
    const input={files:[{size:100,text:async()=>JSON.stringify(candidate)}],value:'selected'};
    await elements.import.onchange({target:input});
    assert.equal(input.value,''); assert.match(elements.status.textContent,/1\/3/);
    assert.match(elements.message.textContent,fails?/无法保存.*重启后不会保留/:/已导入并保存/);
  }
});
test('nonmatching pair stays visible until next flip; duplicate flip does not count', () => {
  let state = core.flip(core.initial(), 0); assert.deepEqual(core.flip(state, 0), state);
  state = core.flip(state, 1); assert.deepEqual(state.open, [0, 1]); assert.equal(state.moves, 1);
  state = core.flip(state, 2); assert.deepEqual(state.open, [2]); assert.equal(state.moves, 1);
});
