import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GAME_CSP} from '../../web/src/core/contracts.mjs';
import {sha256Hex} from '../../web/src/core/digests.mjs';
import {createCatalogAuthority} from '../../web/src/update/catalog-authority.mjs';
import {createPinnedAuthority,PINNED_KEY_ID,PINNED_SPKI_BASE64} from '../../web/src/update/trust.mjs';
import {TEST_KEY_ID,TEST_TIME,testSpki,signPayload,signedPayload} from '../fixtures/web-signed.mjs';
const options=()=>({spki:testSpki,keyId:TEST_KEY_ID,origin:'https://games.example.invalid',basePath:'/hub/'});
const authority=()=>createCatalogAuthority(options()),payload=()=>signedPayload({csp:GAME_CSP});
test('fixed production trust matches the existing public DER and rejects configurable identities',async()=>{
  assert.equal(PINNED_KEY_ID,'resources-20261008');assert.deepEqual(Buffer.from(PINNED_SPKI_BASE64,'base64'),readFileSync(new URL('../../android/app/src/main/res/raw/resource_public_key.der',import.meta.url)));
  assert.throws(()=>createPinnedAuthority({origin:'https://games.example.invalid',basePath:'/hub/',spki:testSpki}));
  await assert.rejects(()=>createPinnedAuthority({origin:'https://games.example.invalid',basePath:'/hub/'}).fresh(signPayload(payload()),{now:TEST_TIME}));
});
test('only instance-branded results may provide history, serialize or authorize new work',async()=>{
  const a=authority(),b=authority(),first=await a.fresh(signPayload(payload()),{now:TEST_TIME});
  a.requireFresh(first,{now:TEST_TIME});assert.throws(()=>b.serialize(first));assert.throws(()=>a.serialize(structuredClone(first)));assert.throws(()=>a.requireFresh(structuredClone(first),{now:TEST_TIME}));
  await assert.rejects(()=>a.fresh(signPayload(payload()),{previous:structuredClone(first),now:TEST_TIME}));
  assert.throws(()=>a.requireFresh(first,{now:TEST_TIME+86400000}));assert.throws(()=>a.requireFresh(first,{now:TEST_TIME-300001}));
});
test('stored receipts reverify exact original bytes/history and never authorize fresh work',async()=>{
  const a=authority(),first=await a.fresh(signPayload(payload()),{now:TEST_TIME}),stored=a.serialize(first),restored=await a.restore(stored);
  assert.deepEqual(restored,first);assert.throws(()=>a.requireFresh(restored,{now:TEST_TIME}));
  for(const modify of [r=>r.unknown=true,r=>r.schemaVersion=2,r=>r.envelope[0]=0,r=>r.history.games[0].descriptorHash='c'.repeat(64),r=>r.history.payloadSha256='d'.repeat(64),r=>r.history.unknown=true,r=>r.history.acceptedAt++,r=>r.verifiedAt=NaN]){const record=structuredClone(stored);modify(record);await assert.rejects(()=>a.restore(record));}
  // Recomputing the unkeyed checksum cannot substitute for signature/history.
  for(const modify of [r=>r.history.games[0].descriptorHash='c'.repeat(64),r=>r.history.payloadSha256='d'.repeat(64),r=>{const e=JSON.parse(new TextDecoder().decode(r.envelope));e.signatureBase64='A'.repeat(512);r.envelope=new TextEncoder().encode(JSON.stringify(e));}]){const r=structuredClone(stored);modify(r);r.receiptSha256=sha256Hex(JSON.stringify({schemaVersion:r.schemaVersion,envelopeSha256:sha256Hex(r.envelope),verifiedAt:r.verifiedAt,history:r.history}));await assert.rejects(()=>a.restore(r));}
});
test('caller mutation during crypto awaits and serialized mutation cannot replace branded bytes',async()=>{
  const key=new Uint8Array(testSpki),a=createCatalogAuthority({...options(),spki:key});key.fill(0);
  const bytes=new Uint8Array(signPayload(payload())),pending=a.fresh(bytes,{now:TEST_TIME});bytes.fill(0);const first=await pending;
  const record=a.serialize(first),restoring=a.restore(record);record.envelope.fill(0);record.history.games[0].digest='0'.repeat(64);await restoring;
  assert.notEqual(a.serialize(first).envelope[0],0);assert.notEqual(a.serialize(first).history.games[0].digest,'0'.repeat(64));
});
test('small clock rollback keeps verifiedAt separate from a later acceptedAt watermark',async()=>{
  const a=authority(),first=await a.fresh(signPayload(payload()),{now:TEST_TIME}),next=payload();next.catalogSequence='2';next.issuedAt=new Date(TEST_TIME-2000).toISOString();next.expiresAt=new Date(TEST_TIME-500).toISOString();
  const second=await a.fresh(signPayload(next),{previous:first,now:TEST_TIME-1000}),record=a.serialize(second);
  assert.equal(record.verifiedAt,TEST_TIME-1000);assert.equal(record.history.acceptedAt,TEST_TIME);const restored=await a.restore(record);assert.deepEqual(restored,second);
  assert.throws(()=>a.requireFresh(restored,{now:TEST_TIME-1000}));assert.throws(()=>a.requireFresh(second,{now:TEST_TIME}));
  const third=payload();third.catalogSequence='3';await a.fresh(signPayload(third),{previous:restored,now:TEST_TIME});
});
test('stored authority continuity rejects older signed watermarks without issuing a fresh brand',async()=>{
  const a=authority(),first=await a.fresh(signPayload(payload()),{now:TEST_TIME}),next=payload();next.catalogSequence='2';
  const second=await a.fresh(signPayload(next),{previous:first,now:TEST_TIME+1}),older=await a.restore(a.serialize(first)),newer=await a.restore(a.serialize(second));
  assert.equal(await a.assertSuccessor(newer,older),undefined);assert.throws(()=>a.requireFresh(newer,{now:TEST_TIME+1}));await assert.rejects(()=>a.assertSuccessor(older,newer));await assert.rejects(()=>a.assertSuccessor(structuredClone(newer),older));
});
