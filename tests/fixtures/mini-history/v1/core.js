export const TYPES = {
  move: { category: 'motion', label: '移动', value: 60, min: -480, max: 480, unit: '步' },
  turn: { category: 'motion', label: '右转', value: 90, min: -360, max: 360, unit: '度' },
  goto: { category: 'motion', label: '移到', x: 0, y: 0 },
  say: { category: 'looks', label: '说', value: '你好，世界！' },
  wait: { category: 'control', label: '等待', value: 0.5, min: 0, max: 10, unit: '秒' },
  repeat: { category: 'control', label: '重复执行', value: 4, min: 0, max: 100, unit: '次' },
  penDown: { category: 'pen', label: '落笔' },
  penUp: { category: 'pen', label: '抬笔' },
  clear: { category: 'pen', label: '清除画迹' }
};
let sequence = 0;
export const uid = () => `b${Date.now().toString(36)}-${++sequence}`;
export function block(type, overrides = {}) {
  const d = TYPES[type];
  if (!d) throw new Error('未知积木');
  return { id: uid(), type, ...('value' in d ? { value: d.value } : {}), ...(type === 'goto' ? { x: 0, y: 0 } : {}), ...(type === 'repeat' ? { children: [] } : {}), ...overrides };
}
const finite = (v, min, max) => {
  if (v === '' || v == null || typeof v === 'boolean' || !Number.isFinite(Number(v))) throw new Error('积木参数必须是有效数字');
  return Math.max(min, Math.min(max, Number(v)));
};
export function validateProject(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.blocks)) throw new Error('项目格式不正确，请选择灵感积木 JSON 文件');
  let total = 0;
  const ids = new Set();
  const parse = (items, depth) => {
    if (!Array.isArray(items) || depth > 8) throw new Error('积木嵌套最多 8 层');
    return items.map(item => {
      if (++total > 300) throw new Error('最多使用 300 块积木');
      if (!item || !Object.hasOwn(TYPES, item.type)) throw new Error('包含未知积木');
      const d = TYPES[item.type];
      const id = typeof item.id === 'string' && item.id.length < 100 && !ids.has(item.id) ? item.id : uid();
      ids.add(id);
      const b = { id, type: item.type };
      if (item.type === 'say') b.value = String(item.value ?? '').slice(0, 80);
      else if ('value' in d) b.value = finite(item.value, d.min, d.max);
      if (item.type === 'repeat') { b.value = Math.floor(b.value); b.children = parse(item.children, depth + 1); }
      if (item.type === 'goto') { b.x = finite(item.x, -240, 240); b.y = finite(item.y, -180, 180); }
      return b;
    });
  };
  return { version: 1, name: String(raw.name || '我的新作品').slice(0, 40), sprite: ['fox','rabbit','robot'].includes(raw.sprite) ? raw.sprite : 'fox', backdrop: ['meadow','space','paper'].includes(raw.backdrop) ? raw.backdrop : 'meadow', blocks: parse(raw.blocks, 0) };
}
export function editTree(blocks, id, action) {
  return blocks.flatMap((b, index) => {
    if (b.id === id) return action(b, index) ?? [];
    return { ...b, ...(b.children ? { children: editTree(b.children, id, action) } : {}) };
  });
}
export function moveInTree(blocks, id, direction) {
  const out = [...blocks];
  const i = out.findIndex(b => b.id === id);
  if (i >= 0) {
    const j = i + direction;
    if (j >= 0 && j < out.length) [out[i], out[j]] = [out[j], out[i]];
    return out;
  }
  return out.map(b => b.children ? { ...b, children: moveInTree(b.children, id, direction) } : b);
}
export function countBlocks(blocks) { return blocks.reduce((n,b) => n + 1 + (b.children ? countBlocks(b.children) : 0), 0); }
export const initialState = () => ({ x: 0, y: 0, angle: 0, speech: '', pen: false, lines: [] });
export function delay(ms, signal) {
  return new Promise((resolve,reject) => {
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new DOMException('已停止', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  });
}
export async function execute(blocks, { signal, onStep = () => {}, sleep = delay, pace = 180 } = {}) {
  const state = initialState();
  let steps = 0;
  const check = () => { if (signal?.aborted) throw new DOMException('已停止', 'AbortError'); };
  const walk = async items => {
    for (const b of items) {
      check();
      if (++steps > 10000) throw new Error('执行达到 10000 步，请减少重复次数');
      if (b.type === 'repeat') {
        onStep(state, b.id); await sleep(pace, signal);
        for (let i=0; i<b.value; i++) { check(); await walk(b.children); await sleep(0,signal); }
        continue;
      }
      const old = { x: state.x, y: state.y };
      switch (b.type) {
        case 'move': state.x += Math.cos(state.angle * Math.PI / 180) * b.value; state.y -= Math.sin(state.angle * Math.PI / 180) * b.value; break;
        case 'turn': state.angle = ((state.angle + b.value) % 360 + 360) % 360; break;
        case 'goto': state.x = b.x; state.y = b.y; break;
        case 'say': state.speech = b.value; break;
        case 'penDown': state.pen = true; break;
        case 'penUp': state.pen = false; break;
        case 'clear': state.lines = []; break;
      }
      state.x = Math.max(-240,Math.min(240,state.x)); state.y = Math.max(-180,Math.min(180,state.y));
      if (state.pen && (b.type === 'move' || b.type === 'goto')) state.lines.push({ x1: old.x,y1: old.y,x2: state.x,y2: state.y });
      onStep(state, b.id);
      await sleep(b.type === 'wait' ? b.value * 1000 : pace, signal);
    }
  };
  await walk(blocks); check(); return state;
}
export function example(key = 'square') {
  const square = [block('say',{value:'一起画一个正方形吧！'}), block('penDown'), block('repeat',{value:4,children:[block('move',{value:100}),block('turn',{value:90})]}),block('penUp'),block('say',{value:'完成啦！你也来试试 ✨'})];
  const flower = [block('penDown'),block('repeat',{value:12,children:[block('repeat',{value:4,children:[block('move',{value:70}),block('turn',{value:90})]}),block('turn',{value:30})]}),block('penUp'),block('say',{value:'送你一朵几何花！'})];
  const hello = [block('say',{value:'嗨！我是小狐狸 🦊'}),block('wait'),block('move',{value:80}),block('turn',{value:180}),block('move',{value:160}),block('say',{value:'积木让想法动起来！'})];
  return { version:1,name:{square:'小狐狸画方形',flower:'绽放的几何花',hello:'小狐狸打招呼'}[key] || '小狐狸画方形',sprite:'fox',backdrop:'meadow',blocks:({square,flower,hello}[key] || square) };
}
