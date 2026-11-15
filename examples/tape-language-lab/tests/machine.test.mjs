import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TapeMachine, compile, parseInput, parseTape, validateProject, encodeProject, decodeProject, LIMITS } from '../src/machine.js';
import { EXAMPLES } from '../src/examples.js';

function execute(options, budget = 100000) {
  const machine = new TapeMachine(options);
  for (let i = 0; i < budget && !machine.done && !machine.error; i++) machine.step();
  return machine;
}
test('BF Hello World example has exact byte output', () => {
  const machine = execute({ ...EXAMPLES.bf[0], language: 'bf' });
  assert.equal(machine.done, true); assert.equal(machine.error, null);
  assert.equal(new TextDecoder().decode(Uint8Array.from(machine.output)), 'Hello World!\n');
});
test('BF byte IO echoes UTF-8 and EOF writes zero without consuming extra input', () => {
  const machine = execute({ source: ',[.,],', input: '你好，纸带！\n' });
  assert.deepEqual(machine.output, [...new TextEncoder().encode('你好，纸带！\n')]);
  assert.equal(machine.value, 0); assert.equal(machine.inputAt, machine.input.length);
  const zero = execute({ source: ',.,.', input: '00 FF', inputMode: 'hex' });
  assert.deepEqual(zero.output, [0, 255]);
});
test('decimal input reads numeric bytes, handles whitespace and validates before conversion', () => {
  assert.deepEqual([...parseInput('  0  3\n72\t105 255  ', 'decimal')], [0, 3, 72, 105, 255]);
  assert.deepEqual([...parseInput(' \n ', 'decimal')], []);
  assert.deepEqual([...parseInput('003', 'decimal')], [3]);
  for (const value of ['256', '-1', '3.5', '+3', '1e2', '0xFF', '3,,4', 'NaN', '999999999999999999999']) assert.throws(() => parseInput(value, 'decimal'), /0～255/);
  assert.throws(() => parseInput(Array(LIMITS.input + 1).fill('0').join(' '), 'decimal'), /65,536/);
  const machine = execute({ source: ',.,.,.,.', input: '3 72\n105 255', inputMode: 'decimal' });
  assert.deepEqual(machine.output, [3, 72, 105, 255]);
  const project = { format: 'tape-language-lab', version: 1, language: 'bf', symbols: 2, source: ',.', input: '3 255', inputMode: 'decimal', initialTape: '' };
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(project))), project);
  assert.throws(() => validateProject({ ...project, input: '256' }), /0～255/);
});
test('BF wraps at both byte boundaries and supports negative addresses', () => {
  const machine = execute({ source: '-.+.<+>-' });
  assert.deepEqual(machine.output, [255, 0]); assert.equal(machine.read(-1), 1);
  assert.equal(machine.value, 255); assert.equal(machine.minVisited, -1);
});
test('BF nested loops, zero skip, and transfer use matching brackets', () => {
  const machine = execute({ source: '[+[-]]++[>++[>+<-]<-]' });
  assert.equal(machine.read(2), 4); assert.equal(machine.done, true);
  const transfer = execute({ source: '+++[->+<]' });
  assert.equal(transfer.read(0), 0); assert.equal(transfer.read(1), 3);
});
test('compiler reports unmatched and reversed delimiters at source locations', () => {
  assert.throws(() => compile('ignored\n[+', 'bf'), error => error.offset === 8);
  assert.throws(() => compile('][', 'bf'), error => error.offset === 0);
  assert.throws(() => compile('λR(λ', 'pdouble'), /对应/);
  assert.throws(() => compile('λR+', 'pdouble'), /不认识/);
  assert.throws(() => compile('()', 'pdouble'), /不能为空/);
});
test('P double prime lambda changes the old cell then moves left as one step', () => {
  const machine = new TapeMachine({ language: 'pdouble', source: 'λR', symbols: 4 });
  machine.step(); assert.equal(machine.read(0), 1); assert.equal(machine.pointer, -1); assert.equal(machine.steps, 1);
  machine.step(); assert.equal(machine.pointer, 0); assert.equal(machine.steps, 2); assert.equal(machine.done, true);
});
test('P double prime cyclic alphabet, loop skip, nested iteration and initial tape', () => {
  const clear = execute({ language: 'pdouble', source: '(λ)', initialTape: '1 1 1 1', symbols: 2 });
  assert.equal(clear.pointer, -4); assert.equal(clear.cells.size, 0); assert.equal(clear.done, true);
  const wrap = execute({ language: 'pdouble', source: '(λR)', initialTape: '2', symbols: 4 });
  assert.equal(wrap.value, 0); assert.equal(wrap.done, true);
  const skip = execute({ language: 'pdouble', source: '(λR)', symbols: 2 });
  assert.equal(skip.steps, 1); assert.equal(skip.pointer, 0);
  const nested = execute({ ...EXAMPLES.pdouble[3], language: 'pdouble' });
  assert.equal(nested.done, true); assert.equal(nested.pointer, -1); assert.equal(nested.read(0), 1);
});
test('P double prime refuses to cross its right boundary and keeps last valid state', () => {
  const machine = execute({ language: 'pdouble', source: 'λRR', symbols: 2 });
  assert.match(machine.error, /右边界/); assert.equal(machine.pointer, 0);
  assert.equal(machine.pc, 2); assert.equal(machine.steps, 2); assert.equal(machine.step(), false);
});
test('all supplied examples terminate without errors', () => {
  for (const [language, examples] of Object.entries(EXAMPLES)) for (const example of examples) {
    const machine = execute({ ...example, language });
    assert.equal(machine.error, null, example.name); assert.equal(machine.done, true, example.name);
  }
});

