(function (root) {
  'use strict';
  const values = Object.freeze(['●', '◆', '▲', '●', '▲', '◆']);
  function initial(wins = 0) { return { schemaVersion: 1, game: 'memory-demo', matched: [], open: [], moves: 0, wins, complete: false }; }
  function validate(data) {
    if (!data || data.schemaVersion !== 1 || data.game !== 'memory-demo' || typeof data.complete !== 'boolean' || !Number.isSafeInteger(data.moves) || data.moves < 0 || data.moves > 1000000000 || !Number.isSafeInteger(data.wins) || data.wins < 0 || data.wins > 1000000000) throw new Error('存档格式无效');
    for (const key of ['matched', 'open']) if (!Array.isArray(data[key]) || data[key].some(i => !Number.isInteger(i) || i < 0 || i >= 6) || new Set(data[key]).size !== data[key].length) throw new Error('牌面索引无效');
    if (data.open.length > 2 || data.open.some(i => data.matched.includes(i)) || data.matched.length % 2 || data.complete !== (data.matched.length === 6)) throw new Error('牌面状态无效');
    if (data.moves < data.matched.length / 2 || data.complete && data.wins < 1) throw new Error('步数或胜局无效');
    for (const value of values) if (data.matched.filter(i => values[i] === value).length % 2) throw new Error('配对状态无效');
    if (data.open.length === 2 && values[data.open[0]] === values[data.open[1]]) throw new Error('匹配牌应已保留');
    return { schemaVersion: 1, game: 'memory-demo', matched: [...data.matched], open: [...data.open], moves: data.moves, wins: data.wins, complete: data.complete };
  }
  function flip(state, index) {
    const next = validate(state);
    if (!Number.isInteger(index) || index < 0 || index >= 6) throw new Error('牌面索引无效');
    if (next.complete || next.matched.includes(index)) return next;
    if (next.open.length === 2) next.open = [];
    if (next.open.includes(index)) return next;
    next.open.push(index);
    if (next.open.length === 2) {
      if (next.moves >= 1000000000) throw new Error('步数已达上限，请重新开始');
      next.moves++;
      if (values[next.open[0]] === values[next.open[1]]) { next.matched.push(...next.open); next.open = []; }
      if (next.matched.length === 6) { if (next.wins >= 1000000000) throw new Error('胜局已达上限'); next.complete = true; next.wins++; }
    }
    return next;
  }
  const api = Object.freeze({ values, initial, validate, flip });
  if (typeof module !== 'undefined') module.exports = api;
  root.MemoryDemo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
