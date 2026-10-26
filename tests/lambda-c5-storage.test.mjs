import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { createLambdaC5Storage } from '../scripts/lambda-storage-c5.mjs';
import { createLambdaStorage } from '../scripts/lambda-storage-integration.mjs';

const oldFixture = JSON.parse(readFileSync(new URL('./fixtures/lambda-content3-reader.json', import.meta.url), 'utf8'));
const currentFixture = JSON.parse(readFileSync(new URL('./fixtures/lambda-content4-reader.json', import.meta.url), 'utf8'));
function oldSnapshot() {
  const context = { TextEncoder, TextDecoder };
  for (const source of oldFixture.scripts) runInNewContext(source, context);
  return { C: context.LambdaCore, S: context.LambdaSnapshot };
}
const old = oldSnapshot();
function currentSnapshot() {
  const context = { TextEncoder, TextDecoder };
  for (const source of currentFixture.scripts) runInNewContext(source, context);
  return { C: context.LambdaCore, P: context.LambdaPresets, S: context.LambdaSnapshot };
}
const current = currentSnapshot();
function fullSnapshot(overrides = {}) {
  return {
    version: 3,
    draft: '(λa.a) u',
    functions: [{ name: 'IDENT', term: current.C.parse('λx.x'), source: 'λx.x' }],
    completed: current.P.levels.map(level => level.id),
    mode: 'challenge',
    level: 29,
    session: { original: current.C.parse('(λa.a) u'), steps: 0, dirty: false, halt: '', paths: [] },
    view: { speed: 321, strategy: 'normal', direction: 'left', numberEncoding: 'decimal', decimalPlaces: 4, scale: 1, autoFit: true, panX: 0, panY: 0, historyOpen: false, helpOpen: false, hintOpen: false },
    selection: { start: 0, end: 0 },
    error: '',
    functionDraft: { name: '', source: '' },
    ...overrides
  };
}
const currentReader = current.S;
function encodedFull(overrides = {}) { return current.S.encode(fullSnapshot(overrides)); }
function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return { map, getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
}

test('C5 stores the complete new state and an actual content3-readable five-level projection', () => {
  assert.equal(currentFixture.upstreamRevision, '2ce0fa371e583bb9b57e74ace1f5cd2a7b14bd2c');
  assert.equal(currentFixture.builtHtmlSha256, '41B74AD08422447CC79B4DB4628036D75EFBE9C6379C8F890A4B018654952937');
  assert.equal(createHash('sha256').update(JSON.stringify(currentFixture.scripts)).digest('hex'), '20a8cf1807962ba0879622ae4db13c0dae4d6ab0df39654c93de0536cc62b4f4');
  assert.equal(current.P.levels.length, 30);
  const storage = memoryStorage();
  const adapter = createLambdaC5Storage(storage, currentReader, old.S);
  const full = encodedFull();
  adapter.setItem('lambda-lab-hub-v4', full);

  assert.equal(storage.getItem('lambda-lab-hub-v4'), full);
  assert.equal(current.S.decode(adapter.getItem('lambda-lab-hub-v4')).level, 29);
  const v3Text = storage.getItem('lambda-lab-hub-v3');
  const v2Text = storage.getItem('lambda-lab-v2');
  const v3 = old.S.decode(v3Text);
  const v2 = old.S.decode(v2Text);
  assert.equal(JSON.stringify(v3.completed), JSON.stringify([1, 2, 3, 4, 5]));
  assert.equal(v3.mode, 'free');
  assert.equal(v3.level, 0);
  assert.equal(old.C.format(v3.term), '(λa.a) u');
  assert.equal(v3.view.speed, 321);
  assert.equal(v3.functions[0].name, 'IDENT');
  assert.equal(v2.version, 2);
  assert.equal(v2.session.steps, 0);
  assert.equal(JSON.parse(v3Text).lambdaHubC5.completedBeyondLegacy.length, 25);
  assert.equal(JSON.parse(v2Text).lambdaHubC5, undefined);
  assert.deepEqual(JSON.parse(storage.getItem('lambda-lab-hub-mirror-ready-v3')), { auto: true, checkpoint: false });
});

