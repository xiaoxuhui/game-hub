'use strict';

const { compile, placed, step, won } = BoxRooms;
const opening = [
  {
    title: '箱子与玩家终点', hint: '先把箱子推到方框，再走到带两点的玩家终点。',
    rows: ['#######', '#     #', '#     #', '#    $#', '# @ # #', '#   #.#', '#######'],
    finish: [1, 1],
  },
  {
    title: '双箱连推', hint: '排成一列的箱子可以一起推。把它们分到两边，再走到中间的玩家终点。',
    rows: ['#######', '#   ###', '# #$  #', '# #$  #', '#     #', '#  @  #', '#.   .#', '#######'],
    finish: [3, 6],
  },
  {
    title: '绕到箱子后面', hint: '先把箱子推离右边的墙，再利用底部空间绕到另一侧。',
    rows: ['#########', '#    ####', '#  .$####', '#    ####', '# @  ####', '#       #', '#  ##   #', '#########'],
    finish: [2, 2],
  },
];
const chapters = [
  { id: 'intro', title: '入门', levels: [...opening, ...BoxCampaign.intro], color: '#cbcbce' },
  { id: 'enter', title: '进入', levels: BoxCampaign.enter, color: '#a4bedf' },
  { id: 'empty', title: '空白', levels: BoxCampaign.empty, color: '#b7a8a6' },
  { id: 'eat', title: '吞食', levels: BoxCampaign.eat, color: '#ffa778' },
  { id: 'reference', title: '参照', levels: BoxCampaign.reference, color: '#2d9eca' },
  { id: 'swap', title: '调换', levels: BoxCampaign.swap, color: '#3488f4' },
  { id: 'center', title: '居中', levels: BoxCampaign.center, color: '#85829f' },
  { id: 'clone', title: '克隆', levels: BoxCampaign.clone, color: '#8caad2' },
  { id: 'transfer', title: '转移', levels: BoxCampaign.transfer, color: '#5a8cdc' },
  { id: 'open', title: '开放', levels: BoxCampaign.open, color: '#6496e6' },
];
const levels = [];
for (const chapter of chapters) {
  chapter.start = levels.length;
  levels.push(...chapter.levels);
}

const $ = id => document.getElementById(id);
const board = $('intro-board');
const stage = $('intro-stage');
const textMaps = $('intro-text-maps');
const displayMode = $('intro-display-mode');
const returnButton = $('intro-return');
const parentButton = $('intro-view-parent');
const moveButtons = document.querySelectorAll('[data-move]');
const roomMaps = new WeakMap();
let previewContents;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const zoomCanvas = $('intro-recursive-view');
const zoomButton = $('intro-zoom');
const boxCanvas = $('intro-box-motion');
const hiddenBoxes = new Set();
const shellInset = 0.84;
const targetColor = '#f5e4bb';
const finishColor = '#fff2d9';
let levelButtons = [];
let chapterIndex = -1;
const storageKey = 'sokoban-lab-box-intro-v1';
const layoutRevision = 5;
const moveKeys = { arrowup: 0, w: 0, arrowright: 1, d: 1, arrowdown: 2, s: 2, arrowleft: 3, a: 3 };
let active = 0;
let complete = [];
let map;
let state;
let history = [];
let future = [];
let textView = false;
let inspectedRoom = null;
let roomMotion;
let recursiveZoom;
let routeInput;
let boxMotion;

try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (Number.isInteger(saved?.active) && levels[saved.active]) active = saved.active;
  if ([2, 3, 4, layoutRevision].includes(saved?.revision) && Array.isArray(saved.complete)) {
    complete = saved.complete.slice(0, levels.length);
  }
  if (saved?.revision === 2) {
    const reference = chapters.find(chapter => chapter.id === 'reference');
    const seventh = reference.start + 6;
    const tenth = reference.start + 9;
    if (active === seventh) active = tenth;
    else if (active === tenth) active = seventh;
    if (complete.length > seventh) {
      [complete[seventh], complete[tenth]] = [complete[tenth], complete[seventh]];
    }
  }
  if (saved?.revision === 2 || saved?.revision === 3) {
    const swap = chapters.find(chapter => chapter.id === 'swap');
    const third = swap.start + 2;
    const fourth = swap.start + 3;
    if (active === third) active = fourth;
    else if (active === fourth) active = third;
    if (complete.length > third) {
      [complete[third], complete[fourth]] = [complete[fourth], complete[third]];
    }
  }
} catch { /* Progress is optional when storage is unavailable. */ }

const query = new URLSearchParams(location.search);
const requestedChapter = chapters.find(chapter => chapter.id === query.get('chapter'));
const requestedLevel = Number(query.get('level'));
if (Number.isInteger(requestedLevel) && requestedChapter?.levels[requestedLevel - 1]) {
  active = requestedChapter.start + requestedLevel - 1;
}

function saveProgress() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ revision: layoutRevision, active, complete }));
  } catch { /* The current session can still be played. */ }
}

function parentRoom(roomId) {
  const owner = map.rooms[roomId].owner;
  return owner < 0 ? -1 : state.positions[owner][0];
}

function roomLabel(roomId) {
  const owner = map.rooms[roomId].owner;
  if (owner >= 0 && state.positions[owner][0] === roomId) return '自引用棋盘';
  const seen = new Set([roomId]);
  let depth = 0;
  for (let room = parentRoom(roomId); room >= 0; room = parentRoom(room)) {
    if (seen.has(room)) return '参照循环';
    seen.add(room);
    depth++;
  }
  return depth ? '箱内第 ' + depth + ' 层' : '外层';
}

function inspectRoom(roomId, crossing) {
  clearBoxMotion();
  inspectedRoom = roomId === state.positions[0][0] ? null : roomId;
  render(crossing ? [crossing] : []);
}

function inspectParent() {
  const roomId = inspectedRoom ?? state.positions[0][0];
  const parent = parentRoom(roomId);
  if (parent >= 0) inspectRoom(parent, { direction: 'out', owner: map.rooms[roomId].owner });
  else returnToPlayer();
}

function returnToPlayer() {
  if (inspectedRoom !== null) inspectRoom(state.positions[0][0]);
}

