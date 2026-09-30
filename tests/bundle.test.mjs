import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { assemble, assertReferences, buildManifest, collectReferences, safeRelative, validateLock, verifyBundle } from '../scripts/bundle.mjs';

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

test('failed checkout or missing locked resource preserves the last complete bundle', () => {
  const root = mkdtempSync(join(tmpdir(), 'game-hub-integration-'));
  const original = join(root, 'original');
  const hub = join(root, 'hub');
  const output = join(hub, 'android', 'app', 'src', 'main', 'assets');
  mkdirSync(original);
  mkdirSync(hub);
  const git = (args) => {
    const result = spawnSync('git', args, { cwd: original, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const priorEnv = process.env.GAME_HUB_LOCAL_SOURCES;
  delete process.env.GAME_HUB_LOCAL_SOURCES;
  try {
    git(['init', '-b', 'main']);
    git(['config', 'user.name', 'Test']);
    git(['config', 'user.email', 'test@example.invalid']);
    writeFileSync(join(original, 'package.json'), '{"version":"1.0.0"}');
    writeFileSync(join(original, 'index.html'), '<h1>fixture</h1>');
    writeFileSync(join(original, 'LICENSE'), 'MIT License\nfixture\n');
    writeFileSync(join(hub, 'LICENSE'), 'MIT License\nfixture hub\n');
    writeFileSync(join(hub, 'THIRD_PARTY_NOTICES.md'), '# 第三方许可与来源\nfixture\n');
    mkdirSync(join(hub, 'licenses'));
    writeFileSync(join(hub, 'licenses', 'Apache-2.0.txt'), 'Apache License\nVersion 2.0\nfixture\n');
    git(['add', '.']);
    git(['commit', '-m', 'fixture']);
    const sha = git(['rev-parse', 'HEAD']);
    const source = { id: 'fixture', displayName: 'Fixture', repository: original, revision: sha, version: '1.0.0', buildKind: 'static', entryPage: 'index.html', files: ['index.html'] };
    assemble([source], hub, output, 'a'.repeat(40));
    assert.equal(verifyBundle(output, [source], 'a'.repeat(40)).files.length, 5);
    assert.equal(readFileSync(join(output, 'games', 'fixture', 'LICENSE'), 'utf8'), 'MIT License\nfixture\n');
    assert.equal(readFileSync(join(output, 'games', 'LICENSE'), 'utf8'), 'MIT License\nfixture hub\n');
    assert.equal(readFileSync(join(output, 'games', 'THIRD_PARTY_NOTICES.md'), 'utf8'), '# 第三方许可与来源\nfixture\n');
    assert.throws(() => verifyBundle(output, [source], 'b'.repeat(40)), /does not match/);
    assert.throws(() => verifyBundle(output, [{ ...source, version: '9.9.9' }], 'a'.repeat(40)), /does not match/);
    writeFileSync(join(output, 'games', 'fixture', 'unregistered.js'), 'not in the manifest');
    assert.throws(() => verifyBundle(output, [source], 'a'.repeat(40)), /differ/);
    rmSync(join(output, 'games', 'fixture', 'unregistered.js'));
    const before = readFileSync(join(output, 'bundle-manifest.json'), 'utf8');
    assert.throws(() => assemble([{ ...source, revision: 'f'.repeat(40) }], hub, output, 'a'.repeat(40)), /failed|moved/i);
    assert.equal(readFileSync(join(output, 'bundle-manifest.json'), 'utf8'), before);
    assert.throws(() => assemble([{ ...source, files: ['missing.js'] }], hub, output, 'a'.repeat(40)), /Missing required resource/);
    assert.equal(readFileSync(join(output, 'bundle-manifest.json'), 'utf8'), before);
    assert.throws(() => assemble([{ ...source, files: ['../outside'] }], hub, output, 'a'.repeat(40)), /Unsafe asset path/);
    assert.equal(readFileSync(join(output, 'bundle-manifest.json'), 'utf8'), before);
    assert.ok(existsSync(join(output, 'games', 'fixture', 'index.html')));
    assert.equal(git(['status', '--porcelain=v1', '--untracked-files=all']), '');
  } finally {
    if (priorEnv === undefined) delete process.env.GAME_HUB_LOCAL_SOURCES;
    else process.env.GAME_HUB_LOCAL_SOURCES = priorEnv;
    rmSync(root, { recursive: true, force: true });
  }
});