test('BF, P double prime, and TM experiments round trip with numeric and custom ternary symbols', () => {
  const common = { format: 'tape-language-lab', version: 1, input: '', initialTape: '', inputMode: 'text' };
  const projects = [
    { ...common, language: 'bf', source: 'fn 加一 { + } @加一.', cellBits: 32, signedCells: true, symbols: 2, functionsEnabled: true },
    { ...common, language: 'pdouble', source: 'λR', initialTape: '1, 0', symbols: 3 },
    { ...common, language: 'tm', source: '开始.扫描,红蓝->完成,🔴🔵,N', initialTape: '红蓝', blankSymbol: '□',
      tmStates: { start: '开始.扫描', halt: '完成', accept: '', reject: '' } }
  ];
  for (const project of projects) {
    const digits = encodeProject(project);
    assert.match(digits, /^[012]+$/);
    assert.ok(digits.startsWith('{'.charCodeAt(0).toString(3).padStart(6, '0')));
    assert.deepEqual(decodeProject(digits), project);
    for (const alphabet of [['○', '🔴', '◇'], ['红蓝', '红', '🔴🔵']]) {
      const encoded = encodeProject(project, alphabet);
      assert.deepEqual(decodeProject(encoded, alphabet), project);
    }
    const machine = execute(decodeProject(digits));
    assert.equal(machine.error, null);
    assert.equal(machine.done, true);
  }
  const encoded = encodeProject(projects[2], ['A', 'B', 'C']);
  assert.deepEqual(decodeProject(`${encoded.slice(0, 12)}\n${encoded.slice(12)}`, ['A', 'B', 'C']), projects[2]);
  assert.throws(() => encodeProject(projects[0], ['A', 'A', 'C']), /不同的符号/);
  assert.throws(() => decodeProject('012012X'), /未设置的符号/);
  assert.throws(() => decodeProject('01201'), /长度不完整/);
  assert.throws(() => decodeProject('222222'), /超出/);
  assert.throws(() => decodeProject('000000'), /无法解码/);
});

test('TM selects a rule by state and symbol, writes before moving, and supports both tape directions', () => {
  const machine = new TapeMachine({
    language: 'tm',
    source: 'q0 1 -> left 2 L # leave a marker\nleft 0 -> back 1 R\nback 2 -> accept 0 S',
    initialTape: '1 2',
    symbols: 3
  });
  assert.equal(machine.read(1), '2');
  assert.equal(machine.pc, 0);
  machine.step();
  assert.deepEqual([machine.tmState, machine.pointer, machine.read(0), machine.pc], ['left', -1, '2', 1]);
  machine.step();
  assert.deepEqual([machine.tmState, machine.pointer, machine.read(-1), machine.pc], ['back', 0, '1', 2]);
  machine.step();
  assert.deepEqual([machine.tmState, machine.tmStop, machine.pointer, machine.read(0), machine.steps], ['accept', 'accept', 0, '0', 3]);
  assert.equal(machine.done, true);
  assert.equal(machine.step(), false);
});