function cameraCrossing(crossings, previousRoom, roomId) {
  const first = crossings[0];
  const last = crossings.at(-1);
  if (first?.direction === 'out' && last.direction === 'in') {
    if (state.positions[first.owner][0] === roomId) return first;
    if (state.positions[last.owner][0] === previousRoom) return last;
    return { direction: 'across' };
  }
  if (first) return first.direction === 'out' ? last : first;
  if (board.children.length && previousRoom !== roomId) {
    if (parentRoom(roomId) === previousRoom) return { direction: 'in', owner: map.rooms[roomId].owner };
    if (parentRoom(previousRoom) === roomId) return { direction: 'out', owner: map.rooms[previousRoom].owner };
    return { direction: 'across' };
  }
  if (board.hidden && inspectedRoom !== null) return { direction: 'across' };
}

function render(crossings = []) {
  const [playerRoom, x, y] = state.positions[0];
  const inspecting = inspectedRoom !== null;
  const roomId = inspectedRoom ?? playerRoom;
  const showText = textView && !inspecting;
  const covered = placed(map, state);
  const solved = won(map, state, covered);
  renderScene(roomId, cameraCrossing(crossings, Number(board.dataset.room), roomId), showText);
  if (showText) renderTextMaps(playerRoom);
  updateRecursiveZoom(roomId);
  $('intro-room').hidden = map.rooms.length === 1 && map.rooms[0].owner < 0;
  $('intro-room').textContent = (inspecting ? '正在查看 · ' : '') + roomLabel(roomId);
  const canLookOut = parentRoom(roomId) >= 0;
  parentButton.hidden = !canLookOut;
  returnButton.hidden = !inspecting;
  for (const button of moveButtons) button.disabled = inspecting;
  stage.classList.toggle('can-look-out', canLookOut || inspecting);
  board.setAttribute('aria-label', inspecting ? '正在查看' + roomLabel(roomId) :
    '棋盘，玩家第 ' + (x + 1) + ' 列，第 ' + (y + 1) + ' 行');
  $('intro-count').textContent = state.moves + ' 步 · 推箱 ' + state.pushes + ' 次';
  $('intro-status').textContent = solved ? '通关！' : covered === map.goals.length ?
    '箱子都到位了，走到玩家终点即可通关。' : '箱子到位 ' + covered + ' / ' + map.goals.length;
  $('intro-status').classList.toggle('success', solved);
  $('intro-next').hidden = !solved || active === levels.length - 1;
  $('intro-next').textContent = active + 1 === chapters[chapterIndex + 1]?.start ? '进入下一章 →' : '下一关 →';
  $('intro-undo').disabled = inspecting || history.length === 0;
  $('intro-redo').disabled = inspecting || future.length === 0;
  $('intro-reset').disabled = inspecting || state === map.initial;
  for (const [number, button] of levelButtons.entries()) {
    const index = Number(button.dataset.level);
    button.setAttribute('aria-pressed', index === active);
    button.dataset.complete = Boolean(complete[index]);
    button.setAttribute('aria-label', '第 ' + (number + 1) + ' 关' + (complete[index] ? '，已通关' : ''));
  }
}

function addPiece(cell, name) {
  const piece = document.createElement('i');
  piece.className = name;
  cell.append(piece);
}

function roomColor(roomId) {
  return map.rooms[roomId].color ?? (roomId === 0 ? chapters[chapterIndex].color : '#79aedc');
}

function setTextView(enabled) {
  clearBoxMotion();
  clearRoomMotion();
  textView = enabled;
  displayMode.textContent = enabled ? '图形显示' : '字符显示';
}

function renderTextMaps(playerRoom) {
  if (!textMaps.children.length) {
    const columns = map.rooms.reduce((sum, room) => sum + room.width, 0);
    const rows = Math.max(...map.rooms.map(room => room.height));
    textMaps.style.setProperty('--text-columns', columns + (map.rooms.length - 1) * .6 + .5);
    textMaps.style.setProperty('--text-rows', rows * 1.55 + 2.1);
    for (const [roomId, room] of map.rooms.entries()) {
      const button = document.createElement('button');
      const label = document.createElement('span');
      const lines = document.createElement('span');
      button.type = 'button';
      button.className = 'intro-text-room';
      button.style.setProperty('--text-room-color', roomColor(roomId));
      lines.className = 'intro-text-lines';
      label.textContent = roomId + 1;
      label.setAttribute('aria-hidden', 'true');
      lines.setAttribute('aria-hidden', 'true');
      for (let index = 0; index < room.tiles.length; index++) {
        if (index > 0 && index % room.width === 0) lines.append('\n');
        lines.append(document.createElement('span'));
      }
      button.append(label, lines);
      button.addEventListener('click', () => {
        if (state.positions[0][0] !== roomId) inspectRoom(roomId);
      });
      textMaps.append(button);
    }
  }
  const glyphs = map.rooms.map(room => Array.from(room.tiles, tile => tile === '#' ? '#' : '.'));
  for (const [room, x, y] of map.goals) glyphs[room][y * map.rooms[room].width + x] = '_';
  const [finishRoom, finishX, finishY] = map.finish;
  glyphs[finishRoom][finishY * map.rooms[finishRoom].width + finishX] = '=';
  state.positions.forEach(([room, x, y], entity) => {
    const child = map.inside[entity];
    glyphs[room][y * map.rooms[room].width + x] = entity === 0 ? 'p' : child >= 0 ? String(child + 1) : 'b';
  });
  const cloneCells = new Set(state.positions.flatMap(([room, x, y], entity) =>
    map.clones[entity] ? [room + ':' + (y * map.rooms[room].width + x)] : []));
  for (const [roomId, button] of Array.from(textMaps.children).entries()) {
    const cells = button.querySelector('.intro-text-lines').children;
    glyphs[roomId].forEach((glyph, index) => {
      const cell = cells[index];
      cell.toggleAttribute('data-clone', cloneCells.has(roomId + ':' + index));
      if (cell.dataset.glyph !== glyph) {
        cell.textContent = glyph;
        cell.dataset.glyph = glyph;
      }
    });
    button.setAttribute('aria-label', (roomId === 0 ? '外层棋盘' : '套箱 ' + (roomId + 1)) +
      (roomId === playerRoom ? '，玩家所在位置' : '，点击查看'));
  }
}

function floorColor(roomId) {
  if (map.rooms[roomId].void) return '#090b10';
  return map.eat ? 'color-mix(in srgb, #241b2c 67%, ' + roomColor(roomId) + ')' : '#535257';
}

