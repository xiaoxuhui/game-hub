import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createLambdaStorage } from '../scripts/lambda-storage-integration.mjs';
import { createLambdaC5Storage, inspectLambdaC5Storage, resolveLambdaC5Storage } from '../scripts/lambda-storage-c5.mjs';

const oldFixture = JSON.parse(readFileSync(new URL('./fixtures/lambda-content3-reader.json', import.meta.url), 'utf8'));
const currentFixture = JSON.parse(readFileSync(new URL('./fixtures/lambda-content4-reader.json', import.meta.url), 'utf8'));
function reader(fixture) {
  const context = { TextEncoder, TextDecoder };
  for (const source of fixture.scripts) runInNewContext(source, context);
  return { C: context.LambdaCore, P: context.LambdaPresets, S: context.LambdaSnapshot };
}
const old = reader(oldFixture);
const current = reader(currentFixture);
function storage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return { map, getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
}
function oldState(draft = 'λx.x', version = 3) {
  return old.S.encode(old.S.decode(JSON.stringify({
    version, draft, functions: [], completed: [1, 2, 3], mode: 'free', level: 0,
    session: { original: old.C.parse(draft), steps: 0, dirty: false, halt: '', paths: [] },
    view: { speed: 600, strategy: 'normal', direction: 'left', scale: 1, autoFit: true, panX: 0, panY: 0, historyOpen: false, helpOpen: false, hintOpen: false },
    selection: { start: 0, end: 0 }, error: ''
  })));
}
function fullText(draft = '(λa.a) u') {
  const term = current.C.parse(draft);
  return current.S.encode({
    version: 3, draft, functions: [], completed: current.P.levels.map(level => level.id), mode: 'challenge', level: 29,
    session: { original: term, steps: 0, dirty: false, halt: '', paths: [] },
    view: { speed: 600, strategy: 'normal', direction: 'left', numberEncoding: 'decimal', decimalPlaces: 4, scale: 1, autoFit: true, panX: 0, panY: 0, historyOpen: false, helpOpen: false, hintOpen: false },
    selection: { start: 0, end: 0 }, error: '', functionDraft: { name: '', source: '' }
  });
}
function content3Pair(draft = 'λx.x') {
  const s = storage();
  const oldAdapter = createLambdaStorage(s, old.S, () => false);
  oldAdapter.setItem('lambda-lab-hub-v3', oldState(draft, 3));
  return s;
}

test('inspection is read-only and recognizes empty, healthy and safely migratable stores', () => {
  const empty = storage();
  const emptyBefore = new Map(empty.map);
  const emptyState = inspectLambdaC5Storage(empty, current.S, old.S);
  assert.equal(emptyState.current.status, 'empty');
  assert.equal(emptyState.checkpoint.status, 'empty');
  assert.deepEqual(empty.map, emptyBefore);

  const legacy = content3Pair();
  const legacyBefore = new Map(legacy.map);
  const migration = inspectLambdaC5Storage(legacy, current.S, old.S);
  assert.equal(migration.current.status, 'migrate');
  assert.equal(migration.current.autoChoice, 'v3');
  assert.deepEqual(legacy.map, legacyBefore);

  createLambdaC5Storage(empty, current.S, old.S).setItem('lambda-lab-hub-v4', fullText());
  assert.equal(inspectLambdaC5Storage(empty, current.S, old.S).current.status, 'healthy');
});

test('v2-only legacy state migrates automatically, but an explicit ready-with-missing-mirror mismatch does not', () => {
  const s = storage({ 'lambda-lab-v2': oldState('λold.old', 2) });
  const inspected = inspectLambdaC5Storage(s, current.S, old.S);
  assert.equal(inspected.current.status, 'migrate');
  assert.equal(inspected.current.autoChoice, 'v2');
  assert.equal(resolveLambdaC5Storage(s, current.S, old.S, { kind: 'current', inspection: inspected }).status, 'resolved');
  assert.equal(current.C.format(current.S.decode(s.getItem('lambda-lab-hub-v4')).term), 'λold.old');
  assert.notEqual(s.getItem('lambda-lab-hub-c5-conflict-archive-v1'), null);

  const mismatch = storage({
    'lambda-lab-v2': oldState('λold.old', 2),
    'lambda-lab-hub-mirror-ready-v3': JSON.stringify({ auto: true, checkpoint: false })
  });
  assert.equal(inspectLambdaC5Storage(mismatch, current.S, old.S).current.status, 'conflict');
});