test('TM distinguishes explicit rejection from a missing transition and diagnoses invalid rules', () => {
  const parity = EXAMPLES.tm[2];
  assert.equal(execute({ ...parity, language: 'tm', initialTape: '1 1 1' }).tmStop, 'reject');
  assert.equal(execute({ ...parity, language: 'tm' }).tmStop, 'accept');
  const missing = execute({ language: 'tm', source: 'q0 0 -> later 1 R' });
  assert.deepEqual([missing.tmState, missing.tmStop, missing.steps, missing.error], ['later', 'no-rule', 1, null]);
  const repeat = 'q0 0 -> next 1 R\nq0 0 -> halt 0 S';
  assert.throws(() => compile(repeat, 'tm'), error => /重复/.test(error.message) && error.offset === repeat.indexOf('\n') + 1);
  assert.throws(() => compile('q0 A,B -> halt X N', 'tm'), /每条规则/);
  assert.throws(() => compile('halt 0 -> q0 0 L', 'tm'), /终止状态/);
  assert.throws(() => compile('q0 0 -> halt 0 X', 'tm'), /L\/R\/N/);
  assert.deepEqual(compile('q0 0 -> halt 0 S', 'tm').ops, ['q0 0 -> halt 0 N']);
});

test('TM accepts comma-separated rules and normalizes mixed separators in the listing', () => {
  const source = ['q0,1->q0,1,R\\', 'q0,□->HALT,1,N'].join('\n');
  const machine = execute({ language: 'tm', source, blankSymbol: '□', initialTape: '1, 1', tmStates: { halt: 'HALT' } });
  assert.deepEqual(machine.program.ops, ['q0 1 -> q0 1 R', 'q0 □ -> HALT 1 N']);
  assert.deepEqual([machine.tmStop, machine.pointer, machine.steps, machine.read(2)], ['halt', 2, 3, '1']);
  assert.deepEqual(compile('q0 ， 红蓝 → halt A01,N # mixed', 'tm').ops, ['q0 红蓝 -> halt A01 N']);
  assert.throws(() => compile('q0,,1 -> halt 1 N', 'tm'), /每条规则/);
});

test('TM can add unary operands using dotted states', () => {
  const options = {
    language: 'tm', blankSymbol: '□', initialTape: '1 1 + 1 1 1',
    tmStates: { start: 'add.scan', halt: 'HALT' },
    source: String.raw`add.scan,1->add.scan,1,R\
add.scan,+->add.end,1,R\
add.end,1->add.end,1,R\
add.end,□->add.trim,□,L\
add.trim,1->HALT,□,N`
  };
  const machine = execute(options);
  assert.deepEqual([machine.tmState, machine.tmStop, machine.steps], ['HALT', 'halt', 8]);
  assert.deepEqual([...machine.cells.values()], ['1', '1', '1', '1', '1']);
  assert.equal(machine.read(5), '□');

  const dottedHalt = execute({ ...options, source: options.source.replace('HALT', 'add.done'), tmStates: { ...options.tmStates, halt: 'add.done' } });
  assert.deepEqual([dottedHalt.tmState, dottedHalt.tmStop], ['add.done', 'halt']);
  assert.throws(() => compile('', 'tm', { tmStates: { start: 'add..scan' } }), /初始状态/);
});

test('TM supports numbered state segments and uses # as a tape symbol or comment', () => {
  const machine = execute({
    language: 'tm', blankSymbol: '□', initialTape: '#',
    tmStates: { start: 'return.0', halt: 'clean.0.0' },
    source: '# fence marker\nreturn.0,#->return.1,#,R # preserve marker\nreturn.1,□->clean.0.0,#,N# end'
  });
  assert.deepEqual(machine.program.ops, ['return.0 # -> return.1 # R', 'return.1 □ -> clean.0.0 # N']);
  assert.deepEqual([machine.tmStop, machine.tmState, machine.steps], ['halt', 'clean.0.0', 2]);
  assert.deepEqual([...machine.cells], [[0, '#'], [1, '#']]);
  const blank = execute({ language: 'tm', blankSymbol: '#', source: 'q0,#->halt,1,N' });
  assert.deepEqual([blank.tmStop, blank.read(0), blank.read(1)], ['halt', '1', '#']);
});

