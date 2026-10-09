import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {packDynamic,dynamicSources} from '../scripts/dynamic-resources.mjs';
import {assetName} from '../scripts/resource-protocol.mjs';
import {successorPayload} from '../scripts/resource-successor.mjs';
function fixture(){
  const source=dynamicSources(readFileSync(new URL('../dynamic-sources.lock.json',import.meta.url))).sources[0];
  const entries=source.files.map(path=>({path,data:readFileSync(new URL(`../examples/memory-demo/${path}`,import.meta.url))}));
  const {game}=packDynamic(source,entries),oldGame={...game,assetId:100};
  const now=Date.now()-1000;
  const old={schemaVersion:2,channel:'game-hub-resources-v2',releaseId:407394942,catalogSequence:'1',issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+86400000).toISOString(),games:[oldGame]};
  const asset=g=>({id:g.assetId,name:assetName(g),size:g.archiveBytes,state:'uploaded',digest:`sha256:${g.archiveSha256}`});
  const snapshot={schemaVersion:1,pageSize:100,release:{id:407394942,tag_name:'game-resources-v2',draft:false,prerelease:true},assetPages:[{page:1,hasNext:false,assets:[asset(oldGame)]}]};
  return {game,old,snapshot,asset};
}
test('successor retains identities omitted from candidate and binds new resources to public assets',()=>{
  const {game,old,snapshot,asset}=fixture();
  const extra={...game,id:'another-demo',storageContract:'another-demo-dynamic-v1',assetId:101};
  snapshot.assetPages[0].assets.push(asset(extra));
  const {assetId,...candidate}=extra;
  const next=successorPayload(old,[candidate],snapshot,'2');
  assert.deepEqual(next.games[0],old.games[0]);assert.equal(next.games[1].assetId,101);assert.equal(next.catalogSequence,'2');
  snapshot.assetPages[0].assets.pop();assert.throws(()=>successorPayload(old,[candidate],snapshot,'2'),/Asset identity/);
});
test('successor refuses skipped sequences, same-code metadata changes and incomplete historical snapshot',()=>{
  const {game,old,snapshot}=fixture();
  assert.throws(()=>successorPayload(old,[game],snapshot,'3'),/Exact next sequence/);
  assert.throws(()=>successorPayload(old,[{...game,displayName:'Changed'}],snapshot,'2'),/same-code/);
  snapshot.assetPages[0].hasNext=true;assert.throws(()=>successorPayload(old,[game],snapshot,'2'),/pagination/);
});
test('successor rejects forged asset bytes and duplicate candidate identities before signing',()=>{
  const {game,old,snapshot}=fixture();
  assert.throws(()=>successorPayload(old,[game,game],snapshot,'2'),/Candidate identity/);
  snapshot.assetPages[0].assets[0].digest='sha256:'+'0'.repeat(64);
  assert.throws(()=>successorPayload(old,[game],snapshot,'2'),/Asset identity/);
});
