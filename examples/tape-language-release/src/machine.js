export const LANGUAGES = Object.freeze({
  bf: { name: 'BF', commands: '><+-.,[]', open: '[', close: ']' },
  pdouble: { name: 'P′′ · P double prime', commands: 'λR(),', open: '(', close: ')' },
  tm: { name: 'TM · 图灵机' }
});
export const LIMITS = Object.freeze({ source: 200000, cells: 100000, output: 65536, input: 65536, functions: 256, functionDepth: 64, expansionWork: 500000 });
export const MAX_SYMBOLS = 4294967296;
export const CELL_BITS = [8, 16, 32];
export function valueRange(modulus, signed = false) {
  return signed ? { minimum: -modulus / 2, maximum: modulus / 2 - 1 } : { minimum: 0, maximum: modulus - 1 };
}
export function cellModulus(language, symbols = 2, cellBits = 8) {
  if (!CELL_BITS.includes(cellBits)) throw new Error('BF 单元大小必须是 8、16 或 32 位。');
  if (!Number.isInteger(symbols) || symbols < 2 || symbols > MAX_SYMBOLS) throw new Error('纸带字母表大小必须是 2～4294967296。');
  return language === 'bf' ? 2 ** cellBits : symbols;
}

export class ProgramError extends Error {
  constructor(message, offset = 0) { super(message); this.offset = offset; }
}

export const DEFAULT_TM_STATES = Object.freeze({ start: 'q0', halt: 'halt', accept: 'accept', reject: 'reject' });
const TM_STATE_LABELS = { start: '初始状态', halt: '停机状态', accept: '接受状态', reject: '拒绝状态' };
const TM_STATE_SEGMENT = String.raw`[\p{L}\p{N}_]`;
const TM_STATE_NAME = String.raw`[\p{L}_]${TM_STATE_SEGMENT}*(?:\.${TM_STATE_SEGMENT}+)*`;
const TM_STATE_PATTERN = new RegExp(`^${TM_STATE_NAME}$`, 'u');
const TM_SYMBOL = String.raw`[^\s,，]+`;
const TM_SYMBOL_PATTERN = new RegExp(`^${TM_SYMBOL}$`, 'u');
const FIELD_SEPARATOR = /(?:\s*[,，]\s*|\s+)/;
const TM_RULE_PATTERN = new RegExp(
  String.raw`^(${TM_STATE_NAME})${FIELD_SEPARATOR.source}(${TM_SYMBOL}?)\s*(?:->|→)\s*(${TM_STATE_NAME})${FIELD_SEPARATOR.source}(${TM_SYMBOL})${FIELD_SEPARATOR.source}([LRNS])(?:\s*\\)?(?:\s*#[^\n]*)?$`,
  'u'
);
const TM_MOVE = { L: -1, R: 1, N: 0 };

function normalizeBlankSymbol(value = '0') {
  // Older TM projects stored the blank as a number.
  const symbol = typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : value;
  if (typeof symbol !== 'string' || !TM_SYMBOL_PATTERN.test(symbol.trim())) {
    throw new Error('空白符号不能为空，且不能包含空格或逗号。');
  }
  return symbol.trim();
}

function normalizeTmStates(value = DEFAULT_TM_STATES) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('TM 状态设置无效。');
  const states = {};
  for (const [role, label] of Object.entries(TM_STATE_LABELS)) {
    const name = Object.hasOwn(value, role) ? value[role] : DEFAULT_TM_STATES[role];
    const trimmed = typeof name === 'string' ? name.trim() : null;
    if (!(trimmed === '' && role !== 'start') && !TM_STATE_PATTERN.test(trimmed ?? '')) {
      throw new Error(`${label}名称须以字母、汉字或下划线开头，可用点号连接非空段，如 clean.0.0。每段可含字母、汉字、数字或下划线。`);
    }
    states[role] = trimmed;
  }
  const terminalNames = [states.halt, states.accept, states.reject].filter(Boolean);
  if (new Set(terminalNames).size !== terminalNames.length) {
    throw new Error('停机、接受和拒绝状态必须使用不同的名称。');
  }
  return states;
}