function drawTargetOutline(context, left, top, size, color = targetColor) {
  context.strokeStyle = color;
  context.lineWidth = size * .085;
  context.strokeRect(left + size * .10, top + size * .10, size * .80, size * .80);
}

function drawRoomEyes(context, left, top, size, color) {
  context.fillStyle = color;
  for (const x of [.29, .71]) {
    context.beginPath();
    context.arc(left + x * size, top + .5 * size, size * .063, 0, Math.PI * 2);
    context.fill();
  }
}

function drawFinish(context, left, top, size, playerOnFinish) {
  drawTargetOutline(context, left, top, size, finishColor);
  if (!playerOnFinish) drawRoomEyes(context, left, top, size, finishColor);
}

function drawRoomMap(canvas, roomId, size = 10, showFinish = true, nested = true, viewport = null) {
  const room = map.rooms[roomId];
  const hidden = [...hiddenBoxes].join(',');
  if (previewContents?.map !== map || previewContents.positions !== state.positions || previewContents.hidden !== hidden) {
    const pieces = map.rooms.map(() => []);
    state.positions.forEach(([id, x, y], entity) => {
      if (!hiddenBoxes.has(entity)) pieces[id].push([entity, x, y]);
    });
    previewContents = { map, positions: state.positions, hidden, pieces };
  }
  const cached = roomMaps.get(canvas);
  const view = viewport ? JSON.stringify(viewport) : '';
  if (cached?.contents === previewContents && cached.roomId === roomId && cached.size === size &&
      cached.showFinish === showFinish && cached.nested === nested && cached.view === view) return;
  roomMaps.set(canvas, { contents: previewContents, roomId, size, showFinish, nested, view });
  canvas.width = viewport?.width ?? Math.ceil(room.width * size);
  canvas.height = viewport?.height ?? Math.ceil(room.height * size);
  const context = canvas.getContext('2d');
  const emptyChapter = board.classList.contains('empty-chapter');
  const cloneChapter = board.classList.contains('clone-chapter');
  const playerColor = cloneChapter ? '#be2850' : board.classList.contains('reference-chapter') ? '#c53d3a' :
    map.eat ? '#d260bd' : emptyChapter ? '#db562f' : '#df328d';
  const crateColor = cloneChapter ? '#468cfa' : map.eat ? '#ffdc72' : emptyChapter ? '#add444' : board.classList.contains('blue-crates') ? '#38bce8' : '#ffb63a';

  function paint(id, left, top, cellSize, depth) {
    const room = map.rooms[id];
    if (left >= canvas.width || top >= canvas.height ||
        left + room.width * cellSize <= 0 || top + room.height * cellSize <= 0) return;
    const pieces = previewContents.pieces[id];
    context.fillStyle = floorColor(id);
    context.fillRect(left, top, room.width * cellSize, room.height * cellSize);
    context.fillStyle = roomColor(id);
    for (let i = 0; i < room.tiles.length; i++) {
      if (room.tiles[i] !== '#') continue;
      const x = i % room.width, y = Math.floor(i / room.width);
      const x0 = Math.round(left + x * cellSize), y0 = Math.round(top + y * cellSize);
      context.fillRect(x0, y0, Math.round(left + (x + 1) * cellSize) - x0,
        Math.round(top + (y + 1) * cellSize) - y0);
    }
    for (const [entity, x, y] of pieces) {
      const child = map.inside[entity];
      const px = left + x * cellSize, py = top + y * cellSize;
      const inset = Math.min(1, cellSize * .1);
      const side = cellSize - inset * 2;
      context.fillStyle = entity === 0 ? playerColor : child >= 0 ? roomColor(child) : crateColor;
      context.fillRect(px + inset, py + inset, side, side);
      // Repeat shared and self-referencing rooms only while their contents are visible.
      if (nested && child >= 0 && side >= 3 && depth < 12) {
        const inner = map.rooms[child];
        const scale = side / Math.max(inner.width, inner.height);
        paint(child, px + (cellSize - inner.width * scale) / 2,
          py + (cellSize - inner.height * scale) / 2, scale, depth + 1);
      }
      if (map.clones[entity]) {
        context.strokeStyle = '#e9f3ff';
        context.lineWidth = cellSize * .08;
        context.setLineDash([cellSize * .18, cellSize * .12]);
        context.strokeRect(px + inset, py + inset, side, side);
        context.setLineDash([]);
      }
      if (entity === 0) drawRoomEyes(context, px, py, cellSize, '#651914');
    }
    for (const [goalRoom, x, y] of map.goals) {
      if (goalRoom === id) drawTargetOutline(context, left + x * cellSize, top + y * cellSize, cellSize);
    }
    const [finishRoom, finishX, finishY] = map.finish;
    if (showFinish && finishRoom === id) {
      const playerOnFinish = pieces.some(([entity, x, y]) => entity === 0 && x === finishX && y === finishY);
      drawFinish(context, left + finishX * cellSize, top + finishY * cellSize, cellSize, playerOnFinish);
    }
  }
  if (viewport?.layers) {
    for (const layer of viewport.layers) paint(layer.roomId, layer.left, layer.top, layer.size, 0);
  } else paint(roomId, viewport?.left ?? 0, viewport?.top ?? 0, size, 0);
}

function renderSurround(scene, roomId) {
  const outside = scene.querySelector('.intro-surround');
  const parent = state.positions[map.rooms[roomId].owner];
  scene.style.setProperty('--surround-color', roomColor(parent?.[0] ?? roomId));
  scene.classList.toggle('with-surround', Boolean(parent));
  outside.hidden = !parent;
  if (!parent) return;

  const ratio = devicePixelRatio || 1;
  const width = Math.round(scene.clientWidth * ratio), height = Math.round(scene.clientHeight * ratio);
  let frame = {
    left: width / 2 - board.clientWidth * ratio / 2,
    top: height / 2 - board.clientHeight * ratio / 2,
    width: board.clientWidth * ratio, height: board.clientHeight * ratio,
  };
  let current = roomId;
  const seen = new Set([current]);
  const layers = [];
  while (true) {
    const host = state.positions[map.rooms[current].owner];
    if (!host) break;
    const outer = map.rooms[host[0]];
    const size = Math.max(frame.width, frame.height);
    if (!Number.isFinite(size) || size > Number.MAX_SAFE_INTEGER / Math.max(outer.width, outer.height)) break;
    frame = parentFrame(frame, host, 1);
    layers.push({ roomId: host[0], size, left: frame.left, top: frame.top });
    current = host[0];
    if (seen.has(current)) break;
    seen.add(current);
  }
  // Outer ancestors remain visible past an edge of the immediate parent room.
  // Composite them into one viewport so resolution and memory do not grow with depth.
  layers.reverse();
  const outermost = layers[0];
  if (!outermost) return;
  scene.style.setProperty('--surround-color', roomColor(outermost.roomId));
  drawRoomMap(outside, outermost.roomId, outermost.size, true, true, { width, height, layers });
}

