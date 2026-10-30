import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createTuringFormat, parseTuringJSON, turingFormatRuntime } from '../scripts/turing-compatibility.mjs';
import { createTuringPreservation, turingPreservationRuntime } from '../scripts/turing-preservation.mjs';

const require = createRequire(import.meta.url);
const old = require('./fixtures/turing/old/project-codec.cjs');
const current = require('./fixtures/turing/new/project-codec.cjs');
const F = createTuringFormat(current, old, parseTuringJSON);
const key = 'turing-hub-preservation-v1';
const oldKey = 'turing-machine-simulator.project.v1';
const project = patch => ({
  format: 'turing-machine-simulator', version: 1, name: '原项目', description: '完整原文',
  input: '1', blankSymbol: '_', initialState: 'q0', acceptStates: 'qa', rejectStates: 'qr',
  haltStates: '', rules: 'q0,1 -> qa,1,N', maxSteps: 1000, speed: 60, ...patch,
});
const raw = patch => JSON.stringify(project(patch), null, 2);
const initial = raw({ name: '初始' });

class Memory {
  constructor() { this.map = new Map(); this.writes = []; }
  getItem(name) { if (this.getFail === name) throw Error('get denied'); return this.map.get(name) ?? null; }
  setItem(name, value) { this.writes.push([name, value]); if (this.setFail === name) throw Error('quota denied'); this.map.set(name, value); this.afterSet?.(name, value); }
  removeItem(name) { if (this.removeFail) throw Error('remove denied'); this.map.delete(name); }
}
const setup = storage => createTuringPreservation(storage, F, initial, parseTuringJSON);
const doc = storage => JSON.parse(storage.map.get(key));

test('empty and legacy inspection are read-only; first migration protects the exact old raw', () => {
  const storage = new Memory(), S = setup(storage), original = raw({ opaque: { future: 'keep' } });
  assert.equal(S.inspect().kind, 'empty'); storage.map.set(oldKey, original);
  assert.equal(S.inspect().kind, 'legacy'); assert.equal(storage.writes.length, 0);
  S.save(original); assert.equal(doc(storage).history[0].rawText, original);
  assert.equal(old.parseProjectJson(storage.map.get(oldKey)).name, '原项目');
});

test('Max saves full state but never invents or rewrites a finite legacy mirror', () => {
  const storage = new Memory(), S = setup(storage), oldRaw = raw({ name: '旧版原文' });
  storage.map.set(oldKey, oldRaw); S.inspect();
  const max = raw({ maxSteps: null, opaque: '完整Max' });
  assert.equal(S.save(max).status, 'saved');
  assert.equal(doc(storage).current.fullText, max);
  assert.equal(doc(storage).current.legacyMaxSteps, null);
  assert.equal(storage.map.get(oldKey), oldRaw);
  assert.equal(setup(storage).inspect().activeFullText, max);
});

test('a Max save ignores any caller-supplied finite number and survives browser runtime reopen', () => {
  const storage = new Memory(), context = { TextEncoder };
  runInNewContext(turingFormatRuntime().toString() + turingPreservationRuntime().toString(), context);
  const format = context.TuringHubFormat.create(current, old);
  const S = context.TuringHubPreservation.create(storage, format, initial);
  S.inspect(); const max = raw({ maxSteps: null, opaque: 'vm' });
  S.save(max, 456);
  assert.equal(doc(storage).current.legacyMaxSteps, null);
  assert.equal(storage.map.has(oldKey), false);
  assert.equal(context.TuringHubPreservation.create(storage, format, initial).inspect().activeFullText, max);
});

