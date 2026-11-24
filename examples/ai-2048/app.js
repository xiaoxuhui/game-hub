(() => {
  'use strict';
  const core = AI2048, $ = id => document.getElementById(id), key = 'ai-2048-save-v1';
  let state, auto = false, busy = false, worker = null, timer = null, fallbackTimer = null;
  let generation = 0, protectedSave = false, storageWarning = '', notice = '';
  try {
    const saved = localStorage.getItem(key);
    state = saved ? core.validate(JSON.parse(saved)) : core.initial();
  } catch {
    state = core.initial(); protectedSave = true;
    storageWarning = '原存档无法读取，已保留。点击重新开始后才会保存新局。';
  }
  function save() {
    if (protectedSave) return;
    try { localStorage.setItem(key, JSON.stringify(state)); storageWarning = ''; }
    catch { storageWarning = '本机存储不可用，请保持页面打开以保留本局。'; }
  }
  function numberLabel(exponent) { return exponent < 20 ? String(2 ** exponent) : `2^${exponent}`; }
  function scoreLabel(value) { return value.length > 14 ? `${value.slice(0, 4)}… (${value.length}位)` : value; }
  function render() {
    const board = $('board'), gap = state.width > 10 ? 3 : state.width > 6 ? 5 : 8;
    const cell = Math.max(28, (board.parentElement.clientWidth - 20 - (state.width - 1) * gap) / state.width);
    board.style.gridTemplateColumns = `repeat(${state.width}, minmax(0, 1fr))`;
    board.style.setProperty('--gap', `${gap}px`);
    board.style.setProperty('--tile-font', `${Math.min(42, Math.max(11, cell * 0.42))}px`);
    board.style.minWidth = `${state.width * 28 + (state.width - 1) * gap}px`;
    board.setAttribute('aria-rowcount', state.height); board.setAttribute('aria-colcount', state.width);
    board.style.touchAction = board.scrollWidth > board.parentElement.clientWidth ? 'pan-x' : 'none';
    const fragment = document.createDocumentFragment();
    for (let y = 0; y < state.height; y++) {
      const row = document.createElement('div'); row.className = 'row'; row.setAttribute('role', 'row');
      for (let x = 0; x < state.width; x++) {
        const exponent = state.cells[y * state.width + x], tile = document.createElement('div');
        const label = exponent ? numberLabel(exponent) : '';
        tile.className = `tile${exponent ? ' filled' : ''}${exponent >= 11 ? ' high' : ''}${label.length >= 5 ? ' large' : ''}`;
        tile.style.setProperty('--hue', String(170 - Math.min(exponent, 10) * 12));
        tile.textContent = label; tile.setAttribute('role', 'gridcell');
        tile.setAttribute('aria-label', `${y + 1} 行 ${x + 1} 列：${exponent ? label : '空'}`);
        row.append(tile);
      }
      fragment.append(row);
    }
    board.replaceChildren(fragment);
    for (const name of ['score', 'best']) { $(name).textContent = scoreLabel(state[name]); $(name).title = state[name]; }
    $('board-size').textContent = `${state.width} 列 × ${state.height} 行`;
    $('moves').textContent = `${state.moves} 步`;
    const ended = !core.legalMoves(state).length;
    $('auto').textContent = auto ? '暂停 AI' : 'AI 自动游玩'; $('auto').setAttribute('aria-pressed', String(auto));
    $('auto').disabled = ended; $('step').disabled = busy || auto || ended;
    document.querySelectorAll('[data-direction]').forEach(button => { button.disabled = ended; });
    const message = ended ? '本局结束：没有可移动的方向。可以重新开始或换个尺寸。'
      : notice || (busy ? 'AI 正在思考…' : auto ? 'AI 自动游玩中，点击暂停或手动移动即可接手。'
        : state.cells.some(n => n >= 11) ? '已达到 2048！可以继续挑战更大的数字。' : '合并相同数字，向 2048 前进。');
    const status = [message, storageWarning].filter(Boolean).join(' ');
    if ($('status').textContent !== status) $('status').textContent = status;
  }
  function cancel() {
    generation++; clearTimeout(timer); clearTimeout(fallbackTimer); timer = fallbackTimer = null;
    if (worker) worker.terminate(); worker = null; busy = false;
  }
  function pause() { auto = false; cancel(); }
  function play(direction) {
    const next = core.move(state, direction);
    notice = next === state ? '这个方向无法移动，试试其他方向。' : '';
    state = next;
    if (!notice) save();
    if (!core.legalMoves(state).length) pause();
    render();
  }
  function askAI() {
    if (busy || !core.legalMoves(state).length) return;
    busy = true; notice = ''; const token = generation;
    render();
    function done(direction) {
      if (token !== generation) return;
      if (worker) worker.terminate(); worker = null; busy = false;
      if (direction) play(direction); else { pause(); render(); }
      if (auto) timer = setTimeout(askAI, Number($('speed').value));
    }
    function fallback() {
      if (worker) worker.terminate(); worker = null;
      fallbackTimer = setTimeout(() => { if (token === generation) done(AI2048Search.choose(state, 1)); }, 0);
    }
    try {
      worker = new Worker('worker.js');
      worker.onmessage = event => event.data.error ? fallback() : done(event.data.direction);
      worker.onerror = event => { event.preventDefault(); fallback(); };
      worker.postMessage({ width: state.width, height: state.height, cells: state.cells });
    } catch { fallback(); }
  }
  function newGame(width, height) {
    core.dimensions(width, height); pause();
    if ((state.moves > 0 || protectedSave) && !window.confirm('开始新局会替换当前棋盘和本机存档，最高分会保留。继续吗？')) { render(); return; }
    state = core.initial(width, height, state.best); protectedSave = false; notice = '';
    $('width').value = width; $('height').value = height; save(); render();
  }
  $('width').value = state.width; $('height').value = state.height;
  $('size-form').addEventListener('submit', event => {
    event.preventDefault();
    try { newGame(Number($('width').value), Number($('height').value)); }
    catch (error) { notice = error.message; render(); }
  });
  $('restart').addEventListener('click', () => newGame(state.width, state.height));
  $('auto').addEventListener('click', () => { if (auto) { pause(); render(); } else { auto = true; askAI(); } });
  $('step').addEventListener('click', askAI);
  function manual(direction) { pause(); play(direction); }
  document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => manual(button.dataset.direction)));
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,select,textarea,button')) return;
    const direction = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (direction) { event.preventDefault(); manual(direction); }
  });
  let start = null;
  $('board').addEventListener('pointerdown', event => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    $('board').setPointerCapture(event.pointerId);
  });
  $('board').addEventListener('pointerup', event => {
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y; start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    manual(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up');
  });
  $('board').addEventListener('pointercancel', () => { start = null; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); render(); } });
  window.addEventListener('pagehide', pause);
  window.addEventListener('resize', render);
  if (!protectedSave) save(); render();
})();
