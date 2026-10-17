import {test,expect} from '@playwright/test';
import {TEST_KEY_ID,TEST_TIME,testSpki,signPayload,signedPayload} from '../../tests/fixtures/web-signed.mjs';

test('real browser restores a structured-cloned signature receipt without granting fresh download authority',async({page,request})=>{
  const catalog=await (await request.get('catalog.json')).json(),bytes=signPayload(signedPayload({catalog,origin:'http://127.0.0.1:18427'}));await page.goto('./');
  const result=await page.evaluate(async({bytes,spki,keyId,now})=>{
    const {createCatalogAuthority}=await import(new URL('update/catalog-authority.mjs',location.href));
    const options={spki:new Uint8Array(spki),keyId,origin:location.origin,basePath:'/hub/'},a=createCatalogAuthority(options),first=await a.fresh(new Uint8Array(bytes),{now}),record=a.serialize(first);
    const open=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('game-hub-web.test-receipts',1);r.onupgradeneeded=()=>r.result.createObjectStore('receipt');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    let db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction('receipt','readwrite');tx.objectStore('receipt').put(record,'current');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();db=await open();
    const persisted=await new Promise((resolve,reject)=>{const tx=db.transaction('receipt'),r=tx.objectStore('receipt').get('current');tx.oncomplete=()=>resolve(r.result);tx.onabort=()=>reject(tx.error);});db.close();
    const b=createCatalogAuthority(options),restored=await b.restore(persisted);let noFresh=false,wrongInstance=false,expired=false;
    try{b.requireFresh(restored,{now});}catch{noFresh=true;}try{b.serialize(first);}catch{wrongInstance=true;}try{await b.fresh(new Uint8Array(bytes),{previous:restored,now:now+2*86400000});}catch{expired=true;}
    return {same:JSON.stringify(restored)===JSON.stringify(first),typed:persisted.envelope instanceof Uint8Array,games:restored.catalog.games.length,noFresh,wrongInstance,expired};
  },{bytes:[...bytes],spki:[...testSpki],keyId:TEST_KEY_ID,now:TEST_TIME});
  expect(result).toEqual({same:true,typed:true,games:8,noFresh:true,wrongInstance:true,expired:true});
});

test('real browser receipt checks reject recomputed checksum forgeries and production key substitution',async({page,request})=>{
  const catalog=await (await request.get('catalog.json')).json(),bytes=signPayload(signedPayload({catalog,origin:'http://127.0.0.1:18427'}));await page.goto('./');
  const result=await page.evaluate(async({bytes,spki,keyId,now})=>{
    const {createCatalogAuthority}=await import(new URL('update/catalog-authority.mjs',location.href)),{createPinnedAuthority}=await import(new URL('update/trust.mjs',location.href)),{sha256Hex}=await import(new URL('core/digests.mjs',location.href));
    const options={spki:new Uint8Array(spki),keyId,origin:location.origin,basePath:'/hub/'},a=createCatalogAuthority(options),first=await a.fresh(new Uint8Array(bytes),{now}),record=a.serialize(first);
    record.history.games[0].descriptorHash='c'.repeat(64);record.receiptSha256=sha256Hex(JSON.stringify({schemaVersion:record.schemaVersion,envelopeSha256:sha256Hex(record.envelope),verifiedAt:record.verifiedAt,history:record.history}));
    let forged=false,pinned=false,configurable=false;
    try{await a.restore(record);}catch{forged=true;}
    try{await createPinnedAuthority({origin:location.origin,basePath:'/hub/'}).fresh(new Uint8Array(bytes),{now});}catch{pinned=true;}
    try{createPinnedAuthority({...options});}catch{configurable=true;}
    return {forged,pinned,configurable};
  },{bytes:[...bytes],spki:[...testSpki],keyId:TEST_KEY_ID,now:TEST_TIME});
  expect(result).toEqual({forged:true,pinned:true,configurable:true});
});
