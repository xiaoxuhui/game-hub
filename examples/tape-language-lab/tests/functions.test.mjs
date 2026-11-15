import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TapeMachine, compile, nativeCode, validateProject } from '../src/machine.js';

const options = { functionsEnabled: true };
function run(value) {
  const machine = new TapeMachine({ ...value, functionsEnabled: true });
  for (let steps = 0; steps < 10000 && !machine.done && !machine.error && !machine.waitingForInput; steps++) machine.step();
  return machine;
}
test('function definitions are skipped, calls can be forward, repeated and nested, names can be Chinese', () => {
  const source = '@两次 > @两次\nfn 一次 { + }\nfn 两次 { @一次 @一次 }\nfn unused { ---- }';
  const machine = run({ source });
  assert.equal(machine.done, true); assert.equal(machine.error, null);
  assert.equal(machine.read(0), 2); assert.equal(machine.read(1), 2);
  assert.equal(nativeCode(source, 'bf', options), '++>++');
  assert.equal(machine.program.contexts[0].name, '一次'); assert.equal(machine.program.contexts[0].parent.name, '两次');
  assert.equal(source[machine.program.offsets[0]], '+');
});
test('expanded native code has the same tape, pointer, output and steps for both languages', () => {
  for (const value of [
    { language: 'bf', source: 'fn inc { + }\nfn transfer { [->+<] }\n@inc @inc @inc @transfer > .', cellBits: 16 },
    { language: 'bf', source: 'fn down { - } @down @down .', signedCells: true },
    { language: 'pdouble', source: 'fn inc { λR }\nfn clear { (@inc) }\n@inc @inc @clear', symbols: 4 }
  ]) {
    const first = run(value), code = nativeCode(value.source, value.language, options);
    const second = run({ ...value, source: code });
    assert.equal(first.done, true); assert.equal(second.done, true);
    assert.equal(first.error, null); assert.equal(second.error, null);
    assert.deepEqual([...first.cells], [...second.cells]); assert.deepEqual(first.output, second.output);
    assert.deepEqual(first.numericOutput, second.numericOutput);
    assert.equal(first.pointer, second.pointer); assert.equal(first.steps, second.steps);
    assert.match(code, value.language === 'bf' ? /^[><+\-.,\[\]]*$/ : /^[λR()]*$/);
  }
});
test('function input pauses at the correct source and returns to the caller after input', () => {
  const source = 'fn read { , }\n@read +', machine = run({ source, inputPolicy: 'ask' });
  assert.equal(machine.waitingForInput, true); assert.equal(machine.steps, 0);
  assert.equal(machine.program.contexts[machine.pc].name, 'read');
  assert.equal(machine.program.offsets[machine.pc], source.indexOf(','));
  machine.provideInput('3'); machine.step(); machine.step();
  assert.equal(machine.done, true); assert.equal(machine.value, 4);
});
test('undefined, duplicate, malformed, nested, recursive and unbalanced functions fail with source locations', () => {
  for (const source of ['@missing', 'fn a { + } fn a { - }', 'fn { + }', 'fn a { +', 'fn a { fn b { + } }', 'fn a { @a } @a', 'fn a { @b } fn b { @a } @a', 'fn a { [ } @a ]', '[ fn a { + } ]']) {
    assert.throws(() => compile(source, 'bf', options), error => Number.isInteger(error.offset));
  }
  const source = 'fn a { + }\n@missing';
  assert.throws(() => compile(source, 'bf', options), error => error.offset === source.indexOf('@missing'));
  assert.throws(() => nativeCode('fn read { , } @read', 'pdouble', options), /原始 P′′ 没有/);
});
test('expansion budgets bound exponential calls, even when the function bodies are empty', () => {
  const doubling = (base, count) => Array.from({ length: count }, (_, index) => index ? `fn f${index} { @f${index - 1} @f${index - 1} }` : `fn f0 { ${base} }`).join('\n') + `\n@f${count - 1}`;
  assert.throws(() => compile(doubling('+', 20), 'bf', options), /展开/);
  assert.throws(() => compile(doubling('', 22), 'bf', options), /展开/);
  assert.equal(nativeCode('fn empty { } @empty', 'bf', options), '');
});
test('function setting survives JSON while disabled mode keeps original BF comment behavior', () => {
  const project = { format: 'tape-language-lab', version: 1, language: 'bf', source: 'fn add { +++ } @add @add', input: '', inputMode: 'text', symbols: 2, initialTape: '', functionsEnabled: true };
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(project))), project);
  assert.equal(run(project).value, 6);
  assert.equal(nativeCode(project.source, 'bf'), '+++');
  assert.throws(() => validateProject({ ...project, functionsEnabled: 'yes' }), /函数扩展/);
});