function compileTransitions(source, tmStates) {
  const { start, ...outcomes } = normalizeTmStates(tmStates);
  const terminalStates = new Map(Object.entries(outcomes).filter(([, name]) => name).map(([outcome, name]) => [name, outcome]));
  const transitions = new Map(), rules = [], ops = [], offsets = [], listingOffsets = [];
  const ruleSymbols = new Set();
  let offset = 0, listingOffset = 0;
  for (const line of source.split('\n')) {
    const text = line.trim();
    const ruleOffset = offset + (line.length - line.trimStart().length);
    offset += line.length + 1;
    if (!text || text.startsWith('#')) continue;

    const match = TM_RULE_PATTERN.exec(text);
    if (!match) throw new ProgramError('每条规则填写当前状态、读入、->、下一状态、写入和移动方向 L/R/N。', ruleOffset);
    const [, state, read, nextState, write, move] = match;
    const direction = move === 'S' ? 'N' : move;
    if (terminalStates.has(state)) throw new ProgramError(`终止状态 ${state} 不写出边规则。`, ruleOffset);
    if (!transitions.has(state)) transitions.set(state, new Map());
    const stateTransitions = transitions.get(state);
    if (stateTransitions.has(read)) throw new ProgramError(`状态 ${state} 读取 ${read} 的规则重复。`, ruleOffset);
    stateTransitions.set(read, rules.length);
    ruleSymbols.add(read);
    ruleSymbols.add(write);
    rules.push({ nextState, write, direction });
    ops.push(`${state} ${read} -> ${nextState} ${write} ${direction}`);
    offsets.push(ruleOffset);
    listingOffsets.push(listingOffset);
    listingOffset += ops.at(-1).length + 1;
  }
  return { ops, offsets, contexts: [], functions: [], rules, transitions, listingOffsets, start, terminalStates, ruleSymbols };
}

