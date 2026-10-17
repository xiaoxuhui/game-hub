import {createServer} from 'node:http';
import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeBase,safePath,mimeForPath} from '../../web/src/core/contracts.mjs';
import {inside} from './files.mjs';
import {projectRoot} from './inputs.mjs';
import {verifyWeb} from './build.mjs';

const shellCsp="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
export function createWebServer({root,base='/'}){
  root=resolve(root);normalizeBase(base);
  const manifest=JSON.parse(readFileSync(join(root,'build-manifest.json'),'utf8'));
  if(manifest.basePath!==base)throw Error('Build/server base path mismatch');
  const allowed=new Set([...manifest.files.map(f=>f.path),'build-manifest.json']);
  return createServer((request,response)=>{
    response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');
    response.setHeader('Cross-Origin-Resource-Policy','same-origin');response.setHeader('Permissions-Policy','camera=(), geolocation=(), microphone=(self)');
    const error=(status,message)=>{response.statusCode=status;response.setHeader('Content-Type','text/plain; charset=utf-8');response.end(request.method==='HEAD'?'':message);};
    if(!['GET','HEAD'].includes(request.method)){response.setHeader('Allow','GET, HEAD');return error(405,'只支持读取');}
    try{
      const raw=(request.url||'').split('?')[0];
      if(!raw.startsWith('/')||/[\\%\x00-\x20]/.test(raw)||raw.includes('//'))return error(400,'无效路径');
      if(!raw.startsWith(base))return error(404,'没有此页面');
      let path=raw.slice(base.length)||'index.html';if(path.endsWith('/'))path+='index.html';safePath(path);
      if(request.headers['service-worker']&&path!=='sw.js')return error(403,'游戏不能注册 Service Worker');
      if(!allowed.has(path))return error(404,'没有此文件');
      const target=inside(root,join(root,path));
      if(lstatSync(target).isSymbolicLink()||realpathSync(target)!==target)return error(403,'拒绝链接文件');
      const data=readFileSync(target),game=manifest.games.find(g=>path.startsWith(`games/${g.id}/${g.contentCode}/${g.digest}/`));
      const type=mimeForPath(path);response.setHeader('Content-Type',type+(/^(?:text\/|application\/(?:javascript|json))/.test(type)?'; charset=utf-8':''));
      response.setHeader('Content-Security-Policy',game?.csp||shellCsp);
      response.setHeader('Cache-Control',path.startsWith('games/')?'public, max-age=31536000, immutable':'no-cache, must-revalidate');
      if(path==='sw.js')response.setHeader('Service-Worker-Allowed',base);
      response.setHeader('Content-Length',data.length);response.statusCode=200;response.end(request.method==='HEAD'?undefined:data);
    }catch(errorValue){return error(errorValue.message.includes('Unsafe')?400:404,'无法读取此资源');}
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=process.argv.slice(2).filter(v=>v!=='--');let root=join(projectRoot,'.build/web-dist'),port=18427;
    for(let i=0;i<args.length;i++){if(args[i]==='--root')root=resolve(args[++i]);else if(args[i]==='--port')port=Number(args[++i]);else throw Error('Unknown server argument');}
    if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('Invalid reserved port');
    const manifest=verifyWeb(projectRoot,root),server=createWebServer({root,base:manifest.basePath});
    server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'端口已占用，拒绝复用其它服务':e.message);process.exitCode=1;});
    server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}${manifest.basePath}`));
    for(const event of ['SIGINT','SIGTERM'])process.on(event,()=>server.close(()=>process.exit(0)));
  }catch(e){console.error(e.message);process.exitCode=1;}
}
