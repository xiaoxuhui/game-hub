import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {request} from 'node:http';
import {createWebServer} from '../../scripts/web/serve.mjs';

async function fixture(action){
  const build=resolve(fileURLToPath(new URL('../../',import.meta.url)),'.build');mkdirSync(build,{recursive:true});
  const root=mkdtempSync(join(build,'web-server-test-'));
  try{
    mkdirSync(join(root,'games/demo/1/hash'),{recursive:true});
    const entries=[['index.html','<h1>大厅</h1>'],['app.mjs','export const version=1;'],['sw.js','self.addEventListener("fetch",()=>{});'],['games/demo/1/hash/app.js','console.log("game")'],['private.txt','must not be served']];
    for(const [path,data] of entries)writeFileSync(join(root,path),data);
    writeFileSync(join(root,'build-manifest.json'),JSON.stringify({basePath:'/hub/',files:entries.filter(([p])=>p!=='private.txt').map(([path])=>({path})),games:[]}));
    const server=createWebServer({root,base:'/hub/'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    try{await action(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
  }finally{if(!root.startsWith(build+sep))throw Error('Test cleanup escaped');rmSync(root,{recursive:true,force:true});}
}
test('real server serves canonical subdirectory modules with MIME and scope headers',()=>fixture(async origin=>{
  const response=await fetch(origin+'/hub/app.mjs');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/javascript/);
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.match(response.headers.get('content-security-policy'),/object-src 'none'/);
  const head=await fetch(origin+'/hub/app.mjs',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await fetch(origin+'/')).status,404);
}));
test('only the hall SW can register while normal game Worker script requests remain usable',()=>fixture(async origin=>{
  assert.equal((await fetch(origin+'/hub/sw.js',{headers:{'Service-Worker':'script'}})).status,200);
  assert.equal((await fetch(origin+'/hub/games/demo/1/hash/app.js',{headers:{'Service-Worker':'script'}})).status,403);
  assert.equal((await fetch(origin+'/hub/games/demo/1/hash/app.js')).status,200);
}));
test('private/unregistered files, encoded traversal and write methods are refused',()=>fixture(async origin=>{
  assert.equal((await fetch(origin+'/hub/private.txt')).status,404);
  assert.equal((await fetch(origin+'/hub/app.mjs',{method:'POST',body:'x'})).status,405);
  const url=new URL(origin);
  const status=await new Promise((resolve,reject)=>{const r=request({hostname:url.hostname,port:url.port,path:'/hub/%252e%252e/private.txt'},response=>{response.resume();resolve(response.statusCode);});r.on('error',reject);r.end();});
  assert.equal(status,400);
}));
