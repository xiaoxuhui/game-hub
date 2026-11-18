'use strict';

const $ = (id) => document.getElementById(id);
const board = $('board');
const ctx = board.getContext('2d');
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const mod = (n, divisor) => (n % divisor + divisor) % divisor;
const key = (x, y) => x + ',' + y;
const xy = (id) => id.split(',').map(Number);
const colorPattern = /^#[\da-f]{6}$/i;
const maxFrameDuration = 3600000;
const validFrameDuration = (duration) => Number.isFinite(duration) && duration >= 1 && duration <= maxFrameDuration;
const durationLabel = (duration) => Number(duration.toFixed(3));
const playbackModes = ['repeat', 'once', 'ping-pong'];
const readPlaybackMode = (value) => playbackModes.includes(value) ? value : 'repeat';
const initialPalette = [
  '#211d34', '#53446e', '#9578bb', '#643ded', '#4076fc', '#63cfe0', '#71d8a4', '#3d8a6f',
  '#fff5d0', '#ffffff', '#fff0a3', '#f9bf68', '#ed8d5a', '#f66586', '#b63a66', '#663346',
];

const paths = {
  file: '<path d="M6 3h8l4 4v14H6z M14 3v5h4"/>',
  folder: '<path d="M3 7V5h6l2 2h10v12H3z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16m10-16v16M3 9h4M3 15h4m10-6h4m-4 6h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  pencil: '<path d="m4 16-1 5 5-1L20 8l-4-4L4 16zm9-9 4 4"/>',
  line: '<path d="M5 19 19 5"/><rect x="3" y="17" width="4" height="4" rx=".5"/><rect x="17" y="3" width="4" height="4" rx=".5"/>',
  lambda: '<path d="M5 4h2c2 0 3 1 4 4l5 11h3M12 10l-7 9"/>',
  eraser: '<path d="m5 18-2-2a2 2 0 0 1 0-3l9-9a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-7 7H6zM8 8l8 8m-4 3h9"/>',
  select: '<rect x="3.5" y="3.5" width="17" height="17" rx="1" stroke-dasharray="3 3"/>',
  dropper: '<path d="m14 6 4 4m-6-4 3 3-9 9-3 1 1-3 9-9m1-1 2-2a2 2 0 0 1 3 0l1 1a2 2 0 0 1 0 3l-2 2m-6-4 6 6"/>',
  hand: '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v7a5 5 0 0 1-5 5h-2a5 5 0 0 1-4-2l-5-6a1.6 1.6 0 0 1 2-2z"/>',
  undo: '<path d="M8 5 3 10l5 5m-5-5h10a6 6 0 0 1 6 6v3"/>',
  redo: '<path d="m16 5 5 5-5 5m5-5H11a6 6 0 0 0-6 6v3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2q-1.5 1-1.5 2.5m0 3h.01"/>',
  grid: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16M12 4v16"/>',
  fit: '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  layers: '<path d="m12 4 9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 12 12m0-16L8 16"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 5V4H4v12h1"/>',
  clipboard: '<path d="M9 5H5v16h14V5h-4"/><rect x="9" y="3" width="6" height="4" rx="1"/>',
  trash: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15m-8 4v7m4-7v7"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 2-2c0-1-1-2-1-3s1-2 2-2h2a3 3 0 0 0 3-3c0-4-4-8-9-8zM7 11h.01M10 7h.01M15 7h.01"/>',
  play: '<path fill="currentColor" d="m9 5 10 7-10 7z"/>',
  pause: '<path d="M9 6v12m6-12v12" stroke-width="2.8"/>',
  prev: '<path d="M5 6v12m12-12-9 6 9 6z"/>',
  next: '<path d="M19 6v12M7 6l9 6-9 6z"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
};

function icon(name) {
  return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + '</svg>';
}

for (const el of document.querySelectorAll('[data-icon]')) {
  el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
}

function frame(pixels = new Map(), duration = 120, lambda) {
  return lambda ? { pixels, duration, lambda } : { pixels, duration };
}

let cachedDrawing, cachedRaster;
const drawingBounds = new WeakMap();
const drawingCounts = new WeakMap();

function framePixels(picture) {
  if (picture.pixels) return picture.pixels;
  if (cachedDrawing !== picture.drawing) {
    cachedRaster = Tromp.rasterize(picture.drawing);
    cachedDrawing = picture.drawing;
  }
  return cachedRaster;
}

