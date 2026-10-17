import {test,expect} from '@playwright/test';
import {TEST_KEY_ID,TEST_TIME,testSpki,signPayload,signedPayload} from '../../tests/fixtures/web-signed.mjs';
for(const which of ['begin','complete','missing','unknown','concurrent'])test(`controller epoch ${which} uses actual crypto and atomic IDB without SW activation claims`,async({page,request})=>{
  const catalog=await(await request.get('catalog.json')).json(),bytes=signPayload(signedPayload({catalog,origin:'http://127.0.0.1:18427'}));await page.goto('./');
  const result=await page.evaluate(async({which,bytes,spki,keyId,now})=>{
    const {openResourceDatabase}=await import('./cache/database.mjs'),{createCatalogAuthority}=await import('./update/catalog-authority.mjs'),{createResourceRepository}=await import('./update/resource-repository.mjs');
    const options={indexedDB,basePath:'/hub/',now:()=>now},db=await openResourceDatabase(options),input={build:'a'.repeat(40),epoch:'00000000-0000-4000-8000-000000000001',protocol:1},next={...input,epoch:'00000000-0000-4000-8000-000000000002'};
    const raw=await new Promise((resolve,reject)=>{const r=indexedDB.open('game-hub-web.resources./hub/',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const mutate=(key,value,remove=false)=>new Promise((resolve,reject)=>{const tx=raw.transaction('state','readwrite');remove?tx.objectStore('state').delete(key):tx.objectStore('state').put(value,key);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
    const read=key=>new Promise((resolve,reject)=>{const tx=raw.transaction('state'),store=tx.objectStore('state'),v=store.get(key),k=store.getKey(key);tx.oncomplete=()=>resolve({present:k.result!==undefined,value:v.result});tx.onabort=()=>reject(tx.error);});
    if(which==='unknown'){
      let preserved=true;for(const value of [undefined,{schemaVersion:2}]){
        await mutate('controller',value);let snapshot=false,activate=false;try{await db.snapshot();}catch{snapshot=true;}try{await db.activateController(input);}catch{activate=true;}const after=await read('controller');preserved&&=snapshot&&activate&&after.present&&JSON.stringify(after.value)===JSON.stringify(value);
      }raw.close();db.close();return {preserved};
    }
    if(which==='concurrent'){
      const second=await openResourceDatabase(options),records=await Promise.all([db.activateController(input),second.activateController(next)]),current=(await db.snapshot()).controller.record;
      const repeated=await db.activateController({build:current.build,epoch:current.epoch,protocol:current.protocol});const saved=await db.snapshot();raw.close();second.close();db.close();return {generations:records.map(r=>r.generation).sort(),stable:JSON.stringify(current)===JSON.stringify(repeated),empty:saved.state.revision===0&&saved.state.installations.length===0};
    }
    const controller=await db.activateController(input);let pause=false,signal,release;const reached=new Promise(resolve=>signal=resolve),gate=new Promise(resolve=>release=resolve);
    const slow={subtle:{importKey:(...args)=>crypto.subtle.importKey(...args),verify:async(...args)=>{if(pause){pause=false;signal();await gate;}return await crypto.subtle.verify(...args);}}};
    const authority=()=>createCatalogAuthority({spki:new Uint8Array(spki),keyId,origin:location.origin,basePath:'/hub/',crypto:slow}),repo=createResourceRepository({database:db,authority:authority(),now:()=>now,controller}),envelope=new Uint8Array(bytes);
    let record;if(which!=='begin')({record}=await repo.begin(envelope,'conway'));
    if(which==='missing'){
      await mutate('controller',undefined,true);let boundRejected=false,activationRejected=false;try{await repo.check(envelope);}catch{boundRejected=true;}try{await db.activateController(next);}catch{activationRejected=true;}
      const state=await db.read();raw.close();db.close();return {boundRejected,activationRejected,phase:state.installations[0].phase};
    }
    const before=await db.snapshot();pause=true;
    const pending=(which==='begin'?repo.begin(envelope,'conway'):repo.complete(record.fence,{manifestDigest:record.digest,complete:true})).then(()=>false,()=>true);
    await reached;const newer=await db.activateController(next);release();const rejected=await pending,after=await db.snapshot(),unchanged=JSON.stringify({state:before.state,authority:before.authority,proofs:before.proofs})===JSON.stringify({state:after.state,authority:after.authority,proofs:after.proofs});
    const current=createResourceRepository({database:db,authority:authority(),now:()=>now,controller:newer});let continued=false;
    try{if(which==='begin')await current.begin(envelope,'conway');else await current.complete(record.fence,{manifestDigest:record.digest,complete:true});continued=true;}catch{}
    raw.close();db.close();return {rejected,unchanged,continued,generation:newer.generation};
  },{which,bytes:[...bytes],spki:[...testSpki],keyId:TEST_KEY_ID,now:TEST_TIME});
  expect(result).toEqual(which==='unknown'?{preserved:true}:which==='concurrent'?{generations:[1,2],stable:true,empty:true}:which==='missing'?{boundRejected:true,activationRejected:true,phase:'staging'}:{rejected:true,unchanged:true,continued:true,generation:2});
});
