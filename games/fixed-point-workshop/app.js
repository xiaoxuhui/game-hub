(() => {
  'use strict';

  const { parse, format, bits, inputPorts, connect, evaluate, advance, hasDelay, captureGate } = FixedPoint;
  const $ = id => document.getElementById(id);
  const kinds = {
    input: ['输入', '↦', 'A'], constant: ['常数', '#', 'K'], output: ['输出', '↤', 'Y'],
    add: ['加法', '+', 'ADD'], sign: ['正负判断', '±', 'SGN'], changeSign: ['改变符号', '×', 'SIGN'],
    left: ['左移', '≪', 'SHL'], right: ['右移', '≫', 'SHR'], delay: ['延迟线', '↷', 'DLY'],
    custom: ['逻辑门', '▦', 'G'],
  };
  const node = (id, type, name, x, y, value = 0) => ({ id, type, name, x, y, ticks: parse(value) });
  const output = () => node('y', 'output', 'Y', 605, 219);
  const wire = (from, to, port) => ({ from, to, port });
  const levels = [
    {
      title: '两数之和', description: '补上一条线，让输出 Y 得到 A 和 B 的和。', formula: 'Y = A + B',
      inputs: ['a', 'b'], cases: [[2.5, 1.25, 3.75], [-1.5, 0.75, -0.75], [0.0625, 0.9375, 1]],
      nodes: [node('a', 'input', 'A', 43, 114), node('b', 'input', 'B', 43, 332), node('add', 'add', 'ADD', 322, 219), output()],
      wires: [wire('a', 'add', 'A'), wire('add', 'y', 'IN')],
    },
    {
      title: '向左放大', description: '将输入 B 接到移位量 N，让 A 左移 B 位。', formula: 'Y = A << B',
      inputs: ['a', 'n'], cases: [[1.25, 1, 2.5], [-0.75, 2, -3], [0.0625, 3, 0.5], [1.125, 0, 1.125]],
      nodes: [node('a', 'input', 'A', 43, 114), node('n', 'input', 'B', 43, 332), node('left', 'left', 'SHL', 322, 219), output()], wires: [],
    },
    {
      title: '向右缩小', description: '将输入 B 接到移位量 N，让 A 右移 B 位。', formula: 'Y = A >> B',
      inputs: ['a', 'n'], cases: [[5.5, 1, 2.75], [-1.1875, 1, -0.5625], [0.0625, 1, 0], [3.75, 2, 0.9375]],
      nodes: [node('a', 'input', 'A', 43, 114), node('n', 'input', 'B', 43, 332), node('right', 'right', 'SHR', 322, 219), output()], wires: [],
    },
    {
      title: '两数的平均值', description: '先求 A 和 B 的和，再用常数 1 作为移位量，将和右移一位。', formula: 'Y = (A + B) >> 1',
      inputs: ['a', 'b'], cases: [[3.5, 1.25, 2.375], [-2, 1.25, -0.375], [-0.25, -0.1875, -0.1875], [0.0625, 0.125, 0.0625]],
      nodes: [node('a', 'input', 'A', 43, 114), node('b', 'input', 'B', 43, 332), output()], wires: [],
    },
  ];
  const width = 820;
  const height = 525;
  const storageKey = 'fixed-point-workshop-v1';
  const defaultHint = '左键拖节点，右键拖空白处移动视角，滚轮缩放。';
  const svgNS = 'http://www.w3.org/2000/svg';
  const board = $('board-scroll');
  const inputNames = ['A', 'B', 'C', 'D'];
  const inputY = index => 64 + index * 110;
  let save;
  try { save = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { save = {}; }
  const boards = save.boards || {};
  const passed = save.passed || {};
  const gates = Array.isArray(save.gates) ? save.gates : [];
  if (!save.inputPanel) migrateInputs();
  let levelIndex = Number.isInteger(save.levelIndex) && levels[save.levelIndex] ? save.levelIndex : 0;
  let sandbox = save.sandbox === true;
  let graph = boards[boardKey()] || starter();
  let currentCase = 0;
  let sampleValues = {};
  let delays = {};
  let tick = 0;
  let results = null;
  let selection = null;
  let source = null;
  let drag = null;
  let wireDrag = null;
  let middleZoom = null;
  let editedId = null;
  let zoom = 1;
  let autoZoom = true;
  let cameraX = 0;
  let cameraY = 0;
  let pan = null;
  const undo = [];
  const redo = [];

  function boardKey() { return sandbox ? 'sandbox' : `level-${levelIndex}`; }

  function migrateInputs() {
    for (const index of [1, 2]) {
      const input = boards[`level-${index}`]?.nodes.find(item => item.id === 'n');
      if (input) input.name = 'B';
    }
    const board = boards.sandbox;
    if (!board) return;
    const inputs = board.nodes.filter(item => item.type === 'input');
    for (const [index, name] of inputNames.entries()) {
      if (inputs[index]) {
        inputs[index].name = name;
        continue;
      }
      const y = inputY(index);
      const overlaps = board.nodes.some(item => Math.abs(item.y - y) < 104 && Math.abs(item.x - 43) < 174);
      board.nodes.push(node(`input-${name}`, 'input', name, overlaps ? 236 : 43, y));
    }
  }
  function starter() {
    if (!sandbox) {
      const { nodes, wires } = levels[levelIndex];
      return structuredClone({ nodes, wires });
    }
    const inputs = inputNames.map((name, index) => node(name.toLowerCase(), 'input', name, 43, inputY(index), index ? 0 : 1.5));
    return { nodes: [...inputs, output()], wires: [wire('a', 'y', 'IN')] };
  }

  function persist() {
    boards[boardKey()] = graph;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ boards, passed, gates, levelIndex, sandbox, inputPanel: true }));
      $('save-status').textContent = '电路保存在当前浏览器';
      return true;
    } catch {
      $('save-status').textContent = '当前浏览器无法保存电路';
      return false;
    }
  }

  function hint(message = defaultHint, warning = false) {
    $('board-hint').textContent = message;
    $('board-hint').classList.toggle('warning', warning);
  }

  function commit(next, message) {
    undo.push(graph);
    if (undo.length > 60) undo.shift();
    redo.length = 0;
    graph = next;
    finishEdit(message);
  }

  function finishEdit(message) {
    results = null;
    source = null;
    wireDrag = null;
    persist();
    render();
    hint(message);
  }

  function travel(from, to, message) {
    if (!from.length) return;
    to.push(graph);
    graph = from.pop();
    selection = null;
    finishEdit(message);
  }

  function switchBoard(nextSandbox, index = levelIndex) {
    if (nextSandbox === sandbox && index === levelIndex) return;
    persist();
    sandbox = nextSandbox;
    levelIndex = index;
    graph = boards[boardKey()] || starter();
    undo.length = 0;
    redo.length = 0;
    currentCase = 0;
    sampleValues = {};
    delays = {};
    tick = 0;
    selection = null;
    finishEdit();
  }

  function caseInputs(index) {
    if (sandbox) return {};
    const { inputs, cases } = levels[levelIndex];
    return Object.fromEntries(inputs.map((id, i) => [id, parse(cases[index][i])]));
  }

  function liveInputs() {
    return { ...caseInputs(currentCase), ...Object.fromEntries(Object.entries(sampleValues).map(([id, value]) => [id, value.ticks])) };
  }

  function availableInput() {
    const used = new Set(graph.nodes.filter(item => item.type === 'input').map(item => item.name));
    for (let index = 1; ; index += 1) {
      let name = '';
      for (let value = index; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + (value - 1) % 26) + name;
      if (!used.has(name)) return name;
    }
  }

  function inputIsNegative(item, ticks) {
    return ticks < 0 || (ticks === 0 && Boolean(sandbox ? item.negativeZero : sampleValues[item.id]?.negativeZero));
  }

  function inputBits(item, ticks) {
    const [, whole, fraction] = bits(ticks);
    const minus = inputIsNegative(item, ticks);
    const cell = (bit, digit, label, pressed = digit === '1') => `<button type="button" class="bit-cell${bit === 'sign' ? ' sign' : ''}" data-bit="${bit}" aria-label="${item.name} ${label}" aria-pressed="${pressed}" title="${label}">${digit}</button>`;
    const integers = [...whole].map((digit, i) => cell(7 - i, digit, `整数位 ${2 ** (3 - i)}`)).join('');
    const fractions = [...fraction].map((digit, i) => cell(3 - i, digit, `小数位 ${2 ** (-i - 1)}`)).join('');
    return `<div class="input-bits" role="group" aria-label="${item.name} 的符号、整数和小数">${cell('sign', minus ? '−' : '+', '符号位', minus)}${integers}<span aria-hidden="true">.</span>${fractions}</div>`;
  }

  function bitText(value) {
    if (value?.ticks === undefined) return '·  ────.────';
    const [sign, whole, fraction] = bits(value.ticks);
    return `${sign}  ${whole}.${fraction}`;
  }

  function describesSelection() {
    if (selection?.kind === 'node') {
      const item = graph.nodes.find(item => item.id === selection.id);
      return item && `${item.gate?.name ?? kinds[item.type][0]} ${item.name}`;
    }
    return selection?.kind === 'wire' ? '导线' : null;
  }

  function mandatory(item) {
    return !sandbox && [...levels[levelIndex].inputs, 'y'].includes(item.id);
  }

  function updateToolbar() {
    $('undo').disabled = undo.length === 0;
    $('redo').disabled = redo.length === 0;
    const item = selection?.kind === 'node' && graph.nodes.find(item => item.id === selection.id);
    $('delete').disabled = !selection || Boolean(item && mandatory(item));
    $('step').disabled = !hasDelay(graph);
    $('step').textContent = tick ? `下一步 · ${tick}` : '下一步';
    $('save-gate').hidden = !sandbox;
    $('save-gate').disabled = !graph.nodes.some(item => item.type === 'output');
  }

  function render() {
    $('challenge').setAttribute('aria-pressed', String(!sandbox));
    $('sandbox').setAttribute('aria-pressed', String(sandbox));
    $('level-navigation').hidden = sandbox;
    $('prev').disabled = levelIndex === 0;
    $('next').disabled = levelIndex === levels.length - 1;
    $('levels').innerHTML = levels.map((level, index) => `<option value="${index}">${String(index + 1).padStart(2, '0')} / ${String(levels.length).padStart(2, '0')} · ${level.title}${passed[index] ? ' ✓' : ''}</option>`).join('');
    $('levels').value = levelIndex;
    $('level-title').textContent = sandbox ? '自由搭建' : levels[levelIndex].title;
    $('level-description').textContent = sandbox ? '添加元件、修改数值，观察信号在电路中的变化。' : levels[levelIndex].description;
    $('inspector-title').textContent = sandbox ? '信号读数' : '关卡检测';
    $('node-count').textContent = `${graph.nodes.length} 节点 / ${graph.wires.length} 连线`;
    document.querySelectorAll('.shelf [data-part]').forEach(button => {
      const type = button.dataset.part;
      button.disabled = !sandbox && ['input', 'output'].includes(type);
      if (button.disabled) button.title = '关卡的输入和输出由题目指定';
      else if (type === 'sign') button.title = '负数输出 −1，零输出 0，正数输出 +1';
      else if (type === 'changeSign') button.title = 'S 接 −1 取反，接 0 归零，接 +1 保留原值';
      else button.title = '点击添加，或拖到画布指定位置';
    });
    updateToolbar();
    renderLibrary();
    const values = evaluate(graph, liveInputs(), delays);
    renderNodes(values);
    renderWires(values);
    renderInspector(values);
  }

  function renderNodes(values) {
    $('nodes').innerHTML = graph.nodes.map(item => {
      const [kind, symbol] = kinds[item.type];
      const label = escapeHTML(item.gate?.name ?? kind);
      const value = values.get(item.id);
      const number = value.ticks === undefined ? '—' : format(value.ticks);
      const editable = item.type === 'constant' || item.type === 'input';
      const selected = selection?.kind === 'node' && selection.id === item.id;
      const inlets = inputPorts(item);
      const hasOutput = item.type !== 'output';
      const inletButtons = inlets.map((port, index) => {
        const connected = graph.wires.some(w => w.to === item.id && w.port === port);
        return `<button class="port in ${connected ? 'connected' : ''} ${source && item.id !== source ? 'waiting' : ''}" style="--port-top:${44 + index * 23}px" type="button" data-in="${port}" aria-label="${label} ${item.name} 输入口 ${port}" title="输入 ${port}${connected ? '，右键断开' : ''}"></button>`;
      }).join('');
      const outlet = hasOutput ? `<button class="port out ${source === item.id ? 'active' : ''} ${graph.wires.some(w => w.from === item.id) ? 'connected' : ''}" type="button" data-out aria-label="${label} ${item.name} 输出口" aria-pressed="${source === item.id}" title="从这里接线"></button>` : '';
      const outletLabel = hasOutput ? '<span>OUT</span>' : '';
      const shownNumber = editable ? `<button type="button" data-edit class="node-number" aria-label="编辑 ${item.name} 的数值">${number}</button>` : `<span class="node-number ${value.error ? 'error' : ''}">${number}</span>`;
      const body = item.type === 'input' ? `${inputBits(item, value.ticks)}${shownNumber}` : `<div class="node-port-labels"><span>${inlets.map(port => `<span>${port}</span>`).join('')}</span>${outletLabel}</div>${shownNumber}<span class="node-bits" aria-label="定点表示 ${bitText(value)}">${bitText(value)}</span>`;
      return `<article data-node="${item.id}" class="node ${item.type}${selected ? ' selected' : ''}" style="left:${item.x}px;top:${item.y}px">
        <button class="node-head" type="button" aria-label="选择${label} ${item.name}" title="${label}" aria-pressed="${selected}"><span class="node-icon" aria-hidden="true">${symbol}</span><strong>${label}</strong><span class="node-id">${item.name}</span></button>
        <div class="node-body">${body}</div>
        ${inletButtons}${outlet}</article>`;
    }).join('');
  }

  function fromPosition(id) {
    const item = graph.nodes.find(item => item.id === id);
    return item && { x: item.x + 174, y: item.y + 56.5 };
  }

  function toPosition(id, port) {
    const item = graph.nodes.find(item => item.id === id);
    return item && { x: item.x, y: item.y + 56.5 + inputPorts(item).indexOf(port) * 23 };
  }

  function curve(a, b) {
    const vector = Math.max(34, Math.min(120, Math.abs(b.x - a.x) * 0.5));
    return `M ${a.x},${a.y} C ${a.x + vector},${a.y} ${b.x - vector},${b.y} ${b.x},${b.y}`;
  }

  function renderWires(values = evaluate(graph, liveInputs(), delays)) {
    $('wires').innerHTML = graph.wires.map((w, index) => {
      const a = fromPosition(w.from);
      const b = toPosition(w.to, w.port);
      if (!a || !b) return '';
      const d = curve(a, b);
      const selected = selection?.kind === 'wire' && selection.index === index;
      return `<path class="wire${values.get(w.from)?.error ? ' invalid' : ''}${selected ? ' selected' : ''}" d="${d}"/><path class="wire-hit" data-wire="${index}" d="${d}"/>`;
    }).join('');
    if (wireDrag?.moved) {
      const a = fromPosition(wireDrag.id);
      const pending = document.createElementNS(svgNS, 'path');
      pending.setAttribute('class', 'wire pending');
      pending.setAttribute('d', curve(a, wireDrag.end));
      $('wires').append(pending);
    }
  }

  function challengeReading(values) {
    const value = values.get('y');
    const expected = levels[levelIndex].cases[currentCase].at(-1);
    const customized = Object.keys(sampleValues).length !== 0;
    return `<div class="reading"><dl><dt>期望 Y</dt><dd>${customized ? '—' : expected}</dd><dt>实际 Y</dt><dd class="actual">${value?.ticks === undefined ? '—' : format(value.ticks)}</dd></dl>${value?.error ? `<p>${value.error}</p>` : `<p class="node-bits">${bitText(value)}</p>`}${customized ? '<p>正在试算自定义值。检测使用预设样例。</p>' : ''}</div>`;
  }

  function renderInspector(values) {
    if (sandbox) {
      const items = graph.nodes.filter(item => item.type === 'output');
      const selected = selection?.kind === 'node' && graph.nodes.find(item => item.id === selection.id);
      if (selected && selected.type !== 'output') items.unshift(selected);
      $('inspection-content').innerHTML = `<section class="inspection-section"><div class="inspection-kicker"><h3>实时数值</h3></div>${items.map(item => {
        const value = values.get(item.id);
        return `<div class="reading"><dl><dt>${item.name}</dt><dd class="actual">${value.ticks === undefined ? '—' : format(value.ticks)}</dd></dl><p>${value.error || bitText(value)}</p></div>`;
      }).join('') || '<p class="inspection-text">添加输出节点或选择节点，查看信号。</p>'}</section>`;
      return;
    }
    const { cases, inputs, formula, nodes } = levels[levelIndex];
    const caseCards = cases.map((values, index) => {
      const badge = results ? (results[index] ? '✓' : '×') : '·';
      const status = results ? (results[index] ? '通过' : '未通过') : '未检测';
      const sample = inputs.map((id, i) => `${nodes.find(item => item.id === id).name}=${values[i]}`).join(' / ');
      return `<button class="case" type="button" data-case="${index}" aria-pressed="${index === currentCase}" aria-label="样例 ${index + 1}，${sample}，${status}"><span class="case-index">${String(index + 1).padStart(2, '0')}</span><span class="case-values">${sample}</span><span class="case-status ${badge === '×' ? 'fail' : ''}" aria-hidden="true">${badge}</span></button>`;
    }).join('');
    const total = results?.filter(Boolean).length;
    const message = total === cases.length ? `关卡通过 · ${total}/${cases.length} 组符合目标` : `通过 ${total}/${cases.length} 组，请检查标记为 × 的样例。`;
    $('inspection-content').innerHTML = `
      <section class="inspection-section objective"><div class="inspection-kicker"><h3>目标</h3>${passed[levelIndex] ? '<span>✓ 已通关</span>' : ''}</div><div class="formula">${formula.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</div></section>
      <section class="inspection-section"><div class="inspection-kicker"><h3>样例输入</h3><span>${cases.length} 组</span></div><div class="cases">${caseCards}</div></section>
      <section class="inspection-section"><div class="inspection-kicker"><h3>实时输出</h3></div>${challengeReading(values)}</section>
      <section class="inspection-section actions"><button class="primary" type="button" id="check">▶ 检测电路</button>${results ? `<p class="check-result${total === cases.length ? '' : ' fail'}" role="status">${message}</p>` : ''}</section>`;
  }

  function escapeHTML(text) {
    return text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function renderLibrary() {
    $('gate-library').innerHTML = gates.map((gate, index) => {
      const name = escapeHTML(gate.name);
      const ports = gate.inputs.map(input => input.name).join(' · ') || '无输入';
      return `<button class="part" type="button" data-gate="${index}" title="添加 ${name}"><span class="part-icon custom">▦</span><span><strong>${name}</strong><small>${ports} → OUT</small></span><span class="insert" aria-hidden="true">+</span></button>`;
    }).join('');
    $('gate-empty').hidden = gates.length > 0;
  }

  function addPart(type, gate, position) {
    if (!sandbox && ['input', 'output'].includes(type)) return;
    const inputName = type === 'input' ? availableInput() : null;
    if (type === 'input' && !inputName) return;
    const base = kinds[type][2];
    let index = 1;
    while (graph.nodes.some(item => item.name === `${base}${index}`)) index += 1;
    const cardHeight = type === 'input' ? 104 : 155 + Math.max(0, (gate?.inputs.length ?? 0) - 2) * 23;
    const { x, y } = position ?? placement(cardHeight);
    const part = node(`part-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`, type, inputName || `${base}${index}`, x, y, type === 'constant' ? 1 : 0);
    if (gate) part.gate = gate;
    selection = { kind: 'node', id: part.id };
    commit({ ...graph, nodes: [...graph.nodes, part] }, `已添加${gate?.name ?? kinds[type][0]} ${part.name}。`);
    if (cameraX + x * zoom < 0 || cameraX + (x + 174) * zoom > board.clientWidth || cameraY + y * zoom < 0 || cameraY + (y + cardHeight) * zoom > board.clientHeight) {
      autoZoom = false;
      cameraX = board.clientWidth / 2 - (x + 87) * zoom;
      cameraY = board.clientHeight / 2 - (y + cardHeight / 2) * zoom;
      drawCamera();
    }
  }

  function placement(cardHeight) {
    const centerX = Math.round((board.clientWidth / 2 - cameraX) / zoom - 87);
    const centerY = Math.round((board.clientHeight / 2 - cameraY) / zoom - cardHeight / 2);
    const heights = new Map([...$('nodes').children].map(element => [element.dataset.node, element.offsetHeight]));
    for (let ring = 0; ; ring += 1) {
      for (let row = -ring; row <= ring; row += 1) {
        for (let column = -ring; column <= ring; column += 1) {
          if (Math.max(Math.abs(row), Math.abs(column)) !== ring) continue;
          const x = centerX + column * 196;
          const y = centerY + row * (cardHeight + 18);
          const available = graph.nodes.every(item => x + 191 <= item.x || item.x + 191 <= x || y + cardHeight + 12 <= item.y || item.y + (heights.get(item.id) ?? 155) + 12 <= y);
          if (available) return { x, y };
        }
      }
    }
  }

  function select(next) {
    source = null;
    selection = next;
    render();
    const label = describesSelection();
    hint(label ? `已选中${label}。` : defaultHint);
  }

  function activateOutlet(id) {
    source = source === id ? null : id;
    selection = null;
    render();
    $('nodes').querySelector(`[data-node="${id}"] [data-out]`).focus({ preventScroll: true });
    hint(source ? '已选择输出口。点击目标节点的输入圆点。' : defaultHint);
  }

  function completeWire(from, to, port) {
    try {
      const next = connect(graph, from, to, port);
      selection = null;
      commit(next, '接线完成。');
      $('nodes').querySelector(`[data-node="${to}"] [data-in="${port}"]`).focus({ preventScroll: true });
    } catch (error) {
      hint(error.message, true);
    }
  }

  function removeSelected() {
    if (!selection) return;
    if (selection.kind === 'wire') {
      const { index } = selection;
      selection = null;
      commit({ ...graph, wires: graph.wires.filter((_, i) => i !== index) }, '已断开导线。');
      return;
    }
    const { id } = selection;
    if (mandatory(graph.nodes.find(item => item.id === id))) return hint('此节点是关卡指定的接口。', true);
    selection = null;
    commit({ nodes: graph.nodes.filter(item => item.id !== id), wires: graph.wires.filter(w => w.from !== id && w.to !== id) }, '已删除元件及相连的导线。');
  }

  function showEditor(id) {
    const item = graph.nodes.find(item => item.id === id);
    editedId = id;
    $('value-title').textContent = `编辑 ${kinds[item.type][0]} ${item.name}`;
    $('value-input').value = format(item.type === 'input' && !sandbox ? liveInputs()[id] : item.ticks);
    $('value-error').textContent = '范围 ±15.9375，步长 0.0625';
    $('value-dialog').showModal();
    $('value-input').select();
  }

  function applyValue(id, ticks, negativeZero = false) {
    if (!sandbox && Object.hasOwn(caseInputs(currentCase), id)) {
      sampleValues[id] = { ticks, negativeZero };
      results = null;
      render();
      hint('已更新试算输入。点选样例可恢复预设值。');
      return;
    }
    commit({ ...graph, nodes: graph.nodes.map(item => item.id === id ? { ...item, ticks, negativeZero } : item) }, '已应用新数值。');
  }

  function toggleInputBit(id, bit) {
    const item = graph.nodes.find(item => item.id === id);
    const ticks = sandbox ? item.ticks : liveInputs()[id];
    const minus = inputIsNegative(item, ticks);
    const sign = bit === 'sign' ? !minus : minus;
    const magnitude = bit === 'sign' ? Math.abs(ticks) : Math.abs(ticks) ^ (1 << Number(bit));
    applyValue(id, sign && magnitude ? -magnitude : magnitude, sign && magnitude === 0);
    $('nodes').querySelector(`[data-node="${id}"] [data-bit="${bit}"]`).focus({ preventScroll: true });
  }

  function drawCamera() {
    $('plane').style.transform = `translate(${cameraX}px, ${cameraY}px) scale(${zoom})`;
    board.style.backgroundPosition = `${cameraX}px ${cameraY}px`;
  }

  function viewportCenter() {
    const rect = board.getBoundingClientRect();
    return { clientX: rect.left + board.clientWidth / 2, clientY: rect.top + board.clientHeight / 2 };
  }

  function fitCamera() {
    const frame = { x: 0, y: 0, right: width, bottom: height };
    const positions = new Map(graph.nodes.map(node => [node.id, node]));
    for (const element of $('nodes').children) {
      const node = positions.get(element.dataset.node);
      frame.x = Math.min(frame.x, node.x - 12);
      frame.y = Math.min(frame.y, node.y - 12);
      frame.right = Math.max(frame.right, node.x + element.offsetWidth + 12);
      frame.bottom = Math.max(frame.bottom, node.y + element.offsetHeight + 12);
    }
    const next = Math.min(1, (board.clientWidth - 18) / (frame.right - frame.x), (board.clientHeight - 18) / (frame.bottom - frame.y));
    setZoom(next, frame);
  }

  function setZoom(next, fit = false, anchor) {
    const point = anchor && planePoint(anchor);
    zoom = Math.max(fit ? Number.EPSILON : Math.min(0.25, zoom), Math.min(1.6, next));
    autoZoom = Boolean(fit);
    if (fit) {
      cameraX = (board.clientWidth - (fit.right - fit.x) * zoom) / 2 - fit.x * zoom;
      cameraY = (board.clientHeight - (fit.bottom - fit.y) * zoom) / 2 - fit.y * zoom;
    } else if (point) {
      const rect = board.getBoundingClientRect();
      cameraX = anchor.clientX - rect.left - point.x * zoom;
      cameraY = anchor.clientY - rect.top - point.y * zoom;
    }
    drawCamera();
    $('zoom-fit').textContent = `${zoom < 0.1 ? Number((zoom * 100).toPrecision(2)) : Math.round(zoom * 100)}%`;
    $('zoom-out').disabled = zoom <= 0.25;
    $('zoom-in').disabled = zoom >= 1.6;
  }

  function planePoint(event) {
    const rect = $('plane').getBoundingClientRect();
    return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom };
  }

  $('nodes').addEventListener('click', event => {
    const nodeElement = event.target.closest('[data-node]');
    if (!nodeElement) return;
    const id = nodeElement.dataset.node;
    const target = event.target.closest('button');
    if (!target) select({ kind: 'node', id });
    else if (target.hasAttribute('data-out')) activateOutlet(id);
    else if (target.hasAttribute('data-in')) {
      if (source) completeWire(source, id, target.dataset.in);
      else hint('先选择要接出的输出圆点。', true);
    } else if (target.hasAttribute('data-bit')) toggleInputBit(id, target.dataset.bit);
    else if (target.hasAttribute('data-edit')) showEditor(id);
    else if (target.classList.contains('node-head')) {
      select({ kind: 'node', id });
      $('nodes').querySelector(`[data-node="${id}"] .node-head`).focus({ preventScroll: true });
    }
  });

  $('nodes').addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag || wireDrag || middleZoom || pan) return;
    const grip = event.target.closest('.node-head, [data-out]')
      || (!event.target.closest('button') && event.target.closest('.node-body'));
    if (!grip) return;
    const element = grip.closest('[data-node]');
    const id = element.dataset.node;
    const base = graph.nodes.find(item => item.id === id);
    const start = planePoint(event);
    if (grip.hasAttribute('data-out')) wireDrag = { id, grip, start, pointer: event.pointerId, moved: false };
    else drag = { base, element, grip, start, pointer: event.pointerId, moved: false };
    grip.setPointerCapture(event.pointerId);
  });

  $('nodes').addEventListener('pointermove', event => {
    const active = drag || wireDrag;
    if (!active || active.pointer !== event.pointerId) return;
    const end = planePoint(event);
    const dx = end.x - active.start.x;
    const dy = end.y - active.start.y;
    if (!active.moved && Math.hypot(dx, dy) < 5) return;
    active.moved = true;
    if (wireDrag) {
      wireDrag.end = end;
      renderWires();
      return;
    }
    const x = Math.round(drag.base.x + dx);
    const y = Math.round(drag.base.y + dy);
    drag.next = { ...drag.base, x, y };
    drag.element.style.left = `${x}px`;
    drag.element.style.top = `${y}px`;
    // Use the live position for drawing while retaining the original graph for undo.
    const savedGraph = graph;
    graph = { ...graph, nodes: graph.nodes.map(item => item.id === drag.base.id ? drag.next : item) };
    renderWires();
    graph = savedGraph;
  });

  function endPointer(event) {
    const active = drag || wireDrag;
    if (!active || active.pointer !== event.pointerId) return;
    const moving = drag;
    drag = null;
    wireDrag = null;
    if (!active.moved) return;
    if (event.type === 'pointercancel') return render();
    if (moving) {
      selection = { kind: 'node', id: moving.base.id };
      commit({ ...graph, nodes: graph.nodes.map(item => item.id === moving.base.id ? moving.next : item) }, '已移动节点。');
    } else {
      const port = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-in]');
      if (port) completeWire(active.id, port.closest('[data-node]').dataset.node, port.dataset.in);
      renderWires();
    }
  }

  $('nodes').addEventListener('pointerup', endPointer);
  $('nodes').addEventListener('pointercancel', endPointer);

  board.addEventListener('wheel', event => {
    if (!event.deltaY) return;
    event.preventDefault();
    if (drag || wireDrag || middleZoom || pan) return;
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? board.clientHeight : 1);
    setZoom(zoom * Math.exp(-pixels * 0.0018), false, event);
  }, { passive: false });

  board.addEventListener('pointerdown', event => {
    const blank = !event.target.closest('[data-node], [data-wire]');
    if (blank && (event.button === 2 || event.pointerType === 'touch') && !drag && !wireDrag && !middleZoom && !pan) {
      event.preventDefault();
      autoZoom = false;
      pan = { pointer: event.pointerId, x: event.clientX - cameraX, y: event.clientY - cameraY };
      board.classList.add('panning');
      board.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 1) return;
    event.preventDefault();
    if (drag || wireDrag || middleZoom || pan) return;
    middleZoom = { pointer: event.pointerId, clientX: event.clientX, clientY: event.clientY, start: zoom };
    board.classList.add('zooming');
    board.setPointerCapture(event.pointerId);
  });

  board.addEventListener('pointermove', event => {
    if (pan?.pointer === event.pointerId) {
      cameraX = event.clientX - pan.x;
      cameraY = event.clientY - pan.y;
      drawCamera();
      return;
    }
    if (middleZoom?.pointer !== event.pointerId) return;
    const distance = middleZoom.clientY - event.clientY;
    if (!distance && zoom === middleZoom.start) return;
    setZoom(middleZoom.start * Math.exp(distance * 0.008), false, middleZoom);
  });

  function endMiddleZoom(event) {
    if (pan?.pointer === event.pointerId) {
      pan = null;
      board.classList.remove('panning');
    }
    if (middleZoom?.pointer !== event.pointerId) return;
    middleZoom = null;
    board.classList.remove('zooming');
  }

  board.addEventListener('pointerup', endMiddleZoom);
  board.addEventListener('pointercancel', endMiddleZoom);
  board.addEventListener('lostpointercapture', endMiddleZoom);

  board.addEventListener('auxclick', event => {
    if (event.button === 1) event.preventDefault();
  });
  board.addEventListener('contextmenu', event => event.preventDefault());

  $('plane').addEventListener('click', event => {
    const trace = event.target.closest('[data-wire]');
    if (trace) select({ kind: 'wire', index: Number(trace.dataset.wire) });
    else if (event.target === $('plane')) select(null);
  });

  $('plane').addEventListener('contextmenu', event => {
    const port = event.target.closest('[data-in]');
    const trace = event.target.closest('[data-wire]');
    const item = event.target.closest('[data-node]');
    if (!port && !trace && !item) return;
    event.preventDefault();
    if (port || trace) {
      const index = trace ? Number(trace.dataset.wire) : graph.wires.findIndex(w => w.to === item.dataset.node && w.port === port.dataset.in);
      if (index < 0) return;
      selection = { kind: 'wire', index };
    } else {
      selection = { kind: 'node', id: item.dataset.node };
    }
    removeSelected();
    updateToolbar();
  });

  $('inspection-content').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-case')) {
      currentCase = Number(button.dataset.case);
      sampleValues = {};
      render();
      document.querySelector(`[data-case="${currentCase}"]`).focus({ preventScroll: true });
    } else if (button.id === 'check') {
      sampleValues = {};
      const { cases } = levels[levelIndex];
      results = cases.map((values, i) => evaluate(graph, caseInputs(i)).get('y')?.ticks === parse(values.at(-1)));
      const firstFailure = results.indexOf(false);
      if (firstFailure >= 0) currentCase = firstFailure;
      else {
        passed[levelIndex] = true;
        persist();
      }
      render();
      $('check').focus({ preventScroll: true });
      hint(firstFailure >= 0 ? `样例 ${firstFailure + 1} 的结果与目标不同。` : '本关的所有样例均通过。', firstFailure >= 0);
    }
  });

  document.querySelectorAll('[data-part]').forEach(button => button.addEventListener('click', () => addPart(button.dataset.part)));
  const toolbox = document.querySelector('.toolbox');
  let partDrag = null;
  let suppressPartClick = false;
  toolbox.addEventListener('pointerdown', event => {
    const button = event.target.closest('[data-part], [data-gate]');
    if (event.button !== 0 || !button || button.disabled || drag || wireDrag || pan || middleZoom) return;
    event.preventDefault();
    partDrag = { button, pointer: event.pointerId, x: event.clientX, y: event.clientY, ghost: null };
    toolbox.setPointerCapture(event.pointerId);
  });
  document.addEventListener('pointermove', event => {
    if (partDrag?.pointer !== event.pointerId) return;
    if (!partDrag.ghost && Math.hypot(event.clientX - partDrag.x, event.clientY - partDrag.y) < 6) return;
    if (!partDrag.ghost) {
      const ghost = partDrag.button.cloneNode(true);
      ghost.classList.add('part-ghost');
      ghost.removeAttribute('id');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.tabIndex = -1;
      document.body.append(ghost);
      partDrag.ghost = ghost;
    }
    partDrag.ghost.style.left = `${event.clientX + 12}px`;
    partDrag.ghost.style.top = `${event.clientY + 12}px`;
    board.classList.toggle('drop-target', board.contains(document.elementFromPoint(event.clientX, event.clientY)));
  });
  function finishPartDrag(event) {
    if (partDrag?.pointer !== event.pointerId) return;
    const active = partDrag;
    partDrag = null;
    board.classList.remove('drop-target');
    if (!active.ghost) return;
    active.ghost.remove();
    suppressPartClick = true;
    setTimeout(() => { suppressPartClick = false; }, 0);
    if (event.type !== 'pointerup' || !board.contains(document.elementFromPoint(event.clientX, event.clientY))) return;
    const point = planePoint(event);
    const position = { x: Math.round(point.x - 87), y: Math.round(point.y - 19) };
    const gate = active.button.hasAttribute('data-gate') ? gates[Number(active.button.dataset.gate)] : undefined;
    addPart(active.button.dataset.part || 'custom', gate, position);
  }
  document.addEventListener('pointerup', finishPartDrag);
  document.addEventListener('pointercancel', finishPartDrag);
  toolbox.addEventListener('lostpointercapture', finishPartDrag);
  toolbox.addEventListener('click', event => {
    if (suppressPartClick) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
  $('help').addEventListener('click', () => $('help-dialog').showModal());
  $('challenge').addEventListener('click', () => switchBoard(false));
  $('sandbox').addEventListener('click', () => switchBoard(true));
  $('prev').addEventListener('click', () => switchBoard(false, levelIndex - 1));
  $('next').addEventListener('click', () => switchBoard(false, levelIndex + 1));
  $('levels').addEventListener('change', () => switchBoard(false, Number($('levels').value)));
  $('undo').addEventListener('click', () => travel(undo, redo, '已撤销。'));
  $('redo').addEventListener('click', () => travel(redo, undo, '已重做。'));
  $('delete').addEventListener('click', removeSelected);
  $('gate-library').addEventListener('click', event => {
    const button = event.target.closest('[data-gate]');
    if (button) addPart('custom', gates[Number(button.dataset.gate)]);
  });
  $('save-gate').addEventListener('click', () => {
    const outputs = graph.nodes.filter(item => item.type === 'output');
    const options = outputs.map(item => new Option(item.name, item.id));
    $('gate-output').replaceChildren(...options);
    if (selection?.kind === 'node' && outputs.some(item => item.id === selection.id)) $('gate-output').value = selection.id;
    $('gate-name').value = '';
    $('gate-error').textContent = '';
    $('gate-dialog').showModal();
  });
  $('gate-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('gate-name').value.trim();
    try {
      if (!name) throw new Error('请输入逻辑门名称。');
      const gate = captureGate(graph, $('gate-output').value, name);
      gates.unshift(gate);
      if (!persist()) {
        gates.shift();
        throw new Error('浏览器存储不可用，逻辑门未保存。');
      }
      $('gate-dialog').close();
      renderLibrary();
      hint(`已保存「${name}」，可从元件库添加。`);
    } catch (error) {
      $('gate-error').textContent = error.message;
    }
  });
  $('step').addEventListener('click', () => {
    delays = advance(graph, liveInputs(), delays);
    tick += 1;
    results = null;
    render();
    hint(`第 ${tick} 步。所有延迟线已同时采样。`);
  });
  $('reset').addEventListener('click', () => {
    selection = null;
    sampleValues = {};
    delays = {};
    tick = 0;
    commit(starter(), '已重置电路，可以撤销。');
  });
  $('zoom-out').addEventListener('click', () => setZoom(zoom - 0.15, false, viewportCenter()));
  $('zoom-fit').addEventListener('click', fitCamera);
  $('zoom-in').addEventListener('click', () => setZoom(zoom + 0.15, false, viewportCenter()));
  new ResizeObserver(() => { if (autoZoom) fitCamera(); }).observe(board);

  $('value-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const raw = $('value-input').value.trim();
      const ticks = parse(raw);
      $('value-dialog').close();
      applyValue(editedId, ticks, ticks === 0 && raw.startsWith('-'));
      $('nodes').querySelector(`[data-node="${editedId}"] [data-edit]`).focus({ preventScroll: true });
    } catch (error) {
      $('value-error').textContent = error.message;
    }
  });

  document.addEventListener('keydown', event => {
    if (event.target.matches('input, select') || document.querySelector('dialog[open]')) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) travel(redo, undo, '已重做。');
      else travel(undo, redo, '已撤销。');
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removeSelected();
    } else if (event.key === 'Escape') select(null);
  });

  if (!save.inputPanel) persist();
  render();
  fitCamera();
})();