test('old C4 Max wrappers remain readable, but the next Max save preserves their mirror bytes without reusing the cap', () => {
  const storage = new Memory(), max = raw({ maxSteps: null, opaque: '旧C4' });
  const wrapper = F.wrap(max, 777);
  storage.map.set(oldKey, wrapper);
  storage.map.set(key, JSON.stringify({ schemaVersion: 1, current: {
    fullText: max, legacyMaxSteps: 777, baseText: F.project(max, 777).baseText,
    savedAt: new Date().toISOString(), mirrorBeforeRaw: null, mirrorAfterRaw: wrapper,
  }, history: [] }));
  const S = setup(storage); assert.equal(S.inspect().activeFullText, max);
  const updated = raw({ maxSteps: null, opaque: '新版编辑' }); S.save(updated);
  assert.equal(doc(storage).current.fullText, updated);
  assert.equal(doc(storage).current.legacyMaxSteps, null);
  assert.equal(storage.map.get(oldKey), wrapper);
  assert.equal(setup(storage).inspect().activeFullText, updated);
});

test('finite projects use only their actual maxSteps value for the old mirror', () => {
  const storage = new Memory(), S = setup(storage), finite = raw({ maxSteps: 4321 });
  S.inspect(); S.save(finite, 7);
  assert.equal(doc(storage).current.legacyMaxSteps, 4321);
  assert.equal(old.parseProjectJson(storage.map.get(oldKey)).maxSteps, 4321);
  assert.equal(F.read(doc(storage).current.fullText).state.maxSteps, 4321);
});

test('external legacy edits block stale writes and retain the external raw', () => {
  const storage = new Memory(), S = setup(storage), full = raw({ maxSteps: null, opaque: 'new' });
  storage.map.set(oldKey, raw()); S.inspect(); S.save(full);
  const changed = raw({ name: '外部旧版修改' }); storage.map.set(oldKey, changed);
  assert.throws(() => S.save(raw({ maxSteps: null, name: '新写入' })), /已修改/);
  assert.equal(storage.map.get(oldKey), changed);
  assert.equal(doc(storage).current.fullText, full);
});

test('protection quota failure does not touch an existing legacy project', () => {
  const storage = new Memory(), oldRaw = raw(); storage.map.set(oldKey, oldRaw);
  const S = setup(storage); S.inspect(); storage.setFail = key;
  assert.throws(() => S.save(raw({ maxSteps: null })), /quota/);
  assert.equal(storage.map.get(oldKey), oldRaw); assert.equal(storage.map.has(key), false);
});

test('finite mirror failure leaves durable full project and a pending selection', () => {
  const storage = new Memory(), oldRaw = raw(); storage.map.set(oldKey, oldRaw);
  const S = setup(storage); S.inspect(); storage.setFail = oldKey;
  const finite = raw({ maxSteps: 123 });
  assert.throws(() => S.save(finite), /完整项目已保护/);
  assert.equal(doc(storage).current.fullText, finite); assert.equal(storage.map.get(oldKey), oldRaw);
  storage.setFail = null; assert.equal(setup(storage).inspect().kind, 'pending');
});

test('Max mirror bytes remain unchanged through later edits and reopening', () => {
  const storage = new Memory(), oldRaw = raw({ name: '旧镜像' }), S = setup(storage);
  storage.map.set(oldKey, oldRaw); S.inspect(); S.save(raw({ maxSteps: null, opaque: 1 }));
  S.save(raw({ maxSteps: null, opaque: 2 }));
  assert.equal(storage.map.get(oldKey), oldRaw);
  assert.equal(setup(storage).inspect().activeFullText, raw({ maxSteps: null, opaque: 2 }));
});

test('invalid legacy or protection records are never overwritten', () => {
  const storage = new Memory(); storage.map.set(oldKey, '{legacy-broken');
  const S = setup(storage); assert.equal(S.inspect().kind, 'invalid-legacy');
  assert.throws(() => S.save(raw()), /尚未解决/);
  S.preserve(['{invalid-import', 'not a project'], '导入前保留原文');
  assert.deepEqual(doc(storage).history.map(entry => entry.rawText), ['{invalid-import', 'not a project']);
  const corrupt = '{protection-broken'; storage.map.set(key, corrupt);
  assert.throws(() => setup(storage).inspect()); assert.equal(setup(storage).exportProtection(), corrupt);
});

