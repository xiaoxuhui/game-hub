import test from 'node:test';
import assert from 'node:assert/strict';
import {validateResourceRequest,readCatalogResponse} from '../../web/src/control/resource-rpc.mjs';
const context={build:'a'.repeat(40),basePath:'/hub/'};
const request=(action='check',args={})=>({type:'hub-resources',protocol:1,...context,nonce:'12345678-1234-1234-1234-123456789abc',action,args});
test('resource RPC accepts only exact typed finite commands and never caller trust',()=>{
  for(const [action,args] of [['check',{}],['status',{}],['install',{id:'conway'}],['cancel',{taskId:request().nonce}]])assert.equal(validateResourceRequest(request(action,args),context).action,action);
  for(const change of [{url:'https://bad.invalid'},{protocol:2},{build:'b'.repeat(40)},{basePath:'/'},{nonce:'bad'},{action:'delete'},{args:{keyId:'caller'}},{action:'install',args:{id:'../game'}},{action:'cancel',args:{taskId:1}}])assert.throws(()=>validateResourceRequest({...request(),...change},context));
});
test('catalog network reader bounds actual stream and refuses redirects status MIME or URL',async()=>{
  const url='http://127.0.0.1:18428/hub/__hub/current.json';
  const response=(body,options={})=>{const r=new Response(body,{headers:{'Content-Type':'application/json'},...options});Object.defineProperties(r,{type:{value:'basic'},url:{value:url},redirected:{value:false}});return r;};
  assert.deepEqual(await readCatalogResponse(response('{}'),url),new TextEncoder().encode('{}'));
  for(const r of [response('{}',{status:404}),response('{}',{headers:{'Content-Type':'text/html'}}),response('x'.repeat(8*1024*1024+1)),response('{}',{headers:{'Content-Type':'application/json','Content-Length':'8388609'}})])await assert.rejects(readCatalogResponse(r,url));
  await assert.rejects(readCatalogResponse(response('{}'),url+'?other'));
  const aborted=new AbortController();aborted.abort();await assert.rejects(readCatalogResponse(response('{}'),url,aborted.signal));
});