test('TM uses custom start and terminal names without moving on N', () => {
  const tmStates = { start: '开始', halt: '完成', accept: '合格', reject: '不合格' };
  for (const outcome of ['halt', 'accept', 'reject']) {
    const settings = {
      format: 'tape-language-lab', version: 1, language: 'tm', symbols: 2,
      source: `开始 0 -> ${tmStates[outcome]} 1 N`, input: '', inputMode: 'text', initialTape: '', tmStates
    };
    const restored = validateProject(JSON.parse(JSON.stringify(settings)));
    assert.deepEqual(restored.tmStates, tmStates);
    const machine = new TapeMachine(restored);
    assert.equal(machine.tmState, tmStates.start);
    assert.equal(machine.step(), true);
    assert.deepEqual([machine.tmState, machine.tmStop, machine.pointer, machine.read(0)], [tmStates[outcome], outcome, 0, '1']);
    assert.equal(machine.done, true);
  }
  const alreadyAccepted = new TapeMachine({ language: 'tm', tmStates: { start: 'accept' } });
  assert.equal(alreadyAccepted.tmStop, 'accept');
  assert.equal(alreadyAccepted.steps, 0);
  assert.deepEqual(compile('halt 0 -> 完成 0 N', 'tm', { tmStates }).ops, ['halt 0 -> 完成 0 N']);
  assert.throws(() => compile('完成 0 -> 开始 0 N', 'tm', { tmStates }), /终止状态 完成/);
  assert.throws(() => compile('', 'tm', { tmStates: { start: '1bad' } }), /初始状态/);
  assert.throws(() => compile('', 'tm', { tmStates: { accept: 'halt' } }), /不同的名称/);
});

test('TM can halt without a verdict or keep writing past the former cell limit', () => {
  const project = {
    format: 'tape-language-lab', version: 1, language: 'tm', blankSymbol: '□',
    source: 'q0 □ -> halt A01 N', initialTape: '', input: '', inputMode: 'text',
    tmStates: { start: 'q0', halt: 'halt', accept: '', reject: ' ' }
  };
  const restored = validateProject(JSON.parse(JSON.stringify(project)));
  assert.deepEqual(restored.tmStates, { start: 'q0', halt: 'halt', accept: '', reject: '' });
  const halted = execute(restored);
  assert.deepEqual([halted.done, halted.tmStop, halted.value, halted.steps], [true, 'halt', 'A01', 1]);
  assert.throws(() => compile('', 'tm', { tmStates: { start: '' } }), /初始状态/);

  const steps = LIMITS.cells + 1;
  const writer = execute({
    ...restored, source: 'q0 □ -> halt A01 R\nhalt □ -> q0 A01 R',
    tmStates: { ...restored.tmStates, halt: '' }
  }, steps);
  assert.deepEqual([writer.done, writer.tmStop, writer.error], [false, null, null]);
  assert.deepEqual([writer.cells.size, writer.pointer, writer.steps], [steps, steps, steps]);
  assert.equal(writer.read(steps - 1), 'A01');
  assert.equal(writer.value, '□');
});

test('TM treats the selected symbol as blank and preserves zero as data', () => {
  const project = {
    format: 'tape-language-lab', version: 1, language: 'tm', symbols: 3, blankSymbol: 2,
    source: 'q0 0 -> left 2 L\nleft 2 -> accept 0 N',
    initialTape: '0, 2', input: '', inputMode: 'text'
  };
  const restored = validateProject(JSON.parse(JSON.stringify(project)));
  assert.equal(restored.blankSymbol, '2');
  const machine = new TapeMachine(restored);
  assert.deepEqual([...machine.cells], [[0, '0']]);
  assert.equal(machine.read(-1), '2');
  assert.equal(machine.read(100), '2');
  machine.step();
  assert.equal(machine.cells.size, 0);
  assert.equal(machine.value, '2');
  machine.step();
  assert.deepEqual([...machine.cells], [[-1, '0']]);
  assert.equal(machine.tmStop, 'accept');
  for (const blankSymbol of ['', ' ', '两个 字', 'A,B', -1, 1.5, null]) {
    assert.throws(() => validateProject({ ...project, blankSymbol }), /空白符号/);
  }
  assert.equal(new TapeMachine({ language: 'tm' }).read(0), '0');
});