test('divergent v3 and v2 are candidates and cancel changes no storage byte', () => {
  const s = content3Pair();
  const before = new Map(s.map);
  s.setItem('lambda-lab-v2', oldState('λy.y', 2));
  const inspected = inspectLambdaC5Storage(s, current.S, old.S);
  assert.equal(inspected.current.status, 'conflict');
  assert.deepEqual(inspected.current.candidates.map(c => c.id), ['v3', 'v2']);
  const conflictBytes = new Map(s.map);
  assert.equal(resolveLambdaC5Storage(s, current.S, old.S, { kind: 'current', choice: 'cancel', inspection: inspected }).status, 'cancelled');
  assert.deepEqual(s.map, conflictBytes);
  assert.notDeepEqual(conflictBytes, before);
});

test('explicit v2 choice archives exact source bytes before creating the new full save', () => {
  const s = content3Pair();
  const v2Before = oldState('λz.z', 2);
  s.setItem('lambda-lab-v2', v2Before);
  const inspection = inspectLambdaC5Storage(s, current.S, old.S);
  const chosenV2 = inspection.current.candidates.find(c => c.id === 'v2');
  const result = resolveLambdaC5Storage(s, current.S, old.S, { kind: 'current', choice: 'v2', inspection });
  assert.equal(result.status, 'resolved');
  assert.equal(current.C.format(current.S.decode(s.getItem('lambda-lab-hub-v4')).term), 'λz.z');
  const archive = JSON.parse(s.getItem('lambda-lab-hub-c5-conflict-archive-v1'));
  assert.equal(archive.entries.length, 1);
  assert.equal(archive.entries[0].snapshot['lambda-lab-v2'], v2Before);
  assert.equal(archive.entries[0].snapshot['lambda-lab-hub-v3'], inspection.snapshot['lambda-lab-hub-v3']);
  assert.equal(chosenV2.id, 'v2');
  assert.equal(inspectLambdaC5Storage(s, current.S, old.S).current.status, 'healthy');
});

test('a real content3 writer that updates both legacy mirrors conflicts with the newer full save', () => {
  const s = storage();
  createLambdaC5Storage(s, current.S, old.S).setItem('lambda-lab-hub-v4', fullText());
  const oldAdapter = createLambdaStorage(s, old.S, () => false);
  const legacy = old.S.decode(oldAdapter.getItem('lambda-lab-hub-v3'));
  legacy.draft = 'λedited.edited'; legacy.session.original = old.C.parse('λedited.edited');
  oldAdapter.setItem('lambda-lab-hub-v3', old.S.encode(legacy));
  const inspected = inspectLambdaC5Storage(s, current.S, old.S);
  assert.equal(inspected.current.status, 'conflict');
  assert.deepEqual(inspected.current.candidates.map(candidate => candidate.id), ['v4', 'v3', 'v2']);
  const before = s.getItem('lambda-lab-hub-v4');
  resolveLambdaC5Storage(s, current.S, old.S, { kind: 'current', choice: 'v4', inspection: inspected });
  assert.equal(s.getItem('lambda-lab-hub-v4'), before);
  assert.equal(current.C.format(current.S.decode(s.getItem('lambda-lab-hub-v4')).term), '(λa.a) u');
  assert.equal(old.C.format(old.S.decode(s.getItem('lambda-lab-hub-v3')).term), '(λa.a) u');
  const archive = JSON.parse(s.getItem('lambda-lab-hub-c5-conflict-archive-v1'));
  assert.notEqual(archive.entries[0].snapshot['lambda-lab-hub-v3'], s.getItem('lambda-lab-hub-v3'));
});

