import {test,expect} from '@playwright/test';
async function session(page,request){
  const catalog=await (await request.get('catalog.json')).json();await page.goto('./');const root=new URL('.',new URL(catalog.games[0].entryUrl,page.url())).href;
  await page.evaluate(async root=>{const {startSaveSession}=await import(new URL('hub-runtime/save-session.mjs',root));window.scope={keys:['restore.save'],prefixes:[]};window.options={gameId:'restore-demo',scope,basePath:'/restore-session/'};window.a=await startSaveSession(options);a.storage.setItem('restore.save','original');await a.flush();},root);return root;
}
test('session restore binds immutable candidate to revision, preserves old bytes and fences stale writes',async({page,request})=>{
  const root=await session(page,request);
  const result=await page.evaluate(async root=>{
    const candidate=[['restore.save','replacement']],preview=await a.prepareRestore(candidate);candidate[0][1]='mutated after preview';await a.restore(preview.token);
    const blocked=(()=>{try{a.storage.setItem('restore.save','late callback');return false;}catch{return true;}})(),backups=(await a.backups()).map(row=>row.record.entries),oldView=a.storage.getItem('restore.save');
    const {startSaveSession}=await import(new URL('hub-runtime/save-session.mjs',root)),b=await startSaveSession(options),value=b.storage.getItem('restore.save');a.close();b.close();
    return {blocked,backups,oldView,value};
  },root);
  expect(result).toMatchObject({blocked:true,oldView:'original',value:'replacement'});expect(result.backups).toContainEqual([['restore.save','original']]);
});
test('changed save or another writer expires restore preview without replacing current data',async({page,request})=>{
  const root=await session(page,request);
  const result=await page.evaluate(async root=>{
    let preview=await a.prepareRestore([['restore.save','not allowed']]);a.storage.setItem('restore.save','newer edit');await a.flush();let changed=false;try{await a.restore(preview.token);}catch{changed=true;}
    preview=await a.prepareRestore([['restore.save','also not allowed']]);const {startSaveSession}=await import(new URL('hub-runtime/save-session.mjs',root)),b=await startSaveSession(options);b.storage.setItem('restore.save','other writer');await b.flush();let fenced=false;try{await a.restore(preview.token);}catch{fenced=true;}
    const c=await startSaveSession(options),value=c.storage.getItem('restore.save');a.close();b.close();c.close();return {changed,fenced,value};
  },root);expect(result).toEqual({changed:true,fenced:true,value:'other writer'});
});
test('restore abort keeps old data and page readonly; a failed broadcast cannot undo a committed restore',async({page,request})=>{
  const root=await session(page,request);
  const result=await page.evaluate(async root=>{
    let preview=await a.prepareRestore([['restore.save','aborted']]);const put=IDBObjectStore.prototype.put;let failed;
    try{IDBObjectStore.prototype.put=function(value,...args){if(this.name==='saves'&&value.gameId==='restore-demo')throw Error('injected restore failure');return put.call(this,value,...args);};failed=await a.restore(preview.token).then(()=>false,()=>true);}finally{IDBObjectStore.prototype.put=put;}
    const readonly=a.snapshot().mode==='readonly';a.close();const {startSaveSession}=await import(new URL('hub-runtime/save-session.mjs',root));let messages=0;
    const b=await startSaveSession({...options,environment:{localStorage,indexedDB,crypto,BroadcastChannel:class{postMessage(){if(++messages>1)throw Error('notification unavailable');}close(){}}}}),old=b.storage.getItem('restore.save');preview=await b.prepareRestore([['restore.save','committed']]);const committed=await b.restore(preview.token).then(()=>true,()=>false);b.close();const c=await startSaveSession(options),value=c.storage.getItem('restore.save');c.close();return {failed,readonly,old,committed,value};
  },root);expect(result).toEqual({failed:true,readonly:true,old:'original',committed:true,value:'committed'});
});
