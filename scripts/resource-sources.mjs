import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLock, assemble } from './bundle.mjs';
import { strictJson, sha256, CONTRACTS } from './resource-protocol.mjs';

export function resourceInputs(root, independent = false) {
  const baselineBytes = readFileSync(join(root, 'sources.lock.json'));
  const sourceBytes = independent ? readFileSync(join(root, 'resource-sources.lock.json')) : baselineBytes;
  const codeBytes = readFileSync(join(root, 'resource-releases.lock.json'));
  const baseline = validateLock(strictJson(baselineBytes));
  const lock = validateLock(strictJson(sourceBytes));
  const releases = strictJson(codeBytes);
  if (releases.schemaVersion !== 1 || Object.keys(releases.games).sort().join() !== baseline.sources.map(s => s.id).sort().join()) throw new Error('Resource release identities');
  for (const source of lock.sources) {
    const original = baseline.sources.find(s => s.id === source.id), code = releases.games[source.id];
    if (['repository', 'buildKind', 'entryPage'].some(key => source[key] !== original[key])) throw new Error('Resource source contract mismatch');
    if (typeof source.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(source.version)) throw new Error('Resource source version');
    if (!Number.isSafeInteger(code.contentCode) || code.contentCode < 1 || code.contentCode > 2147483647 || code.sourceRevision !== source.revision || code.storageContract !== CONTRACTS[source.id]) throw new Error('Resource release lock mismatch');
    if (typeof code.releaseNotes !== 'string' || !code.releaseNotes || code.releaseNotes.length > 2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(code.releaseNotes)) throw new Error('Resource release notes');
    if (code.contentCode === 1 && JSON.stringify(source) !== JSON.stringify(original)) throw new Error('Changed source needs a new resource code');
  }
  return { lock, releases, binding: { sourceLockSha256: sha256(baselineBytes), resourceSourceLockSha256: sha256(sourceBytes), resourceReleaseLockSha256: sha256(codeBytes) } };
}

export async function prepareResources(root) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  if (git(['status', '--porcelain=v1', '--untracked-files=all'])) throw new Error('Resource preparation requires a clean independent checkout');
  if (process.env.GAME_HUB_LOCAL_SOURCES) throw new Error('Resource preparation must clone remote immutable commits');
  const commit = git(['rev-parse', 'HEAD']);
  const { lock } = resourceInputs(root, true);
  assemble(lock.sources, root, join(root, '.build/resource-source-assets'), commit);
  const { buildResources } = await import('./resource-bundle.mjs');
  return buildResources(root, { expectedCommit: commit, independent: true });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw new Error('Usage: node scripts/resource-sources.mjs');
    await prepareResources(fileURLToPath(new URL('../', import.meta.url)));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