function frameBounds(picture) {
  if (picture.pixels) return bounds(picture.pixels);
  if (!drawingBounds.has(picture.drawing)) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    Tromp.forEachLine(picture.drawing, (left, top, right, bottom) => {
      x0 = Math.min(x0, left); y0 = Math.min(y0, top);
      x1 = Math.max(x1, right); y1 = Math.max(y1, bottom);
    });
    drawingBounds.set(picture.drawing, { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return drawingBounds.get(picture.drawing);
}

function updatePixelCount() {
  const picture = current();
  if (picture.drawing && !drawingCounts.has(picture.drawing)) {
    drawingCounts.set(picture.drawing, framePixels(picture).size);
  }
  const count = picture.pixels?.size ?? drawingCounts.get(picture.drawing);
  $('pixel-count').textContent = count.toLocaleString('zh-CN') + ' 像素';
}

function copyFrameImage(picture) {
  return picture.drawing ? { drawing: picture.drawing } : { pixels: new Map(picture.pixels) };
}

function sampleProject() {
  const cat = [
    '...KK...............KK...',
    '...KLK.............KLK...',
    '...KPLKKKKKKKKKKKKKLPK...',
    '...KPLLCCCCCCCCCCLLPK...',
    '...KLLCCCCCCCCCCCCLLK...',
    '..KLLCCCCCCCCCCCCCCLLK..',
    '..KLCCCCCCCCCCCCCCCCLK..',
    '.KLCCCCCCCCCCCCCCCCCCLK.',
    '.KLCCCWWCCCCCCCCWWCCCLK.',
    '.KLCCCWKCCCCCCCCWKCCCLK.',
    '.KLCCPKKCCCCCCCCPKKCCLK.',
    '.KLCCCCCCCCKCCCCCCCCCLK.',
    '.KLCPPCCCCKCKCCCCPPCCLK.',
    '..KLCCCCCCCCCCCCCCCCLK..',
    '...KLLLLLLLLLLLLLLLLK...',
    '....KKKDDDDDDDDDDKKK....',
    '......KDLCCCCCCLDK......',
    '.....KDLCCCCCCCCLDK.....',
    '.....KDLDCCCCCCDLDK.....',
    '.....KDDDKDDDDKDDDK.....',
    '......KKK.KKKK.KKK......',
  ];
  const colors = {K:'#38284c', L:'#ffc36e', C:'#f3a056', D:'#cb694e', P:'#f27586', W:'#fff7da'};
  return {
    name: '月光小猫',
    palette: [...initialPalette],
    frames: [420, 120, 420, 140].map((duration, index) => {
      const pixels = new Map();
      const dot = (x, y, color) => pixels.set(key(x, y), color);
      const line = (x, y, length, color) => {
        for (let i = 0; i < length; i++) dot(x + i, y, color);
      };
      line(-11, 11, 24, '#32294c');
      line(-14, 10, 30, '#3e3159');
      line(-12, 9, 26, '#4d3b6c');
      for (let y = -11; y <= -5; y++) {
        for (let x = 10; x <= 16; x++) {
          if ((x - 13) ** 2 + (y + 8) ** 2 <= 13 && (x - 15) ** 2 + (y + 10) ** 2 > 10) {
            dot(x, y, y > -7 ? '#f7c477' : '#ffe2a2');
          }
        }
      }
      for (const [x, y, large] of [[-15,-8,1],[-19,2,0],[17,3,1],[10,7,0],[-10,-13,0],[4,-12,0],[20,-4,0]]) {
        dot(x, y, '#ffe4a4');
        if (large && index !== 1) {
          dot(x - 1, y, '#9485c7'); dot(x + 1, y, '#9485c7');
          dot(x, y - 1, '#9485c7'); dot(x, y + 1, '#9485c7');
        }
      }
      const tailTip = index > 1 ? 0 : 2;
      line(5, 7, 8, colors.K);
      line(5, 8, 7, colors.D);
      line(5, 9, 6, colors.K);
      for (let y = tailTip; y <= 7; y++) {
        line(11, y, 4, colors.K);
        line(12, y, 2, y < tailTip + 2 ? colors.L : colors.C);
      }
      line(12, tailTip - 1, 2, colors.K);
      cat.forEach((row, y) => [...row].forEach((cell, x) => {
        if (colors[cell]) dot(x - 12, y - 11, colors[cell]);
      }));
      if (index === 1) {
        for (const start of [-6, 4]) {
          line(start, -3, 2, colors.C);
          line(start, -2, 2, colors.K);
          line(start, -1, 2, colors.C);
        }
      }
      return frame(pixels, duration);
    }),
  };
}

let project = sampleProject();
let active = 0;
let tool = 'draw';
let grid = true;
let onion = false;
let selection = null;
let clipboard = null;
let lastPaste = null;
let hover = null;
let gesture = null;
let history = [];
let future = [];
let mode = 'HSV';
let currentColor = '#f9bf68';
let hsv = rgbToHsv(toRgb(currentColor));
let camera = { x: 0, y: 0, scale: 16 };
let screen = { w: 0, h: 0, dpr: 1 };
let paintPending = false;
let playState = null;
let noticeTimer;
let revision = 0;
let dbPromise;
let trompGuide = null;
let trompRun = null;

const current = () => project.frames[active];
const currentGuide = () => active === 0 && trompGuide?.seed === current() ? trompGuide : null;
const tag = (index) => String(index + 1).padStart(2, '0');
const pressed = (el, state) => el.setAttribute('aria-pressed', state);
const enabled = (id, state) => { $(id).disabled = !state; };

function toast(message) {
  $('notice').textContent = message;
  $('notice').hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 2100);
}

function bounds(pixels) {
  if (!pixels.size) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const id of pixels.keys()) {
    const [x, y] = xy(id);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function centerFrame() {
  if (project.viewBounds) {
    fitCamera();
    return;
  }
  centerCanvas(currentGuide()?.box || frameBounds(current()));
}

function centerCanvas(box) {
  if (project.viewBounds) return;
  camera = { x: 0, y: 0, scale: 16 };
  if (box) {
    camera.x = (box.x0 + box.x1 + 1) / 2;
    camera.y = (box.y0 + box.y1 + 1) / 2;
    const fit = Math.min((screen.w - 44) / box.w, (screen.h - 45) / box.h);
    camera.scale = clamp(fit, 1 / 128, 16);
  }
  refreshView();
}

function fitCamera() {
  const box = project.viewBounds;
  camera = {
    x: (box.x0 + box.x1 + 1) / 2,
    y: (box.y0 + box.y1 + 1) / 2,
    scale: screen.w && screen.h ? Math.min(screen.w / box.w, screen.h / box.h) : 16,
  };
  refreshView();
}

function fitCurrentView() {
  if (project.viewBounds) return;
  finishGesture();
  const box = frameBounds(current());
  if (!box) {
    toast('当前帧没有可取景的像素');
    return;
  }
  project.viewBounds = box;
  fitCamera();
  storeProject();
}

function releaseView() {
  if (!project.viewBounds) return;
  delete project.viewBounds;
  refreshView();
  storeProject();
}

function resizeBoard() {
  const box = board.getBoundingClientRect();
  const first = !screen.w;
  screen = { w: box.width, h: box.height, dpr: window.devicePixelRatio || 1 };
  board.width = Math.round(screen.w * screen.dpr);
  board.height = Math.round(screen.h * screen.dpr);
  if (first || project.viewBounds) centerFrame();
  requestPaint();
}

function view() {
  const { w, h } = screen;
  const { x, y, scale } = camera;
  if (project.viewBounds) {
    const box = project.viewBounds;
    const clip = { w: box.w * scale, h: box.h * scale };
    clip.x = (w - clip.w) / 2;
    clip.y = (h - clip.h) / 2;
    return { w, h, scale, left: clip.x - box.x0 * scale, top: clip.y - box.y0 * scale, clip };
  }
  return { w, h, scale, left: w / 2 - x * scale, top: h / 2 - y * scale };
}

function position(event) {
  const rect = board.getBoundingClientRect();
  return { sx: event.clientX - rect.left, sy: event.clientY - rect.top };
}

function cellAt({ sx, sy }) {
  if (project.viewBounds) {
    const { clip, scale } = view();
    const { x0, y0 } = project.viewBounds;
    return { x: x0 + Math.floor((sx - clip.x) / scale), y: y0 + Math.floor((sy - clip.y) / scale) };
  }
  return {
    x: Math.floor(camera.x + (sx - screen.w / 2) / camera.scale),
    y: Math.floor(camera.y + (sy - screen.h / 2) / camera.scale),
  };
}

function insideView({ x, y }) {
  const box = project.viewBounds;
  return !box || (x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1);
}

function requestPaint() {
  if (paintPending) return;
  paintPending = true;
  requestAnimationFrame(() => {
    paintPending = false;
    paint();
  });
}

function paint() {
  const { w, h, scale, left, top, clip } = view();
  const dpr = screen.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = clip ? '#141424' : '#202036';
  ctx.fillRect(0, 0, w, h);
  if (clip) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(clip.x, clip.y, clip.w, clip.h);
    ctx.clip();
    ctx.fillStyle = '#202036';
    ctx.fillRect(clip.x, clip.y, clip.w, clip.h);
  }
  if (grid) {
    let group = 8;
    while (group * scale < 18) group *= 2;
    const drawGrid = (step, color) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 / dpr;
      for (let x = mod(left, step); x <= w; x += step) {
        const crisp = (Math.floor(x * dpr) + 0.5) / dpr;
        ctx.moveTo(crisp, 0); ctx.lineTo(crisp, h);
      }
      for (let y = mod(top, step); y <= h; y += step) {
        const crisp = (Math.floor(y * dpr) + 0.5) / dpr;
        ctx.moveTo(0, crisp); ctx.lineTo(w, crisp);
      }
      ctx.stroke();
    };
    if (scale >= 5) drawGrid(scale, '#2a2a42');
    drawGrid(scale * group, '#373650');
  }

  const minX = project.viewBounds?.x0 ?? Math.floor(-left / scale);
  const maxX = project.viewBounds?.x1 ?? Math.ceil((w - left) / scale);
  const minY = project.viewBounds?.y0 ?? Math.floor(-top / scale);
  const maxY = project.viewBounds?.y1 ?? Math.ceil((h - top) / scale);
  function rectangle(x0, y0, x1, y1, color) {
    ctx.fillStyle = color;
    const sx = Math.round((left + x0 * scale) * dpr) / dpr;
    const sy = Math.round((top + y0 * scale) * dpr) / dpr;
    const ex = Math.round((left + (x1 + 1) * scale) * dpr) / dpr;
    const ey = Math.round((top + (y1 + 1) * scale) * dpr) / dpr;
    ctx.fillRect(sx, sy, Math.max(ex - sx, 1 / dpr), Math.max(ey - sy, 1 / dpr));
  }
  function drawPixels(pixels, alpha) {
    ctx.globalAlpha = alpha;
    if (pixels.size > (maxX - minX + 1) * (maxY - minY + 1)) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const color = pixels.get(key(x, y));
          if (color) rectangle(x, y, x, y, color);
        }
      }
    } else {
      for (const [id, color] of pixels) {
        const [x, y] = xy(id);
        if (x >= minX && y >= minY && x <= maxX && y <= maxY) rectangle(x, y, x, y, color);
      }
    }
    ctx.globalAlpha = 1;
  }
  const guide = currentGuide();
  if (guide && !playState) drawPixels(guide.pixels, 0.43);
  if (onion && active && !playState) drawPixels(framePixels(project.frames[active - 1]), 0.27);
  const picture = current();
  if (picture.drawing) {
    Tromp.forEachLine(picture.drawing, (x0, y0, x1, y1, color) => {
      if (x0 <= maxX && x1 >= minX && y0 <= maxY && y1 >= minY) rectangle(x0, y0, x1, y1, color);
    });
  } else {
    drawPixels(picture.pixels, 1);
  }

  if (gesture?.kind === 'line') {
    const { anchor, end, color } = gesture;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(left + Math.min(anchor.x, end.x) * scale, top + Math.min(anchor.y, end.y) * scale,
      (Math.abs(anchor.x - end.x) + 1) * scale, (Math.abs(anchor.y - end.y) + 1) * scale);
    ctx.globalAlpha = 1;
  }

  if (selection && !playState) {
    const { x0, x1, y0, y1 } = selection;
    const x = left + x0 * scale, y = top + y0 * scale;
    const width = (x1 - x0 + 1) * scale, height = (y1 - y0 + 1) * scale;
    ctx.fillStyle = '#9c7bff32';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#e3d6ff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);
  }
  if (hover && tool !== 'pan' && !gesture && !playState && scale >= 4) {
    const { x, y } = cellAt(hover);
    if (insideView({ x, y })) {
      ctx.strokeStyle = '#e3d6ff99';
      ctx.lineWidth = 1;
      ctx.strokeRect(left + x * scale + 0.5, top + y * scale + 0.5, scale - 1, scale - 1);
    }
  }
  if (clip) {
    ctx.restore();
    ctx.strokeStyle = '#9080bf';
    ctx.lineWidth = 1 / dpr;
    ctx.strokeRect(clip.x - 0.5 / dpr, clip.y - 0.5 / dpr, clip.w + 1 / dpr, clip.h + 1 / dpr);
  }
}

