import {checkEntries,createFacade,legacyEntries,openSaveStore,SAVE_LIMITS} from './save-store.mjs';

export async function startSaveSession({gameId,scope,basePath,onStatus=()=>{},environment=globalThis}){
  let nativeStorage,db,record,channel,sequence=0,entries=[],draft=null,backupNeeded=false,pending=null,mode='readonly';
  const writerId=environment.crypto?.randomUUID?.();
  const prefix='game-hub-web.journal.'+encodeURIComponent(basePath)+'.'+gameId+'.',journalKey=prefix+writerId;
  const notify=(state,message)=>{mode=state;onStatus({mode:state,message});};
  function journals(){
    const rows=[];
    for(let i=0;i<nativeStorage.length;i++){
      const key=nativeStorage.key(i);if(!key?.startsWith(prefix))continue;
      const text=nativeStorage.getItem(key);if(text===null)continue;
      // Undecodable app-owned logs are preserved; never take over past them.
      if(text.length>SAVE_LIMITS.characters+128*1024||rows.length>=SAVE_LIMITS.keys)throw Error('存档恢复日志过大，已保留原数据');
      rows.push(JSON.parse(text));
    }
    return rows;
  }
  try{
    nativeStorage=environment.localStorage;entries=legacyEntries(nativeStorage,scope);
    if(!writerId)throw Error('浏览器缺少安全会话标识');
    db=await openSaveStore({indexedDB:environment.indexedDB,basePath});
    const logs=journals();record=await db.acquire({gameId,writerId,scope,legacy:entries,journals:logs});entries=record.entries;
    notify('writable','存档已就绪');
    if(environment.BroadcastChannel){
      channel=new environment.BroadcastChannel('game-hub-web.writer.'+basePath+gameId);
      channel.onmessage=event=>{if(event.data?.fence>record.fence)notify('readonly','另一标签已接管存档，本页只读，可导出备份');};
      channel.postMessage({fence:record.fence});
    }
    // Prior journals (including recovered/conflicting ones) remain available.
    // Only this session's successfully committed journal may be removed below.
  }catch(error){notify('readonly','存档不可用，仅只读：'+error.message);}

  async function flush(){
    if(pending)return pending;
    if(mode!=='writable')return;
    pending=(async()=>{
      while(mode==='writable'&&sequence>record.sequence){
        const writing={...record,sequence,entries:checkEntries(entries,scope)},backup=backupNeeded;backupNeeded=false;
        try{
          record=await db.commit(writing,scope,{backup});
          if(mode==='writable'&&sequence===record.sequence){nativeStorage.removeItem(journalKey);notify('writable','已保存');}
        }catch(error){backupNeeded||=backup;notify('readonly',/conflict/.test(error.message)?'另一标签已接管存档，本页只读，可导出备份':'保存未完成，恢复日志已保留，请导出备份');}
      }
    })();
    try{await pending;}finally{pending=null;}
  }
  const storage=createFacade(scope,entries,(nextEntries,operation)=>{
    const attempted=new Map(draft??entries);
    if(operation.type==='clear')attempted.clear();else if(operation.type==='remove')attempted.delete(operation.key);else attempted.set(operation.key,operation.value);
    draft=checkEntries([...attempted],scope);
    if(mode!=='writable')throw Error('存档只读，请导出备份');
    if(sequence===Number.MAX_SAFE_INTEGER){notify('readonly','存档序号已满，请导出备份');throw Error('Save counter exhausted');}
    const proposed={...record,sequence:sequence+1,entries:nextEntries};
    try{nativeStorage.setItem(journalKey,JSON.stringify(proposed));}
    catch(error){notify('readonly','存档空间不足或不可用，请导出备份');throw error;}
    backupNeeded||=entries.some(([key])=>!nextEntries.some(([nextKey])=>key===nextKey));
    entries=nextEntries;sequence=proposed.sequence;draft=null;
    notify('writable','正在保存…');queueMicrotask(()=>{void flush();});
  });
  async function checkWriter(){
    if(mode!=='writable'||!db)return;
    try{const current=await db.current(gameId);if(current?.writerId!==writerId||current.fence!==record.fence)notify('readonly','另一标签已接管存档，本页只读，可导出备份');}
    catch{notify('readonly','存档连接已失效，本页只读，请导出备份');}
  }
  return {
    storage,flush,checkWriter,
    snapshot(){return {entries:checkEntries(draft??entries,scope),mode,pending:sequence>(record?.sequence??0)||draft!==null,canonicalRead:!!record,source:draft?'session-draft':record?'canonical-session':'legacy-only'};},
    async backups(){return db?db.backups(gameId):[];},
    close(){channel?.close();db?.close();}
  };
}