function clearRoomMotion() {
  roomMotion?.animation.cancel();
  roomMotion?.ghost?.remove();
  roomMotion = undefined;
}

function boardFrame(element) {
  const rect = element.getBoundingClientRect();
  return { rect, opacity: Number(getComputedStyle(element).opacity) };
}

function cloneBoard() {
  const ghost = board.cloneNode(true);
  ghost.removeAttribute('id');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  ghost.classList.add('intro-ghost');
  const sources = board.querySelectorAll('canvas');
  ghost.querySelectorAll('canvas').forEach((canvas, index) => canvas.getContext('2d').drawImage(sources[index], 0, 0));
  return ghost;
}

function cameraPose(rect, anchor, target) {
  const scale = Math.min(target.width / anchor.width, target.height / anchor.height);
  return {
    x: target.left + target.width / 2 - rect.left - rect.width / 2 +
      (rect.left + rect.width / 2 - anchor.left - anchor.width / 2) * scale,
    y: target.top + target.height / 2 - rect.top - rect.height / 2 +
      (rect.top + rect.height / 2 - anchor.top - anchor.height / 2) * scale,
    scale,
  };
}

const restingPose = { x: 0, y: 0, scale: 1 };

function zoomAtProgress(start, end, progress) {
  return start * (end / start) ** progress;
}

function recursiveProgress(zoom, time, interval) {
  const phase = Math.max(0, time - zoom.started) % interval / interval;
  return zoom.direction === 'in' ? phase : 1 - phase;
}

function animateCamera(element, from, to, fromOpacity, toOpacity, duration) {
  const frames = Array.from({ length: 9 }, (_, index) => {
    const progress = index / 8;
    const scale = zoomAtProgress(from.scale, to.scale, progress);
    const zoom = to.scale === from.scale ? progress : (scale - from.scale) / (to.scale - from.scale);
    const x = from.x + (to.x - from.x) * zoom;
    const y = from.y + (to.y - from.y) * zoom;
    return {
      opacity: fromOpacity + (toOpacity - fromOpacity) * progress,
      transform: 'translate(' + x + 'px, ' + y + 'px) scale(' + scale + ')',
    };
  });
  return element.animate(frames, { duration, easing: 'linear', fill: 'backwards' });
}

function tileFrame(frame, roomId, x, y) {
  const room = map.rooms[roomId];
  const width = frame.width / room.width;
  const height = frame.height / room.height;
  return { left: frame.left + x * width, top: frame.top + y * height, width, height };
}

function childFrame(frame, childId, host, inset = shellInset) {
  const tile = tileFrame(frame, host[0], host[1], host[2]);
  const room = map.rooms[childId];
  const size = Math.min(tile.width, tile.height) * inset / Math.max(room.width, room.height);
  return {
    left: tile.left + tile.width / 2 - room.width * size / 2,
    top: tile.top + tile.height / 2 - room.height * size / 2,
    width: room.width * size, height: room.height * size,
  };
}

function parentFrame(frame, host, inset = shellInset) {
  const size = Math.max(frame.width, frame.height) / inset;
  const room = map.rooms[host[0]];
  return {
    left: frame.left + frame.width / 2 - (host[1] + .5) * size,
    top: frame.top + frame.height / 2 - (host[2] + .5) * size,
    width: room.width * size, height: room.height * size,
  };
}

function visibleRoomFrame(roomId, positions, seen = new Set()) {
  const viewRoom = Number(board.dataset.room);
  if (roomId === viewRoom) return board.getBoundingClientRect();
  const outside = stage.querySelector('.intro-surround');
  if (!outside.hidden) {
    let ancestor = viewRoom, frame = board.getBoundingClientRect();
    const ancestors = new Set([ancestor]);
    while (true) {
      const host = positions[map.rooms[ancestor].owner];
      if (!host) break;
      frame = parentFrame(frame, host, 1);
      ancestor = host[0];
      if (ancestor === roomId) return frame;
      if (ancestors.has(ancestor)) break;
      ancestors.add(ancestor);
    }
  }
  if (seen.has(roomId)) return null;
  seen.add(roomId);
  const host = positions[map.rooms[roomId].owner];
  if (!host) return null;
  const frame = visibleRoomFrame(host[0], positions, seen);
  return frame ? childFrame(frame, roomId, host) : null;
}

function sourceBoxFrame(position, positions, route = [], destination = null) {
  if (destination?.[0] === Number(board.dataset.room) && position[0] !== destination[0] && route.length) {
    let frame = zoomCanvas.hidden ? board.getBoundingClientRect() : sourceBoxFrame(destination, positions);
    if (!frame) return null;
    for (const [index, transfer] of route.slice().reverse().entries()) {
      const inverse = { ...transfer, direction: transfer.direction === 'in' ? 'out' : 'in' };
      const inset = index === 0 && inverse.direction === 'out' && zoomCanvas.hidden ? 1 : shellInset;
      frame = transferFrame(frame, inverse, positions, inset);
    }
    return frame;
  }
  if (!zoomCanvas.hidden && recursiveZoom?.layers) {
    const area = zoomCanvas.getBoundingClientRect();
    const candidates = recursiveZoom.layers.filter(layer => layer.roomId === position[0]).map(layer => ({
      left: area.left + layer.left, top: area.top + layer.top,
      width: layer.right - layer.left, height: layer.bottom - layer.top,
    }));
    return candidates.filter(frame => {
      const tile = tileFrame(frame, ...position);
      return tile.left < area.right && tile.top < area.bottom &&
        tile.left + tile.width > area.left && tile.top + tile.height > area.top;
    }).sort((a, b) => b.width - a.width)[0] ?? null;
  }
  return visibleRoomFrame(position[0], positions);
}

