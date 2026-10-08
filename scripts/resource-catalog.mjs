import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetName, signCatalog, verifyEnvelope, validateCatalog, strictJson } from './resource-protocol.mjs';

export function attachAssets(games, release, assets) {
  if (release.tag_name !== 'game-resources-v1' || release.draft !== false || release.prerelease !== true || !Number.isSafeInteger(release.id) || release.id <= 0) throw new Error('Wrong resource release');
  return games.map(game => {
    const matches = assets.filter(a => a.name === assetName(game));
    if (matches.length !== 1 || matches[0].size !== game.archiveBytes || matches[0].state !== 'uploaded' || matches[0].digest !== `sha256:${game.archiveSha256}` || !Number.isSafeInteger(matches[0].id) || matches[0].id <= 0) throw new Error('Asset identity mismatch');
    return { ...game, assetId: matches[0].id };
  });
}
// Deliberately no key creation or network publishing in this tool.
// Private key path is an explicit argument; key bytes never enter JSON output/logs.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, payloadPath, keyPath, keyId, outputPath] = process.argv.slice(2);
    const sources = JSON.parse(readFileSync(new URL('../sources.lock.json', import.meta.url))).sources;
    if (mode === 'sign' && outputPath) {
      const payload = strictJson(readFileSync(payloadPath)); validateCatalog(payload, sources);
      const signed = signCatalog(payload, readFileSync(keyPath), keyId);
      const checked = verifyEnvelope(signed, readFileSync(keyPath), keyId); validateCatalog(checked.catalog, sources);
      writeFileSync(outputPath, signed, { flag: 'wx' }); console.log(`Signed catalog sequence ${payload.catalogSequence}; ${checked.payloadSha256}`);
    } else if (mode === 'verify' && !outputPath) {
      const checked = verifyEnvelope(readFileSync(payloadPath), readFileSync(keyPath), keyId); validateCatalog(checked.catalog, sources);
      console.log(`Verified catalog sequence ${checked.catalog.catalogSequence}; ${checked.payloadSha256}`);
    } else throw new Error('Usage: resource-catalog.mjs sign payload.json private-key-path key-id output.json | verify envelope.json public-key-path key-id');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