test('TM infers its alphabet from the □ blank, whole tokens on the tape, and all rules', () => {
  const machine = new TapeMachine({
    language: 'tm', blankSymbol: '□', initialTape: '红蓝,🔴🔵 01',
    source: 'q0 红蓝 -> next □ R\nnext 🔴🔵 -> check A01 R\ncheck 01 -> end 1 R\nend □ -> halt □ N\nunused X -> halt Y N'
  });
  assert.deepEqual([...machine.alphabet], ['□', '红蓝', '🔴🔵', '01', 'A01', '1', 'X', 'Y']);
  assert.equal(machine.read(100), '□');
  while (!machine.done && !machine.error) machine.step();
  assert.equal(machine.tmStop, 'halt');
  assert.equal(machine.steps, 4);
  assert.equal(machine.read(0), '□');
  assert.deepEqual([...machine.cells], [[1, 'A01'], [2, '1']]);
});

test('initial tape accepts mixed separators while rejecting empty comma entries', () => {
  assert.deepEqual(parseTape('1, 0 2，1', 3), [1, 0, 2, 1]);
  assert.deepEqual(parseTape('-1， -2, 0 3', 256, true), [255, 254, 0, 3]);
  for (const invalid of ['1,,2', '1， ,2', ',1', '1,']) assert.throws(() => parseTape(invalid, 3), /空项/);
});
test('infinite programs can be run in bounded chunks then resumed', () => {
  const machine = execute({ source: '+[]' }, 10000);
  assert.equal(machine.done, false); assert.equal(machine.error, null); assert.equal(machine.steps, 10000);
  machine.step(); assert.equal(machine.steps, 10001);
});
test('output and sparse memory limits stop before corrupting the state', () => {
  const machine = execute({ source: '+[.]' }, LIMITS.output * 3);
  assert.match(machine.error, /输出/); assert.equal(machine.output.length, LIMITS.output);
  const memory = new TapeMachine({ source: '+' });
  for (let i = 1; i <= LIMITS.cells; i++) memory.cells.set(-i, 1);
  memory.step(); assert.match(memory.error, /非零格/); assert.equal(memory.read(0), 0); assert.equal(memory.steps, 0);
});
test('project imports reject unknown languages, malformed byte input and invalid tapes', () => {
  const project = { format: 'tape-language-lab', version: 1, language: 'pdouble', symbols: 2, source: 'λR', input: '', inputMode: 'text', initialTape: '1 1' };
  assert.deepEqual(validateProject(project), project);
  assert.deepEqual(validateProject({ ...project, speed: 'turbo' }), { ...project, speed: 'turbo' });
  assert.deepEqual(validateProject({ ...project, speed: '1234' }), { ...project, speed: '1234' });
  for (const speed of ['0', '-1', '1.5', '', '9007199254740992']) assert.throws(() => validateProject({ ...project, speed }), /速度/);
  assert.throws(() => validateProject({ ...project, speed: 'unrecognized' }), /速度/);
  for (const value of [{ ...project, language: 'javascript' }, { ...project, language: '__proto__' }, { ...project, symbols: 1 }, { ...project, initialTape: '2' }, { ...project, inputMode: 'hex', input: '0G' }]) assert.throws(() => validateProject(value));
  assert.throws(() => parseInput('A', 'hex')); assert.throws(() => parseInput('FF00', 'hex'));
  assert.deepEqual([...parseInput('00 ff 0A', 'hex')], [0, 255, 10]);
  assert.throws(() => parseTape('-1', 256)); assert.throws(() => parseTape('1.5', 256));
});

