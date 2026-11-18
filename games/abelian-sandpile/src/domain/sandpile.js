(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SandpileCore = api;
})(globalThis, function () {
  'use strict';
  const RULES = 'square4-open-v1';
  const LIMITS = Object.freeze({ size: 129, input: 100000, grains: 1000000, counter: 1e12, queue: 100 });
  function integer(value, min, max, label) {
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label}必须是 ${min}～${max} 的整数`);
    return value;
  }
  const sum = (values) => values.reduce((a, b) => a + b, 0);
  const clone = (state) => JSON.parse(JSON.stringify(state));
  function isStable(state) { return state.cells.every((value) => value < 4); }
  function create(width, height, cells) {
    integer(width, 1, LIMITS.size, '宽度'); integer(height, 1, LIMITS.size, '高度');
    if (cells === undefined) cells = Array(width * height).fill(0);
    if (!Array.isArray(cells) || cells.length !== width * height) throw new Error('棋盘长度错误');
    cells.forEach((value) => integer(value, 0, LIMITS.grains, '粒数'));
    const total = integer(sum(cells), 0, LIMITS.grains, '总粒数');
    const stable = cells.every((value) => value < 4);
    return { rules: RULES, width, height, cells: cells.slice(), total, initialTotal: total, added: 0, lost: 0,
      topplings: 0, odometer: cells.map(() => 0), stable, avalancheActive: !stable, currentAvalanche: 0, lastAvalanche: 0 };
  }
  function finish(state) {
    if (state.stable && state.avalancheActive) {
      state.lastAvalanche = state.currentAvalanche;
      state.currentAvalanche = 0; state.avalancheActive = false;
    }
  }
  function drop(state, x, y, amount) {
    integer(x, 0, state.width - 1, '横坐标'); integer(y, 0, state.height - 1, '纵坐标');
    integer(amount, 1, LIMITS.input, '投沙量');
    integer(state.initialTotal + state.added + amount, 0, LIMITS.grains, '本局累计粒数');
    if (state.stable) { state.avalancheActive = true; state.currentAvalanche = 0; }
    state.cells[y * state.width + x] += amount; state.total += amount; state.added += amount;
    state.stable = isStable(state); finish(state);
  }
  function neighbours(state, i) {
    const x = i % state.width, y = Math.floor(i / state.width);
    return [x > 0 ? i - 1 : -1, x + 1 < state.width ? i + 1 : -1,
      y > 0 ? i - state.width : -1, y + 1 < state.height ? i + state.width : -1];
  }
  function count(state, i, n) {
    integer(state.topplings + n, 0, LIMITS.counter, '崩塌计数');
    state.topplings += n; state.odometer[i] += n; state.currentAvalanche += n;
  }
  function wave(state) {
    const delta = Array(state.cells.length).fill(0);
    let topplings = 0, lost = 0;
    for (let i = 0; i < state.cells.length; i++) if (state.cells[i] >= 4) {
      delta[i] -= 4; count(state, i, 1); topplings++;
      for (const neighbour of neighbours(state, i)) {
        if (neighbour < 0) lost++; else delta[neighbour]++;
      }
    }
    for (let i = 0; i < delta.length; i++) state.cells[i] += delta[i];
    state.lost += lost; state.total -= lost; state.stable = isStable(state); finish(state);
    return topplings;
  }
  class Relaxer {
    constructor(state) {
      this.state = state;
      this.queue = new Int32Array(state.cells.length + 1);
      this.marked = new Uint8Array(state.cells.length);
      this.head = 0; this.tail = 0;
      for (let i = 0; i < state.cells.length; i++) if (state.cells[i] >= 4) this.enqueue(i);
      this.done = this.head === this.tail;
    }
    enqueue(i) {
      if (i < 0 || this.marked[i]) return;
      this.queue[this.tail] = i; this.tail = (this.tail + 1) % this.queue.length; this.marked[i] = 1;
    }
    tick(budget = 1000, expired = () => false) {
      integer(budget, 1, 100000, '批次数');
      const state = this.state; let operations = 0;
      while (this.head !== this.tail && operations < budget && !expired()) {
        const i = this.queue[this.head]; this.head = (this.head + 1) % this.queue.length; this.marked[i] = 0;
        const n = Math.floor(state.cells[i] / 4); operations++;
        if (!n) continue;
        count(state, i, n); state.cells[i] -= 4 * n;
        for (const neighbour of neighbours(state, i)) {
          if (neighbour < 0) { state.lost += n; state.total -= n; }
          else { state.cells[neighbour] += n; if (state.cells[neighbour] >= 4) this.enqueue(neighbour); }
        }
      }
      this.done = this.head === this.tail;
      state.stable = this.done; finish(state);
      return { operations, done: this.done };
    }
  }
  function stabilize(state, budget = 5000000) {
    const runner = new Relaxer(state); let used = 0;
    while (!runner.done) { used += runner.tick(1000).operations; if (used > budget) throw new Error('稳定化搜索预算耗尽'); }
    return state;
  }
  function validateSnapshot(raw) {
    if (!raw || raw.rules !== RULES) throw new Error('不支持的沙堆规则');
    const base = create(raw.width, raw.height, raw.cells);
    for (const field of ['total', 'initialTotal', 'added', 'lost', 'topplings', 'currentAvalanche', 'lastAvalanche'])
      integer(raw[field], 0, LIMITS.counter, field);
    if (!Array.isArray(raw.odometer) || raw.odometer.length !== raw.cells.length) throw new Error('崩塌数组错误');
    raw.odometer.forEach((v) => integer(v, 0, LIMITS.counter, '逐格崩塌计数'));
    if (raw.total !== base.total || raw.total + raw.lost !== raw.initialTotal + raw.added ||
      raw.initialTotal + raw.added > LIMITS.grains || sum(raw.odometer) !== raw.topplings ||
      raw.stable !== base.stable || typeof raw.avalancheActive !== 'boolean' ||
      raw.avalancheActive !== !raw.stable || raw.currentAvalanche > raw.topplings || raw.lastAvalanche > raw.topplings ||
      (raw.stable && raw.currentAvalanche !== 0)) throw new Error('存档粒数账本或状态不一致');
    return Object.fromEntries(Object.keys(base).map((key) => [key, clone(raw[key])]));
  }
  function preset(size, name) {
    integer(size, 1, LIMITS.size, '尺寸');
    if (!['empty', 'center', 'critical'].includes(name)) throw new Error('未知预设');
    const cells = Array(size * size).fill(name === 'critical' ? 3 : 0);
    if (name === 'center') cells[Math.floor(size / 2) * size + Math.floor(size / 2)] = 4096;
    if (name === 'critical') cells[Math.floor(size / 2) * size + Math.floor(size / 2)]++;
    return create(size, size, cells);
  }
  return Object.freeze({ RULES, LIMITS, integer, sum, clone, create, drop, wave, isStable, neighbours, Relaxer, stabilize, validateSnapshot, preset });
});
