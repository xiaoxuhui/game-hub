import {strictJson} from './resource-protocol.mjs';

// This self-contained factory is also emitted verbatim into the game resource.
export function createConwayArchive(storage, life, subtle, parseJson) {
  const key = 'conway-hub-world-archive-v1';
  const limits = Object.freeze({maxEntries:10, maxBytes:3*1048576, maxTextBytes:1_000_000});
  const encoder = new TextEncoder();
  let pending = Promise.resolve(), invalidated = false, lastConflict = null;
  const bytes = value => encoder.encode(value);
  const queue = action => {
    const result = pending.then(action, action);
    pending = result.then(() => {}, () => {});
    return result;
  };
  function writable() {
    if (invalidated) throw Error('检测到其他页面修改备份，请关闭其它实例后重新打开。');
  }
  async function digest(text) {
    if (!subtle || typeof subtle.digest !== 'function') throw Error('当前环境无法计算安全摘要，本地完整备份尚未保存。');
    const result = await subtle.digest('SHA-256', bytes(text));
    return [...new Uint8Array(result)].map(value => value.toString(16).padStart(2,'0')).join('');
  }
  async function describe(fullText) {
    if (typeof fullText !== 'string' || bytes(fullText).length > limits.maxTextBytes) throw Error('单份完整存档超过 1,000,000 字节上限。');
    const state = life.deserialize(fullText);
    const base = life.serialize(state.world, state.generation, state.view, life.DEFAULT_RULE);
    delete base.rule;
    const [id, baseSha256] = await Promise.all([digest(fullText), digest(JSON.stringify(base))]);
    return {id, baseSha256, rule:state.rule, generation:state.generation, aliveCount:life.countAlive(state.world), fullText};
  }
  async function parse(raw) {
    if (raw === null) return {schemaVersion:1, entries:[]};
    const encoded = bytes(raw);
    if (encoded.length > limits.maxBytes) throw Error('完整备份集合超过 3 MiB 上限，原数据已保留。');
    const doc = parseJson(encoded, limits.maxBytes);
    if (!doc || doc.schemaVersion !== 1 || !Array.isArray(doc.entries) || doc.entries.length > limits.maxEntries) throw Error('完整备份版本或数量无效，原数据已保留。');
    const ids = new Set();
    for (const entry of doc.entries) {
      if (!entry || typeof entry.savedAt !== 'string' || entry.savedAt.length > 64 || !Number.isFinite(Date.parse(entry.savedAt))) throw Error('完整备份时间无效，原数据已保留。');
      const actual = await describe(entry.fullText);
      for (const name of ['id','baseSha256','rule','generation','aliveCount']) if (entry[name] !== actual[name]) throw Error('完整备份摘要或摘要绑定内容不一致，原数据已保留。');
      if (ids.has(entry.id)) throw Error('完整备份身份重复，原数据已保留。');
      ids.add(entry.id);
    }
    return doc;
  }
  async function read() {
    const raw = storage.getItem(key);
    return {raw, doc:await parse(raw)};
  }
  function rememberConflict(beforeRaw, observedRaw, attemptedRaw) {
    invalidated = true;
    lastConflict = {beforeRaw, observedRaw, attemptedRaw};
  }
  function commit(beforeRaw, doc) {
    writable();
    if (doc.entries.length > limits.maxEntries) throw Error('完整备份已达 10 条上限，请先导出再明确清理。');
    const raw = JSON.stringify(doc);
    if (bytes(raw).length > limits.maxBytes) throw Error('完整备份集合超过 3 MiB 上限，请先导出再明确清理。');
    const current = storage.getItem(key);
    if (current !== beforeRaw) {
      rememberConflict(beforeRaw, current, raw);
      throw Error('其他页面已修改完整备份，未覆盖其数据。');
    }
    storage.setItem(key, raw);
    const observed = storage.getItem(key);
    if (observed !== raw) {
      rememberConflict(beforeRaw, observed, raw);
      throw Error('完整备份写入核验失败，已保留冲突原文，未盲目回写。');
    }
  }
  function mergeOpaque(left, right, reserved) {
    const result = Object.assign(Object.create(null), left);
    for (const name of Object.keys(right)) {
      if (reserved.has(name)) continue;
      if (Object.prototype.hasOwnProperty.call(result, name) && JSON.stringify(result[name]) !== JSON.stringify(right[name])) throw Error('备份扩展元数据冲突，未覆盖任何原文。');
      Object.defineProperty(result, name, {value:right[name], enumerable:true, configurable:true, writable:true});
    }
    return result;
  }
  return {
    key,
    limits,
    add(fullText) {
      return queue(async () => {
        writable();
        const entry = await describe(fullText), {raw,doc} = await read();
        writable();
        if (doc.entries.some(saved => saved.id === entry.id)) return {status:'duplicate', id:entry.id};
        const next = {...doc, entries:[...doc.entries, {...entry, savedAt:new Date().toISOString()}]};
        commit(raw, next);
        return {status:'saved', id:entry.id};
      });
    },
    list() {
      return queue(async () => JSON.parse(JSON.stringify((await read()).doc.entries)));
    },
    findMatches(fullText) {
      return queue(async () => {
        const entry = await describe(fullText), {doc} = await read();
        return JSON.parse(JSON.stringify(doc.entries.filter(saved => saved.baseSha256 === entry.baseSha256)));
      });
    },
    exportArchive() {
      // Deliberately exports even unreadable raw archives for manual preservation.
      return queue(() => storage.getItem(key) ?? '{"schemaVersion":1,"entries":[]}');
    },
    importArchive(text) {
      return queue(async () => {
        writable();
        if (typeof text !== 'string') throw Error('完整备份文件须为文本。');
        const incoming = await parse(text), {raw,doc} = await read();
        const next = mergeOpaque(doc, incoming, new Set(['schemaVersion','entries']));
        const known = new Set(['id','baseSha256','rule','generation','aliveCount','fullText','savedAt']);
        next.schemaVersion = 1;
        next.entries = doc.entries.map(entry => Object.assign(Object.create(null), entry));
        for (const entry of incoming.entries) {
          const at = next.entries.findIndex(saved => saved.id === entry.id);
          if (at < 0) next.entries.push(entry);
          else {
            if (next.entries[at].fullText !== entry.fullText) throw Error('完整备份身份冲突，原文均未覆盖。');
            next.entries[at] = mergeOpaque(next.entries[at], entry, known);
          }
        }
        if (JSON.stringify(next) === JSON.stringify(doc)) return {status:'duplicate'};
        commit(raw, next);
        return {status:'saved'};
      });
    },
    previewClear() {
      return queue(async () => {
        const raw = storage.getItem(key);
        let count = null;
        try { count = (await parse(raw)).entries.length; } catch { /* Keep unreadable raw available for explicit preservation/clear. */ }
        return {expectedRaw:raw, count, unreadable:count===null};
      });
    },
    clear(confirmed, expectedRaw) {
      return queue(() => {
        if (confirmed !== true) throw Error('清理完整备份需要明确确认。');
        if (expectedRaw !== null && typeof expectedRaw !== 'string') throw Error('请先预览并确认要清理的备份内容。');
        writable();
        const before = storage.getItem(key);
        if (before !== expectedRaw) {
          rememberConflict(expectedRaw, before, null);
          throw Error('其他页面已修改备份，确认内容已过时，未执行清理。');
        }
        storage.removeItem(key);
        const after = storage.getItem(key);
        if (after !== null) {
          rememberConflict(before, after, null);
          throw Error('完整备份清理核验失败，未重复清理。');
        }
      });
    },
    invalidate() { invalidated = true; },
    conflict() { return lastConflict ? {...lastConflict} : null; },
  };
}

export function conwayArchiveRuntime() {
  return Buffer.from(`(function(root){'use strict';const strictJson=${strictJson.toString()};root.ConwayHubArchives={create:(storage,life)=>(${createConwayArchive.toString()})(storage,life,root.crypto&&root.crypto.subtle,strictJson)};})(globalThis);\n`);
}