test('a content3 journal or nonempty edit archive forces explicit review and is preserved in the archive', () => {
  const s = content3Pair();
  s.setItem('lambda-lab-hub-journal-v3', JSON.stringify({ schemaVersion: 1, before: [], after: [] }));
  s.setItem('lambda-lab-hub-old-edit-archive-v3', JSON.stringify([oldState('λy.y')]));
  const inspected = inspectLambdaC5Storage(s, current.S, old.S);
  assert.equal(inspected.current.status, 'conflict');
  assert.ok(inspected.current.metadata.includes('content3-journal'));
  assert.ok(inspected.current.metadata.includes('old-adapter-history'));
  resolveLambdaC5Storage(s, current.S, old.S, { kind: 'current', choice: 'v3', inspection: inspected });
  const saved = JSON.parse(s.getItem('lambda-lab-hub-c5-conflict-archive-v1')).entries[0].snapshot;
  assert.notEqual(saved['lambda-lab-hub-journal-v3'], null);
  assert.notEqual(saved['lambda-lab-hub-old-edit-archive-v3'], null);
});

test('an interrupted C5 journal is never auto-replayed and can be resolved only after archiving its raw record', () => {
  const s = storage();
  const c5 = createLambdaC5Storage(s, current.S, old.S);
  c5.setItem('lambda-lab-hub-v4', fullText());
  const oldSet = s.setItem;
  s.setItem = (key, value) => { if (key === 'lambda-lab-hub-v3') throw Error('injected C5 interruption'); oldSet(key, value); };
  assert.throws(() => c5.setItem('lambda-lab-hub-v4', fullText('λpending.pending')), /injected C5 interruption/);
  s.setItem = oldSet;
  const journalRaw = s.getItem('lambda-lab-hub-journal-v4');
  const inspected = inspectLambdaC5Storage(s, current.S, old.S);
  assert.equal(inspected.current.status, 'conflict');
  assert.ok(inspected.current.metadata.includes('c5-journal'));
  resolveLambdaC5Storage(s, current.S, old.S, { kind: 'current', choice: 'v3', inspection: inspected });
  const archived = JSON.parse(s.getItem('lambda-lab-hub-c5-conflict-archive-v1')).entries[0].snapshot;
  assert.equal(archived['lambda-lab-hub-journal-v4'], journalRaw);
  assert.equal(s.getItem('lambda-lab-hub-journal-v4'), null);
  assert.equal(inspectLambdaC5Storage(s, current.S, old.S).current.status, 'healthy');
});

test('the old checkpoint double-delete plus ready=false is a tombstone with explicit clear or restore choices', () => {
  const s = storage();
  const c5 = createLambdaC5Storage(s, current.S, old.S);
  c5.setItem('lambda-lab-hub-v4', fullText());
  c5.setItem('lambda-lab-hub-checkpoint-v4', fullText('λq.q'));
  const oldAdapter = createLambdaStorage(s, old.S, () => false);
  oldAdapter.removeItem('lambda-lab-hub-checkpoint-v3');
  const inspected = inspectLambdaC5Storage(s, current.S, old.S);
  assert.equal(inspected.checkpoint.status, 'tombstone');
  const before = new Map(s.map);
  assert.equal(resolveLambdaC5Storage(s, current.S, old.S, { kind: 'checkpoint', choice: 'cancel', inspection: inspected }).status, 'cancelled');
  assert.deepEqual(s.map, before);
  assert.equal(resolveLambdaC5Storage(s, current.S, old.S, { kind: 'checkpoint', choice: 'clear', inspection: inspected }).status, 'cleared');
  assert.equal(s.getItem('lambda-lab-hub-checkpoint-v4'), null);
  assert.notEqual(s.getItem('lambda-lab-hub-c5-checkpoint-tombstone-v1'), null);
  assert.equal(inspectLambdaC5Storage(s, current.S, old.S).checkpoint.status, 'empty');
});