function refreshView() {
  const percentage = camera.scale / 16 * 100;
  $('zoom-reset').textContent = (percentage < 10 ? percentage.toFixed(1) : Math.round(percentage)) + '%';
  const locked = Boolean(project.viewBounds);
  $('release-view').hidden = !locked;
  for (const id of ['fit-view', 'zoom-out', 'zoom-reset', 'zoom-in']) enabled(id, !locked);
  refreshCursor();
}

function refreshCursor() {
  const { x, y } = hover ? cellAt(hover) : { x: Math.floor(camera.x), y: Math.floor(camera.y) };
  $('coords').textContent = 'X ' + x + '   Y ' + y;
  requestPaint();
}

function zoom(factor, anchor = { sx: screen.w / 2, sy: screen.h / 2 }) {
  if (project.viewBounds) return;
  const dx = anchor.sx - screen.w / 2;
  const dy = anchor.sy - screen.h / 2;
  const next = clamp(camera.scale * factor, Math.min(1 / 128, camera.scale), Math.max(128, camera.scale));
  camera.x += dx / camera.scale - dx / next;
  camera.y += dy / camera.scale - dy / next;
  camera.scale = next;
  refreshView();
}

function refreshSelection() {
  $('selection-actions').hidden = !selection || Boolean(playState) || gesture?.kind === 'select';
  if (selection) {
    $('selection-size').textContent = (selection.x1 - selection.x0 + 1) + ' × ' + (selection.y1 - selection.y0 + 1);
  }
  enabled('paste', Boolean(clipboard));
  requestPaint();
}

function setTool(value) {
  tool = value;
  board.dataset.tool = value;
  document.querySelectorAll('[data-tool]:not(canvas)').forEach((button) => pressed(button, button.dataset.tool === value));
  requestPaint();
}

function setSelection(a, b) {
  selection = { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
  refreshSelection();
}

function writePixel(target, changes, x, y, value) {
  const id = key(x, y);
  const pixels = framePixels(target);
  const existing = pixels.get(id);
  if (existing === value) return;
  if (target.drawing) {
    target.pixels = new Map(pixels);
    delete target.drawing;
  }
  if (!changes.has(id)) changes.set(id, { before: existing, after: value });
  else changes.get(id).after = value;
  if (value === undefined) target.pixels.delete(id);
  else target.pixels.set(id, value);
}

function stroke(from, to, action) {
  let { x, y } = from;
  const dx = Math.abs(to.x - x), dy = -Math.abs(to.y - y);
  const sx = x < to.x ? 1 : -1, sy = y < to.y ? 1 : -1;
  let error = dx + dy;
  // At extreme zoom-out, limit the cells one pointer sample can add.
  for (let i = 0; i < 30000; i++) {
    action(x, y);
    if (x === to.x && y === to.y) return;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
  action(to.x, to.y);
}

function changePixels(target, changes) {
  if (!changes.size) return;
  const apply = (side) => {
    for (const [id, change] of changes) {
      if (change[side] === undefined) target.pixels.delete(id);
      else target.pixels.set(id, change[side]);
    }
    return project.frames.indexOf(target);
  };
  record(() => apply('before'), () => apply('after'));
  updateThumbnail(active);
  refreshActive();
}

function updatePointer(event) {
  const pos = position(event);
  hover = pos;
  refreshCursor();
  if (!gesture || gesture.id !== event.pointerId) return;
  if (gesture.kind === 'pan') {
    camera.x = gesture.camera.x - (pos.sx - gesture.start.sx) / camera.scale;
    camera.y = gesture.camera.y - (pos.sy - gesture.start.sy) / camera.scale;
    refreshCursor();
    return;
  }
  const point = cellAt(pos);
  const box = project.viewBounds;
  if (box) {
    point.x = clamp(point.x, box.x0, box.x1);
    point.y = clamp(point.y, box.y0, box.y1);
  }
  if (gesture.kind === 'select') {
    setSelection(gesture.anchor, point);
  } else if (gesture.kind === 'line') {
    const { anchor } = gesture;
    gesture.end = Math.abs(point.x - anchor.x) >= Math.abs(point.y - anchor.y)
      ? { x: point.x, y: anchor.y }
      : { x: anchor.x, y: point.y };
  } else {
    stroke(gesture.previous, point, (x, y) => writePixel(gesture.target, gesture.changes, x, y, gesture.color));
    gesture.previous = point;
    updatePixelCount();
  }
}

function finishGesture() {
  if (!gesture) return;
  const done = gesture;
  gesture = null;
  delete board.dataset.drag;
  if (board.hasPointerCapture(done.id)) board.releasePointerCapture(done.id);
  if (done.kind === 'line') {
    stroke(done.anchor, done.end, (x, y) => writePixel(done.target, done.changes, x, y, done.color));
  }
  if (done.changes) changePixels(done.target, done.changes);
  refreshSelection();
}

board.addEventListener('contextmenu', (event) => event.preventDefault());
board.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || gesture) return;
  event.preventDefault();
  const panning = event.button === 1 || (event.button === 0 && tool === 'pan' && !event.shiftKey);
  if (panning && project.viewBounds) return;
  board.focus({ preventScroll: true });
  stopPlayback();
  const start = position(event);
  const point = cellAt(start);
  hover = start;
  if (!panning && !insideView(point)) return;
  if (panning) {
    gesture = { kind: 'pan', start, camera: { ...camera }, id: event.pointerId };
  } else if (event.button === 0 && (event.shiftKey || tool === 'select')) {
    gesture = { kind: 'select', anchor: point, id: event.pointerId };
    setSelection(point, point);
  } else if (event.button === 0 && tool === 'pick') {
    const id = key(point.x, point.y);
    const color = framePixels(current()).get(id) || currentGuide()?.pixels.get(id);
    if (color) setColor(color);
    refreshCursor();
    return;
  } else if (event.button === 0 && tool === 'line') {
    selection = null;
    gesture = {
      kind: 'line', id: event.pointerId, target: current(), changes: new Map(),
      anchor: point, end: point, color: currentColor,
    };
    refreshSelection();
  } else if (event.button === 0 || event.button === 2) {
    selection = null;
    refreshSelection();
    gesture = {
      kind: 'stroke', id: event.pointerId, target: current(), changes: new Map(), previous: point,
      color: event.button === 2 || tool === 'erase' ? undefined : currentColor,
    };
  } else {
    return;
  }
  board.dataset.drag = gesture.kind;
  board.setPointerCapture(event.pointerId);
  updatePointer(event);
});
board.addEventListener('pointermove', updatePointer);
board.addEventListener('pointerup', (event) => {
  if (gesture?.id !== event.pointerId) return;
  updatePointer(event);
  finishGesture();
});
board.addEventListener('pointercancel', finishGesture);
board.addEventListener('lostpointercapture', finishGesture);
board.addEventListener('pointerleave', () => { if (!gesture) requestPaint(); });
board.addEventListener('wheel', (event) => {
  event.preventDefault();
  if (gesture) return;
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? screen.h : 1);
  hover = position(event);
  zoom(Math.exp(clamp(-delta * 0.002, -1, 1)), hover);
}, { passive: false });

