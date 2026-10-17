import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {GAME_CSP} from '../../web/src/core/contracts.mjs';
import {verifySignedCatalog} from '../../web/src/core/signed-catalog.mjs';
import {TEST_KEY_ID,TEST_TIME,testSpki,signPayload,signRaw,signedPayload,sampleGame} from '../fixtures/web-signed.mjs';
const payload=()=>signedPayload({csp:GAME_CSP});
const options=extra=>({spki:testSpki,keyId:TEST_KEY_ID,origin:'https://games.example.invalid',basePath:'/hub/',now:TEST_TIME,...extra});
const verify=(value,extra)=>verifySignedCatalog(signPayload(value),options(extra));
const clone=structuredClone;
function code(game,value){game.contentCode=value;game.entryUrl=`/hub/games/${game.id}/${value}/${game.digest}/${game.entryPage}`;}

test('RSA3072 verifies the exact original UTF8 bytes and freezes all returned identities',async()=>{
  const p=payload(),result=await verifySignedCatalog(signRaw(' \n'+JSON.stringify(p,null,2)+'\n'),options());
  assert.equal(result.catalog.games[0].id,'sample');assert.equal(result.history.catalogSequence,'1');assert.equal(result.history.games[0].contentCode,1);assert.equal(result.history.payloadSha256,result.payloadSha256);
  assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result.catalog.games[0].files));assert.throws(()=>{result.catalog.games[0].version='changed';});assert.throws(()=>result.history.games.push({}));
});
test('wrong key, modulus, signature and changed raw bytes never verify; missing WebCrypto does not downgrade trust',async()=>{
  const envelope=JSON.parse(signPayload(payload()));envelope.signatureBase64='A'.repeat(512);await assert.rejects(()=>verifySignedCatalog(Buffer.from(JSON.stringify(envelope)),options()),/Signature/);
  const other=generateKeyPairSync('rsa',{modulusLength:3072}).publicKey.export({type:'spki',format:'der'});await assert.rejects(()=>verifySignedCatalog(signPayload(payload()),options({spki:other})),/Signature/);
  const small=generateKeyPairSync('rsa',{modulusLength:2048}).publicKey.export({type:'spki',format:'der'});await assert.rejects(()=>verifySignedCatalog(signPayload(payload()),options({spki:small})),/RSA3072/);
  const e=JSON.parse(signPayload(payload()));e.payloadBase64=Buffer.from(JSON.stringify({...payload(),shellVersion:'0.2.0'})).toString('base64');await assert.rejects(()=>verifySignedCatalog(Buffer.from(JSON.stringify(e)),options()),/Signature/);
  await assert.rejects(()=>verify(payload(),{crypto:{}}),/WebCrypto/);
});
test('signed duplicate keys, invalid UTF8, unknown envelope and noncanonical Base64 or integers are refused',async()=>{
  const raw=JSON.stringify(payload());for(const bytes of [signRaw(raw.replace('"schemaVersion":1','"schemaVersion":1,"schemaVersion":1')),signRaw(new Uint8Array([255])),signRaw(raw.replace('"contentCode":1','"contentCode":1e0')),signRaw(raw.replace('"bytes":0','"bytes":-0'))])await assert.rejects(()=>verifySignedCatalog(bytes,options()));
  for(const patch of [{url:'https://other.invalid/'},{keyId:'other'},{payloadBase64:'Zh=='},{payloadBase64:'e30'},{signatureBase64:' A==='}]){const envelope={...JSON.parse(signPayload(payload())),...patch};await assert.rejects(()=>verifySignedCatalog(Buffer.from(JSON.stringify(envelope)),options()));}
  const p=payload();p.unknown=true;await assert.rejects(()=>verify(p));
});
test('signed source, file tree, path, scope, CSP and capability mistakes cannot become install manifests',async()=>{
  const mutations=[p=>p.channel='game-hub-resources-v2',p=>p.schemaVersion=2,p=>p.origin='http://public.example.invalid',p=>p.basePath='/other/',p=>p.games[0].entryUrl='https://evil.invalid/',p=>p.games[0].files[0].path='../escape',p=>p.games[0].files[0].sha256='a'.repeat(64),p=>p.games[0].sourceFiles[0].sha256='a'.repeat(64),p=>p.games[0].storage.keys=['game-hub-web.private'],p=>p.games[0].csp='default-src *',p=>p.games[0].webCapabilities=['camera'],p=>p.games[0].webCapabilities=['microphone'],p=>p.games[0].webCapabilities=['files','files'],p=>p.games[0].storageContract='future-contract',p=>p.games[0].adapterRevision='short',p=>p.games[0].available=1,p=>p.games[0].unknown=true,p=>p.games[0].version='1'.repeat(100)+'.0.0'];
  for(const mutate of mutations){const p=payload();mutate(p);await assert.rejects(()=>verify(p));}
  await assert.rejects(()=>verify(payload(),{origin:'https://other.example.invalid'}));await assert.rejects(()=>verify(payload(),{basePath:'/'}));
});
test('new authorization rejects expiry, future issuance, noncanonical dates and invalid clocks',async()=>{
  for(const change of [p=>p.expiresAt=new Date(TEST_TIME).toISOString(),p=>p.issuedAt=new Date(TEST_TIME+300001).toISOString(),p=>p.expiresAt=new Date(TEST_TIME+91*86400000).toISOString(),p=>p.issuedAt=p.issuedAt.replace('.000Z','Z'),p=>p.expiresAt=p.issuedAt]){const p=payload();change(p);await assert.rejects(()=>verify(p));}
  for(const now of [NaN,TEST_TIME+0.5,Number.MAX_SAFE_INTEGER])await assert.rejects(()=>verify(payload(),{now}));
  for(const value of ['01','0','-1','1.0','9223372036854775808',1]){const p=payload();p.catalogSequence=value;await assert.rejects(()=>verify(p));}
});
test('same sequence must name identical bytes; higher sequence accepts resource-only changes but no rollbacks',async()=>{
  const base=payload(),first=await verify(base);await verify(base,{history:first.history});
  const changed=clone(base);changed.issuedAt=new Date(TEST_TIME).toISOString();await assert.rejects(()=>verify(changed,{history:first.history}));
  const next=clone(base);next.catalogSequence='2';code(next.games[0],2);const second=await verify(next,{history:first.history});assert.equal(second.history.games[0].contentCode,2);assert.equal(second.catalog.games[0].version,base.games[0].version);
  const rollback=clone(base);rollback.catalogSequence='3';await assert.rejects(()=>verify(rollback,{history:second.history}));await assert.rejects(()=>verify(base,{history:second.history}));
  const sameCode=clone(base);sameCode.catalogSequence='2';sameCode.games[0].releaseNotes='changed identity';await assert.rejects(()=>verify(sameCode,{history:first.history}));
  const namespace=clone(next);namespace.games[0].storage.keys.push('sample.second');await assert.rejects(()=>verify(namespace,{history:first.history}));
});
test('cumulative game identities, namespace separation, shell and clock history are enforced',async()=>{
  const base=payload(),first=await verify(base),added=payload();added.catalogSequence='2';added.games.push({...sampleGame('second'),csp:GAME_CSP,available:true,adapterRevision:'f'.repeat(40),storageContract:'game-hub-web-save-v1',webCapabilities:['storage'],releaseNotes:''});
  const two=await verify(added,{history:first.history});assert.equal(two.history.games.length,2);const missing=clone(base);missing.catalogSequence='3';await assert.rejects(()=>verify(missing,{history:two.history}));
  const collision=clone(added);collision.games[1].storage=clone(collision.games[0].storage);await assert.rejects(()=>verify(collision));
  const oldShell=clone(base);oldShell.shellVersion='0.0.9';await assert.rejects(()=>verify(oldShell));await assert.rejects(()=>verify(base,{history:first.history,now:TEST_TIME-300001}));
});
test('unknown or corrupt history stops authorization and external edits during signature wait cannot bypass it',async()=>{
  const base=payload(),first=await verify(base);for(const history of [{},false,{...first.history,schemaVersion:2},{...first.history,origin:'https://other.invalid'},{...first.history,games:[...first.history.games,...first.history.games]}])await assert.rejects(()=>verify(base,{history}));
  const next=clone(base);next.catalogSequence='2';next.games[0].displayName='同编号篡改';const unchecked=await verify(next),history=clone(first.history),pending=verify(next,{history});history.games=clone(unchecked.history.games);await assert.rejects(()=>pending);
  const spki=new Uint8Array(testSpki),promise=verify(base,{spki});spki.fill(0);await promise;
});
