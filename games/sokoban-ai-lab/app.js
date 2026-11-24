'use strict';

const { examples, fromRows, readLevel, writeWorld, world, bounds, key, point, portalHost, trainingMap, validate, placed, won, step, activateDevice, Trainer } = Sokoban;
const $ = id => document.getElementById(id);
const board = $('board');
const grid = $('grid');
const dialog = $('dialog');
const storageKey = 'sokoban-lab-levels-v1';
const followAiKey = 'sokoban-lab-follow-ai-v1';
const followClickKey = 'sokoban-lab-follow-click-v1';
const portalArrowsKey = 'sokoban-lab-portal-arrows-v1';
const aiFollow = $('ai-follow');
const clickFollow = $('click-follow');
const portalArrowToggle = $('show-portal-arrows');
const portalCanvas = $('portal-arrows');
try {
  aiFollow.checked = localStorage.getItem(followAiKey) !== 'off';
  clickFollow.checked = localStorage.getItem(followClickKey) === 'on';
  portalArrowToggle.checked = localStorage.getItem(portalArrowsKey) !== 'off';
} catch { /* These controls also work without storage. */ }
const recordBudget = 'next-record';
const number = new Intl.NumberFormat('zh-CN');
const brushButtons = [...document.querySelectorAll('[data-brush]')];
const directionArrows = ['↑', '→', '↓', '←'];

function loadLevels() {
  let first = { name: '自制关卡 1', tiles: new Map(), chainPush: false };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved?.levels) && saved.levels.length) {
      const entries = saved.levels.map(({ name, code, demonstration }) => {
        const layout = readLevel(code);
        const clicks = layout.gameplay === 'powered' || layout.gameplay === 'direct';
        const inputs = Array.isArray(demonstration) ? demonstration.filter(input => clicks ?
          typeof input === 'string' && /^-?\d+,-?\d+$/.test(input) :
          Number.isInteger(input) && input >= 0 && input <= 3 || typeof input === 'string' && /^P[1-9]\d*$/.test(input)) : [];
        return { name, ...layout, demonstration: inputs };
      });
      return { entries, index: entries[saved.index] ? saved.index : 0 };
    }
  } catch { /* Try the previous format. */ }
  try {
    const code = localStorage.getItem('sokoban-lab-world-v1') ?? localStorage.getItem('sokoban-lab-map-v1') ?? '';
    first = { ...first, ...readLevel(code) };
  } catch { /* An empty level is available even without storage. */ }
  return { entries: [first], index: 0 };
}

const library = loadLevels();
const sessions = new Map();
const editHistories = new WeakMap();
let level = library.entries[library.index];
let map = world(level.tiles, level.chainPush, level.portals, level.finish, level);
let area = bounds(map.tiles, map.finish, map.initial.devices);
let brush = '#';
let pendingPortal = null;
let portalMessage = '';
const oneWayPortal = $('portal-direction');
let mode = 'edit';
let manual = map.initial;
let undo = [];
let manualPath = [];
const heldDirections = new Set();
let recording = false;
let trainer = null;
let trainingProblem = '';
let attempt = null;
let running = false;
let batch = null;
let frame = 0;
let watchState = null;
let watchSegment = null;
let watchResult = null;
let nextWatchAt = 0;
let playback = 0;
let replay = null;
let listedRoutes = null;
let listedCount = 0;
let gesture = null;
let camera = { x: 0.5, y: 0.5 };
let laidOutCamera = null;
let viewWidth = board.clientWidth;
let viewHeight = board.clientHeight;
let visibleArea = '';
let cells = new Map();
let portalArrowLayout = null;
let routeInput;

const tileName = { '#': '墙', ' ': '地板', '.': '目标', '$': '箱子', '@': '玩家', '*': '目标上的箱子', '+': '目标上的玩家' };
const sideNames = ['上边', '右边', '下边', '左边'];
const portalOffsets = [[0, -0.32], [0.32, 0], [0, 0.32], [-0.32, 0]];
const portalColors = ['#92dcff', '#f0b7ff', '#ffe09c', '#affae3'];

function cellSize() {
  return viewWidth < 420 ? 29 : 40;
}

function centerMap() {
  if (!Number.isFinite(area.left)) camera = { x: 0.5, y: 0.5 };
  else if (map.initial.player !== -1) {
    const [x, y] = point(map.initial.player);
    camera = { x: x + 0.5, y: y + 0.5 };
  } else {
    camera = { x: (area.left + area.right + 1) / 2, y: (area.top + area.bottom + 1) / 2 };
  }
}

function followPosition(state) {
  const coordinate = state.lastClick ?? state.player;
  if (coordinate === -1) return;
  const [x, y] = point(coordinate);
  const size = cellSize();
  if (Math.abs(x + 0.5 - camera.x) > viewWidth / size / 2 - 1.5 ||
      Math.abs(y + 0.5 - camera.y) > viewHeight / size / 2 - 1.5) {
    camera = { x: x + 0.5, y: y + 0.5 };
  }
}

function followAi(state) {
  if (aiFollow.checked && !gesture?.pan) followPosition(state);
}

function followManual(state) {
  if (!state.devices || (clickFollow.checked && !gesture?.pan)) followPosition(state);
}

function layoutBoard() {
  laidOutCamera = camera;
  const size = cellSize();
  const left = camera.x - viewWidth / size / 2;
  const top = camera.y - viewHeight / size / 2;
  const startX = Math.floor(left);
  const startY = Math.floor(top);
  const columns = Math.ceil(left + viewWidth / size) - startX;
  const rowCount = Math.ceil(top + viewHeight / size) - startY;
  const signature = [startX, startY, columns, rowCount, size].join(',');
  const transform = 'translate(' + (startX - left) * size + 'px, ' + (startY - top) * size + 'px)';
  if (grid.style.transform !== transform) grid.style.transform = transform;
  if (signature === visibleArea) return;
  visibleArea = signature;
  grid.style.setProperty('--cell-size', size + 'px');
  grid.style.setProperty('--cols', columns);
  const nextCells = new Map();
  for (let y = startY; y < startY + rowCount; y++) {
    for (let x = startX; x < startX + columns; x++) {
      const coordinate = key(x, y);
      let cell = cells.get(coordinate);
      if (!cell) {
        cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.dataset.cell = coordinate;
      }
      nextCells.set(coordinate, cell);
    }
  }
  const focused = grid.contains(document.activeElement) ? document.activeElement : null;
  grid.replaceChildren(...nextCells.values());
  if (focused && grid.contains(focused)) focused.focus({ preventScroll: true });
  cells = nextCells;
}