export function compile(source, language, { functionsEnabled = false, tmStates } = {}) {
  if (!Object.hasOwn(LANGUAGES, language)) throw new Error('不支持的语言。');
  const spec = LANGUAGES[language];
  if (typeof source !== 'string' || source.length > LIMITS.source) throw new Error('代码最多 200,000 个字符。');
  if (language === 'tm') return compileTransitions(source, tmStates);
  if (typeof functionsEnabled !== 'boolean') throw new Error('函数扩展设置无效。');
  const main = [], definitions = new Map();
  let active = null, mainDepth = 0;
  const identifier = /^[_\p{L}][_\p{L}\p{N}]*/u;
  const append = unit => (active ? active.units : main).push(unit);
  for (let offset = 0; offset < source.length; offset++) {
    const op = source[offset];
    if (functionsEnabled) {
      const rest = source.slice(offset);
      if (rest.startsWith('fn') && /^fn(?=\s|\{|$)/.test(rest) && (offset === 0 || !/[_\p{L}\p{N}]/u.test(source[offset - 1]))) {
        if (active || mainDepth !== 0) throw new ProgramError('函数只能定义在主程序的循环之外，不能嵌套定义。', offset);
        const header = /^fn\s+([_\p{L}][_\p{L}\p{N}]*)\s*\{/u.exec(rest);
        if (!header) throw new ProgramError('函数定义请写成 fn 名称 { 指令 }。', offset);
        const name = header[1];
        if (name.length > 64) throw new ProgramError('函数名最多 64 个字符。', offset);
        if (definitions.has(name)) throw new ProgramError(`函数「${name}」重复定义。`, offset);
        if (definitions.size >= LIMITS.functions) throw new ProgramError('最多定义 256 个函数。', offset);
        active = { name, offset, units: [] }; definitions.set(name, active);
        offset += header[0].length - 1; continue;
      }
      if (op === '}') {
        if (!active) throw new ProgramError('这个 } 没有对应的函数定义。', offset);
        active = null; continue;
      }
      if (op === '{') throw new ProgramError('函数体需要使用 fn 名称 { 指令 } 定义。', offset);
      if (op === '@') {
        const name = identifier.exec(source.slice(offset + 1))?.[0];
        if (!name || name.length > 64) throw new ProgramError('函数调用请写成 @名称，名称最多 64 个字符。', offset);
        append({ name, offset }); offset += name.length; continue;
      }
    }
    if (!spec.commands.includes(op)) {
      if (language === 'pdouble' && !/\s/.test(op)) throw new ProgramError(`P′′ 不认识「${op}」，请使用 λ、R、(、) 或输入扩展 ,。`, offset);
      continue;
    }
    append({ op, offset });
    if (!active) {
      if (op === spec.open) mainDepth++;
      if (op === spec.close) mainDepth--;
    }
  }
  if (active) throw new ProgramError(`函数「${active.name}」缺少结束的 }。`, active.offset);
  const checkBlock = units => {
    const stack = [];
    for (const unit of units) {
      if (unit.name && !definitions.has(unit.name)) throw new ProgramError(`未定义函数「${unit.name}」。`, unit.offset);
      if (unit.op === spec.open) stack.push(unit.offset);
      if (unit.op === spec.close && !stack.length) throw new ProgramError(`「${unit.op}」缺少对应的「${spec.open}」。`, unit.offset);
      if (unit.op === spec.close) stack.pop();
    }
    if (stack.length) throw new ProgramError(`「${spec.open}」缺少对应的「${spec.close}」。`, stack.at(-1));
  };
  checkBlock(main); for (const definition of definitions.values()) checkBlock(definition.units);
  const depths = new Map(), visiting = new Set();
  function depth(name, offset) {
    if (visiting.has(name)) throw new ProgramError(`函数不能递归调用：${[...visiting, name].join(' → ')}。递归无法展开为有限的原始代码。`, offset);
    if (depths.has(name)) return depths.get(name);
    visiting.add(name); let result = 1;
    for (const unit of definitions.get(name).units) if (unit.name) result = Math.max(result, depth(unit.name, unit.offset) + 1);
    visiting.delete(name);
    if (result > LIMITS.functionDepth) throw new ProgramError('函数调用最多嵌套 64 层。', offset);
    depths.set(name, result); return result;
  }
  for (const definition of definitions.values()) depth(definition.name, definition.offset);
  const ops = [], offsets = [], contexts = [], jumps = new Map(), stack = [];
  let work = 0;
  function expand(units, context) {
    for (const unit of units) {
      if (++work > LIMITS.expansionWork) throw new ProgramError('函数展开次数过多，请减少重复调用。', context?.callOffset ?? unit.offset);
      if (unit.name) expand(definitions.get(unit.name).units, { name: unit.name, callOffset: unit.offset, parent: context });
      else {
        if (ops.length >= LIMITS.source) throw new ProgramError('函数展开过大：最多 200,000 条原始指令，请减少重复调用。', context?.callOffset ?? unit.offset);
        const pc = ops.length;
        ops.push(unit.op); offsets.push(unit.offset); contexts.push(context);
        if (unit.op === spec.open) stack.push(pc);
        if (unit.op === spec.close) {
          const open = stack.pop();
          if (language === 'pdouble' && open + 1 === pc) throw new ProgramError('P′′ 的循环体不能为空。', unit.offset);
          jumps.set(open, pc); jumps.set(pc, open);
        }
      }
    }
  }
  expand(main, null);
  return { ops, offsets, jumps, contexts, functions: [...definitions.keys()] };
}

export function nativeCode(source, language, options = {}) {
  const program = compile(source, language, options);
  const input = program.ops.indexOf(',');
  if (language === 'pdouble' && input !== -1) throw new ProgramError('原始 P′′ 没有 , 输入指令，无法将它转换成纯原始 P′′。请移除输入扩展后再转换。', program.offsets[input]);
  return program.ops.join(language === 'tm' ? '\n' : '');
}

export function parseInput(text, mode = 'text', modulus = 256, signed = false) {
  if (typeof text !== 'string') throw new Error('输入必须是文字。');
  let bytes;
  if (mode === 'text') bytes = new TextEncoder().encode(text);
  else if (mode === 'hex') {
    const cleaned = text.trim();
    if (cleaned && !/^[\da-fA-F]{2}(?:\s+[\da-fA-F]{2})*$/.test(cleaned)) throw new Error('十六进制输入请用空格分隔完整字节，例如 48 69 0A。');
    bytes = Uint8Array.from(cleaned ? cleaned.split(/\s+/).map(x => Number.parseInt(x, 16)) : []);
  } else if (mode === 'decimal') {
    const values = decimalValues(text, modulus, signed);
    if (values.length > LIMITS.input) throw new Error('输入最多 65,536 字节。');
    bytes = values;
  } else throw new Error('不支持的输入格式。');
  if (bytes.length > LIMITS.input) throw new Error('输入最多 65,536 字节。');
  return bytes;
}

export function decimalValues(text, modulus = 256, signed = false) {
  const cleaned = text.trim().replaceAll('−', '-');
  if (!cleaned) return [];
  const { minimum, maximum } = valueRange(modulus, signed);
  const error = `请输入 ${minimum}～${maximum} 的十进制整数，多个数字用逗号分隔，例如 ${signed ? '-1,0,1' : modulus > 3 ? '1,2,3' : '1,0,1'}。`;
  if (!(signed ? /^-?\d+(?:(?:\s*[,，]\s*|\s+)-?\d+)*$/ : /^\d+(?:(?:\s*[,，]\s*|\s+)\d+)*$/).test(cleaned)) throw new Error(error);
  const parts = cleaned.split(/[,，\s]+/);
  if (parts.length > LIMITS.input) throw new Error('输入最多 65,536 个数值。');
  return parts.map(part => {
    const value = Number(part);
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(error);
    return value < 0 ? value + modulus : value;
  });
}

function tapeTokens(text) {
  if (typeof text !== 'string') throw new Error('初始纸带必须是文字。');
  if (!text.trim()) return [];
  const tokens = text.trim().split(FIELD_SEPARATOR);
  if (tokens.length > LIMITS.cells) throw new Error('初始纸带最多 100,000 格。');
  if (tokens.includes('')) throw new Error('逗号之间需要填写纸带符号，开头和结尾也不能留空项。');
  return tokens;
}

export function parseTape(text, modulus, signed = false) {
  const tokens = tapeTokens(text);
  const { minimum, maximum } = valueRange(modulus, signed);
  return tokens.map(x => {
    const normalized = x.replaceAll('−', '-'), value = Number(normalized);
    if (!(signed ? /^-?\d+$/ : /^\d+$/).test(normalized) || !Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`初始纸带的每个值必须是 ${minimum}～${maximum} 的整数。`);
    return value < 0 ? value + modulus : value;
  });
}

export function validateProject(value) {
  if (!value || value.format !== 'tape-language-lab' || value.version !== 1 || !Object.hasOwn(LANGUAGES, value.language)) throw new Error('这不是受支持的编程语言实验文件。');
  for (const key of ['source', 'input', 'initialTape']) if (typeof value[key] !== 'string') throw new Error('实验文件缺少代码、输入或初始纸带。');
  if (!['text', 'hex', 'decimal'].includes(value.inputMode)) throw new Error('输入格式无效。');
  if (value.inputPolicy !== undefined && !['ask', 'preset'].includes(value.inputPolicy)) throw new Error('输入方式无效。');
  const isTm = value.language === 'tm';
  const modulus = isTm ? null : cellModulus(value.language, value.symbols, value.cellBits ?? 8);
  if (value.signedCells !== undefined && typeof value.signedCells !== 'boolean') throw new Error('有符号数设置无效。');
  if (value.functionsEnabled !== undefined && typeof value.functionsEnabled !== 'boolean') throw new Error('函数扩展设置无效。');
  if (value.speed !== undefined && !(value.speed === 'turbo' || typeof value.speed === 'string' && /^\d+$/.test(value.speed) && Number.isSafeInteger(Number(value.speed)) && Number(value.speed) > 0)) throw new Error('运行速度必须是正整数或不限速。');
  const signed = value.language === 'bf' && value.signedCells === true;
  // An unfinished draft can be saved; execution performs syntax validation.
  if (value.source.length > LIMITS.source || value.initialTape.length > 700000 || value.input.length > 300000) throw new Error('实验文件过大。');
  if (value.language !== 'tm' && value.inputPolicy !== 'ask') {
    const input = parseInput(value.input, value.inputMode, modulus, signed);
    if ([...input].some(number => number >= modulus)) throw new Error(`输入必须在 0～${modulus - 1} 范围内。`);
  }
  if (isTm) tapeTokens(value.initialTape);
  else parseTape(value.initialTape, modulus, signed);
  const keys = ['format', 'version', 'language', 'source', 'input', 'initialTape', 'inputMode'];
  if (!isTm) keys.push('symbols');
  if (value.inputPolicy !== undefined) keys.push('inputPolicy');
  if (value.cellBits !== undefined) keys.push('cellBits');
  if (value.signedCells !== undefined) keys.push('signedCells');
  if (value.functionsEnabled !== undefined) keys.push('functionsEnabled');
  if (value.speed !== undefined) keys.push('speed');
  const project = Object.fromEntries(keys.map(key => [key, value[key]]));
  if (value.language === 'tm' && value.tmStates !== undefined) project.tmStates = normalizeTmStates(value.tmStates);
  if (isTm && value.blankSymbol !== undefined) project.blankSymbol = normalizeBlankSymbol(value.blankSymbol);
  return project;
}

function encodingAlphabet(symbols) {
  const alphabet = Array.isArray(symbols) ? Array.from(symbols) : [];
  if (alphabet.length === 3 && new Set(alphabet).size === 3 &&
      alphabet.every(symbol => typeof symbol === 'string' && symbol && !/[\s\uD800-\uDFFF]/u.test(symbol))) return alphabet;
  throw new Error('请为 0、1、2 各填一个不同的符号，符号内不能有空格。');
}

export function encodeProject(project, symbols = ['0', '1', '2']) {
  const alphabet = encodingAlphabet(symbols);
  const separator = alphabet.some(symbol => [...symbol].length > 1) ? ' ' : '';
  const bytes = new TextEncoder().encode(JSON.stringify(validateProject(project)));
  const byteCodes = Array.from({ length: 256 }, (_, byte) =>
    Array.from(byte.toString(3).padStart(6, '0'), digit => alphabet[Number(digit)]).join(separator));
  return Array.from(bytes, byte => byteCodes[byte]).join(separator);
}

export function decodeProject(code, symbols = ['0', '1', '2']) {
  const alphabet = encodingAlphabet(symbols);
  const text = code.trim();
  if (!text) throw new Error('请先粘贴或生成编码。');
  const tokens = alphabet.some(symbol => [...symbol].length > 1) ? text.split(/\s+/u) : text.replace(/\s+/gu, '');
  const bytes = new Uint8Array(Math.floor(tokens.length / 6));
  let byte = 0, digits = 0, length = 0;

  for (const token of tokens) {
    const digit = alphabet.indexOf(token);
    if (digit === -1) throw new Error('编码包含未设置的符号，请检查 0、1、2 的映射。');
    byte = byte * 3 + digit;
    if (++digits === 6) {
      if (byte > 255) throw new Error('编码中有超出 0～255 的字节，请检查符号映射。');
      bytes[length++] = byte;
      byte = 0;
      digits = 0;
    }
  }
  if (digits) throw new Error('编码长度不完整，每六个编码符号对应一个字节。');
  let project;
  try {
    project = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length)));
  } catch {
    throw new Error('无法解码为实验文件，请检查编码和符号映射。');
  }
  return validateProject(project);
}

