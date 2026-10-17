import {test,expect} from '@playwright/test';
async function setup(page,request){const game=(await (await request.get('catalog.json')).json()).games[0];await page.goto('./');const url=new URL('hub-runtime/save-session.mjs',new URL('.',new URL(game.entryUrl,page.url()))).href;await page.evaluate(async url=>{const {startSaveSession}=await import(url);window.nativeSession=await startSaveSession({gameId:'native-import',basePath:'/native-import-session/',scope:{keys:['native.save'],prefixes:[]}});nativeSession.storage.setItem('native.save','original opaque bytes');await nativeSession.flush();},url);}
test('native import confirmation expires after an edit; checkpoint preserves old bytes without replacing canonical data',async({page,request})=>{
  await setup(page,request);const result=await page.evaluate(async()=>{const a=nativeSession;let preview=await a.prepareImport();a.storage.setItem('native.save','newer edit');await a.flush();let expired=false;try{await a.commitImport(preview.token);}catch{expired=true;}const before=(await a.backups()).length;preview=await a.prepareImport();await a.commitImport(preview.token);const after=await a.backups(),snapshot=a.committedSnapshot();a.close();return {expired,before,backups:after.map(row=>row.record.entries),snapshot};});
  expect(result.expired).toBe(true);expect(result.before).toBe(0);expect(result.backups).toEqual([[['native.save','newer edit']]]);expect(result.snapshot.entries).toEqual([['native.save','newer edit']]);
});
test('failed pre-import backup leaves canonical untouched and never permits the importer to continue',async({page,request})=>{
  await setup(page,request);const result=await page.evaluate(async()=>{const a=nativeSession,preview=await a.prepareImport(),put=IDBObjectStore.prototype.put;let rejected;try{IDBObjectStore.prototype.put=function(value,...args){if(this.name==='backups')throw new DOMException('injected backup quota','QuotaExceededError');return put.call(this,value,...args);};rejected=await a.commitImport(preview.token).then(()=>false,()=>true);}finally{IDBObjectStore.prototype.put=put;}const snapshot=a.committedSnapshot(),backups=await a.backups(),mode=a.snapshot().mode;a.close();return {rejected,snapshot,backups,mode};});expect(result).toMatchObject({rejected:true,mode:'readonly',backups:[]});expect(result.snapshot.entries).toEqual([['native.save','original opaque bytes']]);
});
test('cancelling during the initial confirmation await never starts a backup transaction',async({page,request})=>{
  await setup(page,request);const result=await page.evaluate(async()=>{const a=nativeSession,preview=await a.prepareImport(),pending=a.commitImport(preview.token);a.cancelImport();const rejected=await pending.then(()=>false,()=>true),backups=await a.backups();a.close();return {rejected,count:backups.length};});expect(result).toEqual({rejected:true,count:0});
});
for(const action of ['cancel','replace','close'])test(`${action} after a real checkpoint commits cannot authorize returning an old native file`,async({page,request})=>{
  await setup(page,request);const result=await page.evaluate(async action=>{
    const a=nativeSession,preview=await a.prepareImport(),descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');let release,signal,intercepted=false,newPreview;
    const committed=new Promise(resolve=>{signal=resolve;});Object.defineProperty(IDBTransaction.prototype,'oncomplete',{...descriptor,set(callback){const transaction=this;descriptor.set.call(this,function(event){if(!intercepted&&transaction.mode==='readwrite'){intercepted=true;release=()=>callback.call(transaction,event);signal();}else callback.call(transaction,event);});}});
    let rejected,replacementAccepted=true;
    try{
      const pending=a.commitImport(preview.token);await committed;
      if(action==='cancel')a.cancelImport();else if(action==='replace')newPreview=await a.prepareImport();else a.close();release();rejected=await pending.then(()=>false,()=>true);
      if(newPreview)replacementAccepted=await a.commitImport(newPreview.token).then(()=>true,()=>false);
    }finally{Object.defineProperty(IDBTransaction.prototype,'oncomplete',descriptor);}
    const entries=await new Promise((resolve,reject)=>{const request=indexedDB.open('game-hub-web.saves./native-import-session/',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('saves'),read=tx.objectStore('saves').get('native-import');let record;read.onsuccess=()=>{record=read.result;};tx.oncomplete=()=>{db.close();resolve(record.entries);};};});if(action!=='close')a.close();return {rejected,replacementAccepted,entries};
  },action);expect(result).toEqual({rejected:true,replacementAccepted:true,entries:[['native.save','original opaque bytes']]});
});