function selectedPixels() {
  if (!selection) return [];
  const { x0, y0, x1, y1 } = selection;
  const pixels = [];
  for (const [id, color] of framePixels(current())) {
    const [x, y] = xy(id);
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) pixels.push([x, y, color]);
  }
  return pixels;
}

function copySelection(cut = false) {
  if (!selection || gesture || playState) return;
  const pixels = selectedPixels();
  if (!pixels.length) return toast('选区内没有像素');
  const { x0, y0, x1, y1 } = selection;
  clipboard = { w: x1 - x0 + 1, h: y1 - y0 + 1, pixels: pixels.map(([x, y, color]) => [x - x0, y - y0, color]) };
  lastPaste = null;
  if (cut) clearSelection(pixels);
  refreshSelection();
  toast((cut ? '已剪切 ' : '已复制 ') + pixels.length + ' 个像素');
}

function clearSelection(pixels = selectedPixels()) {
  if (!selection || gesture || playState) return;
  const changes = new Map();
  const target = current();
  for (const [x, y] of pixels) writePixel(target, changes, x, y, undefined);
  changePixels(target, changes);
}

function pastePixels() {
  if (!clipboard || gesture || playState) return;
  const pointer = hover && cellAt(hover);
  const at = pointer && insideView(pointer) ? pointer : { x: Math.floor(camera.x), y: Math.floor(camera.y) };
  const target = current();
  const repeated = lastPaste?.target === target && lastPaste.x === at.x && lastPaste.y === at.y;
  const step = repeated ? lastPaste.step + 1 : 0;
  const x = at.x + step * (clipboard.w + 1), y = at.y;
  lastPaste = { target, ...at, step };
  const changes = new Map();
  for (const [dx, dy, color] of clipboard.pixels) writePixel(target, changes, x + dx, y + dy, color);
  setSelection({ x, y }, { x: x + clipboard.w - 1, y: y + clipboard.h - 1 });
  changePixels(target, changes);
}

function record(undo, redo) {
  history.push({ undo, redo });
  if (history.length > 60) history.shift();
  future = [];
  refreshHistory();
  storeProject();
}

function refreshHistory() {
  enabled('undo', history.length > 0);
  enabled('redo', future.length > 0);
}

function restore(reverse) {
  const from = reverse ? history : future;
  const to = reverse ? future : history;
  if (gesture || !from.length) return;
  stopPlayback();
  const entry = from.pop();
  const index = reverse ? entry.undo() : entry.redo();
  active = clamp(index, 0, project.frames.length - 1);
  selection = null;
  lastPaste = null;
  to.push(entry);
  refreshHistory();
  renderFrames();
  storeProject();
}

function drawThumbnail(canvas, picture) {
  const preview = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  preview.fillStyle = '#242239';
  preview.fillRect(0, 0, w, h);
  const box = frameBounds(picture);
  if (!box) return;
  const scale = Math.min((w - 10) / box.w, (h - 7) / box.h, 9);
  const size = scale >= 1 ? Math.floor(scale) : scale;
  const left = Math.floor((w - box.w * size) / 2), top = Math.floor((h - box.h * size) / 2);
  function drawLine(x0, y0, x1, y1, color) {
    const x = Math.floor(left + (x0 - box.x0) * size);
    const y = Math.floor(top + (y0 - box.y0) * size);
    const right = Math.floor(left + (x1 - box.x0) * size);
    const bottom = Math.floor(top + (y1 - box.y0) * size);
    preview.fillStyle = color;
    preview.fillRect(x, y, right - x + Math.max(1, size), bottom - y + Math.max(1, size));
  }
  if (picture.drawing) {
    Tromp.forEachLine(picture.drawing, drawLine);
  } else {
    for (const [id, color] of picture.pixels) {
      const [x, y] = xy(id);
      drawLine(x, y, x, y, color);
    }
  }
}

const thumbnailObserver = new IntersectionObserver((entries) => {
  const row = $('frames');
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const tile = entry.target, index = Number(tile.dataset.index);
    thumbnailObserver.unobserve(tile);
    if (row.children[index] !== tile) continue;
    drawThumbnail(tile.firstElementChild, project.frames[index]);
    tile.dataset.painted = 'true';
  }
}, { root: $('frames'), rootMargin: '0px 108px' });

function updateThumbnail(index) {
  const tile = $('frames').children[index];
  if (!tile?.firstElementChild || !project.frames[index]) return;
  const picture = project.frames[index];
  if (tile.dataset.painted) drawThumbnail(tile.firstElementChild, picture);
  else thumbnailObserver.observe(tile);
  tile.querySelector('.frame-index').textContent = tag(index) + (picture.lambda ? ' · β' + picture.lambda.step : '');
  tile.title = picture.lambda ? '生成时表达式 · ' + picture.lambda.expression : '';
  updateFrameTiming(index);
}

function updateFrameTiming(index) {
  const tile = $('frames').children[index], picture = project.frames[index];
  const duration = durationLabel(picture.duration);
  tile.querySelector('small').textContent = duration + ' ms';
  const step = picture.lambda ? '，β 归约第 ' + picture.lambda.step + ' 步' : '';
  tile.setAttribute('aria-label', '第 ' + (index + 1) + ' 帧，' + duration + ' 毫秒' + step);
}

function renderFrames() {
  const row = $('frames');
  thumbnailObserver.disconnect();
  const scroll = row.scrollLeft;
  const tiles = project.frames.map((_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'frame';
    button.dataset.index = index;
    button.innerHTML = '<canvas width="96" height="63" aria-hidden="true"></canvas><span><b class="frame-index"></b><small></small></span>';
    button.addEventListener('click', () => selectFrame(index));
    return button;
  });
  const add = document.createElement('button');
  add.className = 'add-tile';
  add.innerHTML = icon('plus') + '空白帧';
  add.addEventListener('click', () => addFrame(false));
  row.replaceChildren(...tiles, add);
  row.scrollLeft = scroll;
  tiles.forEach((_, index) => updateThumbnail(index));
  refreshActive(true);
}

function refreshActive(reveal = false) {
  const row = $('frames');
  row.querySelector('[aria-current=true]')?.removeAttribute('aria-current');
  const tile = row.children[active];
  if (tile) {
    tile.setAttribute('aria-current', 'true');
    if (reveal) {
      if (tile.offsetLeft < row.scrollLeft + 8) row.scrollLeft = tile.offsetLeft - 8;
      if (tile.offsetLeft + tile.offsetWidth > row.scrollLeft + row.clientWidth - 8) {
        row.scrollLeft = tile.offsetLeft + tile.offsetWidth - row.clientWidth + 8;
      }
    }
  }
  const frameLabel = tag(active) + ' / ' + String(project.frames.length).padStart(2, '0');
  $('frame-total').textContent = project.frames.length + ' 帧';
  $('frame-number').textContent = tag(active);
  $('stage-frame').textContent = 'FRAME ' + frameLabel;
  $('hide-tromp-guide').hidden = !currentGuide() || Boolean(playState);
  const expression = current().lambda;
  $('lambda-term').hidden = !expression;
  $('lambda-term').textContent = expression ? 'β' + expression.step + ' · ' + expression.expression : '';
  $('lambda-term').title = expression ? '生成时表达式 · ' + expression.expression : '';
  updatePixelCount();
  $('duration').value = durationLabel(current().duration);
  enabled('duration', !playState);
  enabled('from-previous', active > 0 && !playState);
  enabled('prev', active > 0);
  enabled('next', active < project.frames.length - 1);
  enabled('remove-frame', project.frames.length > 1);
  refreshSelection();
  updateTime();
}