function transferFrame(frame, transfer, positions, inset) {
  const currentHost = positions[transfer.owner];
  const host = currentHost[0] === transfer.host[0] ? currentHost : transfer.host;
  return transfer.direction === 'in' ? childFrame(frame, transfer.room, host, inset) :
    parentFrame(frame, host, inset);
}

function boxSprite(entity) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.ceil(Math.max(stage.clientWidth, stage.clientHeight) * (devicePixelRatio || 1));
  const context = canvas.getContext('2d');
  const child = map.inside[entity];
  const edge = canvas.width * .065;
  const side = canvas.width - edge * 2;
  context.fillStyle = child >= 0 ? roomColor(child) :
    board.classList.contains('clone-chapter') ? '#468cfa' :
    board.classList.contains('blue-crates') ? '#38bce8' :
    board.classList.contains('empty-chapter') ? '#add444' :
    board.classList.contains('eat-chapter') ? '#ffdc72' : '#ffb63a';
  context.fillRect(edge, edge, side, side);
  context.strokeStyle = child >= 0 ? '#d2e1fa' : '#ffedaf';
  context.lineWidth = 3;
  if (map.clones[entity]) context.setLineDash([18, 12]);
  context.strokeRect(edge, edge, side, side);
  context.setLineDash([]);
  if (child >= 0) {
    const preview = document.createElement('canvas');
    const room = map.rooms[child];
    drawRoomMap(preview, child, Math.ceil(side / Math.max(room.width, room.height)));
    const scale = (side - 12) / Math.max(preview.width, preview.height);
    const width = preview.width * scale;
    const height = preview.height * scale;
    context.drawImage(preview, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  }
  return canvas;
}

function clearBoxMotion() {
  if (boxMotion) {
    cancelAnimationFrame(boxMotion.frame);
    for (const cell of board.querySelectorAll('.cell')) cell.style.removeProperty('--box-visibility');
  }
  boxMotion = undefined;
  hiddenBoxes.clear();
  boxCanvas.hidden = true;
}

function prepareBoxMotion(next, transfers, crossings = []) {
  const sprites = [];
  const now = performance.now();
  if (!reduceMotion.matches && !textView && inspectedRoom === null &&
      state.positions[0][0] === next.positions[0][0] && !crossings.length) {
    const groups = new Map();
    for (const transfer of transfers) {
      if (!groups.has(transfer.entity)) groups.set(transfer.entity, []);
      groups.get(transfer.entity).push(transfer);
    }
    for (const sprite of boxMotion?.sprites ?? []) {
      if (!groups.has(sprite.entity) && now < sprite.started + sprite.duration &&
          sprite.nextPositions[sprite.entity].every((value, index) => value === next.positions[sprite.entity][index])) {
        sprites.push({ ...sprite, nextPositions: next.positions });
      }
    }
    for (const [entity, route] of groups) {
      const position = state.positions[entity];
      const frame = sourceBoxFrame(position, state.positions, route, next.positions[entity]);
      if (!frame) continue;
      const old = boxMotion?.sprites.find(sprite => sprite.entity === entity);
      sprites.push({
        entity, route, position, positions: state.positions, nextPositions: next.positions,
        from: old?.current ?? tileFrame(frame, ...position), canvas: boxSprite(entity),
        started: now, duration: 220,
      });
    }
  }
  clearBoxMotion();
  if (!sprites.length) return null;
  for (const sprite of sprites) hiddenBoxes.add(sprite.entity);
  return { sprites, frame: 0 };
}

function paintBoxMotion(time) {
  const motion = boxMotion;
  if (!motion) return;
  const area = boxCanvas.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio, 2);
  const width = Math.round(area.width * ratio), height = Math.round(area.height * ratio);
  if (boxCanvas.width !== width || boxCanvas.height !== height) {
    boxCanvas.width = width;
    boxCanvas.height = height;
  }
  const context = boxCanvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, area.width, area.height);
  const active = [];
  for (const sprite of motion.sprites) {
    const progress = Math.max(0, Math.min(1, (time - sprite.started) / sprite.duration));
    let frame = sourceBoxFrame(sprite.position, sprite.positions, sprite.route, sprite.nextPositions[sprite.entity]);
    if (!frame) continue;
    for (const [index, transfer] of sprite.route.entries()) {
      const inset = index === 0 && transfer.direction === 'out' && zoomCanvas.hidden &&
        transfer.room === Number(board.dataset.room) ? 1 : shellInset;
      frame = transferFrame(frame, transfer, sprite.nextPositions, inset);
    }
    const position = sprite.nextPositions[sprite.entity];
    if (position[0] === Number(board.dataset.room) && position[0] !== sprite.position[0] && zoomCanvas.hidden) {
      frame = board.getBoundingClientRect();
    }
    const target = tileFrame(frame, ...position);
    const from = sprite.from;
    const width = zoomAtProgress(from.width, target.width, progress);
    const height = zoomAtProgress(from.height, target.height, progress);
    const zoom = Math.abs(target.width - from.width) < .01 ? progress :
      (width - from.width) / (target.width - from.width);
    const cx = from.left + from.width / 2 + (target.left + target.width / 2 - from.left - from.width / 2) * zoom;
    const cy = from.top + from.height / 2 + (target.top + target.height / 2 - from.top - from.height / 2) * zoom;
    sprite.current = { left: cx - width / 2, top: cy - height / 2, width, height };
    context.drawImage(sprite.canvas, sprite.current.left - area.left, sprite.current.top - area.top, width, height);
    if (progress < 1) active.push(sprite);
    else hiddenBoxes.delete(sprite.entity);
  }
  if (active.length) {
    if (active.length !== motion.sprites.length) {
      motion.sprites = active;
      render();
    }
    motion.frame = requestAnimationFrame(paintBoxMotion);
  }
  else {
    clearBoxMotion();
    render();
  }
}

function startBoxMotion(prepared) {
  if (!prepared) return;
  boxMotion = prepared;
  boxCanvas.hidden = false;
  paintBoxMotion(performance.now());
}

