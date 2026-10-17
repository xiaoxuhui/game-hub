import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyShellLedger,applyShell,validateShellLedger,SHELL_TOTAL,SHELL_GENERATION} from '../../web/src/cache/shell-ledger.mjs';
import {validateShellManifest,shellMarker,shellResponse,verifyShellCache} from '../../web/src/cache/shell-files.mjs';
import {sha256Hex} from '../../web/src/core/digests.mjs';
const basePath='/hub/',build='a'.repeat(40),manifestHash='b'.repeat(64);
const begin=(bytes=1024)=>({type:'begin',build,manifestHash,bytes});
test('all shell attempts including failed and same build generations retain independent charged fences',()=>{
  let {state,result}=applyShell(emptyShellLedger(),begin(SHELL_GENERATION),{basePath});const first=result;
  state=applyShell(state,{type:'failed',fence:first.fence},{basePath}).state;
  ({state,result}=applyShell(state,begin(SHELL_GENERATION),{basePath}));assert.notEqual(first.cacheName,result.cacheName);assert.equal(result.fence,2);assert.equal(state.records.reduce((n,r)=>n+r.bytes,0),SHELL_TOTAL);
  assert.throws(()=>applyShell(state,begin(),{basePath}),/budget/);assert.throws(()=>applyShell(emptyShellLedger(),begin(SHELL_GENERATION+1),{basePath}));
});
test('shell completion and failure cannot move another fence or accept a different manifest',()=>{
  let {state,result}=applyShell(emptyShellLedger(),begin(),{basePath});const fence=result.fence;
  assert.throws(()=>applyShell(state,{type:'ready',fence,manifestHash:'c'.repeat(64),complete:true},{basePath}));assert.throws(()=>applyShell(state,{type:'ready',fence,manifestHash,complete:false},{basePath}));
  state=applyShell(state,{type:'ready',fence,manifestHash,complete:true},{basePath}).state;assert.equal(state.records[0].phase,'ready');
  state=applyShell(state,{type:'failed',fence},{basePath}).state;assert.equal(state.records[0].phase,'failed');assert.equal(state.records[0].bytes,1024);assert.throws(()=>applyShell(state,{type:'ready',fence,manifestHash,complete:true},{basePath}));
});
test('unknown shell roots records counter wrap and cache identities refuse without mutation',()=>{
  const {state}=applyShell(emptyShellLedger(),begin(),{basePath}),original=structuredClone(state);
  for(const modify of [s=>{s.schemaVersion=2;},s=>{s.records[0].extra=true;},s=>{s.records[0].cacheName='foreign';},s=>{s.records.push(s.records[0]);},s=>{s.nextFence=-0;},s=>{s.records[0].bytes=0;}]){const copy=structuredClone(state);modify(copy);assert.throws(()=>validateShellLedger(copy,basePath));}
  assert.throws(()=>applyShell({...emptyShellLedger(),revision:Number.MAX_SAFE_INTEGER,nextFence:Number.MAX_SAFE_INTEGER},begin(),{basePath}));assert.deepEqual(state,original);
});

test('shell closure requires complete root files canonical marker headers and byte identity',async()=>{
  const origin='https://games.example.invalid',data=new TextEncoder().encode('<h1>hub</h1>'),file={path:'index.html',bytes:data.length,sha256:sha256Hex(data),mime:'text/html'},manifest={schemaVersion:1,build,basePath,files:[file]},identity=validateShellManifest(manifest),record=applyShell(emptyShellLedger(),{type:'begin',build,manifestHash:identity.hash,bytes:identity.bytes},{basePath}).result,marker=shellMarker(record,manifest,origin);
  const entries=new Map([[origin+basePath+file.path,shellResponse(data,file)],[marker.url,shellResponse(marker.bytes,marker.file)]]),cache={keys:async()=>[...entries.keys()].map(u=>new Request(u)),match:async url=>entries.get(url)?.clone()};
  await verifyShellCache(cache,{record,manifest,origin});
  entries.set(origin+basePath+'extra.txt',new Response('extra'));await assert.rejects(()=>verifyShellCache(cache,{record,manifest,origin}));entries.delete(origin+basePath+'extra.txt');
  const clean=entries.get(marker.url);const weak=clean.clone();weak.headers.delete('x-content-type-options');entries.set(marker.url,weak);await assert.rejects(()=>verifyShellCache(cache,{record,manifest,origin}));entries.set(marker.url,clean);
  entries.set(origin+basePath+file.path,new Response('evil',{headers:entries.get(origin+basePath+file.path).headers}));await assert.rejects(()=>verifyShellCache(cache,{record,manifest,origin}));
  for(const path of ['sw.js','build-manifest.json','catalog.json','__hub/current.json','games/example/index.html','../escape.html'])assert.throws(()=>validateShellManifest({...manifest,files:[{...file,path,mime:path.endsWith('.json')?'application/json':path.endsWith('.js')?'application/javascript':file.mime}]}),path);
});
