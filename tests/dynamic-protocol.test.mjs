import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { validateDynamicCatalog } from '../scripts/dynamic-protocol.mjs';
import { signCatalog, verifyEnvelope } from '../scripts/resource-protocol.mjs';
const now = Date.parse('2026-10-09T00:00:00.000Z');
function fixture() {
  return {schemaVersion:2, channel:'game-hub-resources-v2', releaseId:10, catalogSequence:'1', issuedAt:'2026-10-09T00:00:00.000Z', expiresAt:'2026-10-10T00:00:00.000Z', games:[{
    id:'memory-demo', displayName:'配对练习 · 示范', iconKind:'puzzle', available:true, resourceProtocol:2, bridgeProtocol:1, storageContract:'memory-demo-dynamic-v1', minHostVersionCode:4, maxHostVersionCode:2147483647, version:'1.0.0', contentCode:1, sourceRepository:'https://github.com/xiaoxuhui/game-hub.git', sourceRevision:'a'.repeat(40), entryPage:'index.html', assetId:100, archiveBytes:100, archiveSha256:'b'.repeat(64), releaseNotes:'示范', files:['index.html','LICENSE'].map(path=>({path, bytes:10, sha256:'c'.repeat(64), mime:path==='LICENSE'?'text/plain':'text/html'}))
  }]};
}
test('v2 signed bytes, empty directory and retired full descriptor remain strict', () => {
  const pair = generateKeyPairSync('rsa',{modulusLength:3072}); const data=fixture();
  const signed=signCatalog(data,pair.privateKey,'fixture');
  assert.equal(validateDynamicCatalog(verifyEnvelope(signed,pair.publicKey,'fixture').catalog,now).games.length,1);
  assert.doesNotThrow(()=>validateDynamicCatalog({...data,games:[]},now));
  data.games[0].available=false; assert.doesNotThrow(()=>validateDynamicCatalog(data,now));
  assert.throws(()=>verifyEnvelope(Buffer.from(signed.toString().replace('fixture','unknown')),pair.publicKey,'fixture'));
});
test('v2 rejects bad identities, capabilities, dangerous files, expiry and duplicate assets',()=>{
  for(const [key,value] of [['id','light'],['id','../x'],['available','true'],['bridgeProtocol',0],['sourceRepository','https://evil.example/game.git'],['contentCode',0],['assetId',0],['minHostVersionCode',3],['entryPage','plugin.dex']]) {
    const data=fixture();data.games[0][key]=value;assert.throws(()=>validateDynamicCatalog(data,now),key);
  }
  const duplicate=fixture();duplicate.games.push({...duplicate.games[0],id:'other-demo'});assert.throws(()=>validateDynamicCatalog(duplicate,now));
  for(const path of ['../x','plugin.so','catalog.signed.json']) {const data=fixture();data.games[0].files.push({path,bytes:0,sha256:'c'.repeat(64),mime:'application/octet-stream'});assert.throws(()=>validateDynamicCatalog(data,now));}
  assert.throws(()=>validateDynamicCatalog(fixture(),now+86400000));
  const future=fixture();future.games[0].bridgeProtocol=2;assert.doesNotThrow(()=>validateDynamicCatalog(future,now));
});
