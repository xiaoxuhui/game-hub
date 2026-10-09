(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./sandpile.js') : root.SandpileCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SandpileChallenge = api;
})(globalThis, function (C) {
  'use strict';
  function validateLevel(raw) {
    if (!raw || raw.rules !== C.RULES || typeof raw.id !== 'string' || !/^[a-z0-9-]+$/.test(raw.id) || typeof raw.title !== 'string' ||
      typeof raw.description !== 'string' || raw.grainPerMove !== 1 || raw.version !== 1) throw new Error('关卡格式错误');
    C.integer(raw.board.width, 1, 9, '关卡宽度'); C.integer(raw.board.height, 1, 9, '关卡高度');
    C.integer(raw.maxMoves, 1, 8, '关卡预算');
    const initial = C.create(raw.board.width, raw.board.height, raw.board.initial);
    const target = C.create(raw.board.width, raw.board.height, raw.board.target);
    if (!initial.stable || !target.stable) throw new Error('关卡初态和目标必须稳定');
    if (!Array.isArray(raw.allowedDropCells) || !raw.allowedDropCells.length || raw.allowedDropCells.length > 9) throw new Error('允许位置错误');
    const used = new Set();
    if (raw.teaching && (!['intro','advanced'].includes(raw.teaching.tier) || typeof raw.teaching.concept !== 'string' ||
      !raw.teaching.concept.trim() || !Array.isArray(raw.teaching.hints) || raw.teaching.hints.length !== 3 ||
      raw.teaching.hints.some(v=>typeof v!=='string'||!v.trim()||v.length>500))) throw new Error('教学说明格式错误');
    for (const { x, y } of raw.allowedDropCells) {
      C.integer(x, 0, initial.width - 1, '横坐标'); C.integer(y, 0, initial.height - 1, '纵坐标');
      const key = `${x},${y}`; if (used.has(key)) throw new Error('重复允许位置'); used.add(key);
    }
    return C.clone(raw);
  }
  function status(session) {
    if (!session.state.stable) return 'busy';
    if (session.state.cells.every((v, i) => v === session.level.board.target[i])) return 'won';
    return session.moves >= session.level.maxMoves ? 'failed' : 'playing';
  }
  function create(level) {
    level = validateLevel(level);
    return { level, state: C.create(level.board.width, level.board.height, level.board.initial), moves: 0, history: [] };
  }
  function allowed(level, x, y) { return level.allowedDropCells.some((p) => p.x === x && p.y === y); }
  function move(session, x, y) {
    if (status(session) !== 'playing') throw new Error('请先等待稳定，或重置已结束的关卡');
    if (!allowed(session.level, x, y)) throw new Error('只能在标记的允许位置投沙');
    const next = C.clone(session.state); C.drop(next, x, y, 1);
    session.history.push({ state: C.clone(session.state), moves: session.moves });
    session.state = next; session.moves++;
  }
  function undo(session) {
    const previous = session.history.pop();
    if (!previous) return false;
    session.state = previous.state; session.moves = previous.moves; return true;
  }
  function checkpoint(session) {
    if (session.state.stable) return { id: session.level.id, version: session.level.version,
      state: C.clone(session.state), moves: session.moves, history: C.clone(session.history) };
    const previous = session.history[session.history.length - 1];
    return { id: session.level.id, version: session.level.version, state: C.clone(previous.state),
      moves: previous.moves, history: C.clone(session.history.slice(0, -1)) };
  }
  function solve(level, maxDepth = level.maxMoves, maxNodes = 100000) {
    level = validateLevel(level); C.integer(maxDepth, 0, level.maxMoves, '搜索深度');
    const start = C.create(level.board.width, level.board.height, level.board.initial);
    let frontier = [{ state: start, path: [] }], visited = new Set([start.cells.join(',')]), nodes = 1;
    for (let depth = 0; depth <= maxDepth; depth++) {
      const next = [];
      for (const node of frontier) {
        if (node.state.cells.every((v, i) => v === level.board.target[i])) return { minimum: depth, path: node.path, nodes };
        if (depth === maxDepth) continue;
        for (const p of level.allowedDropCells) {
          const state = C.clone(node.state); C.drop(state, p.x, p.y, 1); C.stabilize(state);
          const key = state.cells.join(','); if (visited.has(key)) continue;
          visited.add(key); if (++nodes > maxNodes) throw new Error('最优性搜索预算耗尽，未证明');
          next.push({ state, path: [...node.path, p] });
        }
      }
      frontier = next;
    }
    return { minimum: null, path: null, nodes };
  }
  function restore(level, raw) {
    if (!raw || raw.id !== level.id || raw.version !== level.version) throw new Error('挑战存档版本错误');
    C.integer(raw.moves, 0, level.maxMoves, '已用步数');
    if (!Array.isArray(raw.history) || raw.history.length !== raw.moves) throw new Error('挑战历史长度错误');
    // Replay transitions from the exact initial state. Saved counters/history cannot invent a board.
    const session = create(level);
    for (let i = 0; i < raw.moves; i++) {
      const before = raw.history[i];
      if (before.moves !== i || JSON.stringify(C.validateSnapshot(before.state)) !== JSON.stringify(session.state)) throw new Error('挑战历史不连续');
      const expected = C.validateSnapshot(i + 1 < raw.moves ? raw.history[i + 1].state : raw.state);
      let chosen = null;
      for (const p of level.allowedDropCells) {
        const candidate = C.clone(session.state); C.drop(candidate, p.x, p.y, 1); C.stabilize(candidate);
        if (JSON.stringify(candidate) === JSON.stringify(expected)) { chosen = p; break; }
      }
      if (!chosen) throw new Error('挑战状态不能由合法操作得到');
      move(session, chosen.x, chosen.y); C.stabilize(session.state);
    }
    if (JSON.stringify(C.validateSnapshot(raw.state)) !== JSON.stringify(session.state)) throw new Error('挑战初态不一致');
    return session;
  }
  return Object.freeze({ validateLevel, create, status, allowed, move, undo, checkpoint, restore, solve });
});
