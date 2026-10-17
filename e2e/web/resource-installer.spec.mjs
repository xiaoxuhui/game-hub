import {test,expect} from '@playwright/test';
import {TEST_KEY_ID,TEST_TIME,testSpki,signPayload,signedPayload} from '../../tests/fixtures/web-signed.mjs';
const cases=['success','hash','mime','quota','cancel','late-put','control','uncontrolled','orphan','extra','missing','expiry','marker-byte','marker-header'];
for(const which of cases)test(`cache component ${which} uses actual fetch CacheStorage and IDB without claiming SW control`,async({page,request})=>{
  const catalog=await (await request.get('catalog.json')).json(),bytes=signPayload(signedPayload({catalog,origin:'http://127.0.0.1:18427'}));
  if(['hash','mime'].includes(which))await page.route('**/games/conway/**/index.html',async route=>{
    const response=await route.fetch(),body=Buffer.from(await response.body()),headers={...response.headers()};
    if(which==='hash')body[0]^=1;else headers['content-type']='text/plain; charset=utf-8';headers['content-length']=String(body.length);await route.fulfill({response,body,headers});
  });
  await page.goto('./');
  const result=await page.evaluate(async({which,bytes,spki,keyId,start,catalog})=>{
    const {openResourceDatabase}=await import(new URL('cache/database.mjs',location.href));
    const {resourceCachePrefix}=await import(new URL('cache/ledger.mjs',location.href));
    const {createCatalogAuthority}=await import(new URL('update/catalog-authority.mjs',location.href));
    const {createResourceRepository}=await import(new URL('update/resource-repository.mjs',location.href));
    const {createResourceInstaller}=await import(new URL('cache/installer.mjs',location.href));
    const {completionMarker,resourceURL}=await import(new URL('cache/resource-files.mjs',location.href));
    const saveGame=catalog.games.find(g=>g.id==='eml');
    const {openSaveStore}=await import(new URL(saveGame.entryUrl.slice(0,-saveGame.entryPage.length)+'hub-runtime/save-store.mjs',location.origin));
    // The built hall excludes raw runtime/. Use a reviewed game's identical
    // self-contained runtime helper to create an opaque other-game save record.
    let now=start,control=which==='uncontrolled'?null:'test-component-controlled';const basePath='/hub/',origin=location.origin;
    const db=await openResourceDatabase({indexedDB,basePath,now:()=>now}),authority=createCatalogAuthority({spki:new Uint8Array(spki),keyId,origin,basePath}),repo=createResourceRepository({database:db,authority,now:()=>now});
    const other=catalog.games.find(g=>g.id==='eml'),key=other.storage.keys[0]??other.storage.prefixes[0]+'sentinel';
    const saveDB=await openSaveStore({indexedDB,basePath});await saveDB.acquire({gameId:other.id,writerId:'cache-fixture',scope:other.storage,legacy:[[key,'opaque user save 🧩']],journals:[]});const before=JSON.stringify(await saveDB.current(other.id));
    const foreign=await caches.open('foreign-app-test'),foreignURL=origin+basePath+'foreign-sentinel.txt';await foreign.put(foreignURL,new Response('keep'));
    let orphan;if(which==='orphan'){orphan=await caches.open(resourceCachePrefix(basePath)+'999');await orphan.put(foreignURL,new Response('orphan-keep'));}
    const installer=createResourceInstaller({repository:repo,caches,fetch:globalThis.fetch,origin,basePath,control:async()=>control}),aborter=new AbortController();
    let calls=0,signal,release;const reached=new Promise(resolve=>signal=resolve),gate=new Promise(resolve=>release=resolve),put=Cache.prototype.put;
    Cache.prototype.put=async function(request,response){
      calls++;const url=typeof request==='string'?request:request.url;
      if(which==='quota'&&calls===1)throw new DOMException('injected Cache quota','QuotaExceededError');
      if(which==='late-put'&&calls===1){signal();await gate;}
      if(url.includes('/__hub/resources/')&&which==='marker-byte'){
        const text=await response.text(),headers=new Headers(response.headers),bytes=new TextEncoder().encode(JSON.stringify(JSON.parse(text),null,2)+'\n');headers.set('content-length',String(bytes.length));response=new Response(bytes,{headers});
      }
      if(url.includes('/__hub/resources/')&&which==='marker-header'){response.headers.set('content-security-policy','default-src *');}
      const result=await put.call(this,request,response);
      if(which==='cancel'&&calls===1)aborter.abort();if(which==='control'&&calls===1)control='different-controller';
      if(url.includes('/__hub/resources/')){if(which==='expiry')now=start+86400000;if(which==='extra')await put.call(this,origin+basePath+'unlisted.txt',new Response('unlisted'));}
      return result;
    };
    let rejected=false,error='',installed;
    try{
      const pending=installer.install(new Uint8Array(bytes),'conway',{signal:aborter.signal,onProgress(){if(which==='success')throw Error('broken progress observer');}});
      if(which==='late-put'){await reached;const state=await repo.inspect();await repo.cancel(state.state.installations[0].fence);release();}
      installed=await pending;
    }catch(e){rejected=true;error=e.message;}finally{Cache.prototype.put=put;}
    const saved=await repo.inspect(),record=saved.state.installations[0],unchanged=before===JSON.stringify(await saveDB.current(other.id))&&(await (await foreign.match(foreignURL)).text())==='keep';
    if(which==='orphan'){const value=await (await orphan.match(foreignURL)).text();repo.close();saveDB.close();return {rejected,count:saved.state.installations.length,orphanPreserved:value==='orphan-keep',unchanged};}
    if(which==='uncontrolled'){repo.close();saveDB.close();return {rejected,count:saved.state.installations.length,unchanged};}
    if(which==='success'){const verified=await installer.verify(record.fence);repo.close();saveDB.close();return {ready:installed.record.phase==='ready',verified:verified.record.fence===record.fence,unchanged};}
    if(which==='missing'){
      const proof=await repo.proof(record.fence),cache=await caches.open(record.cacheName);await cache.delete(resourceURL(origin,basePath,proof.game,proof.game.files[0].path));let repaired=false;
      try{await installer.verify(record.fence);}catch{repaired=true;}const after=await repo.inspect();repo.close();saveDB.close();return {repaired,phase:after.state.installations[0].phase,retained:after.state.installations[0].bytes>0,unchanged};
    }
    const cache=await caches.has(record.cacheName)?await caches.open(record.cacheName):null,marker=cache?Boolean(await cache.match(completionMarker(record,origin,basePath).url)):false;
    repo.close();saveDB.close();return {rejected,phase:record.phase,retained:record.bytes>0,marker,unchanged,reason:which==='hash'?error.includes('digest'):which==='mime'?error.includes('MIME'):true,stopped:which==='late-put'?calls===1:true};
  },{which,bytes:[...bytes],spki:[...testSpki],keyId:TEST_KEY_ID,start:TEST_TIME,catalog});
  if(which==='success')expect(result).toEqual({ready:true,verified:true,unchanged:true});
  else if(which==='orphan')expect(result).toEqual({rejected:true,count:0,orphanPreserved:true,unchanged:true});
  else if(which==='uncontrolled')expect(result).toEqual({rejected:true,count:0,unchanged:true});
  else if(which==='missing')expect(result).toEqual({repaired:true,phase:'repair',retained:true,unchanged:true});
  else expect(result).toEqual({rejected:true,phase:'failed',retained:true,marker:['extra','expiry','marker-byte','marker-header'].includes(which),unchanged:true,reason:true,stopped:true});
});
