import {openResourceDatabase} from '../src/cache/database.mjs';
import {controllerToken} from '../src/core/controller.mjs';
export function createWorkerController(){
  const origin=self.location.origin,basePath=__HUB_BASE__,build=__HUB_BUILD__;
  const eligible=self.registration.scope===origin+basePath&&self.location.href===origin+basePath+'sw.js';
  let database,captured;
  const db=()=>database??=openResourceDatabase({indexedDB:self.indexedDB,basePath});
  async function get(){
    if(!eligible)throw Error('Unexpected SW scope');
    captured??=(async()=>{const snapshot=await(await db()).snapshot(),record=snapshot.controller.record;if(!snapshot.controller.present||record.build!==build||record.protocol!==1)throw Error('Controller activation record unavailable');controllerToken(record,true);return structuredClone(record);})();
    return await captured;
  }
  async function assertCurrent(){const record=await get(),snapshot=await(await db()).snapshot();if(snapshot.token.controller!==controllerToken(record,true))throw Error('SW controller generation changed');return controllerToken(record,true);}
  async function hall(source){
    if(!eligible||typeof source?.id!=='string'||typeof source?.url!=='string')throw Error('Controlled hall source required');
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:false});
    const client=clients.find(c=>c.id===source.id&&c.url===source.url),url=client&&new URL(client.url);
    if(!url||url.origin!==origin||![basePath,basePath+'index.html'].includes(url.pathname))throw Error('Controlled hall source required');
    return await assertCurrent();
  }
  if(eligible)self.addEventListener('activate',event=>{
    // Capture once before the first asynchronous boundary. A restarted instance
    // restores this same persistent epoch rather than activating a new one.
    captured=(async()=>await(await db()).activateController({build,epoch:crypto.randomUUID(),protocol:1}))();event.waitUntil(captured);
  });
  return Object.freeze({eligible,db,get,assertCurrent,hall});
}