function renderBoard(state, previous = null) {
  const full = previous === null || camera !== laidOutCamera;
  if (full) layoutBoard();
  // Walking cannot change box occupancy in either of the player's two cells.
  const boxes = full || state.boxes !== previous.boxes ? new Set(state.boxes) : null;
  const changed = full ? null : changedCells(previous, state, boxes);
  const editable = mode === 'edit';
  const linking = editable && brush === 'portal';
  const aiClick = mode === 'watch' || mode === 'replay' ? state.lastClick : null;
  const marks = new Map();
  state.portalCells.forEach((coordinate, index) => {
    if (changed && !changed.has(coordinate)) return;
    if (!marks.has(coordinate)) marks.set(coordinate, []);
    const kind = map.portalIndex.exitOnly[index] ? 'exit' : map.portalIndex.exitOnly[index | 1] ? 'entry' : '';
    marks.get(coordinate).push({ side: (state.portalSides ?? map.portalSides)[index], pair: Math.floor(index / 2) + 1, kind });
  });
  if (linking && pendingPortal) {
    if (!marks.has(pendingPortal.cell)) marks.set(pendingPortal.cell, []);
    marks.get(pendingPortal.cell).push({ side: pendingPortal.side, pair: 0 });
  }
  const drawCell = (cell, coordinate) => {
    const goal = map.goals.has(coordinate);
    const finish = map.finishes.includes(coordinate);
    const tile = map.isWall(coordinate) ? '#' :
      boxes?.has(coordinate) ? (goal ? '*' : '$') :
      (state.players ?? [state.player]).includes(coordinate) ? (goal ? '+' : '@') : (goal ? '.' : ' ');
    const ends = marks.get(coordinate) ?? [];
    const signature = ends.map(({ side, pair, kind }) => side + ':' + pair + (kind ? ':' + kind : '')).join(',');
    const device = state.devices?.get(coordinate);
    const deviceMark = device ? device.kind + ':' + device.direction : '';
    cell.classList.toggle('ai-clicked', coordinate === aiClick);
    const interactive = editable || (mode === 'play' && device?.kind === (map.gameplay === 'powered' ? 'power' : 'pusher'));
    if (cell.disabled === interactive) cell.disabled = !interactive;
    if (cell.tabIndex !== (interactive ? 0 : -1)) cell.tabIndex = interactive ? 0 : -1;
    if (cell.dataset.tile !== tile || cell.dataset.portals !== signature || cell.dataset.device !== deviceMark ||
        cell.classList.contains('finish-cell') !== finish) {
      cell.dataset.tile = tile;
      cell.dataset.portals = signature;
      cell.dataset.device = deviceMark;
      cell.classList.toggle('wall', tile === '#');
      cell.classList.toggle('finish-cell', finish);
      cell.replaceChildren();
      if (finish) cell.append(makeTile('finish-mark'));
      if (goal) cell.append(makeTile('goal'));
      if ('$*'.includes(tile)) cell.append(makeTile(tile === '*' ? 'crate placed' : 'crate'));
      if ('@+'.includes(tile)) cell.append(makeTile('player'));
      if (device) {
        const icon = makeTile('device ' + device.kind + '-device');
        icon.textContent = directionArrows[device.direction];
        cell.append(icon);
      }
      if (ends.length) drawPortalMarks(cell, ends);
      const [x, y] = point(coordinate);
      const label = ends.map(({ side, pair, kind }) => sideNames[side] + (pair ?
        (kind === 'entry' ? '单向入口 ' : kind === 'exit' ? '单向出口 ' : '双向传送门 ') + pair : '等待配对')).join('，');
      cell.setAttribute('aria-label', '坐标 ' + x + ', ' + y + '，' + tileName[tile] +
        (finish ? '，玩家终点' : '') + (label ? '，' + label : '') +
        (device ? '，' + (device.kind === 'pusher' ? '拉推头' : '电源') + '朝' + sideNames[device.direction][0] : ''));
    }
  };
  if (full) {
    board.classList.toggle('editable', editable);
    board.classList.toggle('linking', linking);
    cells.forEach(drawCell);
  } else {
    for (const coordinate of changed) {
      const cell = cells.get(coordinate);
      if (cell) drawCell(cell, coordinate);
    }
  }
  renderPortalArrows(state);
}

function visiblePortalSpan(from, to) {
  let start = 0;
  let end = 1;
  const margin = 7;
  for (const [axis, size] of [[0, viewWidth], [1, viewHeight]]) {
    const origin = from[axis];
    const delta = to[axis] - origin;
    if (delta === 0) {
      if (origin < margin || origin > size - margin) return null;
      continue;
    }
    const a = (margin - origin) / delta;
    const b = (size - margin - origin) / delta;
    start = Math.max(start, Math.min(a, b));
    end = Math.min(end, Math.max(a, b));
    if (start >= end) return null;
  }
  return [start, end];
}

function drawArrowhead(context, x, y, dx, dy, length) {
  const halfWidth = length * 0.47;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x - dx * length + dy * halfWidth, y - dy * length - dx * halfWidth);
  context.lineTo(x - dx * length - dy * halfWidth, y - dy * length + dx * halfWidth);
  context.closePath();
  context.fill();
}

function renderPortalArrows(state) {
  const links = state.portalCells;
  $('portal-arrows-option').hidden = !links.length;
  portalCanvas.hidden = !portalArrowToggle.checked || !links.length;
  if (portalCanvas.hidden) {
    portalArrowLayout = null;
    return;
  }

  const scale = window.devicePixelRatio || 1;
  if (portalArrowLayout?.map === map && portalArrowLayout.camera === camera && portalArrowLayout.scale === scale &&
      portalArrowLayout.width === viewWidth && portalArrowLayout.height === viewHeight &&
      portalArrowLayout.sides === state.portalSides &&
      (portalArrowLayout.links === links || links.every((cell, index) => portalArrowLayout.links[index] === cell))) return;
  portalArrowLayout = { map, camera, scale, width: viewWidth, height: viewHeight, links, sides: state.portalSides };
  const width = Math.round(viewWidth * scale);
  const height = Math.round(viewHeight * scale);
  if (portalCanvas.width !== width) portalCanvas.width = width;
  if (portalCanvas.height !== height) portalCanvas.height = height;
  const context = portalCanvas.getContext('2d');
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, viewWidth, viewHeight);
  context.setLineDash([5, 4]);
  context.lineWidth = 1.6;
  const size = cellSize();
  const facePoint = index => {
    const [x, y] = point(links[index]);
    const [offsetX, offsetY] = portalOffsets[(state.portalSides ?? map.portalSides)[index]];
    return [(x + 0.5 + offsetX - camera.x) * size + viewWidth / 2,
      (y + 0.5 + offsetY - camera.y) * size + viewHeight / 2];
  };

  for (let index = 0; index < links.length; index += 2) {
    const from = facePoint(index);
    const to = facePoint(index + 1);
    const span = visiblePortalSpan(from, to);
    if (!span) continue;
    const [start, end] = span;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    const x1 = from[0] + start * dx;
    const y1 = from[1] + start * dy;
    const x2 = from[0] + end * dx;
    const y2 = from[1] + end * dy;
    const bothWays = !map.portalIndex.exitOnly[index + 1];
    const headLength = Math.min(9, length * (end - start) / (bothWays ? 3 : 2));
    const color = portalColors[(index / 2) % portalColors.length];

    context.strokeStyle = context.fillStyle = color;
    context.globalAlpha = 0.58;
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
    context.globalAlpha = 0.94;
    drawArrowhead(context, x2, y2, dx / length, dy / length, headLength);
    if (bothWays) drawArrowhead(context, x1, y1, -dx / length, -dy / length, headLength);
  }
}

function drawPortalMarks(cell, ends) {
  const faceGroups = new Map();
  for (const end of ends) {
    if (!faceGroups.has(end.side)) faceGroups.set(end.side, []);
    faceGroups.get(end.side).push(end);
  }
  for (const [side, group] of faceGroups) {
    const primary = group.find(end => !end.pair || end.kind !== 'exit') ?? group[0];
    const { pair, kind } = primary;
    const mark = makeTile('portal-mark');
    mark.dataset.side = side;
    mark.dataset.tone = (pair - 1) % 4;
    if (kind) mark.dataset.kind = kind;
    if (!pair) mark.textContent = '·';
    else if (kind === 'exit' && group.length > 1) mark.textContent = '出×' + group.length;
    else mark.textContent = (kind === 'entry' ? '入' : kind === 'exit' ? '出' : '') + pair + (group.length > 1 ? '+' : '');
    cell.append(mark);
  }
}

function changedCells(previous, state, boxes) {
  const changed = new Set([previous.player, state.player]);
  if (previous.players !== state.players) for (const cell of [...(previous.players ?? []), ...(state.players ?? [])]) changed.add(cell);
  if (boxes) {
    const before = new Set(previous.boxes);
    for (const coordinate of before) if (!boxes.has(coordinate)) changed.add(coordinate);
    for (const coordinate of boxes) if (!before.has(coordinate)) changed.add(coordinate);
  }
  state.portalCells.forEach((coordinate, index) => {
    const old = previous.portalCells[index];
    if (old === coordinate && (previous.portalSides ?? map.portalSides)[index] === (state.portalSides ?? map.portalSides)[index]) return;
    changed.add(old);
    changed.add(coordinate);
  });
  if (state.devices !== previous.devices) {
    for (const [cell, device] of previous.devices) if (state.devices.get(cell) !== device) changed.add(cell);
    for (const [cell, device] of state.devices) if (previous.devices.get(cell) !== device) changed.add(cell);
  }
  return changed;
}

function makeTile(className) {
  const tile = document.createElement('i');
  tile.className = className;
  tile.setAttribute('aria-hidden', 'true');
  return tile;
}

