// Same-origin trusted-game namespace guard, not a malicious-code sandbox.
export const SAVE_LIMITS=Object.freeze({keys:512,characters:32*1024*1024});
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const next=value=>{if(!integer(value)||value===Number.MAX_SAFE_INTEGER)throw Error('Save counter exhausted');return value+1;};
export const owns=(scope,key)=>typeof key==='string'&&(scope.keys.includes(key)||scope.prefixes.some(prefix=>key.startsWith(prefix)));
export function checkEntries(entries,scope){
  if(!Array.isArray(entries)||entries.length>SAVE_LIMITS.keys)throw Error('Save key limit');
  const seen=new Set();let characters=0;
  return entries.map(pair=>{
    if(!Array.isArray(pair)||pair.length!==2||!owns(scope,pair[0])||typeof pair[1]!=='string'||seen.has(pair[0]))throw Error('Invalid save scope/entry');
    seen.add(pair[0]);characters+=pair[0].length+pair[1].length;if(characters>SAVE_LIMITS.characters)throw Error('Save size limit');
    return [...pair];
  });
}
function checkRecord(record,gameId,scope){
  if(!record||record.schema!==1||record.gameId!==gameId||typeof record.writerId!=='string'||!record.writerId||!integer(record.fence)||!integer(record.revision)||!integer(record.sequence))throw Error('Unknown or invalid save record; preserved');
  if(Object.keys(record).some(key=>!['schema','gameId','writerId','fence','revision','sequence','entries'].includes(key)))throw Error('Unknown save extension; preserved');
  checkEntries(record.entries,scope);return record;
}
export function acquireRecord(previous,{gameId,writerId,scope,legacy,journals}){
  if(typeof writerId!=='string'||!writerId)throw Error('Writer identity required');
  if(previous)checkRecord(previous,gameId,scope);
  let entries=previous?previous.entries:checkEntries(legacy,scope),recovered=null;
  for(const journal of journals){
    // A later journal from this exact owner is potentially the newest save.
    // An older reader must not advance the fence past bytes it cannot decode.
    if(previous&&journal?.gameId===gameId&&journal.writerId===previous.writerId&&journal.fence===previous.fence&&(!integer(journal.sequence)||journal.sequence>previous.sequence))checkRecord(journal,gameId,scope);
    try{checkRecord(journal,gameId,scope);}catch{continue;}
    // The first IDB commit may finish before its JS callback can rewrite a newer
    // synchronous journal. Within one writer fence, sequence orders whole saves.
    if(previous&&journal.writerId===previous.writerId&&journal.fence===previous.fence&&journal.revision<=previous.revision&&journal.sequence>previous.sequence&&(!recovered||journal.sequence>recovered.sequence))recovered=journal;
  }
  const backups=[];
  if(recovered){entries=recovered.entries;backups.push(previous);}
  if(!previous&&entries.length)backups.push({schema:1,gameId,writerId:'legacy',fence:0,revision:0,sequence:0,entries});
  const record={schema:1,gameId,writerId,fence:next(previous?.fence??0),revision:recovered?next(previous.revision):previous?.revision??0,sequence:0,entries:checkEntries(entries,scope)};
  return {record,backups,recovered};
}
export function commitRecord(current,proposed,scope){
  checkRecord(proposed,proposed.gameId,scope);checkRecord(current,proposed.gameId,scope);
  if(current.writerId!==proposed.writerId||current.fence!==proposed.fence||current.revision!==proposed.revision||proposed.sequence<=current.sequence)throw Error('Save conflict: stale writer/revision');
  return {...proposed,revision:next(current.revision),entries:checkEntries(proposed.entries,scope)};
}
export function createFacade(scope,initial,onMutate){
  let entries=new Map(checkEntries(initial,scope));
  const update=map=>{const snapshot=checkEntries([...map],scope);onMutate(snapshot);entries=map;};
  const methods={
    getItem(key){return entries.get(String(key))??null;},
    setItem(key,value){key=String(key);if(!owns(scope,key))throw Error('Save scope violation');const map=new Map(entries);map.set(key,String(value));update(map);},
    removeItem(key){key=String(key);if(!owns(scope,key))throw Error('Save scope violation');const map=new Map(entries);map.delete(key);update(map);},
    clear(){update(new Map());},key(index){return [...entries.keys()][Number(index)>>>0]??null;}
  };
  return new Proxy(Object.create(null),{
    get(_target,key){if(key===Symbol.toStringTag)return 'Storage';if(key==='length')return entries.size;if(Object.hasOwn(methods,key))return methods[key];return entries.get(key);},
    set(_target,key,value){methods.setItem(key,value);return true;},
    deleteProperty(_target,key){methods.removeItem(key);return true;},
    ownKeys(){return [...entries.keys()];},has(_target,key){return entries.has(key)||Object.hasOwn(methods,key)||key==='length';},
    getOwnPropertyDescriptor(_target,key){if(entries.has(key))return {configurable:true,enumerable:true,writable:true,value:entries.get(key)};},
    defineProperty(){throw Error('Storage property definition unsupported');},preventExtensions(){return false;}
  });
}
export function legacyEntries(storage,scope){
  const entries=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(owns(scope,key)){const value=storage.getItem(key);if(value!==null)entries.push([key,value]);}}
  return checkEntries(entries,scope);
}
// No awaited work inside a live IDB transaction: Safari may auto-close it.
export function openSaveStore({indexedDB,basePath,timeout=4000}){
  return new Promise((resolve,reject)=>{
    let expired=false;const request=indexedDB.open('game-hub-web.saves.'+basePath,1);
    const timer=setTimeout(()=>{expired=true;reject(Error('Save database blocked/unavailable'));},timeout);
    request.onupgradeneeded=()=>{request.result.createObjectStore('saves',{keyPath:'gameId'});request.result.createObjectStore('backups',{keyPath:'id'}).createIndex('gameId','gameId');};
    request.onerror=()=>{clearTimeout(timer);reject(request.error);};
    request.onsuccess=()=>{
      clearTimeout(timer);const db=request.result;if(expired){db.close();return;}
      db.onversionchange=()=>db.close();
      const transact=(gameId,scope,operation)=>new Promise((done,fail)=>{
        let result,cause;const tx=db.transaction(['saves','backups'],'readwrite'),saves=tx.objectStore('saves'),backups=tx.objectStore('backups');
        tx.oncomplete=()=>done(result);tx.onabort=()=>fail(cause??tx.error??Error('Save transaction aborted'));
        const read=saves.get(gameId);read.onsuccess=()=>{try{
          const outcome=operation(read.result);result=outcome.record;
          checkRecord(result,gameId,scope);
          for(const backup of outcome.backups??[])backups.put({id:JSON.stringify([gameId,backup.writerId,backup.fence,backup.revision,backup.sequence]),gameId,record:backup});
          saves.put(result);
        }catch(error){cause=error;tx.abort();}};
      });
      resolve({
        acquire(options){return transact(options.gameId,options.scope,previous=>acquireRecord(previous,options));},
        commit(proposed,scope,{backup=false}={}){return transact(proposed.gameId,scope,current=>({record:commitRecord(current,proposed,scope),backups:backup?[current]:[]}));},
        backups(gameId){return new Promise((done,fail)=>{const tx=db.transaction('backups'),request=tx.objectStore('backups').index('gameId').getAll(gameId);let rows;request.onsuccess=()=>{rows=request.result;};tx.oncomplete=()=>done(rows);tx.onabort=()=>fail(tx.error);});},
        close(){db.close();}
      });
    };
  });
}
