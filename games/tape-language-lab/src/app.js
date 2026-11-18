import { TapeMachine, LANGUAGES, DEFAULT_TM_STATES, LIMITS, compile, validateProject, cellModulus, valueRange, nativeCode, encodeText, convertProgram } from './machine.js';
import { EXAMPLES } from './examples.js';

const $ = id => document.getElementById(id);
const STORAGE = 'tape-language-lab.projects.v1';
const conversionLanguages = { bf: 'BF', pdouble: 'P′′', tm: 'TM' };
const defaults = language => ({
  format: 'tape-language-lab', version: 1, language, source: EXAMPLES[language][0].source,
  input: '', inputMode: 'text', inputPolicy: 'ask', initialTape: EXAMPLES[language][0].initialTape,
  cellBits: 8, speed: language === 'tm' ? '2' : 'turbo', symbols: EXAMPLES[language][0].symbols ?? 2,
  blankSymbol: EXAMPLES[language][0].blankSymbol
});
const projects = Object.fromEntries(Object.keys(LANGUAGES).map(name => [name, defaults(name)]));
const savedProjects = { ...projects };
let language = 'bf', machine = null, running = false, frame = 0, lastTime = 0, credit = 0;
let follow = true, center = 0, outputMode = 'text', state = 'ready', syntaxError = null, outputSize = -1;
let saveIssue = '';
let resumeAfterInput = 'step';
let convertedCode = null;
let crossConversion = null;
let viewCenter = 0, tapeFrame = 0, tapeTime = 0, drag = null;
let tapeCells = new Map();
let instructionProgram = null, instructionPc = -1;
let lastRenderTime = 0;
let speedSetting = 'turbo';
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
  if (saved?.version === 1) {
    for (const name of Object.keys(LANGUAGES)) {
      if (saved.projects?.[name]) savedProjects[name] = projects[name] = validateProject(saved.projects[name]);
    }
    if (Object.hasOwn(LANGUAGES, saved.language)) language = saved.language;
  }
} catch { saveIssue = '未能读取旧草稿；可导入之前导出的实验。'; }