function renderMap() {
  const editing = mode === 'edit';
  const playing = mode === 'play';
  const watching = mode === 'watch';
  const devices = Boolean(map.initial.devices);
  $('gameplay').value = map.gameplay;
  $('best-label').textContent = devices ? '最佳操作次数' : '最佳推箱次数';
  $('chain-push-label').textContent = devices ? '允许连推多个方块' : '允许连推多个箱子';
  for (const tool of brushButtons) {
    if (tool.hasAttribute('data-classic')) tool.hidden = devices;
    if (tool.dataset.brush === 'pusher') tool.hidden = !devices;
    if (tool.dataset.brush === 'power') tool.hidden = map.gameplay !== 'powered';
    if (tool.hidden && tool.dataset.brush === brush) brush = '$';
  }
  for (const tool of brushButtons) tool.setAttribute('aria-pressed', tool.dataset.brush === brush);
  $('device-direction-label').hidden = brush !== 'pusher' && brush !== 'power';
  $('device-rotate-help').hidden = !devices;
  const linking = editing && brush === 'portal';
  const state = activeState();
  $('edit-mode').setAttribute('aria-pressed', editing);
  $('play-mode').setAttribute('aria-pressed', playing);
  $('watch-mode').setAttribute('aria-pressed', watching);
  $('edit-tools').hidden = !editing;
  $('undo-edit').disabled = !pendingPortal && !editHistories.get(level)?.length;
  $('play-tools').hidden = !playing;
  $('watch-tools').hidden = !watching;
  $('replay-tools').hidden = mode !== 'replay';
  $('ai-follow-option').hidden = !watching && mode !== 'replay';
  $('click-follow-option').hidden = !playing || !devices;
  $('map-actions').hidden = !editing;
  $('player-mode-option').hidden = devices;
  $('player-mode').value = level.playerMode ?? map.playerMode;
  $('active-player-option').hidden = !playing || (state.players?.length ?? 0) < 2;
  const playerSelect = $('active-player');
  if (playerSelect.options.length !== (state.players?.length ?? 0)) playerSelect.replaceChildren(...(state.players ?? []).map((_, index) => {
    const option = document.createElement('option'); option.value = index; option.textContent = '玩家 ' + (index + 1); return option;
  }));
  playerSelect.value = String(state.activePlayer ?? 0);
  $('dpad').hidden = !playing || state.player === -1;
  $('record-tools').hidden = !recording;
  $('portal-direction-label').hidden = !linking;
  $('portal-cancel').hidden = !linking || !pendingPortal;
  $('portal-help').hidden = !linking;
  const oneWay = oneWayPortal.value === 'one-way';
  $('portal-help').textContent = portalMessage || (pendingPortal ?
    (oneWay ? '已选入口。请点出口，可共用已有出口。' : '已选第一端，再点墙、箱子或玩家的另一条边。') :
    (oneWay ? '先点入口，再点出口。点已有端点可管理连接。' : '点墙、箱子或玩家的两条边配对。点已有端点可管理连接。'));
  $('map-info').textContent = (devices ? '方块推推推' : '无限地图') + ' · ' +
    map.initial.boxes.length + ' 个箱子 · ' + map.goals.size + ' 个目标' + (map.players.length > 1 ? ' · ' + map.players.length + ' 个玩家' : '');
  $('finish-status').hidden = devices;
  $('finish-status').textContent = map.finishes.length ? '已设置 ' + map.finishes.length + ' 个玩家终点' : '玩家终点可选';
  if (playing) {
    renderManual();
    return;
  }
  const problem = editing || watching ? validate(map) || (watching ? trainingProblem : '') : '';
  const solved = !editing && won(map, state);
  const note = problem || (editing ? '地图可试玩和训练' :
    watching ? watchNote(state, solved) : '');
  setMapNote(note, problem ? 'error' : solved ? 'success' : '');
  if (mode === 'replay') renderReplayControls(state, solved);
  if (watching) {
    const episode = Math.min((trainer?.episodes ?? 0) + Number(watchResult === null), batch?.target ?? 0);
    $('watch-progress').textContent = (episode ? '第 ' + number.format(episode) + ' 回合 · ' : '') +
      (watchSegment?.demonstration ? '跟随示范 · ' : '') +
      stateProgress(state);
  }
  renderBoard(state);
}

function setMapNote(message, status = '') {
  const note = $('map-note');
  const className = status ? 'map-note ' + status : 'map-note';
  if (note.className !== className) note.className = className;
  if (note.textContent !== message) note.textContent = message;
}

function renderManual(previous = null) {
  renderBoard(manual, previous);
  $('active-player').value = String(manual.activePlayer ?? 0);
  $('undo').disabled = !undo.length;
  $('reset-play').disabled = !manualPath.length;
  $('save-demo').disabled = !manualPath.length;
  renderMoveCount();
  const covered = placed(map, manual);
  const solved = won(map, manual, covered);
  const demoHint = manual.devices ? '示范中。点几次装置后即可保存。' : '示范中。走几步或推几次箱后即可保存。';
  let message = recording ? (solved ? '示范已通关，可以保存。' : demoHint) :
    (solved ? '通关！' : objectiveProgress(manual, covered));
  if (manual.devices && !solved) message += map.gameplay === 'powered' ? ' · 点击电源' : ' · 点击拉推头';
  setMapNote(message, solved ? 'success' : '');
}

function renderMoveCount() {
  const text = stateProgress(manual);
  const count = $('move-count');
  if (count.textContent !== text) count.textContent = text;
}

function stateProgress(state) {
  return state.devices ? '操作 ' + state.moves + ' 次' : '移动 ' + state.moves + ' 步 · 推箱 ' + state.pushes + ' 次';
}

function objectiveProgress(state, covered = placed(map, state)) {
  if (map.finishes.length && covered === map.goals.size && !won(map, state, covered)) return '请让玩家占据所有玩家终点。';
  return '目标已覆盖 ' + covered + ' / ' + map.goals.size;
}

function watchNote(state, solved) {
  if (!trainer) return '开始训练后，可在这里看 AI 走位和推箱。';
  const position = objectiveProgress(state);
  if (!running && batchComplete()) return '本批训练完成 · ' + position;
  if (!running) return '训练已暂停 · ' + position;
  if (solved) return '本回合通关';
  if (watchResult === false) return '本回合未通关，AI 将重新尝试';
  return position;
}

function setMode(next) {
  routeInput?.pause();
  if (next === 'play' && validate(map)) {
    $('map-note').textContent = validate(map);
    return;
  }
  pauseReplay();
  replay = null;
  if (next !== 'play') recording = false;
  if (next !== 'edit') {
    pendingPortal = null;
    portalMessage = '';
  }
  mode = next;
  if (mode === 'play') {
    pauseTraining();
    followManual(manual);
  }
  if (mode === 'watch') {
    nextWatchAt = 0;
    if (!watchState && trainer) syncWatchState();
    followAi(activeState());
  }
  renderMap();
  renderTraining();
}

function pauseTraining() {
  running = false;
  cancelAnimationFrame(frame);
}

function saveLevels() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      index: library.index,
      levels: library.entries.map(entry => ({
        name: entry.name, code: levelCode(entry), demonstration: entry.demonstration,
      })),
    }));
    return true;
  } catch {
    return false;
  }
}

function levelCode(entry) {
  return writeWorld(entry.tiles, entry.chainPush, entry.portals, entry.finish, entry);
}

function renderLevelPicker() {
  const picker = $('current-level');
  picker.replaceChildren(...library.entries.map((entry, index) =>
    new Option((index + 1) + ' · ' + entry.name, index)));
  picker.value = library.index;
  $('prev-level').disabled = library.index === 0;
  $('next-level').disabled = library.index === library.entries.length - 1;
}

function loadBoard(recenter) {
  watchState = null;
  watchSegment = null;
  watchResult = null;
  nextWatchAt = 0;
  map = world(level.tiles, level.chainPush, level.portals, level.finish, level);
  area = bounds(level.tiles, map.finish, map.initial.devices);
  manual = map.initial;
  undo = [];
  manualPath = [];
  recording = false;
  pendingPortal = null;
  portalMessage = '';
  mode = 'edit';
  $('chain-push').checked = level.chainPush;
  if (recenter) centerMap();
  routeInput?.reset();
  renderMap();
  renderTraining();
}

function stopActivity() {
  pauseTraining();
  pauseReplay();
  replay = null;
}

