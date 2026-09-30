import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, lstatSync, copyFileSync, writeFileSync, renameSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(repoRoot, '.build');
const assetsRoot = join(repoRoot, 'android', 'app', 'src', 'main', 'assets');
const HEX_SHA = /^[0-9a-f]{40}$/;
const SAFE_ID = /^[a-z][a-z0-9-]*$/;

function ensureInside(root, target) {
  const rel = relative(resolve(root), resolve(target));
  if (rel === '' || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    throw new Error(`Path must be a child of ${root}: ${target}`);
  }
  return target;
}

function cleanChild(root, target) {
  ensureInside(root, target);
  rmSync(target, { recursive: true, force: true });
}

function safeRelative(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') || value.startsWith('/') || /^[A-Za-z]:/.test(value)) {
    throw new Error(`Unsafe asset path: ${value}`);
  }
  const parts = value.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) throw new Error(`Unsafe asset path: ${value}`);
  return value;
}

function validateLock(lock) {
  if (lock?.schemaVersion !== 1 || !Array.isArray(lock.sources) || lock.sources.length !== 4) throw new Error('Expected four locked sources');
  const ids = new Set();
  for (const source of lock.sources) {
    if (!SAFE_ID.test(source.id) || ids.has(source.id)) throw new Error(`Invalid or duplicate source id: ${source.id}`);
    ids.add(source.id);
    if (!HEX_SHA.test(source.revision)) throw new Error(`Source ${source.id} needs a full immutable Git SHA`);
    if (!/^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+\.git$/.test(source.repository)) throw new Error(`Invalid repository for ${source.id}`);
    if (!['static', 'eml', 'turing'].includes(source.buildKind)) throw new Error(`Unknown build kind: ${source.buildKind}`);
    safeRelative(source.entryPage);
    if (!Array.isArray(source.files) || !source.files.length) throw new Error(`Missing files for ${source.id}`);
    for (const name of source.files) {
      if (name === 'dist/**' && source.buildKind === 'turing') continue;
      safeRelative(name);
    }
  }
  if (['conway', 'eml', 'light', 'turing'].some((id) => !ids.has(id))) throw new Error('Unexpected source ids');
  return lock;
}

function run(binary, args, cwd) {
  const command = process.platform === 'win32' && binary === 'pnpm' ? 'pnpm.cmd' : binary;
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: 'inherit', shell: process.platform === 'win32' && binary === 'pnpm', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${binary} ${args.join(' ')} failed in ${cwd} (exit ${result.status})`);
}

function gitOutput(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  if (result.error || result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr?.trim() || result.error}`);
  return result.stdout.trim();
}

function sha256(data) { return createHash('sha256').update(data).digest('hex'); }

function listFiles(root, current = root) {
  const result = [];
  for (const item of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(current, item.name);
    if (item.isSymbolicLink()) throw new Error(`Symlink in built assets: ${full}`);
    if (item.isDirectory()) result.push(...listFiles(root, full));
    else if (item.isFile()) result.push(relative(root, full).split(sep).join('/'));
    else throw new Error(`Unsupported built asset: ${full}`);
  }
  return result;
}