function project() {
  const settings = { format: 'tape-language-lab', version: 1, language, source: $('source').value, input: $('input').value, inputMode: $('input-mode').value, inputPolicy: $('input-policy').value, initialTape: $('initial-tape').value, cellBits: Number($('cell-bits').value), signedCells: $('signed-cells').checked, functionsEnabled: $('functions-enabled').checked, speed: speedSetting, symbols: Number($('symbols').value) };
  if (language === 'tm') {
    delete settings.symbols;
    settings.tmStates = Object.fromEntries(Object.keys(DEFAULT_TM_STATES).map(role => [role, $(`tm-${role}`).value.trim()]));
    settings.blankSymbol = $('tm-blank').value.trim();
  }
  return settings;
}
function applyTmStates(names = DEFAULT_TM_STATES) {
  for (const role of Object.keys(DEFAULT_TM_STATES)) $(`tm-${role}`).value = names[role];
}
function persist() {
  projects[language] = project();
  try {
    const validated = validateProject(projects[language]);
    localStorage.setItem(STORAGE, JSON.stringify({ version: 1, language, projects: { ...savedProjects, [language]: validated } }));
    savedProjects[language] = validated;
    $('save-state').textContent = '✓ 草稿已保存在本机';
  } catch { $('save-state').textContent = '草稿未保存，请检查设置或导出备份'; }
}
function message(text = '', error = false) {
  $('message').hidden = !text;
  $('message').textContent = text;
  $('message').dataset.error = String(error);
}
function encodingStatus(text = '', error = false) {
  const status = $('encoding-status');
  status.textContent = text;
  status.hidden = !text;
  status.dataset.error = String(error);
}
async function copyField(field) {
  try { await navigator.clipboard.writeText(field.value); return true; }
  catch { field.focus(); field.select(); return false; }
}
function pause() { running = false; cancelAnimationFrame(frame); if (state === 'running') state = 'paused'; }
function createMachine(report = false) {
  convertedCode = null; $('native-panel').hidden = true;
  if ($('input-dialog').open) $('input-dialog').close();
  pause(); machine = null; syntaxError = null; outputSize = -1; state = 'ready';
  try { machine = new TapeMachine(project()); }
  catch (error) {
    syntaxError = error; state = 'error';
    if (report) {
      message(error.message, true);
      if (Number.isInteger(error.offset)) { $('source').focus(); $('source').setSelectionRange(error.offset, error.offset + 1); }
    }
  }
  if (language === 'tm') {
    const alphabet = machine?.alphabet;
    $('tm-alphabet-count').textContent = alphabet ? `字母表 · ${alphabet.size.toLocaleString()} 个符号` : '字母表';
    $('tm-alphabet-symbols').textContent = alphabet ? [...alphabet].join('  ') : '检查规则、初始纸带和空白符号后可查看字母表。';
  }
  if (follow) center = 0;
  render();
  return !!machine;
}
const bfCommands = [
  ['>', '向右移动', '指针右移一格'], ['<', '向左移动', '指针左移一格'], ['+', '当前格加一', '按所选位宽回绕'], ['-', '当前格减一', '按所选位宽回绕'],
  ['.', '输出当前格', '十进制显示完整数值'], [',', '读入一个数值', '没有待用数字时询问'], ['[', '进入循环', '当前格为 0 则跳过'], [']', '继续或退出', '当前格非 0 则重复']
];
const pCommands = [
  ['λ', '改写并左移', '当前格加一回绕，再左移'], ['R', '向右移动', '不能越过 0 号格'], ['(', '进入循环', '当前格为 0 则跳过'], [')', '继续或退出', '当前格非 0 则重复'], [',', '输入扩展', '询问并写入当前格']
];
const tmCommands = [
  ['L', '左移', '写入后向左移动一格'], ['R', '右移', '写入后向右移动一格'],
  ['N', '停在原格', '只写入并切换状态'], ['空白', '默认纸带符号', '未写入的格读取所设空白符号']
];
const tmOutcomes = { halt: '停机', accept: '接受', reject: '拒绝', 'no-rule': '无匹配规则' };
function applyProject(value) {
  language = value.language;
  const target = $('conversion-target'), previousTarget = target.value;
  target.replaceChildren(...Object.entries(conversionLanguages)
    .filter(([name]) => name !== language).map(([name, label]) => new Option(label, name)));
  if ([...target.options].some(option => option.value === previousTarget)) target.value = previousTarget;
  $('source').value = value.source; $('input').value = value.input; $('initial-tape').value = value.initialTape;
  $('input-mode').value = value.inputMode; $('symbols').value = value.symbols ?? 2;
  $('cell-bits').value = String(value.cellBits ?? 8);
  $('signed-cells').checked = value.signedCells ?? false;
  $('functions-enabled').checked = value.functionsEnabled ?? false;
  speedSetting = value.speed ?? 'turbo';
  $('speed-unlimited').checked = speedSetting === 'turbo';
  $('speed').value = speedSetting === 'turbo' ? '20000' : speedSetting;
  $('speed').setAttribute('aria-invalid', 'false');
  $('speed-hint').textContent = '填写每秒步数，按 Enter 或移开焦点生效。';
  $('input-policy').value = value.inputPolicy ?? 'ask';
  const isP = language === 'pdouble', isTm = language === 'tm';
  if (isTm) applyTmStates(value.tmStates);
  $('tm-blank').value = value.blankSymbol ?? '0';
  $('tm-blank-label').hidden = !isTm;
  $('tm-alphabet').hidden = !isTm;
  $('cell-range').hidden = isTm;
  document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
  $('language-summary').textContent = isP ? 'λ · R · ( ) · 输入扩展 , · 向左无限纸带' : '8 位单元 · 双向无限纸带';
  $('file-name').textContent = isTm ? 'program.tm' : isP ? 'program.pdouble' : 'program.b';
  $('insert-lambda').hidden = !isP; $('symbols-label').hidden = !isP;
  $('cell-bits-label').hidden = language !== 'bf';
  $('signed-cells-label').hidden = language !== 'bf';
  $('function-controls').hidden = isTm;
  $('function-help').hidden = isTm;
  $('tm-help').hidden = !isTm;
  $('tm-settings').hidden = !isTm;
  $('editor-hint').textContent = isTm ? '每行一条规则，字段可用空格或逗号分隔。行首或规则写完后的 # 开始注释。' : isP ? '使用 λ R ( )；输入扩展为 ,；可点上方插入 λ。' : '仅执行 > < + - . , [ ]，其余字符忽略。';
  const tapePositionHint = isTm ? '第一项放在 0 号格，留空时整条纸带使用设定的空白符号。' : '最后一项放在 0 号格，留空则全为 0。';
  $('initial-tape-hint').textContent = `用空格或逗号分隔${isTm ? '符号' : '数字'}，可以混用。${tapePositionHint}读写头从 0 号格出发。`;
  $('initial-tape').placeholder = isTm ? '例如 红蓝, A01 🔴🔵' : '例如 1 0 1 或 1,0,1';
  $('tape-direction').textContent = isP ? '← 向左延伸 · 0 号格为右边界' : '← 向两侧按需延伸 →';
  $('bf-io').hidden = language !== 'bf'; $('pdouble-result').hidden = language === 'bf';
  $('pdouble-result-note').hidden = !isP;
  $('tape-result-intro').textContent = isTm ? '输出留在纸带上。' : 'P′′ 的计算结果留在纸带上。';
  $('tape-result').setAttribute('aria-label', isTm ? '非空白纸带格' : '非零纸带格');
  $('input-policy-row').hidden = isTm; $('io-progress').hidden = isTm;
  $('tm-state-row').hidden = !isTm;
  $('io-name').textContent = language === 'bf' ? '输入与输出' : '纸带结果';
  $('instruction-heading').textContent = isTm ? '转移规则 · 蓝色标记下一条' : '展开后的代码 · 蓝色标记执行位置';
  $('instruction').setAttribute('aria-label', isTm ? '完整转移规则，蓝色标记下一条' : '展开后的完整代码，蓝色标记下一条执行指令');
  $('reference-subtitle').textContent = isTm ? '每步读取、改写、移动并切换状态。' : isP ? '四个符号，组合出计算。' : '八个符号，完成整个程序。';
  $('example').replaceChildren(new Option('选择一个示例…', ''), ...EXAMPLES[language].map((example, index) => new Option(example.name, String(index))));
  $('example-note').textContent = '选择示例会替换本语言的代码与初始数据；可先导出保存。';
  $('commands').replaceChildren(...(isTm ? tmCommands : isP ? pCommands : bfCommands).map(([op, title, detail]) => {
    const div = document.createElement('div'); div.className = 'command';
    const dt = document.createElement('dt'); dt.textContent = op;
    const dd = document.createElement('dd'), b = document.createElement('b'); b.textContent = title;
    dd.append(b, document.createTextNode(detail)); div.append(dt, dd); return div;
  }));
  message(); createMachine();
}
function loadProject(value) {
  projects[language] = project();
  projects[value.language] = value;
  applyProject(value);
  persist();
}
function statusText() {
  return { ready: '准备就绪', running: '运行中', paused: '已暂停', waiting: '等待输入', done: '执行完成', error: '请检查程序' }[state];
}
function stopTapeAnimation() { cancelAnimationFrame(tapeFrame); tapeFrame = 0; tapeTime = 0; }
function drawTape() {
  const pointer = machine?.pointer ?? 0;
  const blank = machine?.blankSymbol ?? 0;
  const track = $('tape'), viewport = $('tape-viewport');
  const padding = getComputedStyle(viewport), gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
  const width = viewport.clientWidth - Number.parseFloat(padding.paddingLeft) - Number.parseFloat(padding.paddingRight);
  const pitch = (width + gap) / 9;
  if (pitch <= 0) return;
  const anchor = Math.floor(viewCenter), nextCells = new Map();
  const cells = Array.from({ length: 13 }, (_, offset) => {
    const index = anchor - 6 + offset, value = machine ? machine.display(machine.read(index)) : 0;
    const boundary = language === 'pdouble' && index > 0;
    let cell = tapeCells.get(index);
    if (!cell) {
      cell = document.createElement('div'); cell.dataset.index = String(index);
      const number = document.createElement('span'); number.className = 'value';
      const digits = document.createElement('span'); digits.className = 'cell-digits'; number.append(digits);
      cell.append(number, document.createElement('small'));
    }
    cell.className = `cell${index === pointer ? ' current' : ''}${value !== blank ? ' nonzero' : ''}${boundary ? ' boundary' : ''}`;
    cell.firstElementChild.className = `value${String(value).length > 3 ? ' large-number' : ''}`;
    cell.querySelector('.cell-digits').textContent = boundary ? '边界' : value;
    cell.lastElementChild.textContent = boundary ? '—' : index;
    cell.setAttribute('aria-label', boundary ? '右边界外' : `${index} 号格：${value}${index === pointer ? '，当前指针' : ''}`);
    nextCells.set(index, cell);
    return cell;
  });
  if (track.firstElementChild !== cells[0] || track.childElementCount !== cells.length) track.replaceChildren(...cells);
  tapeCells = nextCells;
  track.style.gridTemplateColumns = `repeat(13, ${pitch - gap}px)`;
  track.style.width = `${13 * pitch - gap}px`;
  track.style.transform = `translate3d(${(-2 - (viewCenter - anchor)) * pitch}px, 0, 0)`;
  viewport.dataset.viewCenter = String(viewCenter); viewport.dataset.targetCenter = String(center);
  $('tape-range').textContent = `${Math.floor(viewCenter - 4)} … ${language === 'pdouble' ? Math.min(0, Math.ceil(viewCenter + 4)) : Math.ceil(viewCenter + 4)}`;
  $('follow').setAttribute('aria-pressed', String(follow));
}
function animateTape(time) {
  const elapsed = tapeTime ? Math.min(64, time - tapeTime) : 16;
  tapeTime = time;
  viewCenter += (center - viewCenter) * (1 - Math.exp(-elapsed / 65));
  if (Math.abs(center - viewCenter) < .001) {
    viewCenter = center; stopTapeAnimation(); drawTape(); return;
  }
  drawTape(); tapeFrame = requestAnimationFrame(animateTape);
}
function renderTape({ smooth = false } = {}) {
  if (drag && !drag.active) center = drag.center;
  else if (follow) center = machine?.pointer ?? 0;
  if (language === 'pdouble') center = Math.min(-4, center);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (drag || reducedMotion || !(follow || smooth || tapeFrame)) {
    stopTapeAnimation(); viewCenter = center;
  } else if (Math.abs(center - viewCenter) >= .001 && !tapeFrame) tapeFrame = requestAnimationFrame(animateTape);
  drawTape();
}
function paintInstructionCursor({ scroll = true } = {}) {
  const viewer = $('instruction'), code = $('instruction-code'), cursor = $('instruction-cursor');
  const program = machine?.program, pc = machine?.pc ?? 0;
  cursor.hidden = !program || machine.done || !program.ops.length;
  if (cursor.hidden || !code.firstChild) return;
  const range = document.createRange();
  const markerOffset = program.listingOffsets?.[pc] ?? pc;
  range.setStart(code.firstChild, markerOffset); range.setEnd(code.firstChild, markerOffset + 1);
  const glyph = range.getBoundingClientRect(), content = $('instruction-content'), bounds = content.getBoundingClientRect();
  const x = glyph.left - bounds.left, y = glyph.top - bounds.top;
  cursor.textContent = program.ops[pc][0]; cursor.dataset.pc = String(pc);
  cursor.style.transform = `translate(${x}px, ${y}px)`;
  cursor.style.width = `${Math.max(glyph.width, 8)}px`; cursor.style.height = `${Math.max(glyph.height, 18)}px`;
  if (scroll) {
    const top = content.offsetTop + y, bottom = top + Math.max(glyph.height, 18);
    if (top < viewer.scrollTop + 6) viewer.scrollTop = Math.max(0, top - 6);
    else if (bottom > viewer.scrollTop + viewer.clientHeight - 6) viewer.scrollTop = bottom - viewer.clientHeight + 6;
  }
}
function renderInstruction() {
  const program = machine?.program;
  const pc = machine?.pc ?? 0;
  const isTm = language === 'tm';
  let total = program?.ops.length;
  if (total === undefined) {
    const settings = project();
    try { total = compile(settings.source, language, settings).ops.length; }
    catch { total = 0; }
  }
  $('code-count').textContent = `${total.toLocaleString()} 条${isTm ? '规则' : '指令'}${program?.functions.length ? ` · ${program.functions.length} 个函数` : ''}`;
  const offset = program?.offsets[pc] ?? syntaxError?.offset ?? $('source').value.length;
  const prefix = $('source').value.slice(0, offset).split('\n');
  $('source-location').textContent = isTm && machine?.done ? '无下一条规则' : `${program && !machine.done ? `${isTm ? '规则' : '指令'} ${pc + 1}/${total} · ` : ''}第 ${prefix.length} 行 · 第 ${prefix.at(-1).length + 1} 列`;
  const context = program?.contexts[pc], chain = [];
  for (let at = context; at; at = at.parent) chain.unshift(at.name);
  $('function-context').hidden = isTm || !$('functions-enabled').checked;
  $('function-context').textContent = chain.length ? `主程序 → ${chain.join(' → ')} · 调用于第 ${$('source').value.slice(0, context.callOffset).split('\n').length} 行` : '主程序';
  const changedProgram = program !== instructionProgram;
  if (changedProgram) {
    instructionProgram = program;
    const expanded = program?.ops.join(isTm ? '\n' : '') || '—';
    if ($('instruction-code').textContent !== expanded) $('instruction-code').textContent = expanded;
    $('instruction').scrollTop = 0;
    instructionPc = -1;
  }
  if (instructionPc !== pc || changedProgram) { paintInstructionCursor(); instructionPc = pc; }
  if (isTm) {
    let help = syntaxError?.message ?? machine?.error ?? '填写状态转移规则后即可运行。';
    if (machine && !machine.error) {
      help = machine.tmStop === 'no-rule'
        ? `状态 ${machine.tmState} 读到 ${machine.value}，没有匹配规则，机器停止。`
        : machine.done ? `进入 ${machine.tmState}，结果为「${tmOutcomes[machine.tmStop]}」。` : program.ops[pc];
    }
    $('instruction-help').textContent = help;
    return;
  }
  if (!program || !total) {
    $('instruction-help').textContent = syntaxError?.message || '写下几条指令，点“单步”开始。'; return;
  }
  if (machine.done) {
    $('instruction-help').textContent = '所有指令已执行。可查看结果，或点“重置”重新运行。'; return;
  }
  const entry = (language === 'bf' ? bfCommands : pCommands).find(item => item[0] === program.ops[pc]);
  $('instruction-help').textContent = machine.error || `${program.ops[pc]}  ${entry[1]} · ${entry[2]}`;
}
function renderOutput() {
  const remaining = Math.max(0, (machine?.input.length ?? 0) - (machine?.inputAt ?? 0));
  $('io-progress').textContent = `已读取 ${machine?.inputAt ?? 0} 个数值，队列剩余 ${remaining} 个。${$('input-policy').value === 'ask' ? (machine?.inputEnded ? '已结束输入，之后读入 0。' : '队列用完时暂停询问。') : '预先输入耗尽后读入 0。'}`;
  if (language !== 'bf') {
    const count = machine?.cells.size ?? 0;
    const cells = [];
    // A growing TM tape can exceed the original storage limit. Avoid sorting all of it for a preview.
    const sample = count > LIMITS.cells ? 100 : count;
    for (const cell of machine?.cells ?? []) {
      cells.push(cell);
      if (cells.length === sample) break;
    }
    cells.sort((a, b) => a[0] - b[0]);
    const cellType = language === 'tm' ? '非空白格' : '非零格';
    $('io-count').textContent = `${count.toLocaleString()} 个${cellType}`;
    $('tape-result').textContent = count ? cells.slice(0, 100).map(([index, value]) => `[${index}] = ${value}`).join('    ') + (count > 100 ? '\n…其余请在纸带观察窗中查看' : '') : `全部为空白 ${machine?.blankSymbol ?? (language === 'tm' ? '—' : 0)}`;
    return;
  }
  const output = machine?.output ?? [];
  $('io-count').textContent = outputMode === 'decimal' ? `${output.length.toLocaleString()} 个数值输出` : `${output.length.toLocaleString()} 字节输出`;
  if (output.length === outputSize) return;
  outputSize = output.length;
  if (!output.length) {
    const span = document.createElement('span'); span.className = 'placeholder'; span.textContent = '运行程序，等待第一声问候。'; $('output').replaceChildren(span);
  } else {
    $('output').textContent = outputMode === 'decimal' ? machine.numericOutput.join(' ') : outputMode === 'hex' ? output.map(value => value.toString(16).padStart(2, '0').toUpperCase()).join(' ') : new TextDecoder().decode(Uint8Array.from(output));
  }
}
function render() {
  const bits = Number($('cell-bits').value), symbols = Number($('symbols').value);
  const isTm = language === 'tm';
  const signed = language === 'bf' && $('signed-cells').checked;
  let inputMaximum = null, inputMinimum;
  if (!isTm) {
    try {
      const range = valueRange(cellModulus(language, symbols, bits), signed);
      inputMaximum = range.maximum;
      inputMinimum = range.minimum;
    } catch { /* Invalid numeric settings are reported by the machine. */ }
  }
  const rangeText = inputMaximum === null ? '请检查单元设置' : `${inputMinimum}～${inputMaximum}`;
  $('language-summary').textContent = isTm ? '确定性状态转移 · 双向无限纸带' : language === 'bf' ? `${bits} 位${signed ? '有符号' : '无符号'}单元 · 双向无限纸带` : 'λ · R · ( ) · 输入扩展 , · 向左无限纸带';
  $('cell-range').textContent = inputMaximum === null ? rangeText : `有效范围：${rangeText}`;
  $('model-note').textContent = isTm ? `TM 的空白符号为 ${machine?.blankSymbol ?? '—'}。` : language === 'bf' ? `BF：${bits} 位回绕，十进制输出完整值，文本/HEX 取低 8 位。` : 'P′′：有限字母表，0 表示空白。';
  const inputHints = {
    text: ['在这里输入程序要读取的内容…', '文字会转换成 UTF-8 字节，例如数字 3 会读成字符编码 51。'],
    hex: ['例如 48 69 0A', '每项为两位十六进制字节，用空格或换行分隔。'],
    decimal: [signed ? '例如 -3,0,10' : '例如 72,105,10', `每项为 ${rangeText} 的整数，多个数字用逗号分隔；输入 3 就读入数值 3。`]
  };
  const hint = inputHints[$('input-mode').value];
  $('input').placeholder = hint[0]; $('input-format-hint').textContent = hint[1];
  const asking = $('input-policy').value === 'ask';
  $('preset-input').hidden = isTm || asking; $('ask-input-note').hidden = isTm || !asking;
  $('ask-input-note').textContent = `执行到 , 时询问 ${language === 'bf' ? 'BF' : 'P′′'} 输入，多个十进制数字用逗号分隔。${inputMaximum === null ? '请检查单元设置。' : `有效范围：${rangeText}。`}`;
  if (machine?.error) state = 'error';
  else if (machine?.waitingForInput) state = 'waiting';
  else if (machine?.done && (isTm || machine.program.ops.length)) state = 'done';
  $('status').textContent = isTm && state === 'done' ? tmOutcomes[machine.tmStop] : statusText();
  $('status').dataset.state = state;
  $('tm-state').textContent = machine?.tmState ?? ($('tm-start').value.trim() || '—');
  const displayedValue = machine ? machine.display(machine.value) : 0;
  $('pointer').textContent = machine?.pointer ?? 0; $('cell-value').textContent = displayedValue;
  $('cell-value').classList.toggle('large-number', String(displayedValue).length > 6);
  const displayedSteps = (machine?.steps ?? 0).toLocaleString();
  $('steps').replaceChildren(document.createTextNode(displayedSteps), Object.assign(document.createElement('small'), { textContent: ' 步' }));
  $('steps').classList.toggle('large-number', displayedSteps.length > 8);
  $('steps').classList.toggle('very-large-number', displayedSteps.length > 10);
  $('run').disabled = running || !!machine?.done || !!machine?.error;
  $('step').disabled = running || !!machine?.done || !!machine?.error;
  $('pause').disabled = !running;
  renderTape(); renderInstruction(); renderOutput();
}
function ensureMachine() {
  if (!machine && !createMachine(true)) return false;
  return !machine.done && !machine.error;
}
function tick(time) {
  if (!running) return;
  const elapsed = Math.max(0, Math.min(time - lastTime, 100)); lastTime = time;
  const turbo = speedSetting === 'turbo', rate = turbo ? 0 : Number(speedSetting);
  if (!turbo) credit = Math.min(credit + elapsed * rate / 1000, Math.max(1, rate / 10));
  const limit = turbo ? Infinity : Math.floor(credit), deadline = performance.now() + 8;
  let executed = 0, stopped = false;
  while (executed < limit && !stopped) {
    const batch = Math.min(1024, limit - executed);
    for (let index = 0; index < batch; index++) {
      const advanced = machine.step();
      if (advanced) executed++;
      if (!advanced || machine.done || machine.error) { stopped = true; break; }
    }
    if (performance.now() >= deadline) break;
  }
  if (!turbo) credit -= executed;
  if (machine.done || machine.error) {
    pause(); state = machine.error ? 'error' : 'done';
    if (machine.error) message(machine.error, true);
  }
  if (machine.waitingForInput) { requestInput('run'); return; }
  if (!running || !(turbo || rate > 200) || time - lastRenderTime >= 50) { render(); lastRenderTime = time; }
  if (running) frame = requestAnimationFrame(tick);
}
function startRunning() {
  message(); if (!ensureMachine()) return;
  if (machine.waitingForInput) { requestInput('run'); return; }
  state = 'running'; running = true; credit = 0; lastTime = performance.now(); lastRenderTime = lastTime; render(); frame = requestAnimationFrame(tick);
}
function commitSpeed(value) {
  speedSetting = value; credit = 0; lastTime = performance.now(); lastRenderTime = 0; persist();
}
function commitTypedSpeed() {
  const text = $('speed').value.trim(), value = Number(text);
  const valid = text !== '' && Number.isSafeInteger(value) && value > 0;
  $('speed').setAttribute('aria-invalid', String(!valid));
  if (!valid) { $('speed-hint').textContent = '请输入大于 0 的整数；当前继续使用原来的速度。'; return false; }
  $('speed-unlimited').checked = false;
  $('speed-hint').textContent = '填写每秒步数，按 Enter 或移开焦点生效。';
  commitSpeed(String(value)); return true;
}
$('speed').addEventListener('change', commitTypedSpeed);
$('speed').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); commitTypedSpeed(); } });
$('speed').addEventListener('input', () => { $('speed').setAttribute('aria-invalid', 'false'); });
$('speed-unlimited').addEventListener('change', () => {
  if ($('speed-unlimited').checked) { $('speed').setAttribute('aria-invalid', 'false'); $('speed-hint').textContent = '不限速运行。填写数字并确认，可切回指定速度。'; commitSpeed('turbo'); }
  else if (!commitTypedSpeed()) $('speed-unlimited').checked = speedSetting === 'turbo';
});
function requestInput(resume) {
  pause(); resumeAfterInput = resume; state = 'waiting';
  $('input-dialog-title').textContent = `${language === 'bf' ? 'BF' : 'P′′'} 等待输入`;
  const { minimum, maximum } = valueRange(machine.modulus, machine.signedCells);
  $('input-dialog-hint').textContent = `请输入 ${minimum}～${maximum} 的十进制整数。多个数字用逗号分隔，后续输入指令依次读取；用完后再次询问。`;
  $('input-request').value = ''; $('input-request').placeholder = machine.signedCells ? '例如 -3,0,10' : machine.modulus > 3 ? '例如 3,72,255' : '例如 1,0,1';
  $('input-error').textContent = '';
  render(); if (!$('input-dialog').open) $('input-dialog').showModal(); $('input-request').focus();
}
function resumeInput() {
  $('input-dialog').close();
  if (resumeAfterInput === 'run') startRunning();
  else {
    machine.step(); state = machine.done ? 'done' : 'paused';
    if (machine.error) message(machine.error, true);
    render();
  }
}
$('input-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!machine?.waitingForInput) return;
  try { machine.provideInput($('input-request').value); resumeInput(); }
  catch (error) { $('input-error').textContent = error.message; }
});
$('input-end').addEventListener('click', () => { if (machine?.waitingForInput) { machine.finishInput(); resumeInput(); } });
$('input-cancel').addEventListener('click', () => { $('input-dialog').close(); render(); });
$('input-dialog').addEventListener('cancel', () => { pause(); render(); });
$('run').addEventListener('click', startRunning);
$('pause').addEventListener('click', () => { pause(); render(); });
$('step').addEventListener('click', () => {
  message(); if (!ensureMachine()) return;
  machine.step(); state = machine.done ? 'done' : 'paused';
  if (machine.waitingForInput) { requestInput('step'); return; }
  if (machine.error) message(machine.error, true);
  render();
});
$('reset').addEventListener('click', () => { message(); createMachine(true); });
for (const id of ['source', 'input', 'initial-tape', 'symbols', 'tm-blank', 'cell-bits', 'signed-cells', 'functions-enabled', 'input-mode', 'input-policy']) $(id).addEventListener(['input-mode', 'input-policy', 'cell-bits', 'signed-cells', 'functions-enabled'].includes(id) ? 'change' : 'input', () => { message(); createMachine(); persist(); });
$('tm-settings').addEventListener('input', () => { message(); createMachine(); persist(); });
document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => {
  if (language === button.dataset.language) return;
  projects[language] = project(); applyProject(projects[button.dataset.language]); persist();
}));
$('example').addEventListener('change', () => {
  if ($('example').value === '') return;
  const example = EXAMPLES[language][Number($('example').value)];
  $('source').value = example.source; $('input').value = example.input; $('initial-tape').value = example.initialTape;
  $('input-mode').value = 'text'; if (example.symbols) $('symbols').value = example.symbols;
  if (language === 'tm') {
    applyTmStates(example.tmStates);
    $('tm-blank').value = example.blankSymbol ?? '0';
  }
  $('input-policy').value = example.inputPolicy ?? 'ask';
  $('functions-enabled').checked = example.functionsEnabled ?? false;
  $('example-note').textContent = example.description;
  message(); createMachine(); persist();
});
$('insert-lambda').addEventListener('click', () => {
  const editor = $('source');
  if (editor.value.length >= LIMITS.source) { message('代码最多 1,000,000 个字符。', true); return; }
  editor.setRangeText('λ', editor.selectionStart, editor.selectionEnd, 'end'); editor.focus(); editor.dispatchEvent(new Event('input', { bubbles: true }));
});
$('insert-function').addEventListener('click', () => {
  const template = language === 'bf' ? 'fn add3 { +++ }\n@add3\n' : 'fn inc { λR }\n@inc\n';
  const editor = $('source');
  const separator = editor.selectionStart && editor.value[editor.selectionStart - 1] !== '\n' ? '\n' : '';
  if (editor.value.length - (editor.selectionEnd - editor.selectionStart) + separator.length + template.length > LIMITS.source) { message('代码最多 1,000,000 个字符。', true); return; }
  editor.setRangeText(separator + template, editor.selectionStart, editor.selectionEnd, 'end');
  $('functions-enabled').checked = true; editor.focus(); editor.dispatchEvent(new Event('input', { bubbles: true }));
});
$('convert-native').addEventListener('click', () => {
  try {
    const code = nativeCode($('source').value, language, { functionsEnabled: $('functions-enabled').checked });
    pause(); render(); convertedCode = code;
    $('native-source').value = code;
    $('native-note').textContent = `已转换为 ${language === 'bf' ? 'BF 八条原始指令' : 'P′′ 四个原始符号'}，共 ${code.length.toLocaleString()} 条指令。位宽、初始纸带和输入设置保持相同即可得到相同结果。`;
    $('native-panel').hidden = false; message();
  } catch (error) {
    convertedCode = null; $('native-panel').hidden = true; message(error.message, true);
    if (Number.isInteger(error.offset)) { $('source').focus(); $('source').setSelectionRange(error.offset, error.offset + 1); }
  }
});
$('copy-native').addEventListener('click', async () => {
  if (convertedCode === null) return;
  message(await copyField($('native-source')) ? '已复制原始代码。' : '已选中原始代码，可手动复制。');
});
$('use-native').addEventListener('click', () => {
  if (convertedCode === null) return;
  $('source').value = convertedCode; $('functions-enabled').checked = false;
  createMachine(); persist(); message('已将编辑器替换为原始代码，函数扩展已关闭。');
});
const encodingSymbols = () => ['encoding-zero', 'encoding-one', 'encoding-two'].map(id => $(id).value.trim());
function conversionTapeGuide(result) {
  const { layout, wordWidth } = result;
  const word = wordWidth ? `原数值纸带的 x 号格对应 TM 的 −x × ${wordWidth} 号起，共 ${wordWidth} 位，从低位到高位。${language === 'pdouble' ? 'E0、E1 标记 P′′ 的右边界。' : ''}` : '';
  if (!layout) return word;
  const { symbols, block, positive, negative, outcome } = layout;
  const legend = symbols.map((symbol, id) => {
    const digits = [...id.toString(2).padStart(positive.length, '0')].reverse().join('');
    return `${symbol} = ${digits}`;
  });
  return [word, `每 ${block} 格为一块，从 0 向左排。第 j 块存 TM 的 j 号格和 −j−1 号格。`,
    `相对块起点的位偏移（低位到高位）`, `j 号格 ${positive.join('、')}`, `−j−1 号格 ${negative.join('、')}`,
    `停机时读写头所在块的结果位 ${outcome.join('、')}。00 无匹配规则，10 普通停机，01 接受，11 拒绝。`, ...legend]
    .filter(Boolean).join('\n');
}
$('project-encoding').addEventListener('input', () => encodingStatus());
$('convert-program').addEventListener('click', () => {
  try {
    const target = $('conversion-target').value;
    const result = convertProgram(project(), target);
    const converted = result.project, targetLabel = conversionLanguages[target];
    $('encoded-project').value = encodeText(converted.source, encodingSymbols());
    $('converted-program').value = converted.source;
    $('conversion-initial').value = converted.initialTape;
    $('conversion-initial-label').hidden = target !== 'tm';
    $('conversion-layout').textContent = conversionTapeGuide(result);
    const settings = target === 'tm'
      ? `初始状态 ${converted.tmStates.start} · 空白符号 ${converted.blankSymbol} · 停机 ${converted.tmStates.halt}${converted.tmStates.reject ? ` · 拒绝 ${converted.tmStates.reject}` : ''}`
      : `${target === 'bf' ? '8 位单元' : '二元字母表'} · 从空白纸带运行，源码会写入初始内容`;
    $('conversion-settings').textContent = `${conversionLanguages[language]} → ${targetLabel} · ${settings}`;
    crossConversion = converted;
    $('conversion-result').hidden = false;
    encodingStatus(`已生成 ${targetLabel} 源码。`);
  } catch (error) {
    crossConversion = null;
    $('conversion-result').hidden = true;
    encodingStatus(error.message, true);
  }
});
for (const [button, field] of [['copy-encoding', 'encoded-project'], ['copy-converted-program', 'converted-program']]) {
  $(button).addEventListener('click', async () => {
    encodingStatus(await copyField($(field)) ? '已复制。' : '已选中结果，可手动复制。');
  });
}
$('load-converted-program').addEventListener('click', () => {
  if (!crossConversion) return;
  loadProject(crossConversion);
  encodingStatus(`已载入 ${conversionLanguages[crossConversion.language]}，可运行或单步执行。`);
});
const tapeViewport = $('tape-viewport');
tapeViewport.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  const cell = $('tape').firstElementChild;
  if (!cell) return;
  const gap = Number.parseFloat(getComputedStyle($('tape')).columnGap) || 0;
  drag = { pointerId: event.pointerId, x: event.clientX, center: viewCenter, pitch: cell.getBoundingClientRect().width + gap, active: false };
  center = viewCenter; stopTapeAnimation();
  tapeViewport.setPointerCapture(event.pointerId);
});
tapeViewport.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const dx = event.clientX - drag.x;
  if (!drag.active && Math.abs(dx) < 2) return;
  drag.active = true; follow = false;
  tapeViewport.classList.add('dragging');
  center = Math.max(-Number.MAX_SAFE_INTEGER + 8, Math.min(Number.MAX_SAFE_INTEGER - 8, drag.center - dx / drag.pitch));
  if (language === 'pdouble') center = Math.min(-4, center);
  renderTape();
});
function endTapeDrag(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  drag = null; tapeViewport.classList.remove('dragging');
  if (tapeViewport.hasPointerCapture(event.pointerId)) tapeViewport.releasePointerCapture(event.pointerId);
  renderTape();
}
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) tapeViewport.addEventListener(event, endTapeDrag);
tapeViewport.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault(); follow = false; center += event.key === 'ArrowLeft' ? -1 : 1;
  if (language === 'pdouble') center = Math.min(-4, center);
  renderTape({ smooth: true });
});
$('follow').addEventListener('click', () => {
  follow = !follow;
  if (!follow) { center = viewCenter; stopTapeAnimation(); }
  renderTape();
});
if ('ResizeObserver' in window) new ResizeObserver(() => renderTape()).observe(tapeViewport);
else window.addEventListener('resize', () => renderTape());
if ('ResizeObserver' in window) new ResizeObserver(() => paintInstructionCursor()).observe($('instruction'));
else window.addEventListener('resize', () => paintInstructionCursor());
for (const mode of ['text', 'hex', 'decimal']) $(`output-${mode}`).addEventListener('click', () => {
  outputMode = mode; outputSize = -1;
  for (const name of ['text', 'hex', 'decimal']) { $(`output-${name}`).classList.toggle('selected', name === mode); $(`output-${name}`).setAttribute('aria-pressed', String(name === mode)); }
  renderOutput();
});
$('export').addEventListener('click', () => {
  try {
    const value = validateProject(project()), blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'), url = URL.createObjectURL(blob);
    link.href = url; link.download = `tape-lab-${language}.json`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('已导出代码与初始设置；执行进度不包含在实验文件中。');
  } catch (error) { message(error.message, true); }
});
$('import').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async () => {
  const file = $('file').files[0]; $('file').value = ''; if (!file) return;
  try {
    if (file.size > 2000000) throw new Error('实验文件不能超过 2 MB。');
    const imported = validateProject(JSON.parse(await file.text()));
    // Validate before changing any current draft or execution state.
    loadProject(imported); message('已导入实验，纸带已恢复到初始设置。');
  } catch (error) { message(`导入失败：${error.message}`, true); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running) { pause(); render(); message('页面进入后台，运行已暂停。'); }
});
applyProject(projects[language]);
if (saveIssue) message(saveIssue, true);