function selectLevel(index) {
  if (!library.entries[index] || index === library.index) return;
  stopActivity();
  if (trainer || trainingProblem) sessions.set(level, { trainer, trainingProblem, attempt, batch });
  return activateLevel(index);
}

function activateLevel(index) {
  library.index = index;
  level = library.entries[index];
  const session = sessions.get(level);
  trainer = session?.trainer ?? null;
  trainingProblem = session?.trainingProblem ?? '';
  attempt = session?.attempt ?? null;
  batch = session?.batch ?? null;
  if (!batchComplete()) $('budget').value = batch.option;
  const saved = saveLevels();
  renderLevelPicker();
  loadBoard(true);
  return saved;
}

function blankLevel(name) {
  return { name, tiles: new Map(), chainPush: false };
}

function deleteLevel() {
  stopActivity();
  sessions.delete(level);
  library.entries.splice(library.index, 1);
  if (!library.entries.length) library.entries.push(blankLevel('自制关卡 1'));
  activateLevel(Math.min(library.index, library.entries.length - 1));
}

function addLevels(entries) {
  const first = library.entries.length;
  library.entries.push(...entries);
  return selectLevel(first);
}

function importPortalMap() {
  const url = new URL(location.href);
  if (url.searchParams.get('import') !== 'box-portals') return;
  const handoffKey = 'sokoban-lab-portal-import-v1';
  try {
    const entry = JSON.parse(sessionStorage.getItem(handoffKey));
    if (typeof entry?.code !== 'string' || !entry.name?.trim()) throw Error('没有找到待导入的套箱地图。');
    const saved = addLevels([{ name: entry.name.trim().slice(0, 40), ...readLevel(entry.code) }]);
    sessionStorage.removeItem(handoffKey);
    setMapNote(saved ? '已将套箱地图保存为新关卡，可以编辑传送门或试玩。' :
      '已打开转换后的地图。浏览器保存失败，可以用「导入 / 导出」下载地图。', saved ? 'success' : 'error');
  } catch (error) {
    setMapNote(error.message, 'error');
  }
  url.searchParams.delete('import');
  history.replaceState(history.state, '', url);
}

function editMap(changes, recenter = false) {
  let history = editHistories.get(level);
  if (!history) {
    history = [];
    editHistories.set(level, history);
  }
  let snapshot = history.at(-1);
  if (!gesture?.edit || snapshot !== gesture.edit) {
    snapshot = { demonstration: level.demonstration ?? [] };
    history.push(snapshot);
    if (history.length > 100) history.shift();
    if (gesture && !gesture.pan) gesture.edit = snapshot;
  }
  // A single brush stroke can change different fields as it crosses the map.
  for (const field of Object.keys(changes)) {
    if (!Object.hasOwn(snapshot, field)) snapshot[field] = level[field];
  }
  changeMap(changes, recenter);
}

function undoEdit() {
  if (mode !== 'edit') return;
  if (pendingPortal) {
    cancelPortalSelection();
    return;
  }
  const snapshot = editHistories.get(level)?.pop();
  if (!snapshot) return;
  changeMap(snapshot, false);
}

function changeMap(changes, recenter) {
  stopActivity();
  sessions.delete(level);
  trainer = null;
  trainingProblem = '';
  attempt = null;
  batch = null;
  Object.assign(level, { demonstration: [] }, changes);
  saveLevels();
  loadBoard(recenter);
}

$('current-level').addEventListener('change', event => selectLevel(Number(event.target.value)));
$('prev-level').addEventListener('click', () => selectLevel(library.index - 1));
$('next-level').addEventListener('click', () => selectLevel(library.index + 1));
$('chain-push').addEventListener('change', event => editMap({ chainPush: event.target.checked }));
$('gameplay').addEventListener('change', event => editMap({ gameplay: event.target.value }, true));
$('undo-edit').addEventListener('click', undoEdit);

function paint(coordinate) {
  const old = map.tiles.get(coordinate) ?? ' ';
  if (brush === 'pusher' || brush === 'power') {
    if ('$*'.includes(old)) {
      setMapNote('请把装置放在空格或目标格上。', 'error');
      return;
    }
    const direction = Number($('device-direction').value);
    const previous = level.devices?.get(coordinate);
    if (previous?.kind === brush && previous.direction === direction) return;
    const devices = new Map(level.devices);
    devices.set(coordinate, { kind: brush, direction });
    editMap({ devices });
    return;
  }
  if (brush === ' ' && map.initial.devices?.has(coordinate)) {
    const devices = new Map(level.devices);
    devices.delete(coordinate);
    editMap({ devices });
    return;
  }
  if (brush === 'finish') {
    if (old === '#') {
      $('map-note').textContent = '请在可行走的格子上设置玩家终点。';
      $('map-note').classList.add('error');
      return;
    }
    if ((level.playerMode ?? 'single') !== 'single' || map.players.length > 1) {
      const finishes = map.finishes.includes(coordinate) ? map.finishes.filter(cell => cell !== coordinate) : [...map.finishes, coordinate];
      editMap({ finishes, finish: finishes[0] ?? null });
    } else editMap({ finish: map.finish === coordinate ? null : coordinate, finishes: undefined });
    return;
  }
  if (brush === ' ' && map.finishes.includes(coordinate)) {
    const finishes = map.finishes.filter(cell => cell !== coordinate);
    editMap({ finishes, finish: finishes[0] ?? null });
    return;
  }
  const wasGoal = '.*+'.includes(old);
  const wasPlayer = '@+'.includes(old);
  let tile = brush;
  if (brush === '.') tile = '$*'.includes(old) ? '*' : wasPlayer ? '+' : '.';
  if (brush === '$') tile = wasGoal ? '*' : '$';
  if (brush === '@') tile = wasGoal ? '+' : '@';
  if (brush === ' ') tile = old === '*' || old === '+' ? '.' : ' ';
  if (tile === old) return;

  const tiles = new Map(map.tiles);
  let portals = level.portals ?? [];
  const migratedFaces = new Set();
  let movedPlayer;
  if (brush === '@' && map.initial.player !== -1 && (level.playerMode ?? 'single') === 'single') {
    const previous = map.initial.player;
    movedPlayer = previous;
    if (tiles.get(previous) === '+') tiles.set(previous, '.');
    else tiles.delete(previous);
    const overwritten = new Set(portals.flatMap((end, index) => end.cell === coordinate ? [Math.floor(index / 2)] : []));
    portals = portals.filter((_, index) => !overwritten.has(Math.floor(index / 2))).map(end => {
      if (end.cell !== previous) return end;
      const moved = { ...end, cell: coordinate }; migratedFaces.add(moved); return moved;
    });
  }
  if (tile === ' ') tiles.delete(coordinate);
  else tiles.set(coordinate, tile);
  const sameHost = portalHost(tile) && portalHost(old) && (tile === '#') === (old === '#');
  const removed = new Set();
  if (!sameHost) portals.forEach((end, i) => { if (end.cell === coordinate && !migratedFaces.has(end)) removed.add(Math.floor(i / 2)); });
  const finish = tile === '#' && level.finish === coordinate ? null : level.finish ?? null;
  const changes = { tiles, portals: portals.filter((_, i) => !removed.has(Math.floor(i / 2))), finish };
  if (level.players || (level.playerMode ?? 'single') !== 'single') {
    const players = [...tiles].filter(([, tile]) => '@+'.includes(tile)).map(([cell]) => cell);
    const order = (level.players ?? map.players).map(cell => cell === movedPlayer ? coordinate : cell).filter(cell => players.includes(cell));
    changes.players = [...order, ...players.filter(cell => !order.includes(cell))];
  }
  if (level.finishes) {
    changes.finishes = level.finishes.filter(cell => cell !== coordinate || tile !== '#');
    changes.finish = changes.finishes[0] ?? null;
  }
  if ('$*'.includes(tile) && level.devices?.has(coordinate)) {
    changes.devices = new Map(level.devices);
    changes.devices.delete(coordinate);
  }
  editMap(changes);
}

function cellAt(element) {
  const cell = element?.closest('.cell');
  return cell && board.contains(cell) ? cell.dataset.cell : null;
}

function rotatableDeviceAt(coordinate) {
  if (brush !== ' ') return map.initial.devices?.get(coordinate);
}

