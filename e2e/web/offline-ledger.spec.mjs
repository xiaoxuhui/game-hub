import {test,expect} from '@playwright/test';

test('an existing undefined IDB value is corruption, never an absent first-visit key',async({page})=>{
  await page.goto('./');
  const result=await page.evaluate(async()=>{
    const {openResourceDatabase}=await import(new URL('cache/database.mjs',location.href));
    const options={indexedDB,basePath:'/hub/'},db=await openResourceDatabase(options);db.close();
    const raw=await new Promise((resolve,reject)=>{const r=indexedDB.open('game-hub-web.resources./hub/',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise((resolve,reject)=>{const tx=raw.transaction('state','readwrite');tx.objectStore('state').put(undefined,'current');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
    const guarded=await openResourceDatabase(options);let readRejected=false,writeRejected=false;
    try{await guarded.read();}catch{readRejected=true;}
    try{await guarded.apply({type:'begin',id:'one',contentCode:1,digest:'a'.repeat(64),proofHash:'b'.repeat(64),bytes:100});}catch{writeRejected=true;}
    const stored=await new Promise((resolve,reject)=>{const tx=raw.transaction('state'),store=tx.objectStore('state'),value=store.get('current'),key=store.getKey('current');tx.oncomplete=()=>resolve({keyPresent:key.result==='current',valueIsUndefined:value.result===undefined});tx.onabort=()=>reject(tx.error);});
    guarded.close();raw.close();return {readRejected,writeRejected,...stored};
  });
  expect(result).toEqual({readRejected:true,writeRejected:true,keyPresent:true,valueIsUndefined:true});
});

test('real IDB serializes global reservations and preserves cancelled fences across reopen',async({page})=>{
  await page.goto('./');
  const result=await page.evaluate(async()=>{
    const {openResourceDatabase}=await import(new URL('cache/database.mjs',location.href));
    const options={indexedDB,basePath:'/hub/'},a=await openResourceDatabase(options),b=await openResourceDatabase(options);
    const event=id=>({type:'begin',id,contentCode:1,digest:'a'.repeat(64),proofHash:'b'.repeat(64),bytes:75*1024*1024});
    const attempts=await Promise.allSettled([a.apply(event('one')),b.apply(event('two'))]);let state=await a.read();
    await b.apply({type:'cancel',fence:1});let staleRejected=false;
    try{await a.apply({type:'complete',fence:1,proofHash:'b'.repeat(64),manifestDigest:'a'.repeat(64),complete:true});}catch{staleRejected=true;}
    const second=await a.apply({...event('third'),bytes:1});a.close();b.close();
    const reopened=await openResourceDatabase(options);state=await reopened.read();reopened.close();
    return {attempts:attempts.map(r=>r.status).sort(),staleRejected,fence:second.result.fence,phases:state.installations.map(r=>r.phase),bytes:state.installations.reduce((n,r)=>n+r.bytes,0),revision:state.revision};
  });
  expect(result).toEqual({attempts:['fulfilled','rejected'],staleRejected:true,fence:2,phases:['failed','staging'],bytes:75*1024*1024+1,revision:3});
});

test('unknown persisted ledger stays byte-identical after read and write refusal',async({page})=>{
  await page.goto('./');
  const result=await page.evaluate(async()=>{
    const {openResourceDatabase}=await import(new URL('cache/database.mjs',location.href));
    const options={indexedDB,basePath:'/hub/'},db=await openResourceDatabase(options);db.close();
    const raw=await new Promise((resolve,reject)=>{const r=indexedDB.open('game-hub-web.resources./hub/',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const unknown={schemaVersion:99,personal:'保留原数据'},foreign='game-hub-test.foreign';localStorage.setItem(foreign,'unmodified');
    await new Promise((resolve,reject)=>{const tx=raw.transaction('state','readwrite');tx.objectStore('state').put(unknown,'current');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
    const guarded=await openResourceDatabase(options),rejected=[];
    for(const operation of [()=>guarded.read(),()=>guarded.apply({type:'cancel',fence:1})]){try{await operation();rejected.push(false);}catch{rejected.push(true);}}
    const saved=await new Promise((resolve,reject)=>{const tx=raw.transaction('state'),r=tx.objectStore('state').get('current');tx.oncomplete=()=>resolve(r.result);tx.onabort=()=>reject(tx.error);});
    guarded.close();raw.close();return {rejected,saved,foreign:localStorage.getItem(foreign)};
  });
  expect(result).toEqual({rejected:[true,true],saved:{schemaVersion:99,personal:'保留原数据'},foreign:'unmodified'});
});

test('a real IDB transaction abort keeps its preceding complete root and does not consume a fence',async({page})=>{
  await page.goto('./');
  const result=await page.evaluate(async()=>{
    const {openResourceDatabase}=await import(new URL('cache/database.mjs',location.href));
    const db=await openResourceDatabase({indexedDB,basePath:'/hub/'}),event={type:'begin',id:'one',contentCode:1,digest:'a'.repeat(64),proofHash:'b'.repeat(64),bytes:100};
    await db.apply(event);const before=JSON.stringify(await db.read()),put=IDBObjectStore.prototype.put;let rejected=false;
    IDBObjectStore.prototype.put=function(...args){if(this.name==='state')throw new DOMException('injected quota failure','QuotaExceededError');return put.apply(this,args);};
    try{await db.apply({...event,id:'two'});}catch{rejected=true;}finally{IDBObjectStore.prototype.put=put;}
    const unchanged=before===JSON.stringify(await db.read()),next=await db.apply({...event,id:'two'});db.close();return {rejected,unchanged,nextFence:next.result.fence};
  });
  expect(result).toEqual({rejected:true,unchanged:true,nextFence:2});
});
