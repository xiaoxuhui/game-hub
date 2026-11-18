(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('../domain/sandpile.js') : root.SandpileCore,
    node ? require('../domain/challenge.js') : root.SandpileChallenge);
  if (node) module.exports = api; else root.SandpileStorage = api;
})(globalThis, function (C, H) {
  'use strict';
  const KEYS = Object.freeze({ experiment: 'abelian-sandpile.experiment.v1', progress: 'abelian-sandpile.progress.v1', settings: 'abelian-sandpile.settings.v1' });
  const MAX_BYTES = 2 * 1024 * 1024;
  function validate(raw, levels) {
    if (!raw || raw.schemaVersion !== 1 || raw.gameId !== 'abelian-sandpile') throw new Error('不支持的存档版本或游戏');
    const state = C.validateSnapshot(raw.experiment?.state), queue = raw.experiment?.queue;
    if (!Array.isArray(queue) || queue.length > C.LIMITS.queue) throw new Error('待处理操作队列错误');
    let reserved = 0;
    for (const p of queue) {
      C.integer(p.x, 0, state.width - 1, '横坐标'); C.integer(p.y, 0, state.height - 1, '纵坐标');
      C.integer(p.amount, 1, C.LIMITS.input, '投沙量'); reserved += p.amount;
    }
    if (state.initialTotal + state.added + reserved > C.LIMITS.grains) throw new Error('待处理投入超过总预算');
    const selected = raw.experiment.selected;
    C.integer(selected?.x, 0, state.width - 1, '选中横坐标'); C.integer(selected?.y, 0, state.height - 1, '选中纵坐标');
    const settings = raw.settings;
    if (!settings || !['explore', 'challenge'].includes(settings.mode)) throw new Error('模式错误');
    C.integer(settings.speed, 1, 60, '速度'); C.integer(settings.amount, 1, C.LIMITS.input, '投沙量');
    const level = levels.find((x) => x.id === settings.levelId); if (!level) throw new Error('未知关卡');
    if (!raw.progress || typeof raw.progress !== 'object' || Array.isArray(raw.progress)) throw new Error('关卡进度格式错误');
    const progress = {};
    for (const [id, value] of Object.entries(raw.progress)) {
      const item = levels.find((x) => x.id === id); if (!item || value.version !== item.version) throw new Error('进度关卡版本错误');
      C.integer(value.best, 0, item.maxMoves, '最好步数');
      const proof = H.solve(item, value.best); if (proof.minimum === null) throw new Error('完成记录没有合法解');
      progress[id] = { version: value.version, best: value.best };
    }
    const challenge = raw.challenge ? H.checkpoint(H.restore(level, raw.challenge)) : H.checkpoint(H.create(level));
    return { schemaVersion: 1, gameId: 'abelian-sandpile', experiment: { state, queue: C.clone(queue), selected: { x: selected.x, y: selected.y } },
      progress, settings: { mode: settings.mode, speed: settings.speed, amount: settings.amount, levelId: level.id }, challenge };
  }
  function decode(text, levels) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('存档超过 2MiB 上限');
    let raw; try { raw = JSON.parse(text); } catch { throw new Error('存档不是有效 JSON'); }
    return validate(raw, levels);
  }
  function encode(bundle, levels) { return JSON.stringify(validate(bundle, levels), null, 2); }
  // The complete experiment envelope is authoritative; mirrors never override it.
  function save(storage, bundle, levels) {
    const normalized = validate(bundle, levels);
    storage.setItem(KEYS.experiment, JSON.stringify(normalized));
    storage.setItem(KEYS.progress, JSON.stringify(normalized.progress));
    storage.setItem(KEYS.settings, JSON.stringify(normalized.settings));
  }
  function load(storage, levels) { const text = storage.getItem(KEYS.experiment); return text === null ? null : decode(text, levels); }
  function clear(storage) { for (const key of Object.values(KEYS)) storage.removeItem(key); }
  return Object.freeze({ KEYS, MAX_BYTES, validate, decode, encode, save, load, clear });
});
