(function (root) {
  'use strict';
  const core = typeof module !== 'undefined' ? require('./core.js') : root.AI2048;
  function evaluate(board) {
    const { width, height, cells } = board;
    let empty = 0, roughness = 0, max = 0, monotonicity = 0, pairs = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const value = cells[y * width + x];
      if (!value) { empty++; continue; }
      max = Math.max(max, value);
      for (const index of [x + 1 < width ? y * width + x + 1 : -1, y + 1 < height ? (y + 1) * width + x : -1]) {
        if (index < 0 || !cells[index]) continue;
        roughness += Math.abs(value - cells[index]);
        if (value === cells[index]) pairs++;
      }
    }
    for (let y = 0; y < height; y++) {
      let up = 0, down = 0;
      for (let x = 1; x < width; x++) {
        const delta = cells[y * width + x] - cells[y * width + x - 1];
        up += Math.max(0, delta); down += Math.max(0, -delta);
      }
      monotonicity += Math.min(up, down);
    }
    for (let x = 0; x < width; x++) {
      let up = 0, down = 0;
      for (let y = 1; y < height; y++) {
        const delta = cells[y * width + x] - cells[(y - 1) * width + x];
        up += Math.max(0, delta); down += Math.max(0, -delta);
      }
      monotonicity += Math.min(up, down);
    }
    const corner = [0, width - 1, (height - 1) * width, cells.length - 1].some(i => cells[i] === max);
    return empty * 16 + pairs * 5 + max * 3 - roughness * 1.2 - monotonicity * 3 + (corner ? max * 4 : 0);
  }
  function choose(board, depth = 2) {
    // Each root receives the same bounded search. Sample evenly on large boards.
    function player(position, remaining) {
      if (!remaining) return evaluate(position);
      let best = -Infinity;
      for (const direction of core.DIRECTIONS) {
        const result = core.slide(position, direction);
        if (result.changed) best = Math.max(best, chance(result, remaining - 1) + mergeBonus(result));
      }
      return best === -Infinity ? evaluate(position) - 1000 : best;
    }
    function mergeBonus(result) { return result.gained ? result.gained.toString(2).length * 0.5 : 0; }
    function chance(position, remaining) {
      const empty = position.cells.flatMap((v, i) => v ? [] : [i]);
      if (!empty.length) return player(position, remaining);
      const count = Math.min(6, empty.length);
      let total = 0;
      for (let i = 0; i < count; i++) {
        const index = empty[Math.floor((i + 0.5) * empty.length / count)];
        for (const [value, probability] of [[1, 0.9], [2, 0.1]]) {
          const cells = position.cells.slice(); cells[index] = value;
          total += probability * player({ ...position, cells }, remaining) / count;
        }
      }
      return total;
    }
    let direction = null, best = -Infinity;
    const searchDepth = depth >= 2 ? 2 : 1;
    for (const candidate of core.DIRECTIONS) {
      const result = core.slide(board, candidate);
      if (!result.changed) continue;
      const score = chance(result, searchDepth - 1) + mergeBonus(result);
      if (score > best) { best = score; direction = candidate; }
    }
    return direction;
  }
  const api = Object.freeze({ choose, evaluate });
  if (typeof module !== 'undefined') module.exports = api;
  root.AI2048Search = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
