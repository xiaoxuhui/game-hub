import { readFileSync, writeFileSync, mkdirSync, readdirSync, lstatSync, mkdtempSync, existsSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIMITS, CONTRACTS, sha256, safePath, mime, assetName } from './resource-protocol.mjs';
import { verifyBundle } from './bundle.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const crcTable = Array.from({ length: 256 }, (_, n) => { for (let bit = 0; bit < 8; bit++) n = (n & 1) ? (0xedb88320 ^ (n >>> 1)) : (n >>> 1); return n >>> 0; });
export function crc32(data) { let crc = 0xffffffff; for (const b of data) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }

// Stored ZIP: deterministic bytes, no compression bombs, no external ZIP runtime.
export function createZip(entries) {
  if (!entries.length || entries.length > LIMITS.files) throw new Error('File count');
  const locals = [], centrals = []; const seen = new Set(); let offset = 0;
  for (const { path, data } of [...entries].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) {
    safePath(path); const key = path.toLowerCase();
    if (seen.has(key) || [...seen].some(p => key.startsWith(p + '/') || p.startsWith(key + '/'))) throw new Error('Conflicting ZIP path'); seen.add(key);
    if (data.length > LIMITS.file) throw new Error('File limit');
    const name = Buffer.from(path); const local = Buffer.alloc(30); const central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc32(data), 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc32(data), 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, name, data); centrals.push(central, name); offset += 30 + name.length + data.length;
  }
  const directory = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  const archive = Buffer.concat([...locals, directory, end]); if (archive.length > LIMITS.archive) throw new Error('Archive limit'); return archive;
}
export function readStoredZip(archive) {
  if (archive.length > LIMITS.archive || archive.length < 22) throw new Error('Archive limit');
  const entries = []; let at = 0;
  while (at + 4 <= archive.length && archive.readUInt32LE(at) === 0x04034b50) {
    if (at + 30 > archive.length) throw new Error('Truncated ZIP');
    const size = archive.readUInt32LE(at + 18), nameBytes = archive.readUInt16LE(at + 26), extraBytes = archive.readUInt16LE(at + 28);
    if (archive.readUInt16LE(at + 6) !== 0x800 || archive.readUInt16LE(at + 8) !== 0 || size !== archive.readUInt32LE(at + 22) || extraBytes !== 0) throw new Error('Unsupported ZIP');
    const path = new TextDecoder('utf-8', { fatal: true }).decode(archive.subarray(at + 30, at + 30 + nameBytes)); safePath(path);
    const start = at + 30 + nameBytes, end = start + size; if (end > archive.length) throw new Error('Truncated ZIP');
    const data = archive.subarray(start, end); if (crc32(data) !== archive.readUInt32LE(at + 14)) throw new Error('ZIP CRC');
    entries.push({ path, data }); at = end;
  }
  // Rebuilding also validates central directory, EOCD, flags and duplicate paths.
  if (!createZip(entries).equals(archive)) throw new Error('ZIP structure mismatch');
  return entries;
}
function walk(directory, base = directory) {
  return readdirSync(directory).sort().flatMap(name => {
    const path = join(directory, name), stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error('Resource symlink');
    if (stat.isDirectory()) return walk(path, base);
    if (!stat.isFile()) throw new Error('Special resource');
    return [{ path: relative(base, path).split(sep).join('/'), data: readFileSync(path) }];
  });
}
export function inspectResources(entries, id) {
  let bytes = 0;
  for (const entry of entries) {
    bytes += entry.data.length;
    if (bytes > LIMITS.unpacked) throw new Error('Unpacked limit');
    if (/\.(?:js|html)$/i.test(entry.path)) {
      const text = entry.data.toString('utf8');
      if (/\bserviceWorker\b|\bcaches\s*\.|\b(?:localStorage|sessionStorage)\s*(?:\.\s*clear|\[\s*['"]clear['"]\s*\])\s*\(/.test(text)) throw new Error(`${id}: incompatible cache or storage operation`);
    }
  }
}
const checkoutCommit = root => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
export function buildResources(checkoutRoot = root, { expectedCommit = checkoutCommit(checkoutRoot), failAfterGame = null } = {}) {
  const assets = join(checkoutRoot, 'android/app/src/main/assets');
  const manifest = JSON.parse(readFileSync(join(assets, 'bundle-manifest.json')));
  const lock = JSON.parse(readFileSync(join(checkoutRoot, 'sources.lock.json')));
  verifyBundle(assets, lock.sources, expectedCommit);
  const codes = JSON.parse(readFileSync(join(checkoutRoot, 'resource-releases.lock.json')));
  const buildRoot = join(checkoutRoot, '.build'); mkdirSync(buildRoot, { recursive: true });
  const output = join(buildRoot, 'resource-candidate');
  const staging = mkdtempSync(join(buildRoot, 'resource-staging-'));
  const backup = staging + '-previous';
  try {
  const games = lock.sources.map(source => {
    const code = codes.games[source.id];
    if (!code || !Number.isSafeInteger(code.contentCode) || code.contentCode < 1 || code.sourceRevision !== source.revision || code.storageContract !== CONTRACTS[source.id]) throw new Error('Resource lock mismatch');
    const entries = walk(join(assets, 'games', source.id)); inspectResources(entries, source.id);
    const archive = createZip(entries);
    const game = { id: source.id, version: source.version, contentCode: code.contentCode, sourceRepository: source.repository, sourceRevision: source.revision, minHostVersionCode: 3, maxHostVersionCode: 2147483647, resourceProtocol: 1, storageContract: code.storageContract, entryPage: source.entryPage, archiveBytes: archive.length, archiveSha256: sha256(archive), files: entries.map(e => ({ path: e.path, bytes: e.data.length, sha256: sha256(e.data), mime: mime(e.path) })), releaseNotes: code.releaseNotes };
    writeFileSync(join(staging, assetName(game)), archive);
    if (failAfterGame === source.id) throw new Error('Injected resource generation failure');
    return game;
  });
  writeFileSync(join(staging, 'games.unsigned.json'), JSON.stringify(games, null, 2) + '\n');
  writeFileSync(join(staging, 'candidate.json'), JSON.stringify({ schemaVersion: 1, bundleCommit: expectedCommit, sourceLockSha256: sha256(readFileSync(join(checkoutRoot, 'sources.lock.json'))) }) + '\n');
  verifyResources(staging, { checkoutRoot, expectedCommit });
  if (existsSync(output)) renameSync(output, backup);
  try { renameSync(staging, output); } catch (error) { if (existsSync(backup)) renameSync(backup, output); throw error; }
  if (existsSync(backup)) rmSync(backup, { recursive: true, force: true });
  console.log(`Built four deterministic resource ZIPs from ${expectedCommit}`); return games;
  } finally { if (existsSync(staging)) rmSync(staging, { recursive: true, force: true }); }
}
export function verifyResources(output = join(root, '.build/resource-candidate'), { checkoutRoot = root, expectedCommit = checkoutCommit(checkoutRoot) } = {}) {
  const candidate = JSON.parse(readFileSync(join(output, 'candidate.json')));
  const lockBytes = readFileSync(join(checkoutRoot, 'sources.lock.json'));
  const sources = JSON.parse(lockBytes).sources;
  const codes = JSON.parse(readFileSync(join(checkoutRoot, 'resource-releases.lock.json'))).games;
  if (candidate.schemaVersion !== 1 || candidate.bundleCommit !== expectedCommit || candidate.sourceLockSha256 !== sha256(lockBytes)) throw new Error('Stale candidate commit or source lock');
  const games = JSON.parse(readFileSync(join(output, 'games.unsigned.json')));
  if (games.length !== 4 || new Set(games.map(g => g.id)).size !== 4) throw new Error('Candidate must contain four games');
  for (const game of games) {
    const source = sources.find(s => s.id === game.id), code = codes[game.id];
    if (!source || !code || game.sourceRevision !== source.revision || game.sourceRepository !== source.repository || game.version !== source.version || game.entryPage !== source.entryPage || game.contentCode !== code.contentCode || game.storageContract !== code.storageContract) throw new Error('Candidate source or resource lock mismatch');
    const archive = readFileSync(join(output, assetName(game))); if (sha256(archive) !== game.archiveSha256 || archive.length !== game.archiveBytes) throw new Error('Archive mismatch');
    const entries = readStoredZip(archive); inspectResources(entries, game.id);
    if (JSON.stringify(entries.map(e => ({ path: e.path, bytes: e.data.length, sha256: sha256(e.data), mime: mime(e.path) }))) !== JSON.stringify(game.files)) throw new Error('File manifest mismatch');
    if (!entries.some(e => e.path === game.entryPage) || !entries.some(e => e.path === 'LICENSE') || (game.id === 'turing' && (!entries.some(e => e.path === 'campaign.html') || !entries.some(e => /route-worker.*\.js$/.test(e.path))))) throw new Error('Required resource');
  }
  console.log(`Verified ${games.length} resource ZIPs and complete file manifests; source commit ${candidate.bundleCommit}`); return games;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { if (process.argv[2] === '--verify') verifyResources(); else if (process.argv.length === 2) buildResources(); else throw new Error('Usage: resource-bundle.mjs [--verify]'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
