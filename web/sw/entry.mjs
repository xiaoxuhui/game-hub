import {enableShell} from './shell.mjs';
const build=__HUB_BUILD__,basePath=__HUB_BASE__,protocol=1,scope=self.location.origin+basePath,scriptURL=scope+'sw.js';
enableShell();
// Never claim existing online games or skip an old active SW automatically.
self.addEventListener('message',event=>{
  const data=event.data,port=event.ports?.[0];if(!port||data?.type!=='hub-control')return;
  event.waitUntil((async()=>{
    let controlled=false;
    try{
      const fields=['type','protocol','build','basePath','nonce'];
      if(Object.keys(data).length===fields.length&&fields.every(k=>Object.hasOwn(data,k))&&data.protocol===protocol&&data.build===build&&data.basePath===basePath&&typeof data.nonce==='string'&&/^[a-f0-9-]{16,128}$/.test(data.nonce)&&self.registration.scope===scope&&self.location.href===scriptURL){
        const clients=await self.clients.matchAll({type:'window',includeUncontrolled:false}),client=clients.find(c=>c.id===event.source?.id&&c.url===event.source?.url),url=client&&new URL(client.url);
        controlled=Boolean(url&&url.origin===self.location.origin&&[basePath,basePath+'index.html'].includes(url.pathname));
      }
    }catch{/* Unknown source or client enumeration never grants a token. */}
    port.postMessage({type:'hub-control-result',protocol,build,basePath,scope,scriptURL,nonce:data.nonce,controlled});port.close();
  })());
});
