// Test-only identities remain in Node memory; browsers receive public material.
import {generateKeyPairSync,sign} from 'node:crypto';
import {fileTreeDigest,sourceProofBytes,sha256Hex,canonicalFiles} from '../../web/src/core/digests.mjs';
const pair=generateKeyPairSync('rsa',{modulusLength:3072});
export const TEST_KEY_ID='web-tests-only';
export const TEST_TIME=Date.UTC(2026,9,17);
export const testSpki=new Uint8Array(pair.publicKey.export({type:'spki',format:'der'}));
export function signRaw(raw){
  const bytes=typeof raw==='string'?Buffer.from(raw):Buffer.from(raw);
  return Buffer.from(JSON.stringify({envelopeVersion:1,keyId:TEST_KEY_ID,payloadBase64:bytes.toString('base64'),signatureBase64:sign('RSA-SHA256',bytes,pair.privateKey).toString('base64')}));
}
export const signPayload=payload=>signRaw(JSON.stringify(payload));
export function sampleGame(id='sample'){
  const game={id,displayName:'测试游戏',version:'1.0.0',contentCode:1,entryPage:'index.html',category:'模拟',iconKind:'generic',sourceRepository:`https://github.com/xiaoxuhui/${id}.git`,sourceRevision:'b'.repeat(40),storage:{keys:[`${id}.save`],prefixes:[]},sourceFiles:[{path:'LICENSE',bytes:20,sha256:'c'.repeat(64),mime:'text/plain'},{path:'index.html',bytes:10,sha256:'d'.repeat(64),mime:'text/html'},{path:'empty.txt',bytes:0,sha256:sha256Hex(new Uint8Array()),mime:'text/plain'}]};
  const proof=sourceProofBytes(game);game.files=canonicalFiles([...game.sourceFiles,{path:'hub-runtime/source-proof.json',bytes:proof.length,sha256:sha256Hex(proof),mime:'application/json'}]);game.digest=fileTreeDigest(game.files);game.entryUrl=`/hub/games/${id}/1/${game.digest}/index.html`;
  return game;
}
export function signedPayload({catalog,origin='https://games.example.invalid',basePath='/hub/',csp}={}){
  return {schemaVersion:1,channel:'game-hub-web-v1',catalogSequence:'1',issuedAt:new Date(TEST_TIME-1000).toISOString(),expiresAt:new Date(TEST_TIME+86400000).toISOString(),origin,basePath,shellVersion:catalog?.shellVersion??'0.1.0',sourceCommit:catalog?.sourceCommit??'e'.repeat(40),games:(catalog?.games??[sampleGame()]).map(({mode,...game})=>({...game,csp:game.csp??csp,available:true,adapterRevision:'f'.repeat(40),storageContract:'game-hub-web-save-v1',webCapabilities:game.id==='turing'?['storage','files','worker']:game.id==='mini-scratch'?['storage','files','audio','microphone']:['storage','files'],releaseNotes:'测试向量，不是发行资源'}))};
}