function selectFrame(index) {
  finishGesture();
  stopPlayback();
  active = clamp(index, 0, project.frames.length - 1);
  selection = null;
  lastPaste = null;
  refreshActive(true);
}

function insertFrames(newFrames) {
  finishGesture();
  stopPlayback();
  const before = active, index = active + 1;
  const add = () => { project.frames.splice(index, 0, ...newFrames); return index; };
  const remove = () => { project.frames.splice(index, newFrames.length); return before; };
  active = add();
  selection = null;
  lastPaste = null;
  record(remove, add);
  renderFrames();
}

function addFrame(duplicate) {
  insertFrames([duplicate ? { ...copyFrameImage(current()), duration: current().duration }
    : frame(undefined, project.defaultFrameDuration)]);
}

function openLambda() {
  finishGesture();
  stopPlayback();
  if (active !== 0) selectFrame(0);
  $('lambda-status').textContent = '';
  $('lambda-dialog').showModal();
}

function makeTrompGuide(source, allowFree) {
  const diagram = Tromp.guide(source, { allowFree });
  const shape = bounds(diagram);
  const art = frameBounds(current());
  const x = (art ? art.x1 + 6 : Math.floor(camera.x - shape.w / 2)) - shape.x0;
  const y = (art ? art.y0 : Math.floor(camera.y - shape.h / 2)) - shape.y0;
  const pixels = new Map();
  for (const [id, color] of diagram) {
    const [dx, dy] = xy(id);
    pixels.set(key(x + dx, y + dy), color);
  }
  return { pixels, box: bounds(pixels), seed: current(), source, allowFree };
}

function hasPixelsOutsideGuide(guide) {
  const { x0, y0, x1, y1 } = guide.box;
  for (const id of framePixels(current()).keys()) {
    const [x, y] = xy(id);
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && !guide.pixels.has(id)) return true;
  }
  return false;
}

function placeTrompGuide(writeToFrame) {
  const source = $('tromp-source').value.trim();
  const allowFree = $('lambda-free').checked;
  try {
    let guide = currentGuide();
    if (guide?.source !== source || guide?.allowFree !== allowFree || (writeToFrame && hasPixelsOutsideGuide(guide))) {
      guide = makeTrompGuide(source, allowFree);
    }
    if (writeToFrame) {
      const target = current();
      const changes = new Map();
      for (const [id, color] of guide.pixels) {
        if (framePixels(target).has(id)) continue;
        const [x, y] = xy(id);
        writePixel(target, changes, x, y, color);
      }
      const { x0, y0, x1, y1 } = guide.box;
      selection = { x0, y0, x1, y1 };
      lastPaste = null;
      trompGuide = null;
      if (changes.size) changePixels(target, changes);
      else refreshActive();
    } else {
      trompGuide = guide;
      selection = null;
      setTool('line');
      refreshActive();
    }
    centerCanvas(guide.box);
    $('lambda-dialog').close();
    board.focus({ preventScroll: true });
    toast(writeToFrame ? '已在第 1 帧生成可编辑底稿' : '沿底稿拖动左键，画出横线和竖线');
  } catch (error) {
    $('lambda-status').textContent = error.message;
  }
}

function closeLambda() {
  if (trompRun) {
    trompRun.stop = true;
    $('lambda-status').textContent = '正在停止归约…';
  } else {
    $('lambda-dialog').close();
  }
}

function setLambdaRunning(running) {
  for (const id of ['show-tromp-guide', 'draw-tromp-guide', 'generate-lambda-frames',
    'tromp-source', 'lambda-free', 'lambda-limit', 'lambda-duration']) enabled(id, !running);
  $('close-lambda').textContent = running ? '停止并保留' : '关闭';
}

async function generateTromp(event) {
  event.preventDefault();
  if (trompRun) return;
  const run = { stop: false };
  trompRun = run;
  setLambdaRunning(true);
  $('lambda-status').textContent = '正在生成归约帧…';
  try {
    const area = selection || currentGuide()?.box;
    let pixels = framePixels(current());
    if (area) {
      const { x0, y0, x1, y1 } = area;
      const selected = new Map();
      for (const [id, color] of pixels) {
        const [x, y] = xy(id);
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) selected.set(id, color);
      }
      pixels = selected;
    }
    const sequence = Tromp.reductionFrames(pixels, $('lambda-limit').valueAsNumber || Infinity, {
      allowFree: $('lambda-free').checked, compact: true,
    });
    const inputDuration = $('lambda-duration').valueAsNumber;
    const defaultDuration = project.defaultFrameDuration;
    const duration = defaultDuration !== undefined && inputDuration === durationLabel(defaultDuration)
      ? defaultDuration : inputDuration;
    const frames = [];
    let result, deadline = performance.now() + 8;
    while (!run.stop) {
      result = sequence.next();
      if (result.done) break;
      const { drawing, step, expression } = result.value;
      frames.push({ drawing, duration, lambda: { step, expression } });
      if (performance.now() >= deadline) {
        $('lambda-status').textContent = '已生成 ' + frames.length + ' 帧…';
        await new Promise((resolve) => setTimeout(resolve, 0));
        deadline = performance.now() + 8;
      }
    }
    if (run.stop) sequence.return();
    const reason = run.stop ? 'stopped' : result.value;
    const ending = {
      normal: '已到达 β 正规形',
      cycle: '检测到归约重复',
      limit: '已达到设定步数',
      size: '自动归约达到 512 节点上限',
      capacity: '浏览器无法继续展开线路',
      stopped: '已停止归约',
    }[reason];
    if (!frames.length) {
      $('lambda-status').textContent = ending + '，没有新增帧。';
      return;
    }
    trompGuide = null;
    insertFrames(frames);
    $('lambda-dialog').close();
    toast('已生成 ' + frames.length + ' 帧 · ' + ending);
  } catch (error) {
    $('lambda-status').textContent = error.message;
  } finally {
    trompRun = null;
    setLambdaRunning(false);
  }
}

function deleteFrame() {
  if (project.frames.length <= 1) return;
  finishGesture();
  stopPlayback();
  const index = active, target = current();
  const remove = () => { project.frames.splice(index, 1); return Math.min(index, project.frames.length - 1); };
  const add = () => { project.frames.splice(index, 0, target); return index; };
  active = remove();
  selection = null;
  lastPaste = null;
  record(add, remove);
  renderFrames();
}

function copyPrevious() {
  if (!active) return;
  const target = current();
  const before = target.drawing ? { drawing: target.drawing } : { pixels: target.pixels };
  const after = copyFrameImage(project.frames[active - 1]);
  const apply = (image) => {
    delete target.pixels;
    delete target.drawing;
    Object.assign(target, image);
    return project.frames.indexOf(target);
  };
  apply(after);
  selection = null;
  record(() => apply(before), () => apply(after));
  updateThumbnail(active);
  refreshActive();
  toast('已复制上一帧的画面');
}

function changeDuration() {
  const target = current(), before = target.duration;
  const value = $('duration').valueAsNumber;
  const after = Number.isFinite(value) ? clamp(value, 1, maxFrameDuration) : before;
  if (before !== after) {
    const apply = (value) => { target.duration = value; return project.frames.indexOf(target); };
    apply(after);
    record(() => apply(before), () => apply(after));
    updateFrameTiming(active);
  }
  refreshActive();
}

