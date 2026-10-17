import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const audit=()=>readFileSync(new URL('../../.build/web-sw-requests.jsonl',import.meta.url),'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line));
async function setup(page){await page.goto('./');await page.evaluate(async()=>{const {createControllerGate}=await import('./control/gate.mjs');window.gate=createControllerGate();});}
async function register(page){await page.evaluate(async()=>{await gate.register();await navigator.serviceWorker.ready;});}
async function reopen(page){await page.reload();await page.evaluate(async()=>{const {createControllerGate}=await import('./control/gate.mjs');window.gate=createControllerGate();});}
test('real SW ready is not controller and controlled reopen uses stable invalidated handshake token',async({page})=>{
  await setup(page);await register(page);
  expect(await page.evaluate(async()=>({controller:navigator.serviceWorker.controller===null,state:(await gate.inspect()).controlled}))).toEqual({controller:true,state:false});
  const untrusted=await page.evaluate(async()=>{
    const {BUILD}=await import('./build-context.mjs'),reg=await navigator.serviceWorker.ready,channel=new MessageChannel();return await new Promise(resolve=>{channel.port1.onmessage=e=>{channel.port1.close();resolve(e.data.controlled);};reg.active.postMessage({type:'hub-control',protocol:1,build:BUILD.build,basePath:BUILD.basePath,nonce:crypto.randomUUID()},[channel.port2]);});
  });expect(untrusted).toBe(false);
  await reopen(page);
  const result=await page.evaluate(async()=>{const a=await gate.token(),b=await gate.token();dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));const c=await gate.token();return {controlled:(await gate.inspect()).controlled,stable:a===b,invalidated:a!==c};});expect(result).toEqual({controlled:true,stable:true,invalidated:true});
});
test('real SW rejects wrong protocol build and invalid nonce from controlled caller',async({page})=>{
  await setup(page);await register(page);await reopen(page);
  const replies=await page.evaluate(async()=>{
    const {BUILD}=await import('./build-context.mjs'),results=[];
    for(const change of [{protocol:2},{build:'b'.repeat(40)},{nonce:'invalid'}]){
      const channel=new MessageChannel(),reply=await new Promise(resolve=>{const timer=setTimeout(()=>{channel.port1.close();resolve(false);},1500);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data.controlled);};navigator.serviceWorker.controller.postMessage({type:'hub-control',protocol:1,build:BUILD.build,basePath:BUILD.basePath,nonce:crypto.randomUUID(),...change},[channel.port2]);});results.push(reply);
    }return results;
  });expect(replies).toEqual([false,false,false]);
});
test('additional narrow registration prevents gate without unregistering it',async({page})=>{
  await setup(page);await register(page);await reopen(page);
  expect(await page.evaluate(async()=>(await gate.inspect()).controlled)).toBe(true);
  const result=await page.evaluate(async()=>{await navigator.serviceWorker.register('/hub/sw.js',{scope:'/hub/games/'});const state=await gate.inspect();return {blocked:!state.controlled,count:(await navigator.serviceWorker.getRegistrations()).length};});expect(result).toEqual({blocked:true,count:2});
});
test('server rejects actual game SW registration but ordinary game Worker executes',async({page,request})=>{
  await setup(page);const catalog=await(await request.get('catalog.json')).json(),game=catalog.games.find(g=>g.id==='turing'),file=game.files.find(f=>/worker.*\.js$/.test(f.path)),url=game.entryUrl.slice(0,-game.entryPage.length)+file.path;
  const probe=url+'?sw-probe='+crypto.randomUUID();
  expect(await page.evaluate(async url=>{try{await navigator.serviceWorker.register(url,{scope:url.slice(0,url.lastIndexOf('/')+1)});return false;}catch{return true;}},probe)).toBe(true);
  await expect.poll(()=>audit().some(row=>row.url===probe&&row.serviceWorker&&row.status===403)).toBe(true);
  const reply=await page.evaluate(async url=>await new Promise((resolve,reject)=>{const worker=new Worker(url),timer=setTimeout(()=>{worker.terminate();reject(Error('Worker timeout'));},5000);worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(Error('Worker error'));};worker.onmessage=e=>{if(['complete','error'].includes(e.data.type)){clearTimeout(timer);worker.terminate();e.data.type==='error'?reject(Error(e.data.message)):resolve(e.data.reason);}};worker.postMessage({definition:{blankSymbol:'_',initialState:'q',acceptStates:[],rejectStates:[],haltStates:['q'],transitions:[]},initialTape:[],maxSteps:1});}),url);expect(reply).toBe('halt');
  expect(audit().some(row=>row.url===url&&!row.serviceWorker&&row.status===200)).toBe(true);
});

test('narrow scope created during pending control verification cannot grant a token',async({page})=>{
  await setup(page);await register(page);await reopen(page);
  const result=await page.evaluate(async()=>{
    const container=navigator.serviceWorker,read=container.getRegistrations.bind(container);
    container.getRegistrations=async()=>{const old=await read();container.getRegistrations=read;await container.register('/hub/sw.js',{scope:'/hub/games/'});return old;};
    const state=await gate.inspect();return {blocked:!state.controlled,registrations:(await read()).length};
  });expect(result).toEqual({blocked:true,registrations:2});
});