function collectReferences(html) {
  const refs = [];
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const ref = match[1].split(/[?#]/, 1)[0];
    if (!ref || /^(?:data:|https?:|mailto:|tel:|javascript:)/i.test(ref)) continue;
    refs.push(safeRelative(ref));
  }
  return refs;
}

function assertReferences(gameDir) {
  for (const name of listFiles(gameDir).filter((name) => name.endsWith('.html'))) {
    const parent = dirname(name);
    for (const ref of collectReferences(readFileSync(join(gameDir, name), 'utf8'))) {
      const full = resolve(gameDir, parent, ref);
      ensureInside(gameDir, full);
      if (!existsSync(full) || !statSync(full).isFile()) throw new Error(`Missing HTML reference in ${name}: ${ref}`);
    }
  }
}

function sourceCloneUrl(source) {
  const localRoot = process.env.GAME_HUB_LOCAL_SOURCES;
  if (!localRoot) return source.repository;
  const repoName = basename(source.repository, '.git');
  const local = join(localRoot, repoName);
  if (!existsSync(local)) throw new Error(`Missing local source: ${local}`);
  if (gitOutput(['rev-parse', 'HEAD'], local) !== source.revision) throw new Error(`Original HEAD moved: ${source.id}`);
  if (gitOutput(['status', '--porcelain=v1', '--untracked-files=all'], local)) throw new Error(`Original worktree is dirty: ${source.id}`);
  return local;
}

function stageSource(source, staging, gamesDir) {
  const checkout = join(staging, 'sources', source.id);
  const origin = sourceCloneUrl(source);
  run('git', ['clone', '--quiet', '--no-local', '--no-checkout', origin, checkout], repoRoot);
  run('git', ['checkout', '--quiet', '--detach', source.revision], checkout);
  const actual = gitOutput(['rev-parse', 'HEAD'], checkout);
  if (actual !== source.revision) throw new Error(`Revision mismatch for ${source.id}: ${actual}`);
  const packageFile = JSON.parse(readFileSync(join(checkout, 'package.json'), 'utf8'));
  if (packageFile.version !== source.version) throw new Error(`Version mismatch for ${source.id}`);
  if (source.buildKind === 'eml') run(process.execPath, ['scripts/build.mjs'], checkout);
  if (source.buildKind === 'turing') {
    run('pnpm', ['install', '--frozen-lockfile'], checkout);
    run('pnpm', ['run', 'typecheck'], checkout);
    run('pnpm', ['run', 'build:android'], checkout);
  }
  const gameDir = join(gamesDir, source.id);
  mkdirSync(gameDir, { recursive: true });
  let files = source.files;
  if (source.buildKind === 'turing') files = listFiles(join(checkout, 'dist')).map((name) => `dist/${name}`);
  for (const item of files) {
    safeRelative(item);
    const from = join(checkout, ...item.split('/'));
    if (!existsSync(from) || !lstatSync(from).isFile()) throw new Error(`Missing required resource for ${source.id}: ${item}`);
    const target = source.buildKind === 'static' ? item : item.replace(/^dist\//, '');
    const to = join(gameDir, ...target.split('/'));
    ensureInside(gameDir, to);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
  if (!existsSync(join(gameDir, source.entryPage))) throw new Error(`Missing entry for ${source.id}: ${source.entryPage}`);
  if (source.id === 'turing') {
    if (!existsSync(join(gameDir, 'campaign.html'))) throw new Error('Missing turing campaign.html');
    if (!listFiles(gameDir).some((name) => /route-worker.*\.js$/.test(name))) throw new Error('Missing turing Worker');
  }
  assertReferences(gameDir);
  if (process.env.GAME_HUB_LOCAL_SOURCES) sourceCloneUrl(source);
  return { id: source.id, displayName: source.displayName, repository: source.repository, revision: source.revision, version: source.version, entryPage: source.entryPage };
}

function buildManifest(gamesDir, sources, bundleCommit) {
  const files = listFiles(gamesDir).map((name) => {
    const data = readFileSync(join(gamesDir, ...name.split('/')));
    return { path: `games/${name}`, bytes: data.length, sha256: sha256(data) };
  });
  return { schemaVersion: 1, bundleCommit, sources, files };
}

function bundle() {
  const lock = validateLock(JSON.parse(readFileSync(join(repoRoot, 'sources.lock.json'), 'utf8')));
  const bundleCommit = gitOutput(['rev-parse', 'HEAD'], repoRoot);
  if (gitOutput(['status', '--porcelain=v1', '--untracked-files=all'], repoRoot)) throw new Error('Bundle must run from a clean independent checkout');
  mkdirSync(sourceRoot, { recursive: true });
  mkdirSync(dirname(assetsRoot), { recursive: true });
  cleanChild(repoRoot, assetsRoot);
  const staging = join(sourceRoot, `bundle-${process.pid}-${Date.now()}`);
  const payload = join(staging, 'payload');
  mkdirSync(join(payload, 'games'), { recursive: true });
  try {
    const sources = lock.sources.map((source) => stageSource(source, staging, join(payload, 'games')));
    const manifest = buildManifest(join(payload, 'games'), sources, bundleCommit);
    writeFileSync(join(payload, 'bundle-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    mkdirSync(dirname(assetsRoot), { recursive: true });
    renameSync(payload, assetsRoot);
    cleanChild(sourceRoot, staging);
    console.log(`Bundled ${sources.length} sources, ${manifest.files.length} files, commit ${bundleCommit}`);
    console.log(`Manifest SHA-256: ${sha256(readFileSync(join(assetsRoot, 'bundle-manifest.json')))}`);
  } catch (error) {
    cleanChild(sourceRoot, staging);
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { bundle(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

export { safeRelative, validateLock, collectReferences, assertReferences, buildManifest, bundle };
