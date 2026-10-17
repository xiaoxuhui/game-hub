import {normalizeBase} from '../core/contracts.mjs';
import {emptyLedger,validateLedger,applyLedger} from './ledger.mjs';
import {sha256Hex} from '../core/digests.mjs';

function receiptToken(value,present){
  if(!present)return 'absent';
  const fields=['schemaVersion','envelope','verifiedAt','history','receiptSha256'];
  if(!value||typeof value!=='object'||Object.keys(value).length!==fields.length||!fields.every(k=>Object.hasOwn(value,k))||!(value.envelope instanceof Uint8Array)||value.envelope.length===0||value.envelope.length>8*1024*1024)throw Error('Unknown resource receipt; preserved');
  // Include actual original bytes and metadata, not merely its claimed checksum.
  return sha256Hex(JSON.stringify({...value,envelope:sha256Hex(value.envelope),fields:Object.keys(value)}));
}

// The resource database never opens or modifies the independent saves database.
export function openResourceDatabase({indexedDB,basePath,timeout=4000,now=()=>Date.now()}){
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
        const store=tx.objectStore('state'),read=store.get('current'),key=store.getKey('current');
        // Requests run in issue order in this same transaction. Presence must
        // use getKey: an existing undefined value is corrupt, not first visit.
        key.onsuccess=()=>{try{
          // Only a genuinely absent key is a first visit. Null/future data fails.
          const current=key.result===undefined?emptyLedger():read.result;validateLedger(current,basePath);
          if(event){const outcome=applyLedger(current,event,{basePath});store.put(outcome.state,'current');result=outcome;}
          else result=current;
        }catch(error){cause=error;tx.abort();}};
      });
      const signedTransaction=(command=null)=>new Promise((done,fail)=>{
        let tx,result,cause;try{tx=db.transaction('state',command?'readwrite':'readonly');}catch(error){fail(error);return;}
        tx.oncomplete=()=>done(result);tx.onabort=()=>fail(cause??tx.error??Error('Signed resource transaction aborted'));
        const store=tx.objectStore('state'),stateRead=store.get('current'),stateKey=store.getKey('current'),authRead=store.get('authority'),authKey=store.getKey('authority');
        const abort=error=>{cause=error;tx.abort();};
        const checkAuthorization=()=>{
          if(!command?.receipt)return;
          const a=command.authorization,time=now();
          if(!a||Object.keys(a).length!==2||!['notBefore','expiresAt'].every(k=>Object.hasOwn(a,k)&&Number.isSafeInteger(a[k]))||!Number.isSafeInteger(time)||time<0||Object.is(time,-0)||!Number.isFinite(new Date(time).getTime())||time<a.notBefore||time>=a.expiresAt)throw Error('Authorization expired or clock changed before commit');
        };
        authKey.onsuccess=()=>{try{
          const state=stateKey.result===undefined?emptyLedger():stateRead.result;validateLedger(state,basePath);
          const present=authKey.result!==undefined,authority=authRead.result;
          const token={ledger:sha256Hex(JSON.stringify({present:stateKey.result!==undefined,state})),authority:receiptToken(authority,present)};
          const referenced=[...new Set(state.installations.map(r=>r.proofHash))];
          const hashes=[...new Set([...referenced,...(command?.proof?[command.proof.history.payloadSha256]:[])])];
          if(hashes.some(h=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h)))throw Error('Invalid proof key');
          const proofs=Object.create(null),proofTokens=Object.create(null);let remaining=hashes.length,total=0;
          const finish=()=>{try{
            if(!command){result={state,authority:{present,record:authority},proofs,proofTokens,token};return;}
            if(command.expected?.ledger!==token.ledger||command.expected?.authority!==token.authority)throw Error('Resource snapshot changed; retry');
            if(referenced.some(hash=>command.expectedProofTokens?.[hash]!==proofTokens[hash]))throw Error('Referenced proof changed; retry');
            let next,outcome;
            if(command.event){outcome=applyLedger(state,command.event,{basePath});next=outcome.state;}
            else{if(state.revision===Number.MAX_SAFE_INTEGER)throw Error('Ledger counter exhausted');next={...state,revision:state.revision+1};validateLedger(next,basePath);}
            if(command.receipt){receiptToken(command.receipt,true);if(command.receipt.schemaVersion!==1)throw Error('Unknown receipt');}
            checkAuthorization();let lastWrite;
            if(command.proof){
              const hash=command.proof.history.payloadSha256,existing=proofs[hash];
              if(command.event?.type!=='begin'||command.event.proofHash!==hash||command.receipt?.history.payloadSha256!==hash)throw Error('Unbound installation proof');
              if((command.expectedProofToken??'absent')!==proofTokens[hash])throw Error('Installation proof changed or orphaned; preserved');
              receiptToken(command.proof,true);if(!existing.present)lastWrite=store.put(command.proof,'proof:'+hash);
            }
            lastWrite=store.put(next,'current');if(command.receipt)lastWrite=store.put(command.receipt,'authority');
            lastWrite.onsuccess=()=>{try{checkAuthorization();}catch(error){abort(error);}};
            result={state:next,result:outcome?.result??null};
          }catch(error){abort(error);}};
          if(!remaining){finish();return;}
          for(const hash of hashes){const value=store.get('proof:'+hash),key=store.getKey('proof:'+hash);key.onsuccess=()=>{try{
            const exists=key.result!==undefined,record=value.result;proofTokens[hash]=receiptToken(record,exists);proofs[hash]={present:exists,record};
            if(exists){total+=record.envelope.length+new TextEncoder().encode(JSON.stringify({...record,envelope:undefined})).length;if(total>150*1024*1024)throw Error('Stored proofs exceed resource limit');}
            if(--remaining===0)finish();
          }catch(error){abort(error);}};}
        }catch(error){abort(error);}};
      });
      resolve({
        read:()=>transact(null),apply:event=>event&&typeof event==='object'&&!Array.isArray(event)?transact(structuredClone(event)):Promise.reject(Error('Ledger event required')),
        snapshot:()=>signedTransaction(),commit:command=>signedTransaction(structuredClone(command)),close:()=>db.close()
      });
    };
  });
}
