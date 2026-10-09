import { readFileSync, writeFileSync } from 'node:fs';
import { createPublicKey } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
const [checkout, online] = process.argv.slice(2);
const load = name => import(pathToFileURL(resolve(checkout, 'scripts', name)).href);
const { captureReleaseSnapshot, validateReleaseSnapshot } = await load('resource-catalog.mjs');
const { verifyEnvelope, validateCatalog } = await load('resource-protocol.mjs');
const { validateDynamicCatalog } = await load('dynamic-protocol.mjs');
const sources = JSON.parse(readFileSync(join(checkout,'sources.lock.json'))).sources;
const key = createPublicKey({key:readFileSync(join(online,'apk-resource-public-key.der')),format:'der',type:'spki'});
for (const channel of ['v1','v2']) {
  const tag = `game-resources-${channel}`;
  const snapshot = await captureReleaseSnapshot(fetch,tag);
  const { catalog } = verifyEnvelope(readFileSync(join(online,channel,'catalog.signed.json')),key,'resources-20261008');
  if(channel==='v1') validateCatalog(catalog,sources); else validateDynamicCatalog(catalog);
  validateReleaseSnapshot(catalog,snapshot,tag);
  const ids = catalog.games.map(g=>g.id).sort();
  const expected = channel==='v1'?['conway','eml','light','turing']:['memory-demo'];
  if(JSON.stringify(ids)!==JSON.stringify(expected)) throw Error('Unexpected signed game identity set');
  const assets=snapshot.assetPages.flatMap(p=>p.assets);
  if(new Set(assets.map(a=>a.name)).size!==assets.length || assets.length!==expected.length+1 || assets.filter(a=>a.name==='catalog.signed.json').length!==1) throw Error('Unexpected public asset set');
  for(const asset of assets){
    const local=join(online,channel,asset.name);
    const {createHash}=await import('node:crypto');
    const bytes=readFileSync(local);
    if(bytes.length!==asset.size || `sha256:${createHash('sha256').update(bytes).digest('hex')}`!==asset.digest) throw Error('Snapshot no longer matches downloaded bytes');
  }
  writeFileSync(join(online,`${channel}-complete-release-snapshot.json`),JSON.stringify(snapshot,null,2)+'\n');
  console.log(`Anonymous ${channel} signature, exact game set, complete current Release and every asset binding verified`);
}
