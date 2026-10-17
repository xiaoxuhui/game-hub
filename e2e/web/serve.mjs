import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {join} from 'node:path';
import {projectRoot} from '../../scripts/web/inputs.mjs';
import {verifyWeb} from '../../scripts/web/build.mjs';
import {createWebServer} from '../../scripts/web/serve.mjs';
const root=join(projectRoot,'.build/web-dist'),manifest=verifyWeb(projectRoot,root),log=join(projectRoot,'.build/web-sw-requests.jsonl');
writeFileSync(log,'');
const server=createWebServer({root,base:manifest.basePath});
// SW script fetches are not consistently exposed as page response events.
// Observe the actual server boundary; this file is private test evidence only.
server.prependListener('request',(request,response)=>{
  if(request.headers['service-worker']||request.url?.includes('route-worker'))response.on('finish',()=>appendFileSync(log,JSON.stringify({url:request.url,serviceWorker:request.headers['service-worker']??null,status:response.statusCode})+'\n'));
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(18427,'127.0.0.1',()=>console.log('Local test: http://127.0.0.1:18427'+manifest.basePath));
for(const event of ['SIGINT','SIGTERM'])process.on(event,()=>server.close(()=>process.exit(0)));
