import {test,expect} from '@playwright/test';
async function setup(page,request){
  const catalog=await (await request.get('catalog.json')).json();await page.goto('./');
  const url=new URL('./hub-runtime/save-store.mjs',new URL(catalog.games[0].entryUrl,page.url())).href;
  await page.evaluate(async url=>{window.saveModule=await import(url);},url);
}
test('IDB serializes competing whole saves and fences an older tab',async({page,request})=>{
  await setup(page,request);
  const result=await page.evaluate(async()=>{
    const scope={keys:['test.save'],prefixes:[]},a=await saveModule.openSaveStore({indexedDB,basePath:'/race/'}),b=await saveModule.openSaveStore({indexedDB,basePath:'/race/'});
    const first=await a.acquire({gameId:'demo',writerId:'a',scope,legacy:[],journals:[]});
    const race=await Promise.allSettled([a.commit({...first,sequence:1,entries:[['test.save','first']]},scope),b.commit({...first,sequence:2,entries:[['test.save','second']]},scope)]);
    const winner=race.find(result=>result.status==='fulfilled').value;
    const second=await b.acquire({gameId:'demo',writerId:'b',scope,legacy:[],journals:[]});
    const late=await a.commit({...winner,sequence:3,entries:[['test.save','stale']]},scope).then(()=>false,()=>true);
    const current=await b.acquire({gameId:'demo',writerId:'c',scope,legacy:[],journals:[]});a.close();b.close();
    return {fulfilled:race.filter(r=>r.status==='fulfilled').length,late,entries:current.entries,expected:second.entries,fence:current.fence};
  });
  expect(result).toMatchObject({fulfilled:1,late:true,fence:3});expect(result.entries).toEqual(result.expected);
});
test('crash journal survives a commit/callback gap; original and pre-recovery bytes remain backed up',async({page,request})=>{
  await setup(page,request);
  const result=await page.evaluate(async()=>{
    const scope={keys:['test.save'],prefixes:[]},db=await saveModule.openSaveStore({indexedDB,basePath:'/recover/'});
    const first=await db.acquire({gameId:'demo',writerId:'a',scope,legacy:[['test.save','original opaque bytes']],journals:[]});
    const journal={...first,sequence:2,entries:[['test.save','newer full journal']]};
    await db.commit({...first,sequence:1,entries:[['test.save','first commit']]},scope);
    const recovered=await db.acquire({gameId:'demo',writerId:'b',scope,legacy:[],journals:[journal]});
    const backups=await db.backups('demo');db.close();return {entries:recovered.entries,backups:backups.map(b=>b.record.entries)};
  });
  expect(result.entries).toEqual([['test.save','newer full journal']]);
  expect(result.backups).toContainEqual([['test.save','original opaque bytes']]);expect(result.backups).toContainEqual([['test.save','first commit']]);
});
test('scoped clear preserves another game and an empty save never resurrects raw legacy data',async({page,request})=>{
  await setup(page,request);
  const result=await page.evaluate(async()=>{
    const scope={keys:['test.save'],prefixes:[]},other={keys:['other.save'],prefixes:[]},db=await saveModule.openSaveStore({indexedDB,basePath:'/clear/'});
    const current=await db.acquire({gameId:'demo',writerId:'a',scope,legacy:[['test.save','old']],journals:[]});
    await db.acquire({gameId:'other',writerId:'a',scope:other,legacy:[['other.save','keep']],journals:[]});
    await db.commit({...current,sequence:1,entries:[]},scope,{backup:true});
    const empty=await db.acquire({gameId:'demo',writerId:'b',scope,legacy:[['test.save','old']],journals:[]});
    const kept=await db.acquire({gameId:'other',writerId:'b',scope:other,legacy:[],journals:[]});
    const backups=await db.backups('demo');db.close();return {empty:empty.entries,kept:kept.entries,backups:backups.map(b=>b.record.entries)};
  });
  expect(result.empty).toEqual([]);expect(result.kept).toEqual([['other.save','keep']]);expect(result.backups).toContainEqual([['test.save','old']]);
});
test('newer future-format crash journal blocks takeover without changing the IDB writer',async({page,request})=>{
  await setup(page,request);
  const result=await page.evaluate(async()=>{
    const scope={keys:['test.save'],prefixes:[]},db=await saveModule.openSaveStore({indexedDB,basePath:'/future/'});
    const current=await db.acquire({gameId:'demo',writerId:'a',scope,legacy:[['test.save','old']],journals:[]});
    const journal={...current,sequence:2,future:{opaque:true}};
    const blocked=await db.acquire({gameId:'demo',writerId:'b',scope,legacy:[],journals:[journal]}).then(()=>false,()=>true);
    // If takeover was aborted atomically, the previous writer still owns fence1.
    const retained=await db.commit({...current,sequence:1,entries:[['test.save','writer retained']]},scope).then(()=>true,()=>false);
    db.close();return {blocked,retained,journal};
  });
  expect(result.blocked).toBe(true);expect(result.retained).toBe(true);expect(result.journal.future).toEqual({opaque:true});
});
test('atomic restore keeps the old complete save and fences old callbacks and crash logs',async({page,request})=>{
  await setup(page,request);
  const result=await page.evaluate(async()=>{
    const scope={keys:['test.save'],prefixes:[]},db=await saveModule.openSaveStore({indexedDB,basePath:'/restore/'});
    const original=await db.acquire({gameId:'demo',writerId:'a',scope,legacy:[['test.save','old complete bytes']],journals:[]});
    const restored=await db.restore({gameId:'demo',expected:original,writerId:'restore-b',entries:[['test.save','restored']]},scope);
    const late=await db.commit({...original,sequence:5,entries:[['test.save','late callback']]},scope).then(()=>false,()=>true);
    const next=await db.acquire({gameId:'demo',writerId:'c',scope,legacy:[],journals:[{...original,sequence:99,entries:[['test.save','old crash journal']]}]});
    const backups=await db.backups('demo');db.close();return {fence:restored.fence,revision:restored.revision,late,entries:next.entries,backups:backups.map(b=>b.record)};
  });
  expect(result).toMatchObject({fence:2,revision:1,late:true,entries:[['test.save','restored']]});expect(result.backups.some(b=>b.writerId==='a'&&b.entries[0][1]==='old complete bytes')).toBe(true);
});
test('failure after queuing the restore backup aborts both backup and canonical changes',async({page,request})=>{
  await setup(page,request);
  const result=await page.evaluate(async()=>{
    const scope={keys:['test.save'],prefixes:[]},db=await saveModule.openSaveStore({indexedDB,basePath:'/restore-abort/'});
    const original=await db.acquire({gameId:'demo',writerId:'a',scope,legacy:[['test.save','keep']],journals:[]});
    const before=(await db.backups('demo')).length,put=IDBObjectStore.prototype.put;let failed;
    try{
      IDBObjectStore.prototype.put=function(value,...args){if(this.name==='saves'&&value.writerId==='restore-b')throw new DOMException('injected quota after backup queued','QuotaExceededError');return put.call(this,value,...args);};
      failed=await db.restore({gameId:'demo',expected:original,writerId:'restore-b',entries:[['test.save','must not persist']]},scope).then(()=>false,()=>true);
    }finally{IDBObjectStore.prototype.put=put;}
    const current=await db.current('demo'),after=(await db.backups('demo')).length;db.close();return {failed,current,before,after};
  });
  expect(result.failed).toBe(true);expect(result.current).toMatchObject({writerId:'a',fence:1,revision:0,entries:[['test.save','keep']]});expect(result.after).toBe(result.before);
});
