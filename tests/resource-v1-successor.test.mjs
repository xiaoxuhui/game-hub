import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assetName,mime,CONTRACTS} from '../scripts/resource-protocol.mjs';
import {v1SuccessorPayload,validateV1SigningInput,validateV1History,v1PublicDownloadUrl} from '../scripts/resource-v1-successor.mjs';
function fixture(){
 const sources=JSON.parse(readFileSync(new URL('../sources.lock.json',import.meta.url))).sources;
 const games=sources.map((s,i)=>({id:s.id,version:s.version,contentCode:1,sourceRepository:s.repository,sourceRevision:s.revision,
  minHostVersionCode:3,maxHostVersionCode:2147483647,resourceProtocol:1,storageContract:CONTRACTS[s.id],entryPage:s.entryPage,
  assetId:100+i,archiveBytes:100,archiveSha256:String(i+1).repeat(64),releaseNotes:'baseline fixture',
  files:[s.entryPage,'LICENSE'].map(path=>({path,bytes:10,sha256:'a'.repeat(64),mime:mime(path)}))}));
 const now=Date.now()-1000,old={schemaVersion:1,channel:'game-hub-resources-v1',releaseId:407293817,catalogSequence:'1',issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+86400000).toISOString(),games};
 const asset=g=>({id:g.assetId,name:assetName(g),size:g.archiveBytes,state:'uploaded',digest:`sha256:${g.archiveSha256}`});
 const snapshot={schemaVersion:1,pageSize:100,release:{id:407293817,tag_name:'game-resources-v1',draft:false,prerelease:true},assetPages:[{page:1,hasNext:false,assets:games.map(asset)}]};
 return {old,snapshot,asset};
}
test('v1 successor binds two actual code increases while preserving other full identities',()=>{
 const {old,snapshot,asset}=fixture(),games=structuredClone(old.games);
 for(const g of games.filter(g=>['light','turing'].includes(g.id))){g.contentCode=2;g.version='updated';g.sourceRevision='e'.repeat(40);g.archiveSha256='f'.repeat(64);g.assetId+=100;snapshot.assetPages[0].assets.push(asset(g));}
 const next=v1SuccessorPayload(old,games,snapshot,'2');assert.deepEqual(next.games.slice(0,2),old.games.slice(0,2));assert.equal(next.games[2].contentCode,2);
 assert.equal(validateV1History([old],next,snapshot).length,2);
 snapshot.assetPages[0].assets.shift();assert.throws(()=>validateV1History([old],next,snapshot),/Asset identity/);
});
test('v1 successor refuses sequence skips, same-code source/notes/archive changes and rollback',()=>{
 const {old,snapshot}=fixture();assert.throws(()=>v1SuccessorPayload(old,old.games,snapshot,'3'),/Exact next/);
 for(const field of ['version','releaseNotes','sourceRevision']){const games=structuredClone(old.games);games[0][field]=field==='sourceRevision'?'e'.repeat(40):'changed';assert.throws(()=>v1SuccessorPayload(old,games,snapshot,'2'),/Same-code/);}
 const newer=structuredClone(old);newer.games[0].contentCode=2;assert.throws(()=>v1SuccessorPayload(newer,old.games,snapshot,'2'),/rollback/);
 const forged=structuredClone(old.games);forged[0].archiveSha256='f'.repeat(64);assert.throws(()=>v1SuccessorPayload(old,forged,snapshot,'2'),/Asset identity/);
});
test('v1 refuses wrong contract, repository, duplicate identities, asset IDs and pagination',()=>{
 const {old,snapshot}=fixture();
 for(const [field,value] of [['storageContract','changed'],['sourceRepository','https://example.com/game.git']]){const games=structuredClone(old.games);games[0][field]=value;assert.throws(()=>v1SuccessorPayload(old,games,snapshot,'2'));}
 const forged=v1SuccessorPayload(old,old.games,snapshot,'2');forged.games[0].assetId=999;assert.throws(()=>validateV1SigningInput(forged,snapshot,old),/Asset ID/);
 assert.throws(()=>v1SuccessorPayload(old,[...old.games.slice(0,3),old.games[0]],snapshot,'2'),/unique/);
 snapshot.assetPages[0].hasNext=true;assert.throws(()=>v1SuccessorPayload(old,old.games,snapshot,'2'),/pagination/);
});
test('v1 full signed history requires initial one, every sequence, and unchanged same-code metadata',()=>{
 const {old,snapshot}=fixture(),second=v1SuccessorPayload(old,old.games,snapshot,'2'),third=v1SuccessorPayload(second,second.games,snapshot,'3');
 assert.equal(validateV1History([second,old],third,snapshot).length,3);
 assert.throws(()=>validateV1History([second],third,snapshot),/Incomplete/);
 assert.throws(()=>validateV1History([old,old],third,snapshot),/Duplicate or missing/);
 assert.throws(()=>validateV1SigningInput(second,snapshot,null),/signed history/);
 const changed=structuredClone(second);changed.games[0].releaseNotes='changed';assert.throws(()=>validateV1History([old,changed],third,snapshot),/Same-code/);
});
test('v1 anonymous download only accepts fixed release URL and binds immutable asset ID cache key',()=>{
 const asset={id:101,name:'catalog.signed.json',browser_download_url:'https://github.com/xiaoxuhui/game-hub/releases/download/game-resources-v1/catalog.signed.json'};
 assert.equal(v1PublicDownloadUrl(asset).searchParams.get('verified_asset_id'),'101');assert.notEqual(String(v1PublicDownloadUrl(asset)),String(v1PublicDownloadUrl({...asset,id:102})));
 for(const url of ['https://example.com/catalog.signed.json',asset.browser_download_url.replace('v1/','v2/')])assert.throws(()=>v1PublicDownloadUrl({...asset,browser_download_url:url}));
 assert.throws(()=>v1PublicDownloadUrl({...asset,id:0}));
});