export class TapeMachine {
  constructor({ source = '', language = 'bf', input = '', inputMode = 'text', inputPolicy = 'preset', initialTape = '', symbols = 2, cellBits = 8, signedCells = false, functionsEnabled = false, tmStates, blankSymbol } = {}) {
    this.language = language;
    const isTm = language === 'tm';
    this.modulus = isTm ? null : cellModulus(language, symbols, cellBits);
    this.blankSymbol = isTm ? normalizeBlankSymbol(blankSymbol) : 0;
    if (typeof signedCells !== 'boolean') throw new Error('有符号数设置无效。');
    this.signedCells = language === 'bf' && signedCells;
    this.program = compile(source, language, { functionsEnabled, tmStates });
    if (!['ask', 'preset'].includes(inputPolicy)) throw new Error('输入方式无效。');
    this.inputPolicy = inputPolicy; this.waitingForInput = false; this.inputEnded = false;
    this.input = language === 'tm' || inputPolicy === 'ask' ? [] : Array.from(parseInput(input, inputMode, this.modulus, this.signedCells));
    if (this.input.some(value => value >= this.modulus)) throw new Error(`输入必须在 0～${this.modulus - 1} 范围内。`);
    this.inputAt = 0; this.output = []; this.numericOutput = []; this.cells = new Map();
    this.pointer = 0; this.pc = 0; this.steps = 0;
    this.minVisited = 0; this.maxVisited = 0; this.lastWrite = null;
    this.error = null;
    const values = isTm ? tapeTokens(initialTape) : parseTape(initialTape, this.modulus, this.signedCells);
    const firstIndex = isTm ? 0 : Math.min(0, 1 - values.length);
    values.forEach((value, i) => { if (value !== this.blankSymbol) this.cells.set(firstIndex + i, value); });
    this.minVisited = firstIndex;
    if (isTm) {
      this.alphabet = new Set([this.blankSymbol, ...values, ...this.program.ruleSymbols]);
      this.maxVisited = Math.max(0, values.length - 1);
      this.tmState = this.program.start;
      this.selectTransition();
    }
  }
  get done() { return this.pc >= this.program.ops.length; }
  get value() { return this.read(this.pointer); }
  read(index) { return this.cells.get(index) ?? this.blankSymbol; }
  display(value) { return this.signedCells && value >= this.modulus / 2 ? value - this.modulus : value; }
  provideInput(text) {
    if (!this.waitingForInput) throw new Error('当前没有等待输入。');
    const values = decimalValues(text, this.modulus, this.signedCells);
    if (!values.length) throw new Error('请至少输入一个数字，或选择“结束输入”。');
    if (this.input.length + values.length > LIMITS.input) throw new Error('本次运行输入最多 65,536 个数值。');
    this.input = this.input.concat(values); this.waitingForInput = false;
  }
  finishInput() { this.inputEnded = true; this.waitingForInput = false; }
  write(value) {
    if (value === this.blankSymbol) this.cells.delete(this.pointer);
    else {
      if (this.language !== 'tm' && this.cells.size >= LIMITS.cells && !this.cells.has(this.pointer)) {
        throw new Error('已达到 100,000 个非零格的运行保护上限，请重置后缩小实验。');
      }
      this.cells.set(this.pointer, value);
    }
    this.lastWrite = this.pointer;
  }
  move(delta) {
    const next = this.pointer + delta;
    if (!Number.isSafeInteger(next)) throw new Error('纸带位置超出精确整数范围。');
    if (this.language === 'pdouble' && next > 0) throw new Error('P′′ 的 0 号格是右边界，R 无法继续向右。');
    this.pointer = next;
    this.minVisited = Math.min(this.minVisited, next); this.maxVisited = Math.max(this.maxVisited, next);
  }
  selectTransition() {
    const outcome = this.program.terminalStates.get(this.tmState);
    const next = outcome ? undefined : this.program.transitions.get(this.tmState)?.get(this.value);
    this.pc = next ?? this.program.ops.length;
    this.tmStop = outcome ?? (next === undefined ? 'no-rule' : null);
  }
  stepTransition() {
    const rule = this.program.rules[this.pc];
    const delta = TM_MOVE[rule.direction];
    try {
      if (!Number.isSafeInteger(this.pointer + delta)) throw new Error('纸带位置超出精确整数范围。');
      this.write(rule.write);
      if (delta) this.move(delta);
      this.tmState = rule.nextState;
      this.steps++;
      this.selectTransition();
      return true;
    } catch (error) {
      this.error = error.message;
      return false;
    }
  }
  step() {
    if (this.done || this.error) return false;
    if (this.language === 'tm') return this.stepTransition();
    const op = this.program.ops[this.pc];
    if (op === ',' && this.inputAt >= this.input.length && this.inputPolicy === 'ask' && !this.inputEnded) {
      this.waitingForInput = true;
      return false;
    }
    let next = this.pc + 1;
    try {
      if (op === '>' || op === 'R') this.move(1);
      else if (op === '<') this.move(-1);
      else if (op === '+' || op === 'λ') {
        this.write((this.value + 1) % this.modulus);
        if (op === 'λ') this.move(-1);
      } else if (op === '-') this.write(this.value === 0 ? this.modulus - 1 : this.value - 1);
      else if (op === ',') {
        this.write(this.input[this.inputAt] ?? 0);
        if (this.inputAt < this.input.length) this.inputAt++;
      }
      else if (op === '.') {
        if (this.output.length >= LIMITS.output) throw new Error('输出已达到 65,536 次上限，请重置后缩小实验。');
        this.output.push(this.value % 256);
        this.numericOutput.push(this.display(this.value));
      } else if (op === LANGUAGES[this.language].open && this.value === 0) next = this.program.jumps.get(this.pc) + 1;
      else if (op === LANGUAGES[this.language].close && this.value !== 0) next = this.program.jumps.get(this.pc) + 1;
      this.pc = next; this.steps++;
      return true;
    } catch (error) { this.error = error.message; return false; }
  }
}
