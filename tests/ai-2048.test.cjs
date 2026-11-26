const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const core = require('../examples/ai-2048/core.js');
const ai = require('../examples/ai-2048/ai.js');
const board = (width, height, cells) => ({ width, height, cells });
const state = position => ({ schemaVersion: 1, game: 'ai-2048', ...position, score: '0', moves: 0, best: '0' });
const mass = cells => cells.reduce((sum, n) => sum + (n ? 1n << BigInt(n) : 0n), 0n);

test('rectangles slide all four directions using their own row and column lengths', () => {
  const b = board(3, 2, [1, 1, 2, 1, 2, 0]);
  assert.deepEqual(core.slide(b, 'left').cells, [2, 2, 0, 1, 2, 0]);
  assert.deepEqual(core.slide(b, 'right').cells, [0, 2, 2, 0, 1, 2]);
  assert.deepEqual(core.slide(b, 'up').cells, [2, 1, 2, 0, 2, 0]);
  assert.deepEqual(core.slide(b, 'down').cells, [0, 1, 0, 2, 2, 2]);
  assert.equal(core.slide(b, 'left').gained, 4n);
  assert.deepEqual(b.cells, [1, 1, 2, 1, 2, 0]);
  const tall = board(2, 3, [1, 1, 1, 2, 2, 0]);
  assert.deepEqual(core.slide(tall, 'up').cells, [2, 1, 2, 2, 0, 0]);
  assert.deepEqual(core.slide(tall, 'down').cells, [0, 0, 2, 1, 2, 2]);
});

test('equal tiles merge once per move, from the moving edge', () => {
  const b = board(5, 2, [1, 1, 1, 1, 1, 2, 2, 3, 0, 0]);
  assert.deepEqual(core.slide(b, 'left').cells, [2, 2, 1, 0, 0, 3, 3, 0, 0, 0]);
  assert.deepEqual(core.slide(b, 'right').cells, [0, 0, 1, 2, 2, 0, 0, 0, 3, 3]);
  assert.equal(core.slide(b, 'left').gained, 16n);
});

test('movement traces retain every original position, including both tiles in a merge', () => {
  const b = board(3, 2, [1, 1, 2, 1, 2, 0]);
  const plan = core.slide(b, 'left', true);
  assert.deepEqual(plan.motions, [
    { from: 0, to: 0, value: 1 }, { from: 1, to: 0, value: 1 },
    { from: 2, to: 1, value: 2 }, { from: 3, to: 3, value: 1 }, { from: 4, to: 4, value: 2 }
  ]);
  assert.deepEqual(plan.merges, [0]);
  const down = core.slide(b, 'down', true);
  assert.deepEqual(down.motions.slice(0, 2), [{ from: 3, to: 3, value: 1 }, { from: 0, to: 3, value: 1 }]);
  assert.deepEqual(down.merges, [3]);
  assert.equal('motions' in core.slide(b, 'left'), false);
});

test('invalid moves do not spawn; valid moves spawn exactly one 2 or 4', () => {
  const b = state(board(3, 2, [1, 0, 0, 0, 0, 0]));
  assert.equal(core.move(b, 'left', () => { throw Error('must not use randomness'); }), b);
  let values = [0, 0.899999];
  const withTwo = core.move(b, 'right', () => values.shift());
  assert.deepEqual(withTwo.cells, [1, 0, 1, 0, 0, 0]);
  values = [0.999999, 0.9];
  const withFour = core.move(b, 'right', () => values.shift());
  assert.deepEqual(withFour.cells, [0, 0, 1, 0, 0, 2]);
  assert.equal(withFour.moves, 1);
  assert.equal(withFour.score, '0');
  const merged = core.move(state(board(2, 2, [1, 1, 0, 0])), 'left', () => 0);
  assert.equal(merged.score, '4'); assert.equal(merged.best, '4');
});

test('legal moves detect full dead boards, available merges, and play beyond 2048', () => {
  assert.deepEqual(core.legalMoves(board(3, 2, [1, 2, 1, 2, 1, 2])), []);
  assert.deepEqual(core.legalMoves(board(2, 2, [1, 1, 2, 2])), ['left', 'right']);
  assert.equal(core.move(state(board(2, 2, [11, 11, 0, 0])), 'left', () => 0).cells[0], 12);
  const large = core.move(state(board(2, 2, [60, 60, 0, 0])), 'left', () => 0);
  assert.equal(large.score, (2n ** 61n).toString());
  assert.deepEqual(core.validate(JSON.parse(JSON.stringify(large))), large);
});

