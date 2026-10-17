function insist(value,message){if(!value)throw Error(message);}
export function assertRegistrations(registrations,{origin,basePath}){
  const scope=origin+basePath,scriptURL=scope+'sw.js';let exact;
  for(const registration of registrations){
    const url=new URL(registration.scope);
    if(url.origin!==origin)continue;
    if(!url.pathname.startsWith(basePath)&&!basePath.startsWith(url.pathname))continue;
    insist(registration.scope===scope&&!exact,'Unexpected overlapping service worker scope');exact=registration;
    for(const worker of [registration.active,registration.waiting,registration.installing].filter(Boolean))insist(worker.scriptURL===scriptURL,'Unexpected service worker script');
  }
  insist(exact,'Expected service worker registration missing');return exact;
}
export function validateControlReply(value,{context,origin,nonce}){
  const fields=['type','protocol','build','basePath','scope','scriptURL','nonce','controlled'];
  insist(value&&typeof value==='object'&&Object.keys(value).length===fields.length&&fields.every(k=>Object.hasOwn(value,k)),'Unknown controller reply');
  insist(value.type==='hub-control-result'&&value.protocol===1&&value.protocol===context.protocol&&value.build===context.build&&value.basePath===context.basePath&&value.scope===origin+context.basePath&&value.scriptURL===origin+context.basePath+'sw.js'&&value.nonce===nonce&&value.controlled===true,'Controller handshake mismatch');return true;
}
