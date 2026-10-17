import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GAME_CSP} from '../../web/src/core/contracts.mjs';
import {sha256Hex,fileTreeDigest} from '../../web/src/core/digests.mjs';
import {resourceURL,canonicalResponse,verifyResponse,completionMarker,verifyCache} from '../../web/src/cache/resource-files.mjs';
const origin='https://games.example.invalid',basePath='/hub/',data=new TextEncoder().encode('<p>hello</p>');
const file={path:'index.html',bytes:data.length,sha256:sha256Hex(data),mime:'text/html'};
const game={id:'sample',contentCode:1,digest:fileTreeDigest([file]),entryPage:'index.html',files:[file],csp:GAME_CSP};
const record={id:game.id,contentCode:1,digest:game.digest,fence:1,proofHash:'a'.repeat(64)};
const url=resourceURL(origin,basePath,game,file.path);
function network(bytes=data,headers={}){const response=new Response(bytes,{headers:{'content-type':'text/html','content-length':String(bytes.length),...headers}});Object.defineProperties(response,{type:{value:'basic',configurable:true},url:{value:url,configurable:true}});return response;}

test('download verification binds exact decoded bytes while allowing encoded transport lengths',async()=>{
  assert.deepEqual(await verifyResponse(network(),file,{url,network:true}),data);
  assert.deepEqual(await verifyResponse(network(data,{'content-encoding':'gzip','content-length':'2'}),file,{url,network:true}),data);
  const empty={path:'empty.txt',mime:'text/plain',bytes:0,sha256:sha256Hex(new Uint8Array())};const response=network(new Uint8Array(),{'content-type':'text/plain'});await verifyResponse(response,empty,{url,network:true});
});
test('wrong status, URL, response type, MIME, size, digest and noncanonical declarations fail',async()=>{
  const cases=[()=>new Response(data),()=>{const r=network();Object.defineProperty(r,'url',{value:origin+'/other'});return r;},()=>network(data,{'content-type':'application/javascript'}),()=>network(data,{'content-length':'1.0'}),()=>network(data,{'content-length':'1'}),()=>network(new Uint8Array([1])),()=>network(new Uint8Array(data.length+1)),()=>network(new Uint8Array(data.length+1),{'content-length':String(file.bytes)}),()=>network(new Uint8Array(1),{'content-length':String(file.bytes)}),()=>network(new Uint8Array(data.length).fill(1)),()=>new Response(null,{status:204})];
  for(const make of cases)await assert.rejects(()=>verifyResponse(make(),file,{url,network:true}));
  const aborted=new AbortController();aborted.abort();await assert.rejects(()=>verifyResponse(network(),file,{url,network:true,signal:aborted.signal}));
});
test('canonical stored response fixes security headers and rejects weak or corrupt replacements',async()=>{
  const response=canonicalResponse(data,file,GAME_CSP);assert.equal(response.headers.get('content-security-policy'),GAME_CSP);assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(await verifyResponse(response,file),data);
  const weak=canonicalResponse(data,file,GAME_CSP);weak.headers.set('content-security-policy','default-src *');await assert.rejects(()=>verifyResponse(weak,file));assert.throws(()=>canonicalResponse(data,file,'default-src *'));
});
test('cache completeness requires exact URLs, strict marker identity and all original bytes',async()=>{
  const marker=completionMarker(record,origin,basePath);assert.ok(marker.bytes.length<=1024);
  const markerFile={path:'marker.json',bytes:marker.bytes.length,sha256:sha256Hex(marker.bytes),mime:'application/json'};
  const entries=new Map([[url,canonicalResponse(data,file,GAME_CSP)],[marker.url,canonicalResponse(marker.bytes,markerFile,GAME_CSP)]]);
  const cache={keys:async()=>[...entries.keys()].map(u=>new Request(u)),match:async key=>entries.get(key)?.clone()};
  assert.deepEqual(await verifyCache(cache,{record,game,origin,basePath}),{files:1,bytes:data.length});
  entries.set(origin+'/hub/extra.txt',new Response('extra'));await assert.rejects(()=>verifyCache(cache,{record,game,origin,basePath}));entries.delete(origin+'/hub/extra.txt');
  entries.set(url,canonicalResponse(new Uint8Array(data.length).fill(1),{...file,sha256:sha256Hex(new Uint8Array(data.length).fill(1))},GAME_CSP));await assert.rejects(()=>verifyCache(cache,{record,game,origin,basePath}));entries.set(url,canonicalResponse(data,file,GAME_CSP));
  const wrong=completionMarker({...record,fence:2},origin,basePath);entries.set(marker.url,canonicalResponse(wrong.bytes,{...markerFile,bytes:wrong.bytes.length,sha256:sha256Hex(wrong.bytes)},GAME_CSP));await assert.rejects(()=>verifyCache(cache,{record,game,origin,basePath}));
});

test('completion marker requires canonical raw bytes and fixed security headers',async()=>{
  const marker=completionMarker(record,origin,basePath);
  for(const kind of ['whitespace','weak-header']){
    let response;
    if(kind==='whitespace'){
      const bytes=new TextEncoder().encode(JSON.stringify(JSON.parse(new TextDecoder().decode(marker.bytes)),null,2)+'\n');
      response=canonicalResponse(bytes,{path:'marker.json',bytes:bytes.length,sha256:sha256Hex(bytes),mime:'application/json'},GAME_CSP);
    }else{response=new Response(marker.bytes,{headers:{'content-type':'application/json','content-security-policy':'default-src *'}});}
    const entries=new Map([[url,canonicalResponse(data,file,GAME_CSP)],[marker.url,response]]),cache={keys:async()=>[...entries.keys()].map(u=>new Request(u)),match:async key=>entries.get(key)?.clone()};
    await assert.rejects(()=>verifyCache(cache,{record,game,origin,basePath}),kind);
  }
});