function resetLambdaDuration() {
  const input = $('lambda-duration');
  input.value = project.defaultFrameDuration === undefined
    ? input.defaultValue : durationLabel(project.defaultFrameDuration);
}

function unifyFrameDurations() {
  finishGesture();
  stopPlayback();
  const target = project;
  const index = active;
  const frames = target.frames.slice();
  const previousDefault = target.defaultFrameDuration;
  const previousDurations = frames.map((item) => item.duration);
  const previousLambdaDuration = $('lambda-duration').value;
  const duration = current().duration;
  if (previousDefault !== duration || previousDurations.some((value) => value !== duration)) {
    const apply = (defaultFrameDuration, durations, lambdaDuration) => {
      target.defaultFrameDuration = defaultFrameDuration;
      frames.forEach((item, i) => { item.duration = durations[i]; });
      $('lambda-duration').value = lambdaDuration;
      return index;
    };
    const uniformDurations = frames.map(() => duration);
    const redo = () => apply(duration, uniformDurations, durationLabel(duration));
    const undo = () => apply(previousDefault, previousDurations, previousLambdaDuration);
    redo();
    record(undo, redo);
    frames.forEach((_, i) => updateFrameTiming(i));
    refreshActive();
  }
  toast('已将 ' + frames.length + ' 帧设为每帧 ' + durationLabel(duration) + ' ms');
}

function timeLabel(ms) {
  const centiseconds = Math.round(ms / 10);
  const m = Math.floor(centiseconds / 6000);
  const s = Math.floor(centiseconds / 100) % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(centiseconds % 100).padStart(2, '0');
}

function updateTime() {
  let elapsed = 0, total = 0;
  if (playState) {
    ({ elapsed, total } = playState);
  } else {
    project.frames.forEach((item, i) => {
      if (i < active) elapsed += item.duration;
      total += item.duration;
    });
  }
  $('timecode').textContent = timeLabel(elapsed) + ' / ' + timeLabel(total);
}

function stopPlayback(reveal = false) {
  if (!playState) return;
  cancelAnimationFrame(playState.id);
  playState = null;
  $('play').innerHTML = icon('play');
  $('play').setAttribute('aria-label', '播放');
  refreshActive(reveal);
}

function togglePlayback() {
  if (playState) return stopPlayback();
  finishGesture();
  const mode = project.playbackMode;
  const count = project.frames.length;
  const order = project.frames.map((_, index) => index);
  if (mode === 'ping-pong') {
    for (let index = count - 2; index > 0; index--) order.push(index);
  }
  let cycleDuration = 0;
  const starts = order.map((index) => {
    const start = cycleDuration;
    cycleDuration += project.frames[index].duration;
    return start;
  });
  const total = starts[count] ?? cycleDuration;
  if (mode === 'once' && active === count - 1) active = 0;
  const offset = starts[active];
  const started = performance.now();
  playState = { id: 0, total, elapsed: offset };
  $('play').innerHTML = icon('pause');
  $('play').setAttribute('aria-label', '暂停');
  refreshActive(true);
  requestPaint();
  function tick(now) {
    const elapsed = Math.max(0, now - started) + offset;
    if (mode === 'once' && elapsed >= total) {
      active = count - 1;
      stopPlayback(true);
      const endTime = timeLabel(total);
      $('timecode').textContent = endTime + ' / ' + endTime;
      return;
    }
    const position = mode === 'once' ? elapsed : elapsed % cycleDuration;
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const middle = Math.ceil((lo + hi) / 2);
      if (starts[middle] <= position) lo = middle;
      else hi = middle - 1;
    }
    const index = order[lo];
    playState.elapsed = lo < count ? position
      : starts[index] + project.frames[index].duration - (position - starts[lo]);
    if (active !== index) {
      active = index;
      refreshActive(true);
    } else {
      updateTime();
    }
    playState.id = requestAnimationFrame(tick);
  }
  playState.id = requestAnimationFrame(tick);
}

function changePlaybackMode() {
  const wasPlaying = Boolean(playState);
  stopPlayback();
  project.playbackMode = readPlaybackMode($('playback-mode').value);
  storeProject();
  if (wasPlaying) togglePlayback();
}