function choosePortalFace(coordinate, side) {
  if (!portalHost(map.tiles.get(coordinate))) {
    portalMessage = '请选择墙、箱子或玩家的边。';
    renderMap();
    return;
  }
  const portals = level.portals ?? [];
  const connections = portals.filter(end => end.cell === coordinate && end.side === side);
  const hasEntrance = connections.some(end => !end.exitOnly);
  const oneWay = oneWayPortal.value === 'one-way';
  if (!pendingPortal && connections.length) {
    managePortalFace(coordinate, side, portals, hasEntrance);
    return;
  }
  if (!pendingPortal) {
    pendingPortal = { cell: coordinate, side };
    portalMessage = '';
  } else if (pendingPortal.cell === coordinate && pendingPortal.side === side) {
    portalMessage = '两端须选在不同的边上。';
  } else if (!oneWay && hasEntrance) {
    portalMessage = '这条边已有去向，请选择另一条边。';
  } else {
    const exit = oneWay ? { cell: coordinate, side, exitOnly: true } : { cell: coordinate, side };
    editMap({ portals: [...portals, pendingPortal, exit] });
    portalMessage = (oneWay ? '单向' : '双向') + '传送门 ' + (portals.length / 2 + 1) + ' 已建立，可按 Z 撤销。';
  }
  renderMap();
}

function managePortalFace(coordinate, side, portals, hasEntrance) {
  openDialog('管理传送连接', '<div class="level-list"></div>');
  const list = $('dialog-body').firstElementChild;
  if (!hasEntrance) {
    list.append(actionButton('从这条边新建连接', '', () => {
      pendingPortal = { cell: coordinate, side };
      portalMessage = '';
      dialog.close();
      renderMap();
    }));
  }
  for (let i = 0; i < portals.length; i += 2) {
    const [from, to] = portals.slice(i, i + 2);
    const atFace = end => end.cell === coordinate && end.side === side;
    if (!atFace(from) && !atFace(to)) continue;
    const number = i / 2 + 1;
    const kind = to.exitOnly ? (atFace(from) ? '单向入口' : '单向出口') : '双向门';
    list.append(actionButton('移除' + kind + ' ' + number, '', () => {
      editMap({ portals: portals.filter((_, index) => index !== i && index !== i + 1) });
      dialog.close();
    }));
  }
}

function portalClick(event, coordinate) {
  if (!portalHost(map.tiles.get(coordinate))) {
    choosePortalFace(coordinate, 0);
    return;
  }
  if (event.detail) {
    const rect = event.target.closest('.cell').getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const edges = [y, 1 - x, 1 - y, x];
    const side = edges.indexOf(Math.min(...edges));
    if (edges[side] <= 0.34) {
      choosePortalFace(coordinate, side);
      return;
    }
  }
  openDialog('选择传送门所在的边', '<div class="level-list"></div>');
  sideNames.forEach((name, side) => {
    $('dialog-body').firstElementChild.append(actionButton(name, '', () => {
      dialog.close();
      choosePortalFace(coordinate, side);
    }));
  });
}

function pointerPaint(coordinate) {
  if (!coordinate || coordinate === gesture.lastCell) return;
  const previous = gesture.lastCell;
  gesture.lastCell = coordinate;
  if (previous && brush !== '@') {
    const [fromX, fromY] = point(previous);
    const [x, y] = point(coordinate);
    const dx = x - fromX;
    const dy = y - fromY;
    const length = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 1; i < length; i++) {
      paint(key(fromX + Math.round(dx * i / length), fromY + Math.round(dy * i / length)));
    }
  }
  paint(coordinate);
}

board.addEventListener('contextmenu', event => event.preventDefault());
board.addEventListener('pointerdown', event => {
  const pan = event.button === 2;
  const coordinate = cellAt(event.target);
  if (gesture || (!pan && (mode !== 'edit' || event.button !== 0 || !coordinate))) return;
  if (!pan && (brush === 'portal' || brush === 'finish' || rotatableDeviceAt(coordinate))) return;
  event.preventDefault();
  gesture = { id: event.pointerId, pan, x: event.clientX, y: event.clientY, camera, lastCell: null };
  board.setPointerCapture(event.pointerId);
  if (pan) board.classList.add('panning');
  else pointerPaint(coordinate);
});
board.addEventListener('pointermove', event => {
  if (gesture?.id !== event.pointerId) return;
  if (gesture.pan) {
    const size = cellSize();
    camera = {
      x: gesture.camera.x - (event.clientX - gesture.x) / size,
      y: gesture.camera.y - (event.clientY - gesture.y) / size,
    };
    renderBoard(activeState());
  } else if (mode === 'edit') pointerPaint(cellAt(document.elementFromPoint(event.clientX, event.clientY)));
});
board.addEventListener('lostpointercapture', () => {
  gesture = null;
  board.classList.remove('panning');
});
board.addEventListener('click', event => {
  const coordinate = cellAt(event.target);
  if (mode === 'play' && coordinate && manual.devices && !dialog.open && !document.hidden && !won(map, manual)) {
    const result = activateDevice(map, manual, coordinate);
    if (result.state !== manual) commitManualAction(result.state, coordinate);
    else if (result.message) setMapNote(result.message, 'error');
    return;
  }
  if (mode !== 'edit' || !coordinate) return;
  const device = rotatableDeviceAt(coordinate);
  if (device) {
    const devices = new Map(level.devices);
    const direction = (device.direction + (event.ctrlKey ? 3 : 1)) % 4;
    devices.set(coordinate, { ...device, direction });
    editMap({ devices });
  } else if (brush === 'portal') portalClick(event, coordinate);
  else if (brush === 'finish' || event.detail === 0) paint(coordinate);
});

function activeState() {
  if (mode === 'watch') return watchState ?? map.initial;
  if (mode === 'replay') return replay.states[replay.index];
  return mode === 'play' ? manual : map.initial;
}

new ResizeObserver(() => {
  viewWidth = board.clientWidth;
  viewHeight = board.clientHeight;
  renderBoard(activeState());
}).observe(board);
$('center-map').addEventListener('click', () => {
  centerMap();
  if (mode === 'play') followManual(activeState());
  else if (mode === 'watch' || mode === 'replay') followAi(activeState());
  renderBoard(activeState());
});
aiFollow.addEventListener('change', () => {
  try {
    localStorage.setItem(followAiKey, aiFollow.checked ? 'on' : 'off');
  } catch { /* Camera movement is independent of storage. */ }
  const state = activeState();
  followAi(state);
  renderBoard(state);
});
clickFollow.addEventListener('change', () => {
  try {
    localStorage.setItem(followClickKey, clickFollow.checked ? 'on' : 'off');
  } catch { /* Clicking still works without storage. */ }
});
portalArrowToggle.addEventListener('change', () => {
  try {
    localStorage.setItem(portalArrowsKey, portalArrowToggle.checked ? 'on' : 'off');
  } catch { /* Arrows can still be toggled in this session. */ }
  renderPortalArrows(activeState());
});

brushButtons.forEach(button => {
  button.addEventListener('click', () => {
    brush = button.dataset.brush;
    pendingPortal = null;
    portalMessage = '';
    renderMap();
  });
});
function cancelPortalSelection() {
  pendingPortal = null;
  portalMessage = '';
  renderMap();
}
$('portal-cancel').addEventListener('click', cancelPortalSelection);
oneWayPortal.addEventListener('change', cancelPortalSelection);
$('player-mode').addEventListener('change', event => editMap({ playerMode: event.target.value }));
$('active-player').addEventListener('change', event => {
  const activePlayer = Number(event.target.value);
  if (!manual.players?.[activePlayer]) return;
  const input = 'P' + (activePlayer + 1);
  const next = step(map, manual, input);
  if (next !== manual) commitManualAction(next, input);
});
$('edit-mode').addEventListener('click', () => setMode('edit'));
$('play-mode').addEventListener('click', () => setMode('play'));
$('watch-mode').addEventListener('click', () => setMode('watch'));
$('watch-speed').addEventListener('change', () => { nextWatchAt = 0; });

function move(direction) {
  if (mode !== 'play' || dialog.open || document.hidden || won(map, manual)) return;
  const next = step(map, manual, direction);
  if (next === manual) return;
  commitManualAction(next, direction);
}

function commitManualAction(next, input) {
  const previous = manual;
  undo.push(previous);
  manualPath.push(input);
  manual = next;
  followManual(manual);
  renderManual(previous);
}

