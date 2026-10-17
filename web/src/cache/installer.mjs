import {resourceCachePrefix} from './ledger.mjs';
import {resourceURL,canonicalResponse,verifyResponse,completionMarker,markerResponse,verifyCache} from './resource-files.mjs';
function insist(value,message){if(!value)throw Error(message);}
function checkAbort(signal){if(signal.aborted)throw new DOMException('Resource download cancelled','AbortError');}

// Internal component only. Production must supply the actual reviewed SW gate;
// a caller-supplied truthy flag never constitutes platform control by itself.
export function createResourceInstaller({repository,caches,fetch=globalThis.fetch,origin,basePath,control}){
  const jobs=new Map();
  async function markFailed(fence){
    let last;for(let attempt=0;attempt<3;attempt++){
      try{return await repository.cancel(fence);}catch(error){last=error;const current=await repository.task(fence);if(current.phase==='failed')return current;insist(current.phase==='staging','Installation already committed; cannot cancel');}
    }throw last;
  }
  async function verify(fence){
    const {record,game}=await repository.proof(fence);insist(['ready','active','retained'].includes(record.phase),'Installation is not complete');
    try{insist(await caches.has(record.cacheName),'Offline cache missing; repair required');const cache=await caches.open(record.cacheName);await verifyCache(cache,{record,game,origin,basePath});return {record,game};}
    catch(error){await repository.missing(fence).catch(()=>{});throw error;}
  }
  async function install(envelope,id,{signal,onProgress}={}){
    insist(envelope instanceof Uint8Array&&envelope.length>0&&envelope.length<=8*1024*1024,'Invalid installation envelope');const bytes=new Uint8Array(envelope),controller=new AbortController();
    let record,game,cache,token,cancellation=null,finish;
    const finished=new Promise(resolve=>finish=resolve);
    const notify=progress=>{try{const pending=onProgress?.({...progress});if(pending&&typeof pending.catch==='function')pending.catch(()=>{});}catch{/* UI observer errors never change storage policy. */}};
    const startCancellation=()=>{if(record&&!cancellation)cancellation=markFailed(record.fence).catch(()=>{});};
    controller.signal.addEventListener('abort',startCancellation,{once:true});
    const externalAbort=()=>controller.abort();signal?.addEventListener('abort',externalAbort,{once:true});if(signal?.aborted)controller.abort();
    async function guard(){
      checkAbort(controller.signal);const current=await repository.task(record.fence);
      insist(current.phase==='staging'&&['id','contentCode','digest','fence','cacheName','bytes','proofHash'].every(k=>current[k]===record[k]),'Stale or cancelled installation');
      insist(await control()===token,'Controller identity changed during installation');checkAbort(controller.signal);
    }
    try{
      checkAbort(controller.signal);token=await control();insist(typeof token==='string'&&token.length>0&&token.length<=512,'Current page is not controlled');checkAbort(controller.signal);
      const before=await repository.inspect(),known=new Set(before.state.installations.map(r=>r.cacheName)),prefix=resourceCachePrefix(basePath);
      for(const name of await caches.keys())insist(!name.startsWith(prefix)||known.has(name),'Unaccounted resource cache; repair required');
      ({record,game}=await repository.begin(bytes,id));jobs.set(record.fence,{controller,finished});if(controller.signal.aborted)startCancellation();await guard();
      insist(!await caches.has(record.cacheName),'Reserved cache name already exists; preserved');cache=await caches.open(record.cacheName);insist((await cache.keys()).length===0,'Reserved cache is not empty; preserved');
      const total=game.files.reduce((n,f)=>n+f.bytes,0);let downloaded=0,count=0;notify({phase:'downloading',fence:record.fence,id,downloaded,total,files:count});
      for(const file of game.files){
        await guard();const url=resourceURL(origin,basePath,game,file.path),download=new AbortController(),cancel=()=>download.abort();controller.signal.addEventListener('abort',cancel,{once:true});
        const timer=setTimeout(()=>download.abort(),30000);let data;
        try{checkAbort(controller.signal);const response=await fetch(url,{method:'GET',mode:'same-origin',credentials:'omit',cache:'no-store',redirect:'error',signal:download.signal});data=await verifyResponse(response,file,{url,network:true,signal:download.signal});}
        finally{clearTimeout(timer);controller.signal.removeEventListener('abort',cancel);}
        await guard();await cache.put(url,canonicalResponse(data,file,game.csp));await guard();downloaded+=file.bytes;count++;notify({phase:'downloading',fence:record.fence,id,downloaded,total,files:count});
      }
      await guard();const marker=completionMarker(record,origin,basePath);await cache.put(marker.url,markerResponse(marker));await guard();notify({phase:'verifying',fence:record.fence,id,downloaded,total,files:count});
      await verifyCache(cache,{record,game,origin,basePath,signal:controller.signal});await guard();const ready=await repository.complete(record.fence,{manifestDigest:record.digest,complete:true});
      notify({phase:'ready',fence:record.fence,id,downloaded,total,files:count});return {record:ready,game};
    }catch(error){if(record)await markFailed(record.fence).catch(()=>{});notify({phase:'failed',fence:record?.fence??null,id});throw error;}
    finally{signal?.removeEventListener('abort',externalAbort);if(cancellation)await cancellation;controller.signal.removeEventListener('abort',startCancellation);if(record)jobs.delete(record.fence);finish();}
  }
  return Object.freeze({install,verify,async cancel(fence){const job=jobs.get(fence);job?.controller.abort();const result=await markFailed(fence);if(job)await job.finished;return result;}});
}
