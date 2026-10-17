import {normalizeBase} from '../core/contracts.mjs';
import {emptyLedger,validateLedger,applyLedger} from './ledger.mjs';

// The resource database never opens or modifies the independent saves database.
export function openResourceDatabase({indexedDB,basePath,timeout=4000}){
  normalizeBase(basePath);
  return new Promise((resolve,reject)=>{
    let request,expired=false;
    try{request=indexedDB.open('game-hub-web.resources.'+basePath,1);}catch(error){reject(error);return;}
    const timer=setTimeout(()=>{expired=true;reject(Error('Resource database blocked/unavailable'));},timeout);
    request.onupgradeneeded=event=>{if(expired||event.oldVersion!==0){request.transaction.abort();return;}request.result.createObjectStore('state');};
    request.onerror=()=>{clearTimeout(timer);reject(request.error??Error('Resource database unavailable'));};
    request.onsuccess=()=>{
      clearTimeout(timer);const db=request.result;if(expired){db.close();return;}db.onversionchange=()=>db.close();
      const transact=event=>new Promise((done,fail)=>{
        let tx,result,cause;
        try{tx=db.transaction('state',event?'readwrite':'readonly');}catch(error){fail(error);return;}
        tx.oncomplete=()=>done(result);tx.onabort=()=>fail(cause??tx.error??Error('Resource transaction aborted'));
        const store=tx.objectStore('state'),read=store.get('current');
        read.onsuccess=()=>{try{
          // Only a genuinely absent key is a first visit. Null/future data fails.
          const current=read.result===undefined?emptyLedger():read.result;validateLedger(current,basePath);
          if(event){const outcome=applyLedger(current,event,{basePath});store.put(outcome.state,'current');result=outcome;}
          else result=current;
        }catch(error){cause=error;tx.abort();}};
      });
      resolve({read:()=>transact(null),apply:event=>event&&typeof event==='object'&&!Array.isArray(event)?transact(structuredClone(event)):Promise.reject(Error('Ledger event required')),close:()=>db.close()});
    };
  });
}