test('interactive BF waits without changing state, consumes a comma-separated queue and asks again', () => {
  const machine = new TapeMachine({ source: ',>,>,', inputPolicy: 'ask' });
  assert.equal(machine.step(), false); assert.equal(machine.waitingForInput, true);
  assert.equal(machine.pc, 0); assert.equal(machine.steps, 0); assert.equal(machine.value, 0);
  assert.throws(() => machine.provideInput('3,,4'), /0～255/);
  assert.throws(() => machine.provideInput(''), /至少/);
  assert.equal(machine.input.length, 0); assert.equal(machine.waitingForInput, true);
  machine.provideInput('3,0');
  machine.step(); machine.step(); machine.step(); machine.step();
  assert.equal(machine.read(0), 3); assert.equal(machine.read(1), 0);
  assert.equal(machine.step(), false); assert.equal(machine.pc, 4); assert.equal(machine.steps, 4);
  machine.provideInput('255'); machine.step();
  assert.equal(machine.read(2), 255); assert.equal(machine.done, true);
});
test('interactive EOF and P double prime input extension preserve loop and alphabet semantics', () => {
  const echo = new TapeMachine({ source: ',[.,]', inputPolicy: 'ask' });
  echo.step(); echo.provideInput('72,105');
  while (!echo.waitingForInput && !echo.done) echo.step();
  assert.deepEqual(echo.output, [72, 105]);
  echo.finishInput(); while (!echo.done) echo.step();
  assert.equal(echo.error, null); assert.equal(echo.value, 0);
  const p = new TapeMachine({ language: 'pdouble', source: ',λ,', symbols: 4, inputPolicy: 'ask' });
  p.step(); assert.throws(() => p.provideInput('4'), /0～3/);
  assert.equal(p.input.length, 0); assert.equal(p.pc, 0);
  p.provideInput('2，1'); p.step(); p.step(); p.step();
  assert.equal(p.read(0), 3); assert.equal(p.read(-1), 1); assert.equal(p.done, true);
  const project = { format: 'tape-language-lab', version: 1, language: 'bf', symbols: 2, source: ',', input: '', inputMode: 'decimal', inputPolicy: 'ask', initialTape: '' };
  assert.deepEqual(validateProject(project), project);
  assert.equal(validateProject({ ...project, input: '256' }).inputPolicy, 'ask');
  assert.throws(() => validateProject({ ...project, inputPolicy: 'invalid' }), /输入方式/);
});

