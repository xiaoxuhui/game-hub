(function (root) {
  'use strict';
  const MIN_SIZE = 2, MAX_SIZE = 20, MAX_EXPONENT = 4096;
  const DIRECTIONS = Object.freeze(['up', 'left', 'down', 'right']);
  function dimensions(width, height) {
    if (![width, height].every(n => Number.isInteger(n) && n >= MIN_SIZE && n <= MAX_SIZE)) {
      throw new Error('宽和高都需要是 2～20 的整数');
    }
  }
  function slide(board, direction, track = false) {
    if (!DIRECTIONS.includes(direction)) throw new Error('无效方向');
    const { width, height, cells } = board, next = cells.slice();
    const vertical = direction === 'up' || direction === 'down';
    const reverse = direction === 'down' || direction === 'right';
    const count = vertical ? width : height, length = vertical ? height : width;
    let gained = 0n;
    const motions = [], merges = [];
    for (let line = 0; line < count; line++) {
      const indices = Array.from({ length }, (_, offset) => {
        const at = reverse ? length - 1 - offset : offset;
        return vertical ? at * width + line : line * width + at;
      });
      const values = indices.map(i => cells[i]).filter(Boolean), merged = [];
      const sources = track ? indices.filter(i => cells[i]) : null;
      for (let i = 0; i < values.length; i++) {
        const target = indices[merged.length];
        if (values[i] === values[i + 1] && values[i] < MAX_EXPONENT) {
          const exponent = values[i] + 1;
          if (track) {
            motions.push({ from: sources[i], to: target, value: values[i] },
              { from: sources[i + 1], to: target, value: values[i + 1] });
            merges.push(target);
          }
          merged.push(exponent); gained += 1n << BigInt(exponent); i++;
        } else {
          if (track) motions.push({ from: sources[i], to: target, value: values[i] });
          merged.push(values[i]);
        }
      }
      indices.forEach((index, i) => { next[index] = merged[i] || 0; });
    }
    return { width, height, cells: next, gained, changed: next.some((value, i) => value !== cells[i]),
      ...(track ? { motions, merges } : {}) };
  }
  function legalMoves(board) { return DIRECTIONS.filter(direction => slide(board, direction).changed); }
  function spawn(board, random = Math.random) {
    const empty = board.cells.flatMap((value, i) => value ? [] : [i]);
    if (!empty.length) return { ...board, cells: board.cells.slice() };
    const cells = board.cells.slice();
    cells[empty[Math.floor(random() * empty.length)]] = random() < 0.9 ? 1 : 2;
    return { ...board, cells };
  }
  function initial(width = 4, height = 4, best = '0', random = Math.random) {
    dimensions(width, height);
    const board = spawn(spawn({ width, height, cells: Array(width * height).fill(0) }, random), random);
    return validate({ schemaVersion: 1, game: 'ai-2048', ...board, score: '0', moves: 0, best });
  }
  function validate(data) {
    if (!data || data.schemaVersion !== 1 || data.game !== 'ai-2048') throw new Error('无法读取 AI 2048 存档');
    dimensions(data.width, data.height);
    if (!Array.isArray(data.cells) || data.cells.length !== data.width * data.height ||
        !Array.from(data.cells).every(n => Number.isInteger(n) && n >= 0 && n <= MAX_EXPONENT) ||
        !Number.isSafeInteger(data.moves) || data.moves < 0 || data.moves >= Number.MAX_SAFE_INTEGER ||
        ![data.score, data.best].every(n => typeof n === 'string' && /^(0|[1-9][0-9]{0,1399})$/.test(n)) ||
        BigInt(data.best) < BigInt(data.score)) throw new Error('AI 2048 存档数据无效');
    return { schemaVersion: 1, game: 'ai-2048', width: data.width, height: data.height,
      cells: data.cells.slice(), score: data.score, moves: data.moves, best: data.best };
  }
  function move(state, direction, random = Math.random) {
    const result = slide(state, direction);
    if (!result.changed) return state;
    const score = (BigInt(state.score) + result.gained).toString();
    return { ...state, cells: spawn(result, random).cells, score, moves: state.moves + 1,
      best: BigInt(score) > BigInt(state.best) ? score : state.best };
  }
  const api = Object.freeze({ MIN_SIZE, MAX_SIZE, MAX_EXPONENT, DIRECTIONS, dimensions, slide, legalMoves, spawn, initial, validate, move });
  if (typeof module !== 'undefined') module.exports = api;
  root.AI2048 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
