import http from 'node:http';
import {readFile,readFileSync,statSync} from 'node:fs';
import {dirname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url)), manifest=JSON.parse(readFileSync(join(root,'games.json'),'utf8'));
const mainPort=18427,host='127.0.0.1',servers=[];
if(!Array.isArray(manifest.games)||!manifest.games.length||new Set(manifest.games.map(g=>g.port)).size!==manifest.games.length)throw Error('游戏目录无效');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.txt':'text/plain; charset=utf-8','.wasm':'application/wasm'};
const ext=p=>p.includes('.')?p.slice(p.lastIndexOf('.')).toLowerCase():'';
function serverFor(dir,allowed,port){return http.createServer((req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
  if(req.headers.host!==`${host}:${port}`){res.writeHead(403).end();return;}
  let name;try{name=decodeURIComponent(new URL(req.url,`http://${host}:${port}`).pathname).replace(/^\/+/, '')||'index.html';}catch{res.writeHead(400).end();return;}
  if(!allowed.has(name)||name.includes('\\')||name.split('/').some(x=>x==='.'||x==='..')){res.writeHead(404).end();return;}
  const file=resolve(dir,...name.split('/'));if(!file.startsWith(resolve(dir)+sep)){res.writeHead(403).end();return;}
  readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[ext(name)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);});
});}
function listen(server,port){return new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,host,()=>{server.removeListener('error',fail);servers.push(server);ok();});});}
try{
  for(const game of manifest.games){if(!/^[a-z][a-z0-9-]{0,31}$/.test(game.id)||!Number.isInteger(game.port)||game.port<18500||game.port>19499||!Array.isArray(game.files))throw Error('游戏地址无效');const dir=join(root,'games',game.id);if(!statSync(dir).isDirectory())throw Error('游戏目录缺失: '+game.id);await listen(serverFor(dir,new Set(game.files),game.port),game.port);}
  const shell=new Set(['index.html','client.js','style.css','games.json',...manifest.games.map(g=>'icons/'+g.id+'.png')]);await listen(serverFor(root,shell,mainPort),mainPort);
  console.log(`游戏大厅 http://${host}:${mainPort}/ · ${manifest.games.length} 款游戏`);
}catch(error){for(const server of servers)server.close();console.error('游戏大厅启动失败：'+error.message);process.exitCode=1;}
