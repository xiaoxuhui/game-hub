import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createZip, readStoredZip, inspectResources } from '../scripts/resource-bundle.mjs';
import { strictJson, safePath, mime, sha256, CONTRACTS, signCatalog, verifyEnvelope, validateCatalog, assetName } from '../scripts/resource-protocol.mjs';
import { attachAssets } from '../scripts/resource-catalog.mjs';

const sources = JSON.parse(readFileSync(new URL('../sources.lock.json', import.meta.url))).sources;
const now = Date.UTC(2026, 9, 8);
const game = (source, i) => ({ id: source.id, version: source.version, contentCode: 1, sourceRepository: source.repository, sourceRevision: source.revision, minHostVersionCode: 3, maxHostVersionCode: 4, resourceProtocol: 1, storageContract: CONTRACTS[source.id], entryPage: source.entryPage, assetId: i + 10, archiveBytes: 100, archiveSha256: 'a'.repeat(64), files: [source.entryPage, 'LICENSE'].map(path => ({ path, bytes: 10, sha256: 'b'.repeat(64), mime: mime(path) })), releaseNotes: '兼容资源' });
const catalog = () => ({ schemaVersion: 1, channel: 'game-hub-resources-v1', releaseId: 1, catalogSequence: '1', issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + 86400000).toISOString(), games: sources.map(game) });

test('strict parser rejects duplicate escaped keys, UTF8 corruption and invalid JSON', () => {
  for (const value of ['{"x":1,"x":2}', '{"x":1,"\\u0078":2}', '[1,]', '{"x":}', '1 2', '\ufeff{}', '[1e999]']) assert.throws(() => strictJson(Buffer.from(value)));
  assert.throws(() => strictJson(Buffer.from([0xff])));
  assert.equal(strictJson(Buffer.from('{"x":[true,null,"好"]}')).x[2], '好');
});
test('resource paths reject traversal, native binaries, prefix conflicts and case duplicates', () => {
  for (const path of ['../x', '/x', 'a\\b', 'a//b', 'C:x', 'a/./b', 'a.jar', 'x.so']) assert.throws(() => safePath(path));
  for (const paths of [['a','a/b'], ['A','a']]) assert.throws(() => createZip(paths.map(path => ({ path, data: Buffer.from('x') }))));
});
test('ZIP bytes deterministic regardless input order; CRC and central directory tamper rejected', () => {
  const entries = [{ path: 'index.html', data: Buffer.from('你好') }, { path: 'LICENSE', data: Buffer.from('MIT License') }];
  const zip = createZip(entries); assert.deepEqual(zip, createZip([...entries].reverse()));
  assert.equal(readStoredZip(zip).length, 2);
  const broken = Buffer.from(zip); broken[38] ^= 1; assert.throws(() => readStoredZip(broken));
  const central = Buffer.from(zip); central[central.length - 1] ^= 1; assert.throws(() => readStoredZip(central));
  assert.throws(() => readStoredZip(zip.subarray(0, zip.length - 1)));
});
test('resource inspection rejects service workers, cache proxies and broad storage clear', () => {
  for (const text of ['navigator.serviceWorker.register("sw.js")', 'caches.open("x")', 'localStorage.clear()']) assert.throws(() => inspectResources([{ path: 'app.js', data: Buffer.from(text) }], 'conway'));
  assert.doesNotThrow(() => inspectResources([{ path: 'app.js', data: Buffer.from('localStorage.getItem("save")') }], 'conway'));
});
test('catalog checks four identities, safe integer bounds, clock, entry and storage contracts', () => {
  assert.doesNotThrow(() => validateCatalog(catalog(), sources, now));
  const changes = [c => { c.games[1] = c.games[0]; }, c => { c.games[0].contentCode = 1.2; }, c => { c.games[0].storageContract = 'migrated'; }, c => { c.catalogSequence = '9223372036854775808'; }, c => { c.games[0].files.push(c.games[0].files[0]); }, c => { c.games[0].sourceRepository = 'https://evil.example'; }];
  for (const change of changes) { const c = catalog(); change(c); assert.throws(() => validateCatalog(c, sources, now)); }
  assert.throws(() => validateCatalog(catalog(), sources, now + 86400000));
});
test('RSA3072 signature binds raw payload; wrong key/id, tamper and duplicate envelope rejected', () => {
  const keys = generateKeyPairSync('rsa', { modulusLength: 3072 });
  const pub = keys.publicKey.export({ type: 'spki', format: 'pem' });
  const envelope = signCatalog(catalog(), keys.privateKey, 'test');
  const verified = verifyEnvelope(envelope, pub, 'test'); assert.equal(verified.catalog.catalogSequence, '1');
  const altered = JSON.parse(envelope); altered.payloadBase64 = Buffer.from('{}').toString('base64');
  assert.throws(() => verifyEnvelope(Buffer.from(JSON.stringify(altered)), pub, 'test'));
  assert.throws(() => verifyEnvelope(envelope, pub, 'unknown'));
  assert.throws(() => verifyEnvelope(Buffer.from(envelope.toString().replace('"envelopeVersion":1', '"envelopeVersion":1,"envelopeVersion":1')), pub, 'test'));
  assert.match(sha256(envelope), /^[0-9a-f]{64}$/);
});
test('resource release must be prerelease and uploaded assets uniquely bind digest and size', () => {
  const games = catalog().games; const release = { id: 1, tag_name: 'game-resources-v1', draft: false, prerelease: true };
  const assets = games.map(g => ({ id: g.assetId, name: assetName(g), size: g.archiveBytes, state: 'uploaded', digest: `sha256:${g.archiveSha256}` }));
  assert.equal(attachAssets(games, release, assets).length, 4);
  assert.throws(() => attachAssets(games, { ...release, prerelease: false }, assets));
  assert.throws(() => attachAssets(games, release, [...assets, assets[0]]));
  assert.throws(() => attachAssets(games, release, assets.map(a => ({ ...a, size: 1 }))));
});
