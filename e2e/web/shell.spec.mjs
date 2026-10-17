import {test,expect} from '@playwright/test';
for(const fault of ['offline','missing','extra','bytes','marker'])test(`real shell cold navigation ${fault} keeps one complete generation`,async({page,context,request})=>{
  await page.goto('./');const build=await(await request.get('build-manifest.json')).json();
  await page.evaluate(async()=>{const {createControllerGate}=await import('./control/gate.mjs');const gate=createControllerGate();await gate.register();await navigator.serviceWorker.ready;gate.close();});
  const before=await page.evaluate(async()=>{const {openShellDatabase}=await import('./cache/shell-database.mjs');const db=await openShellDatabase({indexedDB,basePath:'/hub/'}),state=await db.read();db.close();return state;});expect(before.records.at(-1).phase).toBe('ready');
  if(fault!=='offline')await page.evaluate(async({fault,build,record})=>{
    const cache=await caches.open(record.cacheName),url=location.origin+'/hub/index.html';
    if(fault==='missing')await cache.delete(url);
    if(fault==='extra')await cache.put(location.origin+'/hub/extra.txt',new Response('unlisted'));
    if(fault==='bytes'){const response=await cache.match(url);await cache.put(url,new Response('corrupt',{headers:response.headers}));}
    if(fault==='marker'){const keys=await cache.keys(),key=keys.find(r=>r.url.includes('/__hub/shell/')),response=await cache.match(key);response.headers.set('content-security-policy','default-src *');await cache.put(key,response);}
  },{fault,build,record:before.records.at(-1)});
  await context.setOffline(true);const response=await page.reload({waitUntil:'domcontentloaded'});expect(response.fromServiceWorker()).toBe(true);
  if(fault==='offline'){
    expect(response.status()).toBe(200);await expect(page.getByRole('heading',{name:'游戏大厅',exact:true})).toBeVisible();await expect(page.locator('#status')).toContainText('检查失败');await expect(page.locator('#status')).not.toContainText('检查成功');
    expect(await page.evaluate(async()=>(await import('./build-context.mjs')).BUILD.build)).toBe(build.sourceCommit);
  }else{expect(response.status()).toBe(503);await expect(page.locator('body')).toContainText('大厅缓存不完整');}
});
test('PWA manifest stays within base and reuses actual 512 pixel icon',async({page,request})=>{
  await page.goto('./');await expect(page.locator('link[rel=manifest]')).toHaveAttribute('href','./manifest.webmanifest');
  const response=await request.get('manifest.webmanifest');expect(response.headers()['content-type']).toContain('application/manifest+json');const manifest=await response.json(),url=new URL('http://127.0.0.1:18427/hub/manifest.webmanifest');
  for(const path of [manifest.id,manifest.scope,manifest.start_url])expect(new URL(path,url).pathname).toBe('/hub/');expect(manifest.display).toBe('standalone');
  const icon=await(await request.get(new URL(manifest.icons[0].src,url).href)).body();expect(icon.readUInt32BE(16)).toBe(512);expect(icon.readUInt32BE(20)).toBe(512);
});
for(const fault of ['quota','orphan','undefined'])test(`shell component ${fault} preserves budget data and unrelated storage`,async({page,request})=>{
  await page.goto('./');const build=await(await request.get('build-manifest.json')).json(),manifest={schemaVersion:1,build:build.sourceCommit,basePath:build.basePath,files:build.files.filter(f=>!f.path.startsWith('games/')&&f.path!=='sw.js')};
  const result=await page.evaluate(async({fault,manifest})=>{
    const {openShellDatabase}=await import('./cache/shell-database.mjs'),{shellCachePrefix}=await import('./cache/shell-ledger.mjs'),{createShellCache}=await import('./cache/shell-cache.mjs');
    if(fault==='undefined')await new Promise((resolve,reject)=>{const open=indexedDB.open('game-hub-web.shell./hub/',1);open.onupgradeneeded=()=>open.result.createObjectStore('state');open.onsuccess=()=>{const db=open.result,tx=db.transaction('state','readwrite');tx.objectStore('state').put(undefined,'current');tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};});
    localStorage.setItem('foreign-app-shell-sentinel','keep');const foreign=await caches.open('foreign-shell-test');await foreign.put(location.origin+'/hub/foreign.txt',new Response('keep'));
    if(fault==='orphan'){const cache=await caches.open(shellCachePrefix('/hub/')+'999');await cache.put(location.origin+'/hub/keep.txt',new Response('orphan-keep'));}
    const store=await openShellDatabase({indexedDB,basePath:'/hub/'}),manager=createShellCache({store,caches,fetch:globalThis.fetch,origin:location.origin,manifest}),put=Cache.prototype.put;
    if(fault==='quota')Cache.prototype.put=async()=>{throw new DOMException('injected shell Cache quota','QuotaExceededError');};
    let rejected=false;try{await manager.install();}catch{rejected=true;}finally{Cache.prototype.put=put;}
    let state,readRejected=false;try{state=await store.read();}catch{readRejected=true;}store.close();
    return {rejected,readRejected,count:state?.records.length??null,phase:state?.records[0]?.phase??null,charged:(state?.records[0]?.bytes??0)>0,foreign:localStorage.getItem('foreign-app-shell-sentinel')==='keep'&&(await(await foreign.match(location.origin+'/hub/foreign.txt')).text())==='keep'};
  },{fault,manifest});
  expect(result).toEqual({rejected:true,readRejected:fault==='undefined',count:fault==='undefined'?null:fault==='quota'?1:0,phase:fault==='quota'?'failed':null,charged:fault==='quota',foreign:true});
});
