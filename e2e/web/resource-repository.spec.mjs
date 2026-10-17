import {test,expect} from '@playwright/test';
import {TEST_KEY_ID,TEST_TIME,testSpki,signPayload,signedPayload} from '../../tests/fixtures/web-signed.mjs';
const cases={
  complete:['signed receipts and ready installation commit together across reopen',{phase:'ready',games:8,proof:true,revision:3}],
  concurrent:['two signature waits cannot reserve against the same old snapshot',{success:1,rejected:1,count:2,fences:[1,2]}],
  quota:['quota failure aborts authority proof and installation as one transaction',{rejected:true,empty:true,keys:0,retryFence:1}],
  undefined:['existing undefined authority and proof keys are preserved on refusal',{authorityRejected:true,authorityPreserved:true,proofRejected:true,proofPreserved:true}],
  expiry:['expiry and cancellation block ready while retaining the reservation',{expired:true,staging:true,failed:true,late:true}],
  late:['a cancellation during real signature await invalidates the complete CAS',{rejected:true,phase:'failed'}]
};
for(const [which,[name,expected]] of Object.entries(cases))test(name,async({page,request})=>{
  const catalog=await (await request.get('catalog.json')).json(),bytes=signPayload(signedPayload({catalog,origin:'http://127.0.0.1:18427'}));await page.goto('./');
  const result=await page.evaluate(async({which,bytes,spki,keyId,start})=>{
    const {openResourceDatabase}=await import(new URL('cache/database.mjs',location.href));
    const {createCatalogAuthority}=await import(new URL('update/catalog-authority.mjs',location.href));
    const {createResourceRepository}=await import(new URL('update/resource-repository.mjs',location.href));
    const options={indexedDB,basePath:'/hub/'},trust={spki:new Uint8Array(spki),keyId,origin:location.origin,basePath:'/hub/'};let now=start;
    const db=await openResourceDatabase(options),authority=createCatalogAuthority(trust),repo=createResourceRepository({database:db,authority,now:()=>now}),envelope=new Uint8Array(bytes);
    const rawOpen=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('game-hub-web.resources./hub/',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const putRaw=async(raw,key,value)=>new Promise((resolve,reject)=>{const tx=raw.transaction('state','readwrite');tx.objectStore('state').put(value,key);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
    const readRaw=async(raw,key)=>new Promise((resolve,reject)=>{const tx=raw.transaction('state'),s=tx.objectStore('state'),v=s.get(key),k=s.getKey(key);tx.oncomplete=()=>resolve({present:k.result!==undefined,value:v.result});tx.onabort=()=>reject(tx.error);});
    if(which==='complete'){
      await repo.check(envelope);const {record}=await repo.begin(envelope,'conway');await repo.complete(record.fence,{manifestDigest:record.digest,complete:true});repo.close();
      const again=createResourceRepository({database:await openResourceDatabase(options),authority:createCatalogAuthority(trust),now:()=>now}),saved=await again.inspect(),proof=await again.proof(record.fence);again.close();return {phase:saved.state.installations[0].phase,games:saved.catalog.games.length,proof:proof.receipt.history.payloadSha256===record.proofHash,revision:saved.state.revision};
    }
    if(which==='concurrent'){
      let calls=0,release;const gate=new Promise(resolve=>release=resolve);const wrap=a=>({...a,async fresh(...args){const result=await a.fresh(...args);if(++calls===2)release();await gate;return result;}});
      const db2=await openResourceDatabase(options),r1=createResourceRepository({database:db,authority:wrap(authority),now:()=>now}),r2=createResourceRepository({database:db2,authority:wrap(createCatalogAuthority(trust)),now:()=>now});
      const attempts=await Promise.allSettled([r1.begin(envelope,'conway'),r2.begin(envelope,'eml')]),saved=await r1.inspect(),missing=saved.state.installations[0].id==='conway'?'eml':'conway';now++;
      await r1.begin(envelope,missing);const final=await r1.inspect();r1.close();r2.close();return {success:attempts.filter(r=>r.status==='fulfilled').length,rejected:attempts.filter(r=>r.status==='rejected').length,count:final.state.installations.length,fences:final.state.installations.map(r=>r.fence)};
    }
    if(which==='quota'){
      const original=IDBObjectStore.prototype.put;let rejected=false;
      IDBObjectStore.prototype.put=function(value,key){if(this.name==='state'&&key==='authority')throw new DOMException('injected quota failure','QuotaExceededError');return original.call(this,value,key);};
      try{await repo.begin(envelope,'conway');}catch{rejected=true;}finally{IDBObjectStore.prototype.put=original;}
      const state=await repo.inspect(),raw=await rawOpen(),keys=await new Promise((resolve,reject)=>{const tx=raw.transaction('state'),r=tx.objectStore('state').getAllKeys();tx.oncomplete=()=>resolve(r.result.length);tx.onabort=()=>reject(tx.error);});raw.close();
      const next=await repo.begin(envelope,'conway');repo.close();return {rejected,empty:state.state.revision===0&&state.state.installations.length===0&&state.catalog===null,keys,retryFence:next.record.fence};
    }
    if(which==='undefined'){
      await repo.check(envelope);const raw=await rawOpen(),good=await readRaw(raw,'authority');await putRaw(raw,'authority',undefined);let authorityRejected=false,proofRejected=false;
      try{await repo.check(envelope);}catch{authorityRejected=true;}const bad=await readRaw(raw,'authority');await putRaw(raw,'authority',good.value);
      const {record}=await repo.begin(envelope,'conway');await putRaw(raw,'proof:'+record.proofHash,undefined);try{await repo.cancel(record.fence);}catch{proofRejected=true;}const badProof=await readRaw(raw,'proof:'+record.proofHash);raw.close();repo.close();return {authorityRejected,authorityPreserved:bad.present&&bad.value===undefined,proofRejected,proofPreserved:badProof.present&&badProof.value===undefined};
    }
    if(which==='expiry'){
      const {record}=await repo.begin(envelope,'conway');now=start+86400000;let expired=false,late=false;
      try{await repo.complete(record.fence,{manifestDigest:record.digest,complete:true});}catch{expired=true;}const staging=(await repo.inspect()).state.installations[0].phase==='staging';await repo.cancel(record.fence);
      try{await repo.complete(record.fence,{manifestDigest:record.digest,complete:true});}catch{late=true;}const failed=(await repo.inspect()).state.installations[0].phase==='failed';repo.close();return {expired,staging,failed,late};
    }
    const {record}=await repo.begin(envelope,'conway');let signal,release;const reached=new Promise(resolve=>signal=resolve),gate=new Promise(resolve=>release=resolve);
    const slow=createResourceRepository({database:db,authority:{...authority,async fresh(...args){const receipt=await authority.fresh(...args);signal();await gate;return receipt;}},now:()=>now});
    const pending=slow.complete(record.fence,{manifestDigest:record.digest,complete:true});await reached;await repo.cancel(record.fence);release();let rejected=false;try{await pending;}catch{rejected=true;}const phase=(await repo.inspect()).state.installations[0].phase;repo.close();return {rejected,phase};
  },{which,bytes:[...bytes],spki:[...testSpki],keyId:TEST_KEY_ID,start:TEST_TIME});
  expect(result).toEqual(expected);
});