document.querySelectorAll('[data-dir]').forEach(button => button.addEventListener('click', () => move(Number(button.dataset.dir))));
const movementKeys = { arrowup: 0, w: 0, arrowright: 1, d: 1, arrowdown: 2, s: 2, arrowleft: 3, a: 3 };
const keyIdentity = event => event.code || event.key.toLowerCase();
document.addEventListener('keydown', event => {
  if (dialog.open || event.isComposing || event.altKey || event.ctrlKey || event.metaKey ||
      event.target.closest('input, textarea, select')) return;
  const pressed = event.key.toLowerCase();
  if (mode !== 'play' && (mode !== 'edit' || pressed !== 'z')) return;
  if (event.key === 'Enter' && event.repeat && event.target.closest('[data-dir], .cell')) {
    event.preventDefault();
    return;
  }
  const direction = movementKeys[pressed];
  if (pressed !== 'z' && (manual.player === -1 || typeof direction !== 'number')) return;
  event.preventDefault();
  const key = keyIdentity(event);
  if (event.repeat || heldDirections.has(key)) return;
  heldDirections.add(key);
  if (mode === 'edit') undoEdit();
  else if (pressed === 'z') undoMove();
  else move(direction);
});
document.addEventListener('keyup', event => heldDirections.delete(keyIdentity(event)));
window.addEventListener('blur', () => heldDirections.clear());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) heldDirections.clear();
});
function undoMove() {
  if (mode !== 'play' || !undo.length) return;
  const previous = manual;
  manual = undo.pop();
  manualPath.pop();
  followManual(manual);
  renderManual(previous);
}
$('undo').addEventListener('click', undoMove);
function resetPlay() {
  routeInput?.pause();
  manual = map.initial;
  undo = [];
  manualPath = [];
  followManual(manual);
  renderMap();
}

$('reset-play').addEventListener('click', resetPlay);

routeInput = RouteInput.mount($('route-input'), {
  devices: () => Boolean(manual.devices),
  state: () => manual,
  available: () => mode === 'play' && !dialog.open,
  won: () => won(map, manual),
  prepare() {
    const problem = validate(map);
    if (problem) return problem;
    setMode('play');
  },
  execute(input) {
    if (manual.devices) {
      const result = activateDevice(map, manual, input);
      if (result.state !== manual) commitManualAction(result.state, input);
      return result.message || '该坐标没有可激活的电源或拉推头。';
    }
    const next = step(map, manual, input);
    if (next !== manual) commitManualAction(next, input);
  },
});

function getTrainer() {
  if (trainer) return trainer;
  if (map.initial.devices) return new Trainer(map);
  const field = trainingMap(map.tiles, area, level.chainPush, level.portals, map.finish, level);
  if (field) return new Trainer(field);
  trainingProblem = '摆放范围超过 40,000 格训练区。请缩小关卡范围后再试。';
  return null;
}

function resetAttempt() {
  attempt = null;
  watchState = null;
  watchSegment = null;
  watchResult = null;
}

function updateDemonstration(path) {
  const model = getTrainer();
  if (!model || !model.setDemonstration(path)) return false;
  if (trainer) resetAttempt();
  level.demonstration = path.slice();
  recording = false;
  saveLevels();
  renderMap();
  renderTraining();
  return true;
}

$('record-demo').addEventListener('click', () => {
  pauseTraining();
  resetPlay();
  recording = true;
  setMode('play');
  const view = board.getBoundingClientRect();
  if (view.top < 0 || view.top >= window.innerHeight) board.scrollIntoView({ block: 'center' });
});
$('cancel-demo').addEventListener('click', () => {
  recording = false;
  renderMap();
  renderTraining();
});
$('save-demo').addEventListener('click', () => {
  if (!recording || !manualPath.length) return;
  if (!updateDemonstration(manualPath)) {
    $('map-note').textContent = trainingProblem || (manual.devices ? '示范动作不适用于当前地图。' :
      '示范走出了 AI 的训练区。请撤销超出地图外围三格的步数。');
    $('map-note').classList.add('error');
  }
});
$('delete-demo').addEventListener('click', () => {
  pauseTraining();
  updateDemonstration([]);
});

function drawChart() {
  const canvas = $('chart');
  const scale = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (!context) return;
  context.scale(scale, scale);
  const history = trainer?.history ?? [];
  const start = history[0]?.episode > 1 ? history[0].episode : 0;
  const end = trainer?.episodes ?? 0;
  $('chart-empty').hidden = history.length > 0;
  $('chart-start').textContent = number.format(start);
  $('chart-end').textContent = end ? number.format(end) + ' 回合' : '回合';
  canvas.setAttribute('aria-label', history.length ? '训练至第 ' + end + ' 回合，近期独立胜率 ' + Math.round(trainer.rate * 100) + '%' : '独立训练胜率曲线');
  if (!history.length) return;

  const points = history.map(point => [
    2 + (width - 4) * (point.episode - start) / Math.max(1, end - start),
    2 + (height - 4) * (1 - point.rate),
  ]);
  context.beginPath();
  points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
  context.lineTo(points.at(-1)[0], height);
  context.lineTo(points[0][0], height);
  context.closePath();
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#b8f27b42');
  gradient.addColorStop(1, '#b8f27b03');
  context.fillStyle = gradient;
  context.fill();
  context.beginPath();
  points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
  context.strokeStyle = '#b8f27b';
  context.lineWidth = 2;
  context.lineJoin = 'round';
  context.stroke();
  context.beginPath();
  context.arc(...points.at(-1), 2.5, 0, Math.PI * 2);
  context.fillStyle = '#b8f27b';
  context.fill();
}

function batchComplete() {
  if (!batch) return true;
  return batch.option === recordBudget ? trainer.best !== batch.previousBest : trainer.episodes >= batch.target;
}

function renderTraining() {
  const episodes = trainer?.episodes ?? 0;
  const best = trainer?.best;
  const problem = validate(map) || trainingProblem;
  const paused = !running && !batchComplete();
  const waitingForRecord = batch?.option === recordBudget;
  const status = running ? '训练中' : paused ? '已暂停' : episodes ? '批次完成' : '待训练';
  const pill = $('train-status');
  if (pill.lastElementChild.textContent !== status) pill.lastElementChild.textContent = status;
  pill.classList.toggle('active', running || Boolean(best));
  $('episodes').textContent = number.format(episodes);
  $('rate').textContent = trainer?.recent.length ? Math.round(trainer.rate * 100) + '%' : '—';
  $('best').textContent = best ? number.format(best.pushes) : '—';
  $('train').disabled = Boolean(problem) || playback !== 0 || recording;
  const action = running ? '暂停训练' : paused ? '继续训练' : episodes ? '再训练一批' : '开始训练';
  $('train').lastElementChild.textContent = action;
  $('watch-run').textContent = action;
  $('watch-run').disabled = $('train').disabled;
  $('train').firstElementChild.textContent = running ? 'Ⅱ' : '▶';
  $('budget').disabled = running || (paused && !waitingForRecord);
  $('unlimited-training-option').hidden = !map.initial.devices;
  $('unlimited-training').checked = map.unlimitedTraining;
  $('unlimited-training').disabled = running;
  $('clear-training').disabled = !trainer || playback !== 0 || recording;
  $('replay').disabled = !best || running || playback !== 0 || recording;
  $('replay-single').disabled = $('replay').disabled;
  renderPartialRoutes(best);
  const demoLength = level.demonstration?.length ?? 0;
  let demoNote = '可以演示开局或完整通关路线。';
  if (demoLength) {
    demoNote = trainer && !trainer.demonstration ? '已保存的示范与当前地图或规则不匹配，请重录。' :
      '已保存 ' + demoLength + ' 步' + (trainer?.demonstration?.complete ? ' · 通关示范' : '');
  }
  $('demo-summary').textContent = demoNote;
  $('record-demo').textContent = demoLength ? '重录示范' : '示范几步';
  $('record-demo').disabled = Boolean(problem) || recording || playback !== 0;
  $('delete-demo').hidden = !demoLength;
  $('delete-demo').disabled = recording || playback !== 0;

  let note = '训练当前关卡，找到通关路线后即可回放。';
  if (problem) note = problem;
  else if ((running || paused) && waitingForRecord) note = batch.previousBest ?
    '本批会在最佳路线更新后停止。' : '本批会在首次通关后停止。';
  else if (running || paused) note = '本批目标为第 ' + number.format(batch.target) + ' 回合，切换关卡时会暂停。';
  else if (waitingForRecord && best) note = '最佳路线已更新 · ' +
    stateProgress({ devices: map.initial.devices, pushes: best.pushes, moves: best.path.length });
  else if (best) note = '已通关 ' + number.format(trainer.successes) + ' 局 · 最佳路线移动 ' + best.path.length + ' 步';
  else if (episodes) note = '尚未通关，可以查看目前覆盖最多的路线。';
  $('training-note').textContent = note;
  drawChart();
}

