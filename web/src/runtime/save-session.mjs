import {checkEntries,createFacade,legacyEntries,openSaveStore,SAVE_LIMITS} from './save-store.mjs';

export async function startSaveSession({gameId,scope,basePath,onStatus=()=>{},environment=globalThis}){
  let nativeStorage,db,record,channel,sequence=0,entries=[],draft=null,backupNeeded=false,pending=null,mode='readonly',preview=null,importPreview=null,importGeneration=0;
  const writerId=environment.crypto?.randomUUID?.();
  const prefix='game-hub-web.journal.'+encodeURIComponent(basePath)+'.'+gameId+'.',journalKey=prefix+writerId;
  const notify=(state,message)=>{
    mode=state;
    // A view callback must never change transaction or writer semantics.
    try{onStatus({mode:state,message});}catch(error){console.error('存档状态界面更新失败',error);}
  };
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
  const identity=()=>Object.fromEntries(['writerId','fence','revision','sequence'].map(key=>[key,record?.[key]]));
  const canRestore=()=>{
    if(mode!=='writable'||!db||!record||draft!==null||sequence!==record.sequence)throw Error('当前存档未保存或只读，不能恢复；请先导出并重新打开');
  };
  // Caller must first validate the complete file and the fixed native writer.
  // Keep candidate/expected private: mutating the UI preview cannot replace them.
  async function prepareRestore(candidate){
    preview=null;const replacement=checkEntries(candidate,scope);await flush();canRestore();
    const token=environment.crypto.randomUUID(),expected=identity();preview={token,expected,entries:replacement};
    return {token,expected:{...expected},keys:replacement.length,replacedKeys:entries.length};
  }
  async function restore(token){
    const selected=preview;preview=null;
    if(!selected||selected.token!==token)throw Error('恢复确认已失效，请重新选择备份');
    await flush();canRestore();
    if(Object.keys(selected.expected).some(key=>selected.expected[key]!==record[key]))throw Error('存档已变化，请重新预览恢复');
    const restoreWriter=environment.crypto.randomUUID();
    notify('readonly','正在恢复，当前页面已停止写入…');
    let restored;
    try{restored=await db.restore({gameId,expected:selected.expected,writerId:restoreWriter,entries:selected.entries},scope);}
    catch(error){notify('readonly','恢复未提交，原存档保持；请重新打开后再试');throw error;}
    // Notification is not the commit authority. A closed channel cannot turn a
    // successful IDB transaction into a false "original unchanged" report.
    try{channel?.postMessage({fence:restored.fence});}catch{/* IDB fences stale writers even without a broadcast. */}
    // Never replace this old native UI's in-memory state or resume its callbacks.
    notify('readonly','恢复完成，重新打开游戏后生效');
    return {fence:restored.fence,revision:restored.revision};
  }
  async function prepareImport(){
    const generation=++importGeneration;importPreview=null;await flush();canRestore();const expected=identity(),current=await db.current(gameId);canRestore();
    if(generation!==importGeneration)throw Error('导入预览已失效');
    if(Object.keys(expected).some(key=>expected[key]!==current?.[key])){notify('readonly','存档已变化，本页只读，请重新打开');throw Error('Save conflict: native import owner changed');}
    const token=environment.crypto.randomUUID();importPreview={token,expected};return {token,expected:{...expected}};
  }
  async function commitImport(token){
    const selected=importPreview,generation=importGeneration;importPreview=null;
    if(!selected||selected.token!==token)throw Error('导入确认已失效，请重新选择文件');
    const checkGeneration=()=>{if(generation!==importGeneration)throw Error('导入确认已失效，请重新选择文件');};
    await flush();checkGeneration();canRestore();if(Object.keys(selected.expected).some(key=>selected.expected[key]!==record[key]))throw Error('存档已变化，请重新预览导入');
    checkGeneration();
    try{await db.checkpoint({gameId,expected:selected.expected},scope);}
    catch(error){notify('readonly','导入前备份未完成，已停止导入，请重新打开');throw error;}
    // Cancellation may race a successful backup. Keep that harmless backup,
    // but never authorize the old file or invalidate a newer preview.
    const checkLocal=()=>{checkGeneration();canRestore();if(Object.keys(selected.expected).some(key=>selected.expected[key]!==record[key]))throw Error('存档已变化，请重新预览导入');};
    checkLocal();const current=await db.current(gameId);checkLocal();
    if(Object.keys(selected.expected).some(key=>selected.expected[key]!==current?.[key])){notify('readonly','存档已变化，本页只读，请重新打开');throw Error('Save conflict: native import owner changed');}
    // No candidate bytes are applied here. Only after this checkpoint commits
    // may the caller return the validated file to the original native importer.
    return {...selected.expected};
  }
  return {
    storage,flush,checkWriter,prepareRestore,restore,cancelRestore(){preview=null;},
    protectWrites(message){preview=null;notify('readonly',message);},
    prepareImport,commitImport,cancelImport(){importGeneration++;importPreview=null;},
    committedSnapshot(){if(!record)throw Error('尚未读取完整存档');return {entries:checkEntries(record.entries,scope),mode:'readonly',pending:false,canonicalRead:true,source:'canonical-session'};},
    snapshot(){return {entries:checkEntries(draft??entries,scope),mode,pending:sequence>(record?.sequence??0)||draft!==null,canonicalRead:!!record,source:draft?'session-draft':record?'canonical-session':'legacy-only'};},
    async backups(){return db?db.backups(gameId):[];},
    close(){importGeneration++;importPreview=null;channel?.close();db?.close();}
  };
}
