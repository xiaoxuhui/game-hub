import {shellCachePrefix} from './shell-ledger.mjs';
import {validateShellManifest,shellMarker,shellResponse,verifyShellCache,verifyShellResponse} from './shell-files.mjs';
import {verifyResponse} from './resource-files.mjs';
import {SHELL_CSP} from '../core/contracts.mjs';
function insist(value,message){if(!value)throw Error(message);}
export function createShellCache({store,caches,fetch,origin,manifest:input}){
  const manifest=structuredClone(input),identity=validateShellManifest(manifest),basePath=manifest.basePath;
  async function fail(record){try{await store.apply({type:'failed',fence:record.fence});}catch{/* Keep unknown state, data and reservation on uncertainty. */}}
  return Object.freeze({
    async install(){
      const state=await store.read(),names=await caches.keys();insist(!names.some(name=>name.startsWith(shellCachePrefix(basePath))&&!state.records.some(r=>r.cacheName===name)),'Unaccounted shell cache; repair required');
      const record=await store.apply({type:'begin',build:manifest.build,manifestHash:identity.hash,bytes:identity.bytes});
      try{
        insist(!await caches.has(record.cacheName),'Shell cache fence already exists');const cache=await caches.open(record.cacheName);insist((await cache.keys()).length===0,'Shell cache is not empty');
        for(const file of manifest.files){
          const url=origin+basePath+file.path,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
          try{const response=await fetch(url,{method:'GET',mode:'same-origin',credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal}),bytes=await verifyResponse(response,file,{url,network:true,signal:controller.signal,csp:SHELL_CSP});await cache.put(url,shellResponse(bytes,file));}finally{clearTimeout(timer);}
        }
        const marker=shellMarker(record,manifest,origin);await cache.put(marker.url,shellResponse(marker.bytes,marker.file));await verifyShellCache(cache,{record,manifest,origin});return await store.apply({type:'ready',fence:record.fence,manifestHash:identity.hash,complete:true});
      }catch(error){await fail(record);throw error;}
    },
    async serve(path,{navigation=false}={}){
      const file=manifest.files.find(f=>f.path===path);insist(file,'Unlisted shell request');
      const state=await store.read(),record=state.records.filter(r=>r.build===manifest.build&&r.manifestHash===identity.hash&&r.phase==='ready').sort((a,b)=>b.fence-a.fence)[0];insist(record,'Complete shell generation unavailable');
      try{
        insist(await caches.has(record.cacheName),'Shell cache evicted');const cache=await caches.open(record.cacheName);
        if(navigation)await verifyShellCache(cache,{record,manifest,origin});
        const response=await cache.match(origin+basePath+file.path);await verifyShellResponse(response?.clone(),file);return response;
      }catch(error){await fail(record);throw error;}
    }
  });
}