function renderPartialRoutes(best) {
  const partial = best ? null : trainer?.partial;
  const routes = partial?.routes ?? null;
  const count = routes?.size ?? 0;
  $('partial-controls').hidden = !count;
  if (!count) {
    listedRoutes = null;
    listedCount = 0;
    $('partial-route').replaceChildren();
    return;
  }
  if (routes !== listedRoutes || count !== listedCount) {
    const select = $('partial-route');
    if (routes !== listedRoutes) select.replaceChildren();
    const options = [];
    for (let i = select.length; i < count; i++) options.push(new Option('路线 ' + number.format(i + 1), i));
    select.append(...options);
    listedRoutes = routes;
    listedCount = count;
  }
  const summary = '覆盖 ' + partial.covered + ' / ' + map.goals.size + ' 个目标 · ' +
    number.format(partial.moves) + ' 步 · ' + number.format(count) + ' 条并列路线';
  if ($('partial-summary').textContent !== summary) $('partial-summary').textContent = summary;
  $('play-partial').disabled = running || playback !== 0 || recording;
  $('play-sequence').disabled = $('play-partial').disabled || count < 2;
}

function toWorldState(state) {
  const coordinate = trainer.map.worldCell;
  if (!coordinate) return state;
  return { ...state, player: coordinate(state.player), boxes: state.boxes.map(coordinate), portalCells: state.portalCells.map(coordinate), ...(state.players ? { players: state.players.map(coordinate) } : {}) };
}

function syncWatchState() {
  watchState = toWorldState(trainer.state);
  watchResult = attempt ? null : won(trainer.map, trainer.state);
}

function trainFast() {
  watchSegment = null;
  const deadline = performance.now() + 9;
  do {
    attempt ??= trainer.attempt();
    if (attempt.next().done) attempt = null;
  } while (!batchComplete() && performance.now() < deadline);
  watchState = null;
  if (mode === 'watch') syncWatchState();
}

function trainVisible(now, delay) {
  if (now < nextWatchAt) return false;
  nextWatchAt = now + delay;
  if (watchSegment) {
    watchState = step(map, watchState, watchSegment.directions[watchSegment.index++]);
    if (watchSegment.index === watchSegment.directions.length) watchSegment = null;
    return true;
  }
  if (!attempt) {
    attempt = trainer.attempt();
    watchState = map.initial;
    watchResult = null;
  }
  const event = attempt.next();
  if (event.done) {
    attempt = null;
    syncWatchState();
    nextWatchAt = now + Math.max(400, delay);
  } else {
    watchState = toWorldState(event.value.from);
    watchSegment = { directions: event.value.directions, index: 0, demonstration: event.value.demonstration };
  }
  return true;
}

function trainFrame(now) {
  if (!running) return;
  const delay = mode === 'watch' ? Number($('watch-speed').value) : 0;
  const advanced = delay ? trainVisible(now, delay) : (trainFast(), true);
  if (batchComplete()) running = false;
  if (advanced) {
    if (mode === 'watch') {
      followAi(watchState);
      renderMap();
    }
    renderTraining();
  }
  if (running) frame = requestAnimationFrame(trainFrame);
}

function toggleTraining() {
  if (running) pauseTraining();
  else {
    if (validate(map) || recording) return;
    if (mode === 'replay') setMode('edit');
    if (!trainer) {
      trainer = getTrainer();
      if (!trainer) {
        renderMap();
        renderTraining();
        return;
      }
      trainer.setDemonstration(level.demonstration ?? []);
    }
    const option = $('budget').value;
    if (batchComplete() || batch.option !== option) {
      batch = option === recordBudget ? { option, target: Infinity, previousBest: trainer.best } :
        { option, target: trainer.episodes + Number(option) };
    }
    running = true;
    setMode('watch');
    const view = board.getBoundingClientRect();
    if (view.top < 0 || view.top >= window.innerHeight) board.scrollIntoView({ block: 'center' });
    frame = requestAnimationFrame(trainFrame);
  }
  if (mode === 'watch') renderMap();
  renderTraining();
}

$('train').addEventListener('click', toggleTraining);
$('watch-run').addEventListener('click', toggleTraining);
$('unlimited-training').addEventListener('change', event => {
  if (running || !map.initial.devices) return;
  level.unlimitedTraining = map.unlimitedTraining = event.target.checked;
  if (trainer) {
    trainer.map.unlimitedTraining = map.unlimitedTraining;
    if (attempt) {
      trainer.state = trainer.map.initial;
      resetAttempt();
    }
  }
  saveLevels();
  renderMap();
  renderTraining();
});
$('clear-training').addEventListener('click', () => {
  pauseTraining();
  sessions.delete(level);
  trainer = null;
  batch = null;
  resetAttempt();
  if (mode === 'replay') setMode('edit');
  else {
    renderMap();
    renderTraining();
  }
});
$('replay').addEventListener('click', () => {
  if (trainer?.best) replayRoutes([trainer.best]);
});
$('replay-single').addEventListener('click', () => {
  if (trainer?.best) replayRoutes([trainer.best], 0, false);
});
$('play-partial').addEventListener('click', () => {
  const route = Array.from(trainer?.partial.routes.values() ?? [])[$('partial-route').selectedIndex];
  if (route) replayRoutes([route], $('partial-route').selectedIndex + 1);
});
$('play-sequence').addEventListener('click', () => {
  if (trainer?.partial.routes.size) replayRoutes([...trainer.partial.routes.values()], 1);
});
$('replay-toggle').addEventListener('click', () => {
  if (playback) pauseReplay();
  else scheduleReplay();
  renderMap();
  renderTraining();
});
$('replay-prev').addEventListener('click', () => stepReplay(-1));
$('replay-next').addEventListener('click', () => stepReplay(1));

function pauseReplay() {
  clearTimeout(playback);
  playback = 0;
}

function replayRoutes(routes, firstNumber = 0, autoplay = true) {
  if (running || playback || recording) return;
  pendingPortal = null;
  portalMessage = '';
  mode = 'replay';
  replay = { routes, firstNumber, routeIndex: 0, index: 0, states: [map.initial] };
  showReplayStep(0);
  if (autoplay) scheduleReplay();
  renderMap();
  renderTraining();
  const view = board.getBoundingClientRect();
  if (view.top < 0 || view.top >= window.innerHeight) board.scrollIntoView({ block: 'center' });
}

function replayPath() {
  return replay.routes[replay.routeIndex].path;
}

function renderReplayControls(state, solved) {
  const { index, firstNumber, routeIndex, routes } = replay;
  const length = replayPath().length;
  const atEnd = index === length;
  $('replay-prev').disabled = index === 0;
  $('replay-next').disabled = atEnd;
  $('replay-toggle').disabled = atEnd && routeIndex === routes.length - 1;
  const toggleLabel = playback ? '暂停' : '自动播放';
  if ($('replay-toggle').textContent !== toggleLabel) $('replay-toggle').textContent = toggleLabel;
  const title = firstNumber ? '路线 ' + number.format(firstNumber + routeIndex) : 'AI 回放';
  let progress = title + ' · ' + index + ' / ' + length + ' 步';
  if (atEnd) progress += solved ? ' · 通关' + (state.devices ? '' : ' · 推箱 ' + state.pushes + ' 次') :
    ' · 覆盖 ' + placed(map, state) + ' / ' + map.goals.size + ' 个目标';
  if ($('replay-progress').textContent !== progress) $('replay-progress').textContent = progress;
}