function updateRecursiveZoom(viewedRoom) {
  if (!recursiveZoom) return;
  const zoom = recursiveZoom;
  const chain = [];
  let parent = viewedRoom;
  while (parent >= 0 && !chain.includes(parent)) {
    chain.push(parent);
    parent = parentRoom(parent);
  }
  const show = parent >= 0 && zoom.pausedAt === null;
  zoomCanvas.hidden = !show;
  zoomButton.textContent = zoom.pausedAt === null ? '暂停缩放' : '继续缩放';
  if (!show) {
    cancelAnimationFrame(zoom.frame);
    zoom.frame = 0;
    return;
  }

  const cycle = chain.slice(chain.indexOf(parent)).reverse();
  const root = Math.min(...cycle);
  const first = cycle.indexOf(root);
  zoom.children = map.rooms.map(() => []);
  state.positions.forEach(([room, x, y], owner) => {
    const child = map.inside[owner];
    if (child >= 0) zoom.children[room].push({ x, y, owner, room: child });
  });
  let x = 0, y = 0, scale = 1;
  for (let i = 0; i < cycle.length; i++) {
    const roomId = cycle[(first + i) % cycle.length];
    const next = cycle[(first + i + 1) % cycle.length];
    const room = map.rooms[roomId];
    const [, tileX, tileY] = state.positions[map.rooms[next].owner];
    const side = Math.max(room.width, room.height);
    x += scale * (tileX + .5 - room.width / 2) / side;
    y += scale * (tileY + .5 - room.height / 2) / side;
    scale *= shellInset / side;
  }
  // The point stays fixed when a full cycle maps the root into its next copy.
  zoom.cycle = { root, scale, x: x / (1 - scale), y: y / (1 - scale) };
  zoom.artwork.forEach((canvas, room) => drawRoomMap(canvas, room, 28, false, false));
  if (!zoom.frame) paintRecursiveZoom(performance.now());
}

function paintRecursiveZoom(time) {
  const zoom = recursiveZoom;
  const width = zoomCanvas.clientWidth;
  const height = zoomCanvas.clientHeight;
  const ratio = Math.min(devicePixelRatio, 2);
  const pixelsWide = Math.round(width * ratio);
  const pixelsHigh = Math.round(height * ratio);
  if (zoomCanvas.width !== pixelsWide || zoomCanvas.height !== pixelsHigh) {
    zoomCanvas.width = pixelsWide;
    zoomCanvas.height = pixelsHigh;
  }
  const context = zoomCanvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const { root, x, y, scale } = zoom.cycle;
  const room = map.rooms[root];
  const side = Math.max(room.width, room.height);
  const cover = Math.max(
    (width / 2 + 1) / (room.width / side / 2 - Math.abs(x)),
    (height / 2 + 1) / (room.height / side / 2 - Math.abs(y)),
  );
  const interval = -Math.log(scale) * 950;
  const previous = zoom.projection;
  if (previous?.root === root && (previous.interval !== interval || previous.cover !== cover)) {
    // A moved shell can change the cycle. Retain the current scale in the new cycle.
    const previousProgress = recursiveProgress(zoom, time, previous.interval);
    const previousSize = zoomAtProgress(previous.cover, previous.cover / previous.scale, previousProgress);
    const distance = Math.log(previousSize / cover) * 950;
    const elapsed = zoom.direction === 'in' ? distance : interval - distance;
    zoom.started = time - (elapsed % interval + interval) % interval;
  }
  zoom.projection = { root, cover, scale, interval };
  const progress = recursiveProgress(zoom, time, interval);
  const size = zoomAtProgress(cover, cover / scale, progress);
  zoom.layers = [];
  const [finishRoom, finishX, finishY] = map.finish;
  const [playerRoom, playerX, playerY] = state.positions[0];
  const playerOnFinish = playerRoom === finishRoom && playerX === finishX && playerY === finishY;

  function paintRoom(roomId, cx, cy, size, container) {
    const room = map.rooms[roomId];
    const cell = size / Math.max(room.width, room.height);
    const w = room.width * cell;
    const h = room.height * cell;
    const left = cx - w / 2;
    const top = cy - h / 2;
    if (left >= width || top >= height || left + w <= 0 || top + h <= 0) return;
    context.drawImage(zoom.artwork[roomId], left, top, w, h);
    zoom.layers.push({ roomId, container, left, top, right: left + w, bottom: top + h });
    const nextSize = cell * shellInset;
    if (nextSize >= 4) {
      for (const child of zoom.children[roomId]) {
        paintRoom(child.room, left + (child.x + .5) * cell, top + (child.y + .5) * cell, nextSize,
          { roomId, owner: child.owner });
      }
    }
    if (roomId === finishRoom) {
      const targetLeft = left + finishX * cell;
      const targetTop = top + finishY * cell;
      if (targetLeft < width && targetTop < height && targetLeft + cell > 0 && targetTop + cell > 0) {
        drawFinish(context, targetLeft, targetTop, cell, playerOnFinish);
      }
    }
  }

  paintRoom(root, width / 2 - x * size, height / 2 - y * size, size, null);
  zoom.frame = requestAnimationFrame(paintRecursiveZoom);
}

