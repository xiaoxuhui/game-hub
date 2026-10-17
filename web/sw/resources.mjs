import {createPinnedAuthority} from '../src/update/trust.mjs';
import {createResourceRepository} from '../src/update/resource-repository.mjs';
import {createResourceInstaller} from '../src/cache/installer.mjs';
import {validateResourceRequest,readCatalogResponse} from '../src/control/resource-rpc.mjs';
export function enableResources(control){
  if(!control.eligible)return;
  const origin=self.location.origin,basePath=__HUB_BASE__,build=__HUB_BUILD__,url=origin+basePath+'__hub/current.json';
  let repository,busy=null;
  const repo=()=>repository??=(async()=>createResourceRepository({database:await control.db(),authority:createPinnedAuthority({origin,basePath}),now:()=>Date.now(),controller:await control.get()}))();
  async function current(signal){
    const bounded=new AbortController(),cancel=()=>bounded.abort(),timer=setTimeout(cancel,30000);signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
    try{return await readCatalogResponse(await self.fetch(url,{method:'GET',mode:'same-origin',credentials:'omit',cache:'no-store',redirect:'error',signal:bounded.signal}),url,bounded.signal);}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
  }
  self.addEventListener('message',event=>{
    const port=event.ports?.[0],raw=event.data;if(!port||raw?.type!=='hub-resources')return;
    event.waitUntil((async()=>{
      let data,task;
      const send=value=>{try{port.postMessage({type:'hub-resources-result',protocol:1,build,basePath,nonce:raw.nonce,...value});}catch{/* A closed UI cannot undo a storage transaction. */}};
      try{
        data=validateResourceRequest(raw,{build,basePath});await control.hall(event.source);
        if(data.action==='cancel'){
          const active=busy;if(!active||active.taskId!==data.args.taskId||active.sourceId!==event.source.id)throw Error('No matching current download');
          active.abort.abort();await active.finished;await control.hall(event.source);send({ok:true,result:{cancelled:true}});return;
        }
        if(data.action==='status'){const status=await(await repo()).inspect();await control.hall(event.source);send({ok:true,result:{...status,task:busy?{taskId:busy.taskId,action:busy.action}:null}});return;}
        if(busy)throw Error('Resource operation busy');
        let finish;task={taskId:data.nonce,sourceId:event.source.id,action:data.action,abort:new AbortController(),finished:new Promise(resolve=>finish=resolve),finish:()=>finish()};busy=task;
        const repository=await repo(),bytes=await current(task.abort.signal);await control.hall(event.source);
        if(data.action==='check'){
          if(task.abort.signal.aborted)throw Error('Resource request cancelled');const catalog=await repository.check(bytes);await control.hall(event.source);send({ok:true,result:{catalog}});
        }else{
          const installer=createResourceInstaller({repository,caches:self.caches,fetch:self.fetch.bind(self),origin,basePath,control:()=>control.hall(event.source)});
          const result=await installer.install(bytes,data.args.id,{signal:task.abort.signal,onProgress:progress=>send({progress:{...progress,taskId:task.taskId}})});await control.hall(event.source);send({ok:true,result});
        }
      }catch(error){send({ok:false,error:String(error?.message??'Resource operation failed').slice(0,240)});}
      finally{if(task){if(busy===task)busy=null;task.finish();}port.close();}
    })());
  });
}