function toRgb(hex) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function toHex(rgb) {
  return '#' + rgb.map((value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0')).join('');
}

function rgbToHsv(rgb, previousHue = 0) {
  const [r, g, b] = rgb.map((value) => value / 255);
  const v = Math.max(r, g, b);
  const c = v - Math.min(r, g, b);
  let h = previousHue;
  if (c) {
    if (v === r) h = 60 * mod((g - b) / c, 6);
    else if (v === g) h = 60 * ((b - r) / c + 2);
    else h = 60 * ((r - g) / c + 4);
  }
  return [h, v ? c / v : 0, v];
}

function hsvToRgb([h, s, v]) {
  const c = s * v;
  const x = c * (1 - Math.abs(mod(h / 60, 2) - 1));
  const sectors = [[c,x,0], [x,c,0], [0,c,x], [0,x,c], [x,0,c], [c,0,x]];
  return sectors[Math.floor(mod(h, 360) / 60)].map((value) => 255 * (value + v - c));
}

function rgbToCmyk(rgb) {
  const k = 1 - Math.max(...rgb) / 255;
  return k === 1 ? [0,0,0,100] : [...rgb.map((value) => 100 * (1 - value / 255 - k) / (1 - k)), 100 * k];
}

function setColor(hex, exactHsv, keepCmyk = false) {
  if (!colorPattern.test(hex)) return;
  currentColor = hex.toLowerCase();
  hsv = exactHsv || rgbToHsv(toRgb(currentColor), hsv[0]);
  refreshColor(!keepCmyk);
}

function setHsv(values) {
  setColor(toHex(hsvToRgb(values)), values);
}

function makeChannels() {
  const definitions = {
    HSV: [['H', 359, '色相（度）'], ['S', 100, '饱和度（%）'], ['V', 100, '明度（%）']],
    RGB: [['R', 255, '红'], ['G', 255, '绿'], ['B', 255, '蓝']],
    CMYK: [['C', 100, '青（%）'], ['M', 100, '品红（%）'], ['Y', 100, '黄（%）'], ['K', 100, '黑（%）']],
  };
  const labels = definitions[mode].map(([letter, max, name], index) => {
    const label = document.createElement('label');
    label.textContent = letter;
    const field = document.createElement('input');
    field.type = 'number';
    field.min = '0';
    field.max = String(max);
    field.step = '1';
    field.setAttribute('aria-label', name);
    field.addEventListener('change', () => {
      if (!Number.isFinite(field.valueAsNumber)) return refreshColor();
      const value = clamp(field.valueAsNumber, 0, max);
      if (mode === 'HSV') {
        const updated = [...hsv];
        updated[index] = index ? value / 100 : value;
        setHsv(updated);
      } else if (mode === 'RGB') {
        const updated = toRgb(currentColor);
        updated[index] = value;
        setColor(toHex(updated));
      } else {
        cmyk[index] = value;
        const [c, m, y, k] = cmyk.map((n) => n / 100);
        setColor(toHex([c, m, y].map((n) => 255 * (1 - n) * (1 - k))), undefined, true);
      }
    });
    field.addEventListener('keydown', (event) => { if (event.key === 'Enter') field.blur(); });
    label.append(field);
    return label;
  });
  $('channels').replaceChildren(...labels);
  document.querySelectorAll('[data-mode]').forEach((button) => pressed(button, button.dataset.mode === mode));
  refreshColor(false);
}

let cmyk = rgbToCmyk(toRgb(currentColor));

function refreshColor(recalculateCmyk = true) {
  const [h, s, v] = hsv;
  $('hue').value = Math.min(359, Math.round(h));
  $('sv').style.setProperty('--hue', 'hsl(' + h + ' 100% 50%)');
  $('color-point').style.left = (s * 100) + '%';
  $('color-point').style.top = ((1 - v) * 100) + '%';
  $('hex').value = currentColor.toUpperCase();
  $('color-swatch').value = currentColor;
  const rgb = toRgb(currentColor);
  if (recalculateCmyk) cmyk = rgbToCmyk(rgb);
  const values = { HSV: [Math.min(359, h), s * 100, v * 100], RGB: rgb, CMYK: cmyk }[mode];
  $('channels').querySelectorAll('input').forEach((field, index) => { field.value = Math.round(values[index]); });
  $('palette').querySelectorAll('button').forEach((button) => pressed(button, button.dataset.color === currentColor));
}

function renderPalette() {
  $('palette').replaceChildren(...project.palette.map((hex) => {
    const button = document.createElement('button');
    button.dataset.color = hex;
    button.style.setProperty('--swatch', hex);
    button.title = hex.toUpperCase();
    button.setAttribute('aria-label', hex.toUpperCase());
    pressed(button, hex === currentColor);
    button.addEventListener('click', () => setColor(hex));
    return button;
  }));
}

function pickSv(event) {
  const box = $('sv').getBoundingClientRect();
  setHsv([hsv[0], clamp((event.clientX - box.left) / box.width, 0, 1), clamp(1 - (event.clientY - box.top) / box.height, 0, 1)]);
}

function packDrawing(drawing) {
  const bytes = new Uint8Array(drawing.lines.buffer);
  let data;
  if (typeof bytes.toBase64 === 'function') {
    data = bytes.toBase64();
  } else {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    data = btoa(binary);
  }
  return { origin: drawing.origin, colors: drawing.colors, data };
}

function unpackDrawing(value) {
  const invalid = () => new Error('项目包含无效的线路帧。');
  const { origin, colors, data } = value;
  if (!Number.isSafeInteger(origin?.x) || !Number.isSafeInteger(origin?.y) ||
      !Array.isArray(colors) || !colors.length ||
      colors.some((color) => typeof color !== 'string' || !colorPattern.test(color)) ||
      typeof data !== 'string') throw invalid();
  let bytes;
  try {
    bytes = typeof Uint8Array.fromBase64 === 'function' ? Uint8Array.fromBase64(data)
      : Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  } catch {
    throw invalid();
  }
  if (!bytes.length || bytes.length % 20) throw invalid();
  const lines = new Int32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  for (let i = 0; i < lines.length; i += 5) {
    const x0 = lines[i] + origin.x, y0 = lines[i + 1] + origin.y;
    const x1 = lines[i + 2] + origin.x, y1 = lines[i + 3] + origin.y;
    if (![x0, y0, x1, y1].every(Number.isSafeInteger) || x0 > x1 || y0 > y1 ||
        (x0 !== x1 && y0 !== y1) || lines[i + 4] < 0 || lines[i + 4] >= colors.length) throw invalid();
  }
  return { origin, colors, lines };
}

function projectData() {
  return {
    format: 'pixel-frame', version: 1, name: project.name, palette: [...project.palette],
    defaultFrameDuration: project.defaultFrameDuration, playbackMode: project.playbackMode,
    viewBounds: project.viewBounds,
    frames: project.frames.map(({ pixels, drawing, duration, lambda }) => (
      drawing ? { drawing: packDrawing(drawing), duration, lambda } : { pixels: [...pixels], duration, lambda }
    )),
  };
}

function readDefaultFrameDuration(data) {
  if (validFrameDuration(data.defaultFrameDuration)) return data.defaultFrameDuration;
  const legacyDuration = typeof data.frameRate === 'number' ? 1000 / data.frameRate : NaN;
  return validFrameDuration(legacyDuration) ? legacyDuration : undefined;
}

function readViewBounds(box) {
  if (!box) return undefined;
  const { x0, y0, x1, y1 } = box;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  if (![x0, y0, x1, y1, w, h].every(Number.isSafeInteger) || w < 1 || h < 1) return undefined;
  return { x0, y0, x1, y1, w, h };
}

function parseProject(data) {
  if (data?.format !== 'pixel-frame' || data.version !== 1 || !Array.isArray(data.frames) || !data.frames.length) {
    throw new Error('文件不是有效的像素帧项目。');
  }
  const frames = data.frames.map((item) => {
    if (!item || !validFrameDuration(item.duration)) {
      throw new Error('项目包含无法读取的帧。');
    }
    const info = item.lambda;
    const lambda = Number.isInteger(info?.step) && info.step > 0 && typeof info.expression === 'string'
      ? { step: info.step, expression: info.expression } : undefined;
    if (item.drawing) return { drawing: unpackDrawing(item.drawing), duration: item.duration, lambda };
    if (!Array.isArray(item.pixels)) throw new Error('项目包含无法读取的帧。');
    const pixels = new Map();
    for (const entry of item.pixels) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !/^-?\d+,-?\d+$/.test(entry[0]) ||
          !xy(entry[0]).every(Number.isSafeInteger) || typeof entry[1] !== 'string' || !colorPattern.test(entry[1])) {
        throw new Error('项目包含无效的像素坐标或颜色。');
      }
      pixels.set(key(...xy(entry[0])), entry[1].toLowerCase());
    }
    return frame(pixels, item.duration, lambda);
  });
  const palette = Array.isArray(data.palette)
    ? [...new Set(data.palette.filter((color) => typeof color === 'string' && colorPattern.test(color)).map((color) => color.toLowerCase()))]
    : [...initialPalette];
  return {
    name: String(data.name || '未命名像素画').slice(0, 80), frames, palette,
    defaultFrameDuration: readDefaultFrameDuration(data), playbackMode: readPlaybackMode(data.playbackMode),
    viewBounds: readViewBounds(data.viewBounds),
  };
}

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('pixel-frame', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function storeProject() {
  revision++;
  try {
    const db = await openDatabase();
    const transaction = db.transaction('projects', 'readwrite');
    transaction.objectStore('projects').put(project, 'latest');
    transaction.onerror = () => { toast('自动保存失败，可手动保存项目文件'); };
  } catch {
    toast('自动保存不可用，可手动保存项目文件');
  }
}

function replaceProject(next, save = true) {
  finishGesture();
  stopPlayback();
  project = next;
  project.defaultFrameDuration = readDefaultFrameDuration(next);
  project.playbackMode = readPlaybackMode(next.playbackMode);
  project.viewBounds = readViewBounds(next.viewBounds);
  $('playback-mode').value = project.playbackMode;
  delete project.frameRate;
  active = 0;
  selection = null;
  trompGuide = null;
  lastPaste = null;
  history = [];
  future = [];
  $('project-name').value = project.name;
  resetLambdaDuration();
  renderPalette();
  renderFrames();
  refreshHistory();
  centerFrame();
  if (save) storeProject();
}

async function loadLastProject() {
  try {
    const db = await openDatabase();
    const request = db.transaction('projects').objectStore('projects').get('latest');
    request.onsuccess = () => {
      if (request.result && revision === 0 && !gesture) replaceProject(request.result, false);
    };
  } catch {
    // The project file actions also work when browser storage is unavailable.
  }
}

function downloadProject() {
  finishGesture();
  const blob = new Blob([JSON.stringify(projectData())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = project.name.replace(/[<>:"/\\|?*]/g, '_') + '.pixelframe.json';
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function waitMedia(video, eventName, signal, action) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const done = () => { cleanup(); resolve(); };
    const failure = () => { cleanup(); reject(new Error('浏览器无法读取该视频，请尝试 MP4 或 WebM 视频。')); };
    const abort = () => { cleanup(); reject(signal.reason); };
    const timer = setTimeout(failure, 12000);
    function cleanup() {
      clearTimeout(timer);
      video.removeEventListener(eventName, done);
      video.removeEventListener('error', failure);
      signal.removeEventListener('abort', abort);
    }
    video.addEventListener(eventName, done, { once: true });
    video.addEventListener('error', failure, { once: true });
    signal.addEventListener('abort', abort, { once: true });
    try { action?.(); } catch (error) { cleanup(); reject(error); }
  });
}

let importController;

async function importVideo(event) {
  event.preventDefault();
  if (importController) return;
  const file = $('video-file').files[0];
  if (!file) return;
  const controller = new AbortController();
  importController = controller;
  const { signal } = controller;
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  const url = URL.createObjectURL(file);
  const status = $('video-status');
  status.textContent = '正在读取视频…';
  enabled('import-video', false);
  try {
    await waitMedia(video, 'loadeddata', signal, () => { video.src = url; });
    if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth || !video.videoHeight) {
      throw new Error('未能读取视频的尺寸或时长。');
    }
    const edge = $('video-size').valueAsNumber, fps = $('video-fps').valueAsNumber;
    const scale = Math.min(1, edge / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.max(1, Math.round(video.videoWidth * scale));
    const h = Math.max(1, Math.round(video.videoHeight * scale));
    const frames = Math.ceil(video.duration * fps);
    if (frames > 300 || frames * w * h > 1800000) {
      throw new Error('这个片段的像素帧太多，请降低取样帧率、缩小最大边长，或使用较短的视频。');
    }
    const x0 = Math.floor(camera.x - w / 2), y0 = Math.floor(camera.y - h / 2);
    const image = document.createElement('canvas');
    image.width = w;
    image.height = h;
    const pixels = image.getContext('2d', { willReadFrequently: true });
    const imported = [];
    for (let index = 0; index < frames; index++) {
      signal.throwIfAborted();
      status.textContent = '正在提取 ' + (index + 1) + ' / ' + frames + ' 帧…';
      if (index) await waitMedia(video, 'seeked', signal, () => { video.currentTime = index / fps; });
      pixels.clearRect(0, 0, w, h);
      pixels.drawImage(video, 0, 0, w, h);
      const rgba = pixels.getImageData(0, 0, w, h).data;
      const map = new Map();
      for (let offset = 0; offset < rgba.length; offset += 4) {
        if (!rgba[offset + 3]) continue;
        const at = offset / 4;
        map.set(key(x0 + at % w, y0 + Math.floor(at / w)), toHex([rgba[offset], rgba[offset + 1], rgba[offset + 2]]));
      }
      const duration = Math.round(Math.min(video.duration, (index + 1) / fps) * 1000) - Math.round(index * 1000 / fps);
      imported.push(frame(map, Math.max(1, duration)));
    }
    insertFrames(imported);
    centerFrame();
    $('video-dialog').close();
    toast('已导入 ' + imported.length + ' 帧');
  } catch (error) {
    if (signal.aborted) $('video-dialog').close();
    else status.textContent = error.message;
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
    importController = null;
    enabled('import-video', true);
  }
}

function bind(id, action) { $(id).addEventListener('click', action); }
for (const button of document.querySelectorAll('button[data-tool]')) {
  button.addEventListener('click', () => setTool(button.dataset.tool));
}
for (const button of document.querySelectorAll('button[data-mode]')) {
  button.addEventListener('click', () => { mode = button.dataset.mode; makeChannels(); });
}
bind('grid', () => { grid = !grid; pressed($('grid'), grid); requestPaint(); });
bind('onion', () => { onion = !onion; pressed($('onion'), onion); requestPaint(); });
bind('zoom-out', () => zoom(1 / 1.25));
bind('zoom-in', () => zoom(1.25));
bind('zoom-reset', centerFrame);
bind('fit-view', fitCurrentView);
bind('release-view', releaseView);
bind('undo', () => restore(true));
bind('redo', () => restore(false));
bind('copy', () => copySelection());
bind('cut', () => copySelection(true));
bind('paste', pastePixels);
bind('delete', () => clearSelection());
bind('prev', () => selectFrame(active - 1));
bind('next', () => selectFrame(active + 1));
bind('play', togglePlayback);
$('playback-mode').addEventListener('change', changePlaybackMode);
bind('add-frame', () => addFrame(false));
bind('duplicate', () => addFrame(true));
bind('lambda', openLambda);
bind('close-lambda', closeLambda);
$('lambda-dialog').addEventListener('cancel', (event) => {
  if (!trompRun) return;
  event.preventDefault();
  closeLambda();
});
bind('show-tromp-guide', () => placeTrompGuide(false));
bind('draw-tromp-guide', () => placeTrompGuide(true));
bind('hide-tromp-guide', () => {
  trompGuide = null;
  refreshActive();
});
$('lambda-form').addEventListener('submit', generateTromp);
bind('remove-frame', deleteFrame);
bind('from-previous', copyPrevious);
bind('unify-duration', unifyFrameDurations);
bind('add-color', () => {
  if (project.palette.includes(currentColor)) return toast('调色板已有这个颜色');
  project.palette.push(currentColor);
  renderPalette();
  storeProject();
});
bind('keys', () => $('help-dialog').showModal());
bind('new', () => {
  if (!confirm('新建项目会替换当前工作区。确定继续？')) return;
  replaceProject({ name: '未命名像素画', palette: [...initialPalette], frames: [frame()] });
});
bind('open', () => $('project-file').click());
bind('save', downloadProject);
bind('video', () => {
  $('video-form').reset();
  $('video-status').textContent = '';
  $('video-dialog').showModal();
});
bind('cancel-video', () => {
  if (importController) importController.abort();
  else $('video-dialog').close();
});
$('video-dialog').addEventListener('cancel', () => importController?.abort());
$('video-form').addEventListener('submit', importVideo);
$('project-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    replaceProject(parseProject(JSON.parse(await file.text())));
    toast('已打开项目');
  } catch (error) {
    toast('打开失败：' + error.message);
  } finally {
    event.target.value = '';
  }
});
$('project-name').addEventListener('change', () => {
  project.name = $('project-name').value.trim() || '未命名像素画';
  $('project-name').value = project.name;
  storeProject();
});
$('duration').addEventListener('change', changeDuration);
for (const id of ['project-name', 'duration', 'hex']) {
  $(id).addEventListener('keydown', (event) => { if (event.key === 'Enter') $(id).blur(); });
}
$('hex').addEventListener('change', () => {
  const hex = '#' + $('hex').value.trim().replace(/^#/, '');
  if (colorPattern.test(hex)) setColor(hex);
  else refreshColor();
});
$('color-swatch').addEventListener('input', (event) => setColor(event.target.value));
$('hue').addEventListener('input', (event) => setHsv([event.target.valueAsNumber, hsv[1], hsv[2]]));
$('sv').addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  $('sv').setPointerCapture(event.pointerId);
  pickSv(event);
});
$('sv').addEventListener('pointermove', (event) => {
  if ($('sv').hasPointerCapture(event.pointerId)) pickSv(event);
});