function renderScene(roomId, crossing, showText) {
  const animate = crossing && !showText && !reduceMotion.matches;
  const entering = crossing?.direction === 'in';
  const shell = crossing?.owner >= 0 ? '[data-shell="' + crossing.owner + '"]' : null;
  let oldFrame, oldShell, returningFrame, ghost;
  if (animate && board.children.length && !board.hidden) {
    // Measure the interpolated frame while the previous animation is still active.
    oldFrame = boardFrame(board);
    oldShell = entering && shell ? board.querySelector(shell)?.getBoundingClientRect() : null;
    const previous = roomMotion?.ghost;
    if (previous?.isConnected && previous.dataset.room === String(roomId) &&
        roomMotion.crossing.direction !== crossing.direction) {
      returningFrame = boardFrame(previous);
    }
    ghost = cloneBoard();
  }

  if (crossing || showText) clearRoomMotion();
  board.hidden = showText;
  textMaps.hidden = !showText;
  stage.classList.toggle('text-view', showText);
  renderRoom(board, roomId);
  renderSurround(stage, roomId);
  if (!animate) return;

  const nextRect = board.getBoundingClientRect();
  const oldRect = oldFrame?.rect;
  const nextShell = !entering && shell ? board.querySelector(shell)?.getBoundingClientRect() : null;
  let incoming = restingPose;
  let outgoing = restingPose;
  let opacity = 0;
  if (oldShell?.width && nextRect.width) {
    incoming = cameraPose(nextRect, nextRect, oldShell);
    outgoing = cameraPose(oldRect, oldShell, nextRect);
    opacity = oldFrame.opacity;
  } else if (nextShell?.width && oldRect?.width) {
    incoming = cameraPose(nextRect, nextShell, oldRect);
    outgoing = cameraPose(oldRect, oldRect, nextShell);
  }
  if (returningFrame?.rect.width && nextRect.width) {
    incoming = cameraPose(nextRect, nextRect, returningFrame.rect);
    opacity = returningFrame.opacity;
  }
  const distance = Math.max(Math.abs(Math.log(incoming.scale)), Math.abs(Math.log(outgoing.scale)));
  const duration = Math.max(110, Math.min(240, distance * 100));
  if (ghost && oldRect.width) {
    const area = stage.getBoundingClientRect();
    Object.assign(ghost.style, {
      left: oldRect.left - area.left - stage.clientLeft + 'px',
      top: oldRect.top - area.top - stage.clientTop + 'px',
      width: oldRect.width + 'px',
      height: oldRect.height + 'px',
      zIndex: entering ? '0' : '2',
    });
    stage.append(ghost);
    animateCamera(ghost, restingPose, outgoing, oldFrame.opacity, 0, duration).onfinish = () => ghost.remove();
  }
  const animation = animateCamera(board, incoming, restingPose, opacity, 1, duration);
  roomMotion = { animation, ghost, crossing };
  animation.onfinish = () => {
    if (roomMotion?.animation === animation) roomMotion = undefined;
  };
}

function renderRoom(container, roomId) {
  const room = map.rooms[roomId];
  if (container.dataset.room !== String(roomId) || !container.children.length) {
    container.dataset.room = roomId;
    container.style.setProperty('--columns', room.width);
    container.style.setProperty('--longest-side', Math.max(room.width, room.height));
    container.style.setProperty('--room-color', roomColor(roomId));
    container.style.setProperty('--room-floor', floorColor(roomId));
    // A single bitmap keeps wall runs continuous at fractional zoom and cell sizes.
    const terrain = document.createElement('canvas');
    terrain.width = room.width;
    terrain.height = room.height;
    const terrainContext = terrain.getContext('2d');
    terrainContext.fillStyle = roomColor(roomId);
    for (let cell = 0; cell < room.tiles.length; cell++) {
      if (room.tiles[cell] === '#') terrainContext.fillRect(cell % room.width, Math.floor(cell / room.width), 1, 1);
    }
    container.style.backgroundImage = 'url("' + terrain.toDataURL() + '")';
    container.replaceChildren(...Array.from(room.tiles, tile => {
      const cell = document.createElement('div');
      cell.className = tile === '#' ? 'cell wall' : 'cell';
      return cell;
    }));
  }
  const goalCells = new Set(map.goals.filter(([id]) => id === roomId).map(([, x, y]) => y * room.width + x));
  const finishCell = map.finish[0] === roomId ? map.finish[2] * room.width + map.finish[1] : -1;
  const occupied = new Map();
  state.positions.forEach(([id, x, y], entity) => { if (id === roomId) occupied.set(y * room.width + x, entity); });
  for (const [index, cell] of Array.from(container.children).entries()) {
    if (room.tiles[index] === '#') continue;
    const entity = occupied.get(index);
    const child = entity === undefined ? -1 : map.inside[entity];
    const crate = entity > 0;
    cell.style.setProperty('--box-visibility', hiddenBoxes.has(entity) ? 'hidden' : 'visible');
    const goal = goalCells.has(index);
    const signature = (entity ?? '') + ':' + Number(goal) + ':' + Number(index === finishCell);
    if (cell.dataset.tile !== signature) {
      cell.dataset.tile = signature;
      cell.replaceChildren();
      if (goal && !crate) addPiece(cell, 'goal');
      if (index === finishCell && !crate) addPiece(cell, 'intro-player-goal');
      if (entity === 0) addPiece(cell, 'player');
      else if (child >= 0) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.shell = entity;
        button.className = 'room-box' + (goal ? ' room-on-goal' : '') + (map.clones[entity] ? ' room-clone' : '');
        button.style.setProperty('--box-color', roomColor(child));
        button.setAttribute('aria-label', child === roomId ? '查看小箱子里的同一张棋盘' :
          '查看第 ' + (index % room.width + 1) + ' 列第 ' + (Math.floor(index / room.width) + 1) + ' 行的箱内房间');
        if (map.clones[entity]) {
          button.setAttribute('aria-label', '查看复制体里的共享房间，退出时回到本体');
          button.title = '复制体：进入同一房间，退出回到本体';
        }
        button.append(document.createElement('canvas'));
        button.addEventListener('click', () => inspectRoom(child, { direction: 'in', owner: entity }));
        cell.append(button);
      } else if (crate) addPiece(cell, goal ? 'crate placed' : 'crate');
    }
    if (child >= 0) {
      const canvas = cell.querySelector('canvas');
      const inner = map.rooms[child];
      const size = Math.max(10, Math.ceil(Math.min(canvas.clientWidth / inner.width,
        canvas.clientHeight / inner.height) * (devicePixelRatio || 1)));
      drawRoomMap(canvas, child, size);
    }
  }
}

