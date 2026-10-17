import {writeFileSync,appendFileSync,existsSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {projectRoot} from '../../scripts/web/inputs.mjs';
import {verifyWeb} from '../../scripts/web/build.mjs';
import {createWebServer} from '../../scripts/web/serve.mjs';
import {prepareOfflineFixture} from './offline-fixture.mjs';
const root=join(projectRoot,'.build/web-dist'),manifest=verifyWeb(projectRoot,root),log=join(projectRoot,'.build/web-sw-requests.jsonl');
writeFileSync(log,'');
const server=createWebServer({root,base:manifest.basePath});
const offline=join(projectRoot,'.build/web-network-down'),serve=server.listeners('request')[0];rmSync(offline,{force:true});
server.removeListener('request',serve);
server.on('request',(request,response)=>{if(existsSync(offline)){request.socket.destroy();return;}serve(request,response);});
// SW script fetches are not consistently exposed as page response events.
// Observe the actual server boundary; this file is private test evidence only.
server.prependListener('request',(request,response)=>{
  if(request.headers['service-worker']||request.url?.includes('route-worker'))response.on('finish',()=>appendFileSync(log,JSON.stringify({url:request.url,serviceWorker:request.headers['service-worker']??null,status:response.statusCode})+'\n'));
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(18427,'127.0.0.1',()=>console.log('Local test: http://127.0.0.1:18427'+manifest.basePath));
const fixture=await prepareOfflineFixture(projectRoot,manifest),resourceServer=createWebServer({root:fixture.root,base:manifest.basePath});
const faults=join(projectRoot,'.build/web-offline-faults.json'),resourceServe=resourceServer.listeners('request')[0];rmSync(faults,{force:true});resourceServer.removeListener('request',resourceServe);
const verifiedLog=join(projectRoot,'.build/web-offline-verified.jsonl');writeFileSync(verifiedLog,'');
resourceServer.on('request',(request,response)=>{
  let fault={};if(existsSync(faults))try{fault=JSON.parse(readFileSync(faults,'utf8'));}catch{/* A partial private test-control write grants no fault. */}
  const path=(request.url??'').split('?')[0];
  if(fault.down){request.socket.destroy();return;}
  if(path===manifest.basePath+'__fixture/verified.json'){appendFileSync(verifiedLog,JSON.stringify({time:Date.now(),delayed:Boolean(fault.verifyDelay)})+'\n');const finish=()=>{response.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end('{}');};if(fault.verifyDelay)setTimeout(finish,Math.min(Number(fault.verifyDelay),5000));else finish();return;}
  if(path===manifest.basePath+'__hub/current.json'&&fault.catalog&&fixture.variants[fault.catalog]){const body=fixture.variants[fault.catalog];response.writeHead(200,{'Content-Type':'application/json','Content-Length':body.length});response.end(body);return;}
  if(path.startsWith(manifest.basePath+'games/')&&fault.resource==='corrupt'){response.writeHead(200,{'Content-Type':'text/html','Content-Length':1});response.end('x');return;}
  if(path.startsWith(manifest.basePath+'games/')&&fault.delay){setTimeout(()=>{if(!response.destroyed)resourceServe(request,response);},Math.min(Number(fault.delay),5000));return;}
  resourceServe(request,response);
});
resourceServer.on('error',error=>{console.error(error.message);process.exitCode=1;});resourceServer.listen(18428,'127.0.0.1',()=>console.log('Private signed SW test: http://127.0.0.1:18428'+manifest.basePath));
for(const event of ['SIGINT','SIGTERM'])process.on(event,()=>{server.close();resourceServer.close(()=>process.exit(0));});