test('16-bit and 32-bit cells keep large decimal input and initial values exact', () => {
  for (const cellBits of [16, 32]) {
    const maximum = 2 ** cellBits - 1;
    const machine = execute({ source: ',.>+', input: String(maximum), inputMode: 'decimal', cellBits, initialTape: '1000' });
    assert.equal(machine.error, null); assert.equal(machine.read(0), maximum);
    assert.deepEqual(machine.output, [255]); assert.equal(machine.read(1), 1);
    const wrap = execute({ source: '+-', initialTape: String(maximum), cellBits });
    assert.equal(wrap.value, maximum);
    const zero = execute({ source: '+', initialTape: String(maximum), cellBits });
    assert.equal(zero.value, 0);
    const down = execute({ source: '-', cellBits }); assert.equal(down.value, maximum);
    const ask = new TapeMachine({ source: ',>,', cellBits, inputPolicy: 'ask' });
    ask.step(); assert.throws(() => ask.provideInput(String(maximum + 1)));
    assert.equal(ask.input.length, 0);
    ask.provideInput(`1000,${maximum}`); ask.step(); ask.step(); ask.step();
    assert.equal(ask.read(0), 1000); assert.equal(ask.read(1), maximum);
  }
});
test('large P double prime alphabets wrap lambda and survive project files without byte truncation', () => {
  const p = new TapeMachine({ language: 'pdouble', source: ',λ,', symbols: 4294967296, inputPolicy: 'ask' });
  p.step(); p.provideInput('4294967295,1000'); p.step(); p.step(); p.step();
  assert.equal(p.read(0), 0); assert.equal(p.read(-1), 1000); assert.equal(p.error, null);
  const project = { format: 'tape-language-lab', version: 1, language: 'bf', symbols: 2, cellBits: 32, source: ',', input: '4294967295', inputMode: 'decimal', inputPolicy: 'preset', initialTape: '65536' };
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(project))), project);
  assert.equal(execute(project).value, 4294967295);
  for (const value of [{ ...project, cellBits: 64 }, { ...project, cellBits: 8 }, { ...project, input: '4294967296' }, { ...project, language: 'pdouble', symbols: 4294967297 }]) assert.throws(() => validateProject(value));
});
test('signed BF input and display preserve the same bits, wrapping, loop tests and byte output', () => {
  for (const cellBits of [8, 16, 32]) {
    const modulus = 2 ** cellBits, minimum = -modulus / 2, maximum = modulus / 2 - 1;
    const down = execute({ source: '-', cellBits, signedCells: true });
    assert.equal(down.value, modulus - 1); assert.equal(down.display(down.value), -1);
    const wrap = execute({ source: '+', cellBits, signedCells: true, initialTape: String(maximum) });
    assert.equal(wrap.display(wrap.value), minimum);
    const back = execute({ source: '-', cellBits, signedCells: true, initialTape: String(minimum) });
    assert.equal(back.display(back.value), maximum);
    const ask = new TapeMachine({ source: ',.>,>,', cellBits, signedCells: true, inputPolicy: 'ask' });
    ask.step(); assert.throws(() => ask.provideInput(`${maximum + 1}`)); assert.throws(() => ask.provideInput(`${minimum - 1}`));
    assert.equal(ask.input.length, 0);
    ask.provideInput(`-1,${minimum},${maximum}`); while (!ask.done) ask.step();
    assert.equal(ask.display(ask.read(0)), -1); assert.equal(ask.display(ask.read(1)), minimum); assert.equal(ask.display(ask.read(2)), maximum);
    assert.deepEqual(ask.output, [255]);
    const preset = execute({ source: ',+', inputMode: 'decimal', input: '-1', cellBits, signedCells: true });
    assert.equal(preset.value, 0);
  }
  const signed = execute({ source: '[-]', initialTape: '-1', signedCells: true });
  const unsigned = execute({ source: '[-]', initialTape: '255' });
  assert.equal(signed.steps, unsigned.steps); assert.equal(signed.value, unsigned.value);
});
test('signed settings and negative drafts round trip, while legacy and P double prime stay unsigned', () => {
  const project = { format: 'tape-language-lab', version: 1, language: 'bf', source: ',.', input: '-1000', inputMode: 'decimal', inputPolicy: 'preset', symbols: 2, cellBits: 16, signedCells: true, initialTape: '-32768' };
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(project))), project);
  const machine = execute(project); assert.equal(machine.display(machine.value), -1000);
  assert.throws(() => validateProject({ ...project, signedCells: false }));
  assert.throws(() => validateProject({ ...project, signedCells: 'true' }));
  assert.throws(() => validateProject({ ...project, language: 'pdouble', symbols: 65536 }));
  assert.deepEqual([...parseInput('−1,-2', 'decimal', 256, true)], [255, 254]);
  assert.equal(execute({ source: '-' }).value, 255);
});
test('decimal output snapshots keep complete 32-bit values and signed negatives while byte output stays compatible', () => {
  const unsigned = execute({ source: ',.+.', input: '4294967295', inputMode: 'decimal', cellBits: 32 });
  assert.deepEqual(unsigned.numericOutput, [4294967295, 0]);
  assert.deepEqual(unsigned.output, [255, 0]); assert.equal(unsigned.value, 0);
  const signed = execute({ source: ',.,.,.', input: '-2147483648,-1,2147483647', inputMode: 'decimal', cellBits: 32, signedCells: true });
  assert.deepEqual(signed.numericOutput, [-2147483648, -1, 2147483647]);
  assert.deepEqual(signed.output, [0, 255, 255]);
  signed.write(0); assert.deepEqual(signed.numericOutput, [-2147483648, -1, 2147483647]);
  const outputLimit = execute({ source: '+[.]' }, LIMITS.output * 3);
  assert.equal(outputLimit.numericOutput.length, outputLimit.output.length);
  assert.equal(outputLimit.numericOutput.length, LIMITS.output);
});
