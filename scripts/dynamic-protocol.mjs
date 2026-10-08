import { IDS, validateCatalog } from './resource-protocol.mjs';

export const dynamicId = id => typeof id === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(id) && !IDS.includes(id);
export function validateDynamicCatalog(catalog, now = Date.now()) {
  if (catalog.schemaVersion !== 2 || catalog.channel !== 'game-hub-resources-v2' || !Array.isArray(catalog.games) || catalog.games.length > 16) throw new Error('Dynamic catalog protocol');
  const ids = new Set(), assets = new Set();
  for (const game of catalog.games) {
    if (!dynamicId(game.id) || ids.has(game.id) || assets.has(game.assetId)) throw new Error('Dynamic identity');
    ids.add(game.id); assets.add(game.assetId);
    if (typeof game.displayName !== 'string' || !game.displayName || game.displayName.length > 80 || /[\x00-\x1f]/.test(game.displayName) || typeof game.iconKind !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(game.iconKind) || typeof game.available !== 'boolean') throw new Error('Dynamic metadata');
    if (!/^https:\/\/github\.com\/xiaoxuhui\/[A-Za-z0-9_.-]+\.git$/.test(game.sourceRepository) || typeof game.entryPage !== 'string' || !game.entryPage.endsWith('.html') || !Number.isSafeInteger(game.minHostVersionCode) || game.minHostVersionCode < 4 || typeof game.storageContract !== 'string' || !game.storageContract || game.storageContract.length > 100 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(game.storageContract)) throw new Error('Dynamic source contract');
    for (const key of ['resourceProtocol', 'bridgeProtocol']) if (!Number.isSafeInteger(game[key]) || game[key] < 1 || game[key] > 2147483647) throw new Error('Dynamic capabilities');
  }
  // Reuse all v1 time, integer, hash, path, file and budget validation with synthetic identities.
  // Only these local copies change; neither production catalog nor v1 contracts are relaxed.
  const seeds = catalog.games.length ? catalog.games : [{ id: 'probe', sourceRepository: 'https://github.com/xiaoxuhui/game-hub.git', sourceRevision: 'a'.repeat(40), version: '1', contentCode: 1, minHostVersionCode: 4, maxHostVersionCode: 4, entryPage: 'index.html', assetId: 1, archiveBytes: 1, archiveSha256: 'a'.repeat(64), releaseNotes: 'probe', files: ['index.html', 'LICENSE'].map(path => ({path, bytes: 0, sha256: 'a'.repeat(64), mime: path === 'LICENSE' ? 'text/plain' : 'text/html'})) }];
  for (const seed of seeds) {
    const games = IDS.map((id, i) => ({ ...seed, id, assetId: i + 1, resourceProtocol: 1, storageContract: `${id}-baseline-v1` }));
    validateCatalog({ ...catalog, schemaVersion: 1, channel: 'game-hub-resources-v1', games }, IDS.map(id => ({id, repository: seed.sourceRepository, entryPage: seed.entryPage})), now);
  }
  if (catalog.games.some(g => !Number.isSafeInteger(g.assetId) || g.assetId < 1)) throw new Error('Dynamic asset');
  return catalog;
}
