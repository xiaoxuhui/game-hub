import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { assertReferences, buildManifest, collectReferences, safeRelative, validateLock } from '../scripts/bundle.mjs';

const lock = JSON.parse(readFileSync(new URL('../sources.lock.json', import.meta.url), 'utf8'));

test('lock contains four immutable source revisions and unique IDs', () => {
  assert.equal(validateLock(lock).sources.length, 4);
  assert.equal(new Set(lock.sources.map((source) => source.revision)).size, 4);
  for (const source of lock.sources) assert.match(source.revision, /^[0-9a-f]{40}$/);
});

test('floating revision, duplicate IDs, and unsafe paths are rejected', () => {
  const altered = structuredClone(lock);
  altered.sources[0].revision = 'main';
  assert.throws(() => validateLock(altered), /full immutable Git SHA/);
  altered.sources[0].revision = lock.sources[0].revision;
  altered.sources[1].id = altered.sources[0].id;
  assert.throws(() => validateLock(altered), /duplicate/);
  assert.throws(() => safeRelative('../private.txt'), /Unsafe/);
  assert.throws(() => safeRelative('/remote.js'), /Unsafe/);
  assert.throws(() => safeRelative('a\\b'), /Unsafe/);
});

test('HTML references exclude external and fragment links while preserving local assets', () => {
  const refs = collectReferences('<link href="./style.css?v=1"><script src="scripts/app.js"></script><a href="#a"></a><img src="data:image/png;base64,AA"><a href="https://example.org"></a>');
  assert.deepEqual(refs, ['style.css', 'scripts/app.js']);
});

test('missing local HTML reference stops bundling', () => {
  const root = mkdtempSync(join(tmpdir(), 'game-hub-test-'));
  try {
    writeFileSync(join(root, 'index.html'), '<script src="missing.js"></script>');
    assert.throws(() => assertReferences(root), /Missing HTML reference/);
    writeFileSync(join(root, 'missing.js'), 'console.log(1)');
    assert.doesNotThrow(() => assertReferences(root));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('manifest hashes are stable and change when a resource changes', () => {
  const root = mkdtempSync(join(tmpdir(), 'game-hub-test-'));
  try {
    mkdirSync(join(root, 'conway'));
    const file = join(root, 'conway', 'index.html');
    writeFileSync(file, 'first');
    const first = buildManifest(root, [{ id: 'conway' }], 'a'.repeat(40));
    assert.deepEqual(first, buildManifest(root, [{ id: 'conway' }], 'a'.repeat(40)));
    assert.equal(first.files[0].bytes, 5);
    writeFileSync(file, 'second');
    assert.notEqual(first.files[0].sha256, buildManifest(root, [], 'a'.repeat(40)).files[0].sha256);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
