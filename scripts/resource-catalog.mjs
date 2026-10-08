import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicKey } from 'node:crypto';
import { assetName, signCatalog, verifyEnvelope, validateCatalog, strictJson } from './resource-protocol.mjs';

export function attachAssets(games, release, assets, tag = 'game-resources-v1') {
  if (!['game-resources-v1','game-resources-v2'].includes(tag) || release.tag_name !== tag || release.draft !== false || release.prerelease !== true || !Number.isSafeInteger(release.id) || release.id <= 0) throw new Error('Wrong resource release');
  return games.map(game => {
    const matches = assets.filter(a => a.name === assetName(game));
    if (matches.length !== 1 || matches[0].size !== game.archiveBytes || matches[0].state !== 'uploaded' || matches[0].digest !== `sha256:${game.archiveSha256}` || !Number.isSafeInteger(matches[0].id) || matches[0].id <= 0) throw new Error('Asset identity mismatch');
    return { ...game, assetId: matches[0].id };
  });
}
export function validateReleaseSnapshot(payload, snapshot, tag = 'game-resources-v1') {
  if (snapshot?.schemaVersion !== 1 || snapshot.pageSize !== 100 || !Array.isArray(snapshot.assetPages) || !snapshot.assetPages.length || snapshot.assetPages.length > 100) throw new Error('Incomplete release snapshot');
  const pages = snapshot.assetPages;
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index];
    if (page?.page !== index + 1 || page.hasNext !== (index < pages.length - 1) || !Array.isArray(page.assets) || page.assets.length > 100 || (page.hasNext && page.assets.length !== 100)) throw new Error('Incomplete asset pagination');
  }
  const assets = pages.flatMap(page => page.assets);
  if (new Set(assets.map(a => a.id)).size !== assets.length || new Set(assets.map(a => a.name)).size !== assets.length) throw new Error('Duplicate release assets');
  if (payload.releaseId !== snapshot.release?.id) throw new Error('Release ID mismatch');
  const attached = attachAssets(payload.games, snapshot.release, assets, tag);
  if (attached.some((g, i) => g.assetId !== payload.games[i].assetId)) throw new Error('Asset ID mismatch');
  return payload;
}
export async function captureReleaseSnapshot(request = fetch, tag = 'game-resources-v1') {
  if (!['game-resources-v1','game-resources-v2'].includes(tag)) throw new Error('Unknown resource tag');
  const api = 'https://api.github.com/repos/xiaoxuhui/game-hub/releases';
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'game-hub-resource-publisher' };
  let total = 0;
  async function get(url) {
    const response = await request(url, { headers, redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Release snapshot HTTP ${response.status}`);
    const reader = response.body.getReader(); const chunks = [];
    while (true) { const { value, done } = await reader.read(); if (done) break; total += value.length; if (total > 4 * 1048576) { await reader.cancel(); throw new Error('Release snapshot byte limit'); } chunks.push(Buffer.from(value)); }
    return { json: strictJson(Buffer.concat(chunks), 4 * 1048576), link: response.headers.get('link') ?? '' };
  }
  const { json: release } = await get(`${api}/tags/${tag}`);
  if (release.tag_name !== tag || release.draft !== false || release.prerelease !== true || !Number.isSafeInteger(release.id) || release.id <= 0) throw new Error('Wrong resource release');
  const assetPages = [];
  for (let page = 1; page <= 100; page++) {
    const { json: assets, link } = await get(`${api}/${release.id}/assets?per_page=100&page=${page}`);
    const next = link.split(',').find(part => /;\s*rel="next"/.test(part));
    if (next) { const match = /^\s*<([^>]+)>;\s*rel="next"\s*$/.exec(next); if (!match) throw new Error('Invalid pagination Link'); const target = new URL(match[1]); if (target.origin !== 'https://api.github.com' || target.pathname !== `/repos/xiaoxuhui/game-hub/releases/${release.id}/assets` || target.searchParams.get('page') !== String(page + 1) || target.searchParams.get('per_page') !== '100') throw new Error('Unexpected next page'); }
    assetPages.push({ page, hasNext: Boolean(next), assets });
    if (!next) return { schemaVersion: 1, capturedAt: new Date().toISOString(), pageSize: 100, release, assetPages };
  }
  throw new Error('Release asset page limit');
}
// Deliberately no key creation or network publishing in this tool.
// Private key path is an explicit argument; key bytes never enter JSON output/logs.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, payloadPath, keyPath, keyId, outputPath, snapshotPath] = process.argv.slice(2);
    const sources = JSON.parse(readFileSync(new URL('../sources.lock.json', import.meta.url))).sources;
    if (mode === 'capture' && payloadPath && !keyPath) {
      writeFileSync(payloadPath, JSON.stringify(await captureReleaseSnapshot(), null, 2) + '\n', { flag: 'wx' });
      console.log('Captured public resource release and consecutive asset pages');
    } else if (mode === 'sign' && outputPath && snapshotPath) {
      const payload = strictJson(readFileSync(payloadPath)); validateCatalog(payload, sources);
      validateReleaseSnapshot(payload, strictJson(readFileSync(snapshotPath), 4 * 1048576));
      const key = readFileSync(keyPath === '-' ? 0 : keyPath);
      const signed = signCatalog(payload, key, keyId);
      const checked = verifyEnvelope(signed, key, keyId); validateCatalog(checked.catalog, sources);
      writeFileSync(outputPath, signed, { flag: 'wx' }); console.log(`Signed catalog sequence ${payload.catalogSequence}; ${checked.payloadSha256}`);
    } else if (mode === 'verify' && !outputPath) {
      const keyBytes = readFileSync(keyPath);
      const key = keyPath.endsWith('.der') ? createPublicKey({ key: keyBytes, format: 'der', type: 'spki' }) : keyBytes;
      const checked = verifyEnvelope(readFileSync(payloadPath), key, keyId); validateCatalog(checked.catalog, sources);
      console.log(`Verified catalog sequence ${checked.catalog.catalogSequence}; ${checked.payloadSha256}`);
    } else throw new Error('Usage: resource-catalog.mjs sign payload.json private-key-path key-id output.json release-snapshot.json | verify envelope.json public-key-path key-id');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