test('restoring the full tombstoned checkpoint is explicit and recreates only validated compatibility mirrors', () => {
  const s = storage();
  const c5 = createLambdaC5Storage(s, current.S, old.S);
  c5.setItem('lambda-lab-hub-v4', fullText());
  const cp = fullText('λq.q');
  c5.setItem('lambda-lab-hub-checkpoint-v4', cp);
  createLambdaStorage(s, old.S, () => false).removeItem('lambda-lab-hub-checkpoint-v3');
  const inspected = inspectLambdaC5Storage(s, current.S, old.S);
  resolveLambdaC5Storage(s, current.S, old.S, { kind: 'checkpoint', choice: 'v4', inspection: inspected });
  assert.equal(s.getItem('lambda-lab-hub-checkpoint-v4'), cp);
  assert.equal(old.S.decode(s.getItem('lambda-lab-hub-checkpoint-v3')).level, 0);
  assert.equal(JSON.parse(s.getItem('lambda-lab-hub-mirror-ready-v3')).checkpoint, true);
  assert.equal(inspectLambdaC5Storage(s, current.S, old.S).checkpoint.status, 'healthy');
});

test('a stale inspection cannot resolve after another writer changes storage', () => {
  const s = content3Pair();
  const inspected = inspectLambdaC5Storage(s, current.S, old.S);
  s.setItem('lambda-lab-v1', 'new legacy data');
  const afterWriter = new Map(s.map);
  assert.throws(() => resolveLambdaC5Storage(s, current.S, old.S, { kind: 'current', choice: 'v3', inspection: inspected }), /changed since conflict inspection/);
  assert.deepEqual(s.map, afterWriter);
});

test('an observed same-origin storage event invalidates the session and exports both observed layers', () => {
  const s = storage();
  const listeners = new Set();
  const eventTarget = {
    addEventListener: (type, fn) => { if (type === 'storage') listeners.add(fn); },
    removeEventListener: (type, fn) => { if (type === 'storage') listeners.delete(fn); }
  };
  const c5 = createLambdaC5Storage(s, current.S, old.S, { eventTarget });
  const text = fullText();
  c5.setItem('lambda-lab-hub-v4', text);
  const oldValue = s.getItem('lambda-lab-v2');
  const newValue = oldState('λexternal.y', 2);
  s.setItem('lambda-lab-v2', newValue);
  for (const listener of listeners) listener({ key: 'lambda-lab-v2', oldValue, newValue });
  const observed = JSON.parse(c5.exportObserved());
  assert.equal(observed.event.key, 'lambda-lab-v2');
  assert.equal(observed.snapshot['lambda-lab-hub-v4'], text);
  assert.equal(observed.snapshot['lambda-lab-v2'], newValue);
  assert.throws(() => c5.getItem('lambda-lab-hub-v4'), /invalidated by an external storage change/);
  assert.throws(() => c5.setItem('lambda-lab-hub-v4', fullText('λnew.new')), /invalidated by an external storage change/);
  assert.equal(s.getItem('lambda-lab-v4'), null);
  c5.dispose();
  assert.equal(listeners.size, 0);
});

test('archive quota failure leaves every source key unchanged and removes only its empty transaction journal', () => {
  const s = content3Pair();
  const inspected = inspectLambdaC5Storage(s, current.S, old.S);
  const before = new Map(s.map);
  const set = s.setItem;
  s.setItem = (key, value) => { if (key === 'lambda-lab-hub-c5-conflict-archive-v1') throw Error('quota'); set(key, value); };
  assert.throws(() => resolveLambdaC5Storage(s, current.S, old.S, { kind: 'current', choice: 'v3', inspection: inspected }), /quota/);
  s.setItem = set;
  for (const [key, value] of before) assert.equal(s.getItem(key), value);
  assert.equal(s.getItem('lambda-lab-hub-journal-v4'), null);
});
