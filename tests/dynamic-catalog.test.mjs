import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSigningInput } from '../scripts/dynamic-catalog.mjs';
import { assetName } from '../scripts/resource-protocol.mjs';
import { generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const now=Date.parse('2026-10-09T00:00:00.000Z');
function fixture(){
  const game={id:'memory-demo',displayName:'示范',iconKind:'puzzle',available:true,resourceProtocol:2,bridgeProtocol:1,storageContract:'memory-demo-dynamic-v1',minHostVersionCode:4,maxHostVersionCode:100,version:'1',contentCode:1,sourceRepository:'https://github.com/xiaoxuhui/game-hub.git',sourceRevision:'a'.repeat(40),entryPage:'index.html',assetId:100,archiveBytes:100,archiveSha256:'b'.repeat(64),releaseNotes:'示范',files:['index.html','LICENSE'].map(path=>({path,bytes:10,sha256:'c'.repeat(64),mime:path==='LICENSE'?'text/plain':'text/html'}))};
  const payload={schemaVersion:2,channel:'game-hub-resources-v2',releaseId:10,catalogSequence:'1',issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+86400000).toISOString(),games:[game]};
  const snapshot={schemaVersion:1,pageSize:100,release:{id:10,tag_name:'game-resources-v2',draft:false,prerelease:true},assetPages:[{page:1,hasNext:false,assets:[{id:100,name:assetName(game),size:100,state:'uploaded',digest:'sha256:'+game.archiveSha256}]}]};
  return {payload,snapshot};
}
test('v2 issuance binds fixed prerelease, complete membership and exact asset bytes',()=>{
  const {payload,snapshot}=fixture();assert.equal(validateSigningInput(payload,snapshot,null,now),payload);
  for(const mutate of [x=>x.release.tag_name='game-resources-v1',x=>x.release.draft=true,x=>x.assetPages[0].hasNext=true,x=>x.assetPages[0].assets[0].digest='sha256:'+'d'.repeat(64)]){
    const changed=structuredClone(snapshot);mutate(changed);assert.throws(()=>validateSigningInput(payload,changed,null,now));
  }
});
test('higher v2 sequences require history and preserve all identities and immutable same-code metadata',()=>{
  const {payload,snapshot}=fixture(),next=structuredClone(payload);next.catalogSequence='2';
  assert.throws(()=>validateSigningInput(next,snapshot,null,now));assert.doesNotThrow(()=>validateSigningInput(next,snapshot,payload,now));
  next.games[0].available=false;assert.doesNotThrow(()=>validateSigningInput(next,snapshot,payload,now));
  next.games=[];assert.throws(()=>validateSigningInput(next,snapshot,payload,now));
  next.games=structuredClone(payload.games);next.games[0].displayName='Changed';assert.throws(()=>validateSigningInput(next,snapshot,payload,now));
  assert.throws(()=>validateSigningInput(payload,snapshot,payload,now));
});
test('higher content accepts new bytes only with new exact public asset identity',()=>{
  const {payload,snapshot}=fixture(),next=structuredClone(payload);next.catalogSequence='2';
  Object.assign(next.games[0],{contentCode:2,version:'2',assetId:101,archiveSha256:'d'.repeat(64)});
  assert.throws(()=>validateSigningInput(next,snapshot,payload,now));
  snapshot.assetPages[0].assets.push({id:101,name:assetName(next.games[0]),size:100,state:'uploaded',digest:'sha256:'+'d'.repeat(64)});
  assert.doesNotThrow(()=>validateSigningInput(next,snapshot,payload,now));
});
test('actual CLI signs via stdin, verifies public DER, rejects overwrite and requires authenticated history',()=>{
  const root=mkdtempSync(join(tmpdir(),'game-hub-v2-signer-'));
  const pair=generateKeyPairSync('rsa',{modulusLength:3072});
  const key=pair.privateKey.export({format:'pem',type:'pkcs8'});
  const cli=fileURLToPath(new URL('../scripts/dynamic-catalog.mjs',import.meta.url));
  const run=args=>spawnSync(process.execPath,[cli,...args],{input:key,encoding:'utf8'});
  try {
    const {payload,snapshot}=fixture();const issued=Date.now()-1000;
    payload.issuedAt=new Date(issued).toISOString();payload.expiresAt=new Date(issued+86400000).toISOString();
    const input=join(root,'payload.json'),snap=join(root,'snapshot.json'),signed=join(root,'signed.json'),pub=join(root,'public.der');
    writeFileSync(input,JSON.stringify(payload));writeFileSync(snap,JSON.stringify(snapshot));writeFileSync(pub,pair.publicKey.export({format:'der',type:'spki'}));
    const first=run(['sign',input,'-','fixture',signed,snap]);assert.equal(first.status,0,first.stderr);
    const before=readFileSync(signed);const checked=run(['verify',signed,pub,'fixture']);assert.equal(checked.status,0,checked.stderr);
    assert.notEqual(run(['sign',input,'-','fixture',signed,snap]).status,0);assert.deepEqual(readFileSync(signed),before);
    payload.catalogSequence='2';writeFileSync(input,JSON.stringify(payload));
    assert.notEqual(run(['sign',input,'-','fixture',join(root,'missing-history.json'),snap]).status,0);
    const second=run(['sign',input,'-','fixture',join(root,'second.json'),snap,signed]);assert.equal(second.status,0,second.stderr);
  } finally {rmSync(root,{recursive:true,force:true});}
});