function openLevel(index) {
  routeInput?.reset();
  clearBoxMotion();
  clearRoomMotion();
  if (recursiveZoom) cancelAnimationFrame(recursiveZoom.frame);
  inspectedRoom = null;
  active = index;
  const level = levels[index];
  const nextChapter = chapters.findLastIndex(chapter => index >= chapter.start);
  if (nextChapter !== chapterIndex) {
    const chapter = chapters[nextChapter];
    chapterIndex = nextChapter;
    $('intro-chapter-title').textContent = chapter.title;
    document.title = '套箱模式 · ' + chapter.title;
    $('intro-chapter').value = String(nextChapter);
    levelButtons = chapter.levels.map((entry, number) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.level = chapter.start + number;
      if (entry.challenge) button.dataset.challenge = true;
      button.textContent = number + 1;
      button.addEventListener('click', () => {
        if (active !== chapter.start + number) openLevel(chapter.start + number);
      });
      return button;
    });
    $('intro-levels').replaceChildren(...levelButtons);
  }
  const theme = chapters[nextChapter].id;
  map = compile({ ...level, eat: ['eat', 'reference', 'swap', 'center', 'clone', 'transfer', 'open'].includes(theme), allowCycles: ['reference', 'swap', 'center', 'clone', 'transfer', 'open'].includes(theme), transfer: theme === 'transfer' });
  $('intro-convert').hidden = map.transfer || !map.portalConversion;
  $('intro-convert').disabled = map.transfer || !map.portalConversion;
  const now = performance.now();
  recursiveZoom = level.recursiveZoom ? {
    direction: level.recursiveZoom,
    started: now,
    pausedAt: reduceMotion.matches ? now : null,
    frame: 0,
    artwork: map.rooms.map(() => document.createElement('canvas')),
  } : undefined;
  zoomCanvas.hidden = !recursiveZoom;
  zoomButton.hidden = !recursiveZoom;
  state = map.initial;
  history = [];
  future = [];
  $('intro-title').textContent = '第 ' + (active - chapters[chapterIndex].start + 1) + ' 关 · ' + level.title;
  $('intro-hint').textContent = level.hint;
  const blueCrates = chapterIndex === 1 && level.crateColor !== 'gold';
  board.classList.toggle('blue-crates', blueCrates);
  board.classList.toggle('empty-chapter', theme === 'empty');
  board.classList.toggle('eat-chapter', theme === 'eat');
  board.classList.toggle('reference-chapter', theme === 'reference');
  board.classList.toggle('clone-chapter', theme === 'clone');
  board.replaceChildren();
  textMaps.replaceChildren();
  displayMode.hidden = !level.textView;
  setTextView(Boolean(level.textView));
  saveProgress();
  render();
}

function move(direction) {
  if (inspectedRoom !== null || won(map, state)) return;
  applyState(step(map, state, direction));
}

function applyState(next) {
  if (next === state) return;
  const prepared = prepareBoxMotion(next, next.transfers ?? [], next.crossings ?? []);
  history.push(state);
  future = [];
  state = next;
  if (!complete[active] && won(map, state)) {
    complete[active] = true;
    saveProgress();
  }
  render(next.crossings);
  startBoxMotion(prepared);
}

function undo() {
  if (history.length === 0) return;
  const crossings = (state.crossings ?? []).map(({ direction, owner }) => ({ direction: direction === 'in' ? 'out' : 'in', owner })).reverse();
  const transfers = (state.transfers ?? []).map(transfer => ({
    ...transfer, direction: transfer.direction === 'in' ? 'out' : 'in',
  })).reverse();
  const prepared = prepareBoxMotion(history.at(-1), transfers, crossings);
  future.push(state);
  state = history.pop();
  render(crossings);
  startBoxMotion(prepared);
}

function redo() {
  if (future.length === 0) return;
  const prepared = prepareBoxMotion(future.at(-1), future.at(-1).transfers ?? [], future.at(-1).crossings ?? []);
  history.push(state);
  state = future.pop();
  render(state.crossings);
  startBoxMotion(prepared);
}

$('intro-convert').addEventListener('click', () => {
  if (map.transfer || !map.portalConversion) return;
  const chapter = chapters[chapterIndex];
  const name = chapter.title + ' 第 ' + (active - chapter.start + 1) + ' 关 · 传送门';
  const code = JSON.stringify(BoxPortals.convert(map, state));
  try {
    sessionStorage.setItem('sokoban-lab-portal-import-v1', JSON.stringify({ name, code }));
  } catch {
    const url = URL.createObjectURL(new Blob([code + '\n'], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('intro-status').textContent = '已下载地图，可在推箱子实验室里导入。';
    return;
  }
  location.assign('./?import=box-portals');
});

$('intro-chapter').addEventListener('change', event => {
  openLevel(chapters[Number(event.target.value)].start);
  event.target.blur();
});
returnButton.addEventListener('click', returnToPlayer);
parentButton.addEventListener('click', inspectParent);
zoomButton.addEventListener('click', () => {
  const now = performance.now();
  if (recursiveZoom.pausedAt === null) recursiveZoom.pausedAt = now;
  else {
    recursiveZoom.started += now - recursiveZoom.pausedAt;
    recursiveZoom.pausedAt = null;
  }
  updateRecursiveZoom(inspectedRoom ?? state.positions[0][0]);
});
zoomCanvas.addEventListener('click', event => {
  const bounds = zoomCanvas.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;
  const layer = recursiveZoom.layers.findLast(layer => x >= layer.left && x < layer.right &&
    y >= layer.top && y < layer.bottom);
  const viewed = inspectedRoom ?? state.positions[0][0];
  if (layer?.container?.roomId === viewed) {
    inspectRoom(layer.roomId, { direction: 'in', owner: layer.container.owner });
  } else if (layer?.roomId !== viewed) inspectParent();
});
displayMode.addEventListener('click', () => {
  inspectedRoom = null;
  setTextView(!textView);
  render();
});
stage.addEventListener('click', event => {
  if (event.target === stage || event.target === textMaps) inspectParent();
});
for (const button of moveButtons) button.addEventListener('click', () => move(Number(button.dataset.move)));
$('intro-undo').addEventListener('click', undo);
$('intro-redo').addEventListener('click', redo);
$('intro-reset').addEventListener('click', () => applyState(map.initial));
$('intro-next').addEventListener('click', () => {
  if (won(map, state) && active + 1 < levels.length) openLevel(active + 1);
});
document.addEventListener('keydown', event => {
  if (event.target.closest('input, textarea, select') || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
  const key = event.key.toLowerCase();
  if (key === 'escape' && inspectedRoom !== null) {
    event.preventDefault();
    returnToPlayer();
    return;
  }
  const direction = moveKeys[key];
  if (key === 'z' || key === 'x' || key === 'r' || typeof direction === 'number') {
    event.preventDefault();
    if (event.repeat || inspectedRoom !== null) return;
    if (key === 'z') undo();
    else if (key === 'x') redo();
    else if (key === 'r') applyState(map.initial);
    else move(direction);
  } else if (key === 'enter' && event.repeat && event.target.closest('[data-move]')) event.preventDefault();
});

openLevel(active);
new ResizeObserver(() => render()).observe(stage);
routeInput = RouteInput.mount($('route-input'), {
  devices: () => false,
  state: () => state,
  available: () => inspectedRoom === null,
  won: () => won(map, state),
  prepare: returnToPlayer,
  execute: move,
});