function showReplayStep(index) {
  const { states } = replay;
  if (index === states.length) states.push(step(map, states[index - 1], replayPath()[index - 1]));
  replay.index = index;
  followAi(states[index]);
}

function stepReplay(delta) {
  const index = replay.index + delta;
  if (index < 0 || index > replayPath().length) return;
  const wasPlaying = Boolean(playback);
  pauseReplay();
  showReplayStep(index);
  renderMap();
  if (wasPlaying) renderTraining();
}

function scheduleReplay() {
  const atEnd = replay.index === replayPath().length;
  if (atEnd && replay.routeIndex === replay.routes.length - 1) {
    playback = 0;
    renderTraining();
    return;
  }
  playback = setTimeout(() => {
    if (atEnd) {
      replay.routeIndex++;
      replay.states = [map.initial];
      showReplayStep(0);
    } else showReplayStep(replay.index + 1);
    scheduleReplay();
    renderMap();
  }, atEnd ? 650 : 115);
}
new ResizeObserver(drawChart).observe($('chart'));

function actionButton(label, kind, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = kind;
  button.textContent = label;
  button.addEventListener('click', handler);
  return button;
}

function openDialog(title, content, actions = []) {
  $('dialog-title').textContent = title;
  $('dialog-body').innerHTML = content;
  $('dialog-error').hidden = true;
  $('dialog-actions').replaceChildren(...actions);
  if (!dialog.open) dialog.showModal();
}

function dialogError(message) {
  $('dialog-error').textContent = message;
  $('dialog-error').hidden = false;
}

$('help').addEventListener('click', () => {
  openDialog('使用说明', '<p>地图从空白开始，按住鼠标右键拖动可向四周平移。选好工具后，用左键点击或拖动绘制。</p>' +
    '<p>放置玩家起点和箱子目标，箱子数可以多于目标数。选「玩家终点」放置一面旗，再点旗子可移除。有旗时，玩家也要走到旗子处才能通关。只放旗子也可以做走位关卡。</p>' +
    '<p>点「手动试玩」，用方向键、WASD 或屏幕方向按钮移动。键盘每按一次走一步，长按时只走第一步。按 Z 撤销上一步。勾选「允许连推多个箱子」后，一步可以推动相邻的一整排箱子。</p>' +
    '<p>选择「多玩家 · 同步控制」或「多玩家 · 切换控制」后，可放置多个玩家及玩家终点。同步模式按同一方向控制全部玩家；切换模式只控制「当前玩家」选中的玩家。所有玩家终点都有人占据才算通关。</p>' +
    '<p>用「传送门」依次点选墙、箱子或玩家的两条边。玩家移动时，身上的传送门一起移动。双向门两端都能进入。选「单向」后，先点入口，再点出口。一个入口只有一个去向，标着「出」的端点可以接收多条连接。点已有端点可管理连接。</p>' +
    '<p>出口和另一个入口正对紧贴时，会继续通过下一对门。开启连推时，整排箱子先一起前进，最前面的箱子碰墙后才触发门箱传送。依次尝试后箱、前箱和玩家，没门或传不通就试下一项。前箱传走的同一步，门箱和它后面被推动的箱子会向前补一格。关闭连推时，门箱沿门面推到前箱就先传走前箱。没有可执行的推箱动作时，玩家可以从碰到的门面进入，即使门箱背后紧贴的是普通箱子。若最终出口有箱子并且推得动，玩家会在同一步穿门走到让出的格子。</p>' +
    '<p>开始训练后，左侧地图会显示 AI 的每一步。可在「观战 AI」中调速度或暂停。进入手动试玩会暂停训练，回到训练区可继续。</p>' +
    '<p>「方块推推推」用拉推头把箱子移到目标。无电源时点拉推头。有电源时点箭头指向拉推头的电源。正前一格有方块就向前推，空一格则把第二格的方块拉近。开启连推可以推动前方连续的多个方块。</p>' +
    '<p>点「示范几步」录下开局或通关路线，再点「保存示范」。胜率只统计 AI 独立尝试。</p>' +
    '<p>AI 用 Q-learning 反复练习。训练区包含已绘制的地图和外围三格空地，最多 40,000 格。找到通关路线后即可回放。</p>' +
    '<p>用关卡列表逐关训练。切换时会暂停当前训练，切回即可继续。示范、地图和规则保存在浏览器。修改地图或规则会清空当前关的示范和训练进度。</p>',
  [actionButton('知道了', 'primary', () => dialog.close())]);
});

$('levels').addEventListener('click', () => {
  const entries = [
    { name: '单箱入门', tiles: fromRows(examples[1]), chainPush: false },
    { name: '双箱练习', tiles: fromRows(examples[0]), chainPush: false },
    { name: '三箱挑战', tiles: fromRows(examples[2]), chainPush: false },
    { name: '连推练习', tiles: fromRows(['#########', '#@$$..  #', '#########']), chainPush: true },
  ];
  openDialog('添加示例关卡', '<div class="level-list"></div>', [actionButton('按顺序添加全部', 'primary', () => {
    addLevels(entries);
    dialog.close();
  })]);
  entries.forEach(entry => {
    $('dialog-body').firstElementChild.append(actionButton(entry.name, '', () => {
      addLevels([entry]);
      dialog.close();
    }));
  });
});

$('new-map').addEventListener('click', () => {
  openDialog('新建关卡', '<label class="level-name">关卡名称 <input id="level-name" maxlength="40"></label>', [actionButton('创建空白关卡', 'primary', () => {
    const name = $('level-name').value.trim() || '自制关卡 ' + (library.entries.length + 1);
    addLevels([blankLevel(name)]);
    dialog.close();
  })]);
});

function confirmSaveChange(deleting) {
  const verb = deleting ? '删除' : '清空';
  openDialog(verb + '存档', '<p id="save-confirm"></p>', [
    actionButton('返回', 'outline plain', manageSave),
    actionButton('确认' + verb, 'primary danger', () => {
      if (deleting) deleteLevel();
      else editMap({ tiles: new Map(), portals: [], finish: null, finishes: [], players: [], devices: new Map() }, true);
      dialog.close();
    }),
  ]);
  $('save-confirm').textContent = deleting ? '删除「' + level.name + '」及其地图、示范和训练进度？' :
    '将「' + level.name + '」恢复成空白地图？名称和规则设置会保留，示范和训练进度会重置。';
}

function manageSave() {
  const saveName = actionButton('保存名称', 'primary', () => {
    const name = $('level-name').value.trim();
    if (!name) return dialogError('请输入关卡名称。');
    level.name = name;
    saveLevels();
    renderLevelPicker();
    dialog.close();
  });
  openDialog('管理存档', '<label class="level-name">关卡名称 <input id="level-name" maxlength="40"></label>' +
    '<div class="save-actions"></div>', [saveName]);
  const input = $('level-name');
  input.value = level.name;
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    saveName.click();
  });
  $('dialog-body').querySelector('.save-actions').append(
    actionButton('清空为白图', 'outline', () => confirmSaveChange(false)),
    actionButton('删除存档', 'outline', () => confirmSaveChange(true)),
  );
  input.focus();
}

$('manage-level').addEventListener('click', manageSave);

$('map-code').addEventListener('click', () => {
  openDialog('导入 / 导出地图', '<p>支持坐标 JSON 和旧版字符地图。</p><p id="symbols"># 墙 · 空格 地板 · . 目标 · $ 箱子 · @ 玩家 · * 目标上的箱子 · + 目标上的玩家</p>' +
    '<textarea id="map-text" aria-label="地图文本" aria-describedby="symbols" spellcheck="false" wrap="off"></textarea>',
  [
    actionButton('下载当前地图', 'outline plain', () => {
      const url = URL.createObjectURL(new Blob([levelCode(level) + '\n'], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sokoban-map.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }),
    actionButton('导入文本', 'primary', () => {
      try {
        const imported = readLevel($('map-text').value);
        editMap({ portals: [], finish: null, finishes: undefined, players: undefined, playerMode: 'single', gameplay: 'classic', devices: new Map(), unlimitedTraining: true, ...imported }, true);
        dialog.close();
      } catch (error) {
        dialogError(error.message);
      }
    }),
  ]);
  $('map-text').value = levelCode(level);
});

renderLevelPicker();
$('chain-push').checked = level.chainPush;
centerMap();
renderMap();
renderTraining();
importPortalMap();

