import {BUILD} from '../build-context.mjs';
import {assertRegistrations,validateControlReply} from './identity.mjs';
function insist(value,message){if(!value)throw Error(message);}
export function createControllerGate(){
  const container=globalThis.navigator?.serviceWorker,origin=globalThis.location?.origin;
  let generation=0,authorized=null,closed=false;
  const invalidate=()=>{generation++;authorized=null;};
  container?.addEventListener('controllerchange',invalidate);globalThis.addEventListener('pageshow',invalidate);
  function capability(){insist(!closed&&BUILD?.protocol===1&&BUILD.basePath&&/^[a-f0-9]{40}$/.test(BUILD.build),'Controller build unavailable');insist(globalThis.isSecureContext&&container&&globalThis.caches&&globalThis.indexedDB&&globalThis.crypto?.subtle,'Controlled offline capability unavailable');}
  async function inspect(){
    const ticket=generation,controller=container?.controller;
    try{
      capability();insist(controller&&controller.state==='activated'&&controller.scriptURL===origin+BUILD.basePath+'sw.js','Current page is online without expected controller');
      const registration=assertRegistrations(await container.getRegistrations(),{origin,...BUILD});insist(registration.active===controller,'Controller is not the active expected registration');
      const nonce=crypto.randomUUID(),channel=new MessageChannel();
      const value=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{channel.port1.close();reject(Error('Controller handshake timeout'));},2000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};try{controller.postMessage({type:'hub-control',protocol:1,build:BUILD.build,basePath:BUILD.basePath,nonce},[channel.port2]);}catch(error){clearTimeout(timer);channel.port1.close();reject(error);}});
      validateControlReply(value,{context:BUILD,origin,nonce});insist(!closed&&ticket===generation&&container.controller===controller&&controller.state==='activated','Controller changed during handshake');
      authorized??=BUILD.build+':'+crypto.randomUUID();return {controlled:true,token:authorized};
    }catch(error){if(ticket===generation)authorized=null;return {controlled:false,reason:error.message};}
  }
  return Object.freeze({
    inspect,
    async token(){const state=await inspect();insist(state.controlled,state.reason);return state.token;},
    async register(){
      capability();const registrations=await container.getRegistrations();
      if(registrations.some(r=>{const path=new URL(r.scope).pathname;return path.startsWith(BUILD.basePath)||BUILD.basePath.startsWith(path);}))assertRegistrations(registrations,{origin,...BUILD});
      return await container.register(origin+BUILD.basePath+'sw.js',{scope:BUILD.basePath,updateViaCache:'none'});
    },
    invalidate,
    close(){closed=true;invalidate();container?.removeEventListener('controllerchange',invalidate);globalThis.removeEventListener('pageshow',invalidate);}
  });
}
