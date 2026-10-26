import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createLambdaStorage } from '../scripts/lambda-storage-integration.mjs';

// This fixture is the four actual inline modules used by the shipped reader.
// Its source HTML/proof identities are pinned so future resource updates do not
// silently replace the backwards-compatibility baseline.
const oldFixture = JSON.parse(readFileSync(new URL('./fixtures/lambda-content3-reader.json', import.meta.url), 'utf8'));

function readers(inline, indices) {
  const context = { TextEncoder, TextDecoder };
  for (const index of indices) runInNewContext(inline[index], context);
  return { C: context.LambdaCore, P: context.LambdaPresets, S: context.LambdaSnapshot };
}

const old = readers(oldFixture.scripts, [0, 1, 2, 3]);

function fullC5Snapshot() {
  return {
    version: 3,
    draft: '(λa.a) u',
    functions: [],
    completed: Array.from({ length: 30 }, (_, i) => i + 1),
    mode: 'challenge',
    level: 29,
    session: { original: old.C.parse('(λa.a) u'), steps: 0, dirty: false, halt: '', paths: [] },
    view: {
      speed: 600, strategy: 'normal', direction: 'left', numberEncoding: 'decimal', decimalPlaces: 4,
      scale: 1, autoFit: true, panX: 0, panY: 0, historyOpen: false, helpOpen: false, hintOpen: false
    },
    selection: { start: 0, end: 0 },
    error: '',
    functionDraft: { name: '', source: '' }
  };
}

function fiveLevelProjection(full) {
  const projected = structuredClone(full);
  projected.completed = projected.completed.filter(id => id <= 5);
  projected.mode = 'free';
  projected.level = 0;
  delete projected.view.numberEncoding;
  delete projected.view.decimalPlaces;
  // The issued reader ignores unknown top-level fields while validating its v2/v3 envelope.
  projected.lambdaHubC5 = { schemaVersion: 1, completedBeyondLegacy: [6, 30], numberEncoding: 'decimal', decimalPlaces: 4 };
  return projected;
}

function memoryStorage() {
  const map = new Map();
  return { map, getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
}

test('the issued content3 reader is the five-level a5eab9f5 resource', () => {
  assert.equal(oldFixture.schemaVersion, 1);
  assert.equal(oldFixture.issuedHtmlSha256, 'ac739314e6e9ec46aa1acb515ad20b1d7e889d1c22adab1eed777860c14b51f7');
  assert.equal(oldFixture.sourceProofSha256, '404c81336ff3d9ca1c5b7ee5de29aa977108aad6d98fda3b03187acfd8e72425');
  assert.equal(createHash('sha256').update(JSON.stringify(oldFixture.scripts)).digest('hex'), 'eafec1d7232927e80c22efc3508fef7eee407030846e33bc86b80ecab09af4e5');
  assert.equal(oldFixture.upstreamRevision, 'a5eab9f5c14f33d328f39858b6680e43c41ffa25');
  assert.deepEqual(oldFixture.scriptIndexes, [0, 3, 4, 5]);
  assert.equal(old.P.levels.length, 5);
});

test('the issued reader rejects full thirty-level progress and a new challenge selection', () => {
  const full = fullC5Snapshot();
  const encoded = JSON.stringify(full);
  assert.throws(() => old.S.decode(encoded), /通关进度不合法/);

  const onlyNewLevelSelected = { ...full, completed: [], level: 29 };
  assert.throws(() => old.S.decode(JSON.stringify(onlyNewLevelSelected)), /关卡编号不合法/);
});

test('content3 reader accepts the v2/v3 compatibility view and ignores C5-only extension fields', () => {
  const full = fullC5Snapshot();
  const projected = fiveLevelProjection(full);
  const encoded = JSON.stringify(projected);
  const decodedOld = old.S.decode(encoded);
  assert.equal(JSON.stringify(decodedOld.completed), JSON.stringify([1, 2, 3, 4, 5]));
  assert.equal(decodedOld.mode, 'free');
  assert.equal(decodedOld.level, 0);
  assert.equal(old.C.format(decodedOld.term), '(λa.a) u');
  assert.equal(Object.hasOwn(decodedOld, 'lambdaHubC5'), false);
  assert.equal(Object.hasOwn(decodedOld.view, 'numberEncoding'), false);
  assert.equal(Object.hasOwn(decodedOld.view, 'decimalPlaces'), false);
});

test('issued content3 adapter generates the exact older v2 base from the v3 projection', () => {
  const storage = memoryStorage();
  const legacyAdapter = createLambdaStorage(storage, old.S, () => false);
  legacyAdapter.setItem('lambda-lab-hub-v3', JSON.stringify(fiveLevelProjection(fullC5Snapshot())));

  const v3 = storage.getItem('lambda-lab-hub-v3');
  const v2 = storage.getItem('lambda-lab-v2');
  assert.ok(v3);
  assert.ok(v2);
  assert.equal(JSON.stringify(old.S.decode(v3).completed), JSON.stringify([1, 2, 3, 4, 5]));
  assert.equal(JSON.stringify(old.S.decode(v2).completed), JSON.stringify([1, 2, 3, 4, 5]));
  assert.equal(JSON.parse(v3).lambdaHubC5.completedBeyondLegacy[1], 30);
  assert.equal(JSON.parse(v2).lambdaHubC5, undefined);
  assert.deepEqual(JSON.parse(storage.getItem('lambda-lab-hub-mirror-ready-v3')), { auto: true, checkpoint: false });
});
