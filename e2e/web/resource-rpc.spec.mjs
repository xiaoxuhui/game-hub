import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
const faultPath=new URL('../../.build/web-offline-faults.json',import.meta.url);
const info=()=>JSON.parse(readFileSync(new URL('../../.build/web-offline-info.json',import.meta.url),'utf8'));
const fault=value=>writeFileSync(faultPath,JSON.stringify(value));
test.afterEach(()=>rmSync(faultPath,{force:true}));
async function open(page,{controlled=true}={}){
  const context=info();await page.goto(context.origin+context.basePath);
  await page.evaluate(async()=>{const {createControllerGate}=await import('./control/gate.mjs');window.gate=createControllerGate();await gate.register();await navigator.serviceWorker.ready;});
  if(controlled)await page.reload();
  await page.evaluate(()=>{
    window.rpc=async(action,args={},change={},active=false)=>{
      const nonce=crypto.randomUUID();window.lastTaskId=nonce;const {BUILD}=await import('./build-context.mjs'),channel=new MessageChannel();
      return await new Promise(async(resolve,reject)=>{
        const timer=setTimeout(()=>{channel.port1.close();reject(Error('RPC timeout'));},20000);channel.port1.onmessage=event=>{const data=event.data;if(data.progress){window.progress=data.progress;return;}clearTimeout(timer);channel.port1.close();resolve(data);};
        const target=active?(await navigator.serviceWorker.ready).active:navigator.serviceWorker.controller;
        try{target.postMessage({type:'hub-resources',protocol:1,build:BUILD.build,basePath:BUILD.basePath,nonce,action,args,...change},[channel.port2]);}catch(error){clearTimeout(timer);channel.port1.close();reject(error);}
      });
    };
  });return context;
}
test('actual activation persists epoch and rejects uncontrolled protocol build fields and game callers',async({page})=>{
  const context=await open(page,{controlled:false});expect((await page.evaluate(()=>rpc('status',{}, {},true))).ok).toBe(false);await page.reload();await open(page);
  expect((await page.evaluate(()=>rpc('status'))).ok).toBe(true);
  for(const change of [{protocol:2},{build:'b'.repeat(40)},{url:'https://bad.invalid'},{nonce:'bad'}])expect((await page.evaluate(change=>rpc('check',{},change),change)).ok).toBe(false);
  const first=await page.evaluate(async()=>{const {openResourceDatabase}=await import('./cache/database.mjs'),db=await openResourceDatabase({indexedDB,basePath:'/hub/'});try{return(await db.snapshot()).controller.record;}finally{db.close();}});
  expect(first).toMatchObject({schemaVersion:1,protocol:1,build:context.build,generation:1});expect(first.epoch).toMatch(/^[a-f0-9-]{36}$/);
  const game=context.games.find(g=>g.id==='light');await page.goto(context.origin+game.entryUrl);
  expect(await page.evaluate(async build=>{const channel=new MessageChannel();return await new Promise(resolve=>{channel.port1.onmessage=e=>{channel.port1.close();resolve(e.data.ok);};navigator.serviceWorker.controller.postMessage({type:'hub-resources',protocol:1,build,basePath:'/hub/',nonce:crypto.randomUUID(),action:'status',args:{}},[channel.port2]);});},context.build)).toBe(false);
});
test('actual fixed-key SW checks signed catalog installs complete bytes but does not grant game session',async({page})=>{
  const context=await open(page),check=await page.evaluate(()=>rpc('check'));expect(check.ok).toBe(true);expect(check.result.catalog.games).toHaveLength(8);
  const installed=await page.evaluate(()=>rpc('install',{id:'light'}));expect(installed.ok).toBe(true);expect(installed.result.record.phase).toBe('ready');
  const status=await page.evaluate(()=>rpc('status'));expect(status.ok).toBe(true);expect(status.result.state.installations).toHaveLength(1);expect(status.result.state.sessions).toHaveLength(0);
  expect(await page.evaluate(async name=>(await(await caches.open(name)).keys()).length,installed.result.record.cacheName)).toBe(context.games.find(g=>g.id==='light').files+1);
  const original=await page.request.get(context.origin+context.games.find(g=>g.id==='light').entryUrl);expect(original.status()).toBe(200);
  fault({down:true});await expect(page.request.get(context.origin+'/hub/__hub/current.json',{timeout:2000})).rejects.toThrow();
  const failed=await page.evaluate(()=>rpc('check'));expect(failed.ok).toBe(false);const saved=await page.evaluate(()=>rpc('status'));expect(saved.result.state.installations[0].phase).toBe('ready');
});
test('actual SW refuses forged expired and corrupt resources without a ready installation',async({page})=>{
  await open(page);
  for(const catalog of ['tampered','expired']){fault({catalog});const reply=await page.evaluate(()=>rpc('check'));expect(reply.ok).toBe(false);expect((await page.evaluate(()=>rpc('status'))).result.catalog).toBe(null);}
  fault({resource:'corrupt'});const result=await page.evaluate(()=>rpc('install',{id:'light'}));expect(result.ok).toBe(false);
  const status=await page.evaluate(()=>rpc('status'));expect(status.result.state.installations).toHaveLength(1);expect(status.result.state.installations[0].phase).toBe('failed');expect(status.result.state.installations[0].bytes).toBeGreaterThan(0);
});
test('actual SW rejects concurrent work and cancellation settles writes while retaining budget',async({page})=>{
  await open(page);fault({delay:2000});await page.evaluate(()=>{window.installing=rpc('install',{id:'light'});});await expect.poll(()=>page.evaluate(()=>window.progress?.phase)).toBe('downloading');
  const busy=await page.evaluate(()=>rpc('check'));expect(busy.ok).toBe(false);expect(busy.error).toContain('busy');
  const cancelled=await page.evaluate(()=>rpc('cancel',{taskId:window.progress.taskId}));expect(cancelled.ok).toBe(true);expect(cancelled.result.cancelled).toBe(true);expect((await page.evaluate(()=>window.installing)).ok).toBe(false);
  const state=(await page.evaluate(()=>rpc('status'))).result.state;expect(state.installations[0].phase).toBe('failed');expect(state.installations[0].bytes).toBeGreaterThan(0);expect(state.sessions).toHaveLength(0);
});
test('cancellation during real verification reports committed check rather than false cancellation',async({page})=>{
  await open(page);fault({verifyDelay:1500});const audit=new URL('../../.build/web-offline-verified.jsonl',import.meta.url),before=readFileSync(audit,'utf8').split('\n').filter(Boolean).length;
  await page.evaluate(()=>{window.checking=rpc('check');window.checkTaskId=window.lastTaskId;});
  await expect.poll(()=>readFileSync(audit,'utf8').split('\n').filter(Boolean).length).toBeGreaterThan(before);
  const cancelled=await page.evaluate(()=>rpc('cancel',{taskId:window.checkTaskId}));expect(cancelled.ok).toBe(true);expect(cancelled.result).toEqual({cancelled:false,phase:'checked'});
  expect((await page.evaluate(()=>window.checking)).ok).toBe(true);fault({});expect((await page.evaluate(()=>rpc('status'))).result.catalog.catalogSequence).toBe('1');
});
