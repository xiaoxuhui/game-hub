import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TapeMachine, encodeText, convertProgram } from '../examples/tape-language-release/src/machine.js';

const project = settings => ({
  format: 'tape-language-lab', version: 1, input: '', inputMode: 'text',
  initialTape: '', symbols: 2, ...settings
});

function run(settings) {
  const machine = new TapeMachine(settings);
  while (!machine.done && !machine.error && machine.steps < 2_000_000) machine.step();
  assert.equal(machine.error, null);
  assert.equal(machine.done, true);
  return machine;
}

function readBinary(machine, layout, position) {
  const block = (position < 0 ? -position - 1 : position) * -layout.block;
  const offsets = position < 0 ? layout.negative : layout.positive;
  const value = offsets.reduce((sum, offset, index) => sum + machine.read(block + offset) * 2 ** index, 0);
  return layout.symbols[value];
}

function headBinary(machine, layout) {
  const block = -machine.pointer / layout.block;
  return machine.read(machine.pointer + layout.side) ? -block - 1 : block;
}

test('TM compiles to native BF and P double prime, including both directions and terminal outcomes', () => {
  const original = project({
    language: 'tm', blankSymbol: '□', initialTape: '红蓝 #',
    tmStates: { start: 'init', halt: 'halt', accept: 'yes', reject: 'no' },
    source: [
      'init,红蓝->west,□,L', 'west,□->west.1,甲,L', 'west.1,□->east,乙,R',
      'east,甲->east.1,甲,R', 'east.1,□->east.2,红蓝,R', 'east.2,#->east.3,甲,R',
      'east.3,□->yes,乙,L'
    ].join('\n')
  });
  const expected = run(original);
  for (const target of ['bf', 'pdouble']) {
    const converted = convertProgram(original, target);
    assert.match(converted.project.source, target === 'bf' ? /^[<>+\-[\]]+$/ : /^[λR()]+$/);
    const actual = run(converted.project);
    for (let position = -4; position <= 4; position++) {
      assert.equal(readBinary(actual, converted.layout, position), expected.read(position));
    }
    assert.equal(headBinary(actual, converted.layout), expected.pointer);
    assert.deepEqual(converted.layout.outcome.map(offset => actual.read(actual.pointer + offset)), [0, 1]);
  }
});

test('BF compiles to TM and native P double prime and preserves 32-bit wraparound and loops', () => {
  const original = project({ language: 'bf', cellBits: 32, initialTape: '1 0', source: '<[->+<]>-<-' });
  const expected = run(original);
  for (const target of ['tm', 'pdouble']) {
    assertNumericTape(original, target, expected);
  }
});

test('P double prime compiles to TM and native BF and preserves custom moduli and the right edge', () => {
  const original = project({ language: 'pdouble', initialTape: '4 3 4', symbols: 5, source: 'λR(λR)λ' });
  const expected = run(original);
  for (const target of ['tm', 'bf']) {
    assertNumericTape(original, target, expected);
    const { project: boundary, layout } = convertProgram({ ...original, source: 'R' }, target);
    const result = run(boundary);
    if (layout) assert.deepEqual(layout.outcome.map(offset => result.read(result.pointer + offset)), [1, 1]);
    else assert.equal(result.tmStop, 'reject');
  }
});

function assertNumericTape(original, target, expected) {
  const converted = convertProgram(original, target);
  const actual = run(converted.project), { layout, wordWidth } = converted;
  const read = layout ? position => readBinary(actual, layout, position) : position => actual.read(position);
  for (let cell = -3; cell <= 2; cell++) {
    let value = 0;
    for (let index = 0; index < wordWidth; index++) {
      value += Number(read(-cell * wordWidth + index).at(-1)) * 2 ** index;
    }
    assert.equal(value, expected.read(cell), `cell ${cell}`);
  }
  assert.equal(layout ? headBinary(actual, layout) : actual.pointer, -expected.pointer * wordWidth || 0);
}

test('custom output symbols encode native source, while unsupported I/O is reported', () => {
  const { project: generated } = convertProgram(project({ language: 'tm', source: 'q0 0 -> halt A N' }), 'bf');
  const encoded = encodeText(generated.source, ['○', '红蓝', '◇']);
  assert.equal(encoded.split(' ').length, 6 * generated.source.length);
  assert.deepEqual(new Set(encoded.split(' ')), new Set(['○', '红蓝', '◇']));
  assert.throws(() => convertProgram(project({ language: 'bf', source: '+.' }), 'tm'), /输入或输出/);
  assert.throws(() => convertProgram(project({ language: 'pdouble', source: ',' }), 'bf'), /输入或输出/);
});