test('the v2 mirror is exactly the fixed issued content3 adapter base of v3', () => {
  const storage = memoryStorage();
  createLambdaC5Storage(storage, currentReader, old.S).setItem('lambda-lab-hub-v4', encodedFull());
  const v3 = storage.getItem('lambda-lab-hub-v3');
  const oldCopy = JSON.parse(old.S.encode(old.S.decode(v3)));
  const term = old.S.decode(v3).term;
  oldCopy.version = 2;
  oldCopy.session = { ...oldCopy.session, original: term, steps: 0 };
  delete oldCopy.session.paths;
  oldCopy.functions = oldCopy.functions.map(({ name, term: fnTerm }) => ({ name, term: fnTerm }));
  oldCopy.view.strategy = 'normal';
  oldCopy.view.direction = 'left';
  assert.equal(storage.getItem('lambda-lab-v2'), old.S.encode(oldCopy));
});

test('a content3 edit may strip the mirror extension but cannot change the authoritative v4 full save', () => {
  const storage = memoryStorage();
  const c5 = createLambdaC5Storage(storage, currentReader, old.S);
  const full = encodedFull();
  c5.setItem('lambda-lab-hub-v4', full);
  const oldAdapter = createLambdaStorage(storage, old.S, () => false);
  const legacy = old.S.decode(oldAdapter.getItem('lambda-lab-hub-v3'));
  legacy.view.speed = 177;
  oldAdapter.setItem('lambda-lab-hub-v3', old.S.encode(legacy));
  assert.equal(storage.getItem('lambda-lab-hub-v4'), full);
  assert.equal(old.S.decode(storage.getItem('lambda-lab-hub-v3')).view.speed, 177);
  assert.equal(JSON.parse(storage.getItem('lambda-lab-hub-v3')).lambdaHubC5, undefined);
});

test('content3 never receives new view fields and a level within its range remains selected', () => {
  const storage = memoryStorage();
  const full = fullSnapshot({ completed: [1, 3, 6], level: 4, mode: 'challenge' });
  createLambdaC5Storage(storage, currentReader, old.S).setItem('lambda-lab-hub-v4', current.S.encode(full));
  const v3Text = storage.getItem('lambda-lab-hub-v3');
  const v3 = old.S.decode(v3Text);
  assert.equal(v3.mode, 'challenge');
  assert.equal(v3.level, 4);
  assert.equal(JSON.stringify(v3.completed), JSON.stringify([1, 3]));
  assert.equal(Object.hasOwn(v3.view, 'numberEncoding'), false);
  assert.equal(Object.hasOwn(v3.view, 'decimalPlaces'), false);
});

test('checkpoint full state and compatibility mirrors are projected independently', () => {
  const storage = memoryStorage();
  const adapter = createLambdaC5Storage(storage, currentReader, old.S);
  const checkpoint = encodedFull({ draft: 'λq.q', completed: [2, 8, 30], level: 29 });
  adapter.setItem('lambda-lab-hub-checkpoint-v4', checkpoint);
  assert.equal(storage.getItem('lambda-lab-hub-checkpoint-v4'), checkpoint);
  const v3 = old.S.decode(storage.getItem('lambda-lab-hub-checkpoint-v3'));
  assert.equal(JSON.stringify(v3.completed), JSON.stringify([2]));
  assert.equal(v3.level, 0);
  assert.equal(old.S.decode(storage.getItem('lambda-lab-checkpoint-v2')).version, 2);
  const current = storage.getItem('lambda-lab-hub-v4');
  assert.equal(current, null);
});

test('invalid full snapshot is rejected before any compatibility key changes', () => {
  const storage = memoryStorage({ unrelated: 'untouched' });
  const adapter = createLambdaC5Storage(storage, currentReader, old.S);
  assert.throws(() => adapter.setItem('lambda-lab-hub-v4', JSON.stringify(fullSnapshot({ completed: [31] }))));
  assert.deepEqual([...storage.map], [['unrelated', 'untouched']]);
});