test('storage read errors do not write and invalidation blocks future writes', () => {
  const storage = new Memory(), S = setup(storage); storage.map.set(oldKey, 'raw old'); storage.getFail = key;
  assert.throws(() => S.inspect(), /get denied/); assert.equal(storage.writes.length, 0);
  storage.getFail = null; S.invalidate(); assert.throws(() => S.preserve(['draft'], 'protect'), /已停止/);
  assert.equal(S.exportLegacy(), 'raw old');
});

test('history is exact-raw deduplicated and refuses capacity without evicting', () => {
  const storage = new Memory(), S = setup(storage); S.inspect(); S.save(raw({ maxSteps: null }));
  const texts = Array.from({ length: 10 }, (_, i) => raw({ name: `历史${i}`, maxSteps: null }));
  S.preserve(texts, 'ten'); S.preserve(texts, 'same'); assert.equal(doc(storage).history.length, 10);
  assert.equal(doc(storage).history.length, 10);
  assert.throws(() => S.preserve(['eleventh'], 'capacity'), /历史已达10条/);
  assert.equal(doc(storage).history.length, 10);
});

test('stale explicit selection and clear are rejected', () => {
  const storage = new Memory(), A = setup(storage); A.inspect(); A.save(raw({ maxSteps: null }));
  const snapshot = A.inspect(), B = setup(storage); B.inspect(); B.preserve(['external raw'], 'other');
  assert.throws(() => A.select(snapshot, 0), /已修改/);
  const C = setup(storage), preview = C.previewClear(); C.clearHistory(true, preview.expectedRaw);
  assert.throws(() => C.clearProtection(true, preview.expectedRaw), /已变化|确认已过时/);
});

test('whole protection clear preserves the old mirror and requires explicit confirmation', () => {
  const storage = new Memory(), oldRaw = raw(), S = setup(storage); storage.map.set(oldKey, oldRaw);
  S.inspect(); S.save(raw({ maxSteps: null })); S.preserve(['invalid raw'], 'keep');
  const preview = S.previewClear();
  assert.throws(() => S.clearProtection(false, preview.expectedRaw), /确认/);
  S.clearProtection(true, preview.expectedRaw);
  assert.equal(storage.map.has(key), false); assert.equal(storage.map.get(oldKey), oldRaw);
});

test('protection collection import merges history without replacing the active project or legacy mirror', () => {
  const source = new Memory(), A = setup(source); A.inspect(); A.save(raw({ maxSteps: 17, opaque: 'incoming' }));
  const incoming = JSON.parse(source.map.get(key)); incoming.futureHeader = { keep: true };
  const target = new Memory(), B = setup(target); B.inspect(); B.save(raw({ maxSteps: 9, name: 'active' }));
  const active = target.map.get(oldKey), full = doc(target).current.fullText;
  B.importProtection(JSON.stringify(incoming));
  assert.equal(target.map.get(oldKey), active); assert.equal(doc(target).current.fullText, full);
  assert.deepEqual(doc(target).futureHeader, { keep: true });
});

test('large protection data fails before touching old mirror; forged arbitrary Max cap does not validate', () => {
  const storage = new Memory(), oldRaw = raw(); storage.map.set(oldKey, oldRaw); const S = setup(storage); S.inspect();
  assert.throws(() => S.save(raw({ maxSteps: null, description: 'x'.repeat(1_600_000) })), /3MiB/);
  assert.equal(storage.map.get(oldKey), oldRaw); assert.equal(storage.map.has(key), false);
  S.save(raw({ maxSteps: null })); const record = doc(storage); record.current.legacyMaxSteps = 1000000;
  storage.map.set(key, JSON.stringify(record)); assert.throws(() => setup(storage).inspect());
});
