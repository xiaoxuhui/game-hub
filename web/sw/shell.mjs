import {openShellDatabase} from '../src/cache/shell-database.mjs';
import {createShellCache} from '../src/cache/shell-cache.mjs';
import {SHELL_CSP} from '../src/core/contracts.mjs';
const manifest=__HUB_SHELL__;
export function enableShell(){
  const origin=self.location.origin,basePath=manifest.basePath;if(self.registration.scope!==origin+basePath)return;
  let manager;
  const get=()=>manager??=openShellDatabase({indexedDB:self.indexedDB,basePath}).then(store=>createShellCache({store,caches:self.caches,fetch:self.fetch.bind(self),origin,manifest}));
  self.addEventListener('install',event=>event.waitUntil(get().then(cache=>cache.install())));
  self.addEventListener('fetch',event=>{
    const url=new URL(event.request.url);if(url.origin!==origin||!url.pathname.startsWith(basePath)||event.request.headers.has('service-worker'))return;
    const path=url.pathname.slice(basePath.length)||'index.html';
    // Checks always use actual network. A cached catalog is never called fresh.
    // Games retain their explicit online path until verified session admission.
    if(path.startsWith('games/')||['catalog.json','sw.js','build-manifest.json'].includes(path)||path.startsWith('__hub/current'))return;
    event.respondWith((async()=>{
      try{if(event.request.method!=='GET')throw Error('Read only');return await(await get()).serve(path,{navigation:event.request.mode==='navigate'});}
      catch{return new Response('大厅缓存不完整，请联网重新打开大厅。游戏存档不会因此删除。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Content-Security-Policy':SHELL_CSP,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}});}
    })());
  });
}
