import {normalizeBase} from '../core/contracts.mjs';
import {emptyShellLedger,validateShellLedger,applyShell} from './shell-ledger.mjs';
export function openShellDatabase({indexedDB,basePath,timeout=4000}){
  normalizeBase(basePath);
  return new Promise((resolve,reject)=>{
    let request,expired=false;try{request=indexedDB.open('game-hub-web.shell.'+basePath,1);}catch(error){reject(error);return;}
    const timer=setTimeout(()=>{expired=true;reject(Error('Shell database unavailable'));},timeout);
    request.onupgradeneeded=event=>{if(expired||event.oldVersion!==0){request.transaction.abort();return;}request.result.createObjectStore('state');};
    request.onerror=()=>{clearTimeout(timer);reject(request.error??Error('Shell database unavailable'));};
    request.onsuccess=()=>{
      clearTimeout(timer);const db=request.result;if(expired){db.close();return;}db.onversionchange=()=>db.close();
      function transact(event){return new Promise((done,fail)=>{
        let tx,cause,result;try{tx=db.transaction('state',event?'readwrite':'readonly');}catch(error){fail(error);return;}
        tx.oncomplete=()=>done(result);tx.onabort=()=>fail(cause??tx.error??Error('Shell transaction aborted'));
        const store=tx.objectStore('state'),read=store.get('current'),key=store.getKey('current');
        key.onsuccess=()=>{try{
          const current=key.result===undefined?emptyShellLedger():read.result;validateShellLedger(current,basePath);
          if(event){const next=applyShell(current,event,{basePath});store.put(next.state,'current');result=next.result;}else result=current;
        }catch(error){cause=error;tx.abort();}};
      });}
      resolve(Object.freeze({read:()=>transact(null),apply:event=>event&&typeof event==='object'?transact(structuredClone(event)):Promise.reject(Error('Shell event required')),close:()=>db.close()}));
    };
  });
}