test('save roundtrips rectangular dimensions and rejects malformed or mismatched data', () => {
  const saved = core.initial(7, 3, '1024', () => 0);
  assert.deepEqual(core.validate(JSON.parse(JSON.stringify(saved))), saved);
  for (const patch of [{ width: 1 }, { height: 21 }, { width: 2.5 }, { cells: [1] },
    { cells: Array(21).fill(-1) }, { cells: Array(21).fill(1.2) }, { score: '1e4' },
    { score: '2', best: '1' }, { score: 5 }, { moves: -1 }, { game: 'another' }, { schemaVersion: 2 }]) {
    assert.throws(() => core.validate({ ...saved, ...patch }));
  }
  const copy = core.validate(saved); copy.cells[0] = 20;
  assert.notEqual(saved.cells[0], 20);
});

test('all board sizes preserve mass while sliding and start with two tiles', () => {
  let seed = 31;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 2 ** 32);
  for (let width = 2; width <= 20; width++) for (let height = 2; height <= 20; height++) {
    const fresh = core.initial(width, height, '0', random);
    assert.equal(fresh.cells.filter(Boolean).length, 2);
    const b = board(width, height, Array.from({ length: width * height }, () => Math.floor(random() * 7)));
    for (const direction of core.DIRECTIONS) {
      const result = core.slide(b, direction);
      assert.equal(result.cells.length, width * height);
      assert.equal(mass(result.cells), mass(b.cells), `${width}x${height} ${direction}`);
      const plan = core.slide(b, direction, true), destinations = Array(width * height).fill(0n);
      assert.deepEqual(plan.cells, result.cells);
      assert.deepEqual(plan.motions.map(tile => tile.from).sort((a, b) => a - b), b.cells.flatMap((v, i) => v ? [i] : []));
      for (const tile of plan.motions) {
        assert.equal(tile.value, b.cells[tile.from]);
        if (direction === 'left' || direction === 'right') assert.equal(Math.floor(tile.from / width), Math.floor(tile.to / width));
        else assert.equal(tile.from % width, tile.to % width);
        destinations[tile.to] += 1n << BigInt(tile.value);
      }
      assert.deepEqual(destinations, result.cells.map(v => v ? 1n << BigInt(v) : 0n));
    }
  }
});

test('AI handles square, wide, tall and maximum boards without mutation, choosing only valid moves', () => {
  const positions = [board(2, 2, [1, 2, 2, 3]), board(3, 2, [1, 2, 1, 2, 1, 2]),
    board(2, 2, [1, 1, 2, 2]), core.initial(2, 20, '0', () => 0),
    core.initial(20, 2, '0', () => 0), core.initial(20, 20, '0', () => 0), core.initial(4, 4)];
  for (const b of positions) {
    const before = JSON.stringify(b), moves = core.legalMoves(b);
    for (const depth of [1, 2]) {
      const chosen = ai.choose(b, depth);
      assert.ok(moves.length ? moves.includes(chosen) : chosen === null);
    }
    assert.equal(JSON.stringify(b), before);
  }
  assert.equal(ai.choose(board(2, 2, [1, 2, 2, 3])), null);
});

test('game resources retain MIT, offline files, and deterministic complete ZIPs', async () => {
  const { packDynamic } = await import('../scripts/dynamic-resources.mjs');
  const base = new URL('../examples/ai-2048/', `file:///${__filename.replaceAll('\\', '/')}`);
  const files = readdirSync(base).sort();
  const entries = files.map(path => ({ path, data: readFileSync(new URL(path, base)) }));
  assert.match(readFileSync(new URL('LICENSE', base), 'utf8'), /^MIT License/);
  const source = { id: 'ai-2048', displayName: 'AI 2048', iconKind: 'puzzle', available: true,
    repository: 'https://github.com/xiaoxuhui/game-hub.git', revision: 'a'.repeat(40), directory: 'examples/ai-2048',
    version: '1.0.0', contentCode: 1, entryPage: 'index.html', storageContract: 'ai-2048-dynamic-v1',
    files, releaseNotes: 'AI 2048，支持自定义长宽。' };
  const first = packDynamic(source, entries);
  assert.deepEqual(first, packDynamic(source, [...entries].reverse()));
  for (const entry of entries.filter(e => /\.(js|html|css)$/.test(e.path))) {
    assert.doesNotMatch(entry.data.toString(), /https?:\/\/|\bfetch\s*\(|\bXMLHttpRequest\b/);
  }
});