document.addEventListener('keydown', (event) => {
  if (event.target.closest('input,textarea,select,[contenteditable]') || document.querySelector('dialog[open]')) return;
  const command = event.ctrlKey || event.metaKey;
  const keyName = event.key.toLowerCase();
  const commands = {
    c: () => copySelection(), x: () => copySelection(true), v: pastePixels,
    z: () => restore(!event.shiftKey), y: () => restore(false), s: downloadProject,
  };
  const shortcuts = {
    delete: () => clearSelection(), backspace: () => clearSelection(),
    escape: () => { selection = null; refreshSelection(); },
    ' ': togglePlayback, arrowleft: () => selectFrame(active - 1), arrowright: () => selectFrame(active + 1),
    b: () => setTool('draw'), l: () => setTool('line'), e: () => setTool('erase'), m: () => setTool('select'),
    i: () => setTool('pick'), h: () => setTool('pan'),
  };
  const action = (command ? commands : shortcuts)[keyName];
  if (action && !event.altKey) {
    event.preventDefault();
    if (!event.repeat || ![' ', 'v'].includes(keyName)) action();
  }
});

pressed($('grid'), grid);
pressed($('onion'), onion);
setTool('draw');
makeChannels();
replaceProject(project, false);
new ResizeObserver(resizeBoard).observe(board);
loadLastProject();
