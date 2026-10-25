export function installEMLCompatibility(root, original, Store) {
  const doc=root.document, F=root.EMLHubFormat.create(original,root.EMLHubLegacy), initial=original.serialize(Store.createInitialState());
  let storage;
  try{storage=root.localStorage;}catch(error){storage={getItem(){throw error;},setItem(){throw error;},removeItem(){throw error;}};}
  const cache=root.EMLHubPreservation.create(storage,F,root.EMLHubLegacy.persistence,initial);
  let host=null,readOnly=false,lastSaveError=null,busy=false,cancelPrompt=()=>{};
  const actions=doc.querySelector('.file-actions'),banner=doc.createElement('p');banner.id='hubEMLStatus';banner.className='hub-eml-status';banner.setAttribute('role','status');banner.hidden=true;actions.parentElement.after(banner);
  const prompt=doc.createElement('dialog');prompt.className='hub-eml-dialog';prompt.setAttribute('aria-label','选择完整列表恢复方式');doc.body.append(prompt);
  prompt.addEventListener('cancel',event=>{event.preventDefault();cancelPrompt();});
  const manager=doc.createElement('dialog');manager.className='hub-eml-dialog';manager.setAttribute('aria-label','完整列表备份管理');doc.body.append(manager);
  function notice(message,error=false){banner.hidden=false;banner.textContent=message;banner.classList.toggle('error',error);}
  function paragraph(parent,message){const node=doc.createElement('p');node.textContent=message;parent.append(node);return node;}
  function button(parent,label,action){const node=doc.createElement('button');node.type='button';node.textContent=label;node.addEventListener('click',action);parent.append(node);return node;}
  function download(text,name){
    if(typeof text!=='string'||!text.length){notice('没有可导出的原文。');return;}
    const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'})),anchor=doc.createElement('a');anchor.href=url;anchor.download=name;doc.body.append(anchor);anchor.click();anchor.remove();root.setTimeout(()=>URL.revokeObjectURL(url),0);
  }
  async function run(action){if(busy)return;busy=true;actions.setAttribute('aria-busy','true');try{return await action();}catch(error){notice(error.message,true);}finally{busy=false;actions.setAttribute('aria-busy','false');}}
  async function choose(title,options){
    prompt.replaceChildren();paragraph(prompt,title);
    const answer=new Promise(resolve=>{
      options.forEach((option,index)=>{
        const parsed=F.read(option.fullText),state=parsed.ok?parsed.state:null;
        const count=state?` · ${state.valueOrder.length}个数值 / ${state.customFunctions?.length||0}个函数`:'';
        button(prompt,option.label+count,()=>resolve(index));
      });
      button(prompt,'取消',()=>resolve(null));cancelPrompt=()=>resolve(null);
    });
    prompt.showModal();try{return await answer;}finally{prompt.close();cancelPrompt=()=>{};}
  }
  // Read-only calculation must still allow an explicit preview-bound archive repair.
  // Only actual external changes invalidate the preservation object's write capability.
  function suspend(message){readOnly=true;notice(message,true);}
  function risk(error){
    if(!root.confirm(`完整保护尚未完成：${error.message}\n是否仍继续？继续只改变当前会话并暂停缓存写入，请导出完整列表；取消保留当前列表。`))return false;
    suspend('当前会话尚未写入缓存，请先导出完整列表；重新打开前不要依赖自动保存。');return true;
  }
  function save(_storage,state){
    try{if(readOnly)throw Error('缓存写入已暂停，请导出完整列表或重新打开后恢复。');cache.save(F.fullText(state));lastSaveError=null;}
    catch(error){lastSaveError=error;notice(`完整缓存尚未确认：${error.message} 请导出完整列表。`,true);throw error;}
  }
  async function load(){
    try{
      const snapshot=cache.inspect();
      if(snapshot.kind==='empty')return {ok:false,error:'没有缓存'};
      if(snapshot.activeFullText)return F.read(snapshot.activeFullText);
      const index=await choose('检测到旧版编辑、保存未完成或无法读取的基础缓存。原文会保管，请明确选择；取消以只读初始列表打开。',snapshot.options);
      if(index===null){suspend('尚未选择缓存恢复内容，当前只在会话中计算；请先保管原文并重新打开后选择。');return {ok:false,error:'取消恢复'};}
      const chosen=snapshot.options[index].fullText;
      try{cache.select(snapshot,index);readOnly=false;notice('已按明确选择恢复并保护原文。');}
      catch(error){if(!risk(error))return {ok:false,error:'保护未完成'};}
      return F.read(chosen);
    }catch(error){suspend(`无法读取完整保护记录：${error.message} 原文未改写，可在完整备份中导出；当前会话不自动保存。`);return {ok:false,error:error.message};}
  }
  function apply(fullText,originalText,reason){
    if(!host)throw Error('列表尚在恢复中。');
    const restored=F.read(fullText);if(!restored.ok)throw Error(restored.error);
    try{if(readOnly)throw Error('缓存保护已暂停。');cache.preserve([F.fullText(host.getState()),originalText,fullText],reason);}
    catch(error){if(!risk(error))return false;}
    lastSaveError=null;host.apply(restored.state);
    notice(readOnly||lastSaveError?'列表已在当前会话中更新；缓存尚未确认，请导出完整列表。':'列表已更新，完整保护与旧版兼容缓存已保存。',readOnly||Boolean(lastSaveError));return true;
  }
  async function importText(text){
    const read=F.read(text);
    if(read.ok)return apply(read.fullText,text,'导入替换前保护当前与原始文件');
    if(!read.conflict)throw Error(`导入失败：${read.error} 现有列表未改变。`);
    const options=[{label:'导入旧版修改后的基础',fullText:read.conflict.baseText},{label:'恢复文件中的完整档',fullText:read.conflict.fullText}],index=await choose('文件基础已被旧版修改，不会自动套用完整扩展。请选择，或取消保留当前列表。',options);
    return index===null?false:apply(options[index].fullText,text,'导入冲突显式选择前保护双方');
  }
  function exportFull(){if(!host)return;try{download(F.fullText(host.getState()),'eml-full-state.json');notice('已请求导出完整列表，请完成系统保存；此文件用于新版恢复，旧版请使用“保存列表”。');}catch(error){notice(error.message,true);}}
  function exportCompatible(state){
    try{
      const fullText=F.fullText(state),projected=F.project(fullText),contents=F.wrap(fullText),omitted=projected.omitted;
      if(omitted.values+omitted.derivations+omitted.customFunctions>0&&!root.confirm(`旧版可读取 ${projected.base.valueOrder.length} 个数值和 ${Object.keys(projected.base.derivations).length} 条EML公式；不会显示 ${omitted.values} 个新表达式、${omitted.derivations} 条新推导和 ${omitted.customFunctions} 个函数定义。完整原文仍在扩展中，旧版编辑后请回新版明确恢复。是否导出？`))return;
      let saved=true;try{save(storage,state);}catch{saved=false;}
      download(contents,'eml-workbench-v2.json');notice(saved?'已请求导出兼容列表，请完成系统保存；完整保护和兼容缓存已保存。':'已请求导出兼容列表；缓存尚未确认，请完成系统保存并另存完整列表。',!saved);
    }catch(error){notice(`兼容导出未完成：${error.message} 请使用“导出完整列表”，内容不会截断。`,true);}
  }
  async function recover(){
    if(!host)return;const snapshot=cache.inspect();
    const index=await choose('选择要恢复的完整列表。取消不改变当前列表和缓存。',snapshot.options);if(index===null)return;
    const chosen=snapshot.options[index].fullText;
    try{
      cache.preserve([F.fullText(host.getState())],'恢复缓存前保护当前会话');
      const fresh=cache.inspect(),at=fresh.options.findIndex(option=>option.fullText===chosen);if(at<0)throw Error('恢复候选已改变，请重新选择。');cache.select(fresh,at);readOnly=false;
    }catch(error){if(!risk(error))return;}
    const restored=F.read(chosen);lastSaveError=null;host.apply(restored.state);notice(readOnly||lastSaveError?'已恢复到当前会话；请导出完整列表，缓存尚未确认。':'完整列表已恢复并保存。',readOnly||Boolean(lastSaveError));
  }
  async function manage(){
    if(!host||busy||manager.open)return;manager.replaceChildren();paragraph(manager,'完整列表与原始文件保管。最多10份历史/保护记录总计3MiB；系统保存仍需您完成。');button(manager,'关闭',()=>manager.close());
    const status=paragraph(manager,''),list=doc.createElement('div');
    const guarded=action=>()=>run(async()=>{try{await action();}catch(error){status.textContent=error.message;notice(error.message,true);}});
    button(manager,'导出当前会话完整列表',exportFull);
    button(manager,'导出保护集合原文',guarded(()=>{download(cache.exportProtection(),'eml-protection-record.json');status.textContent='已请求导出，请完成系统保存。';}));
    button(manager,'导出基础缓存原文',guarded(()=>download(cache.exportLegacy(),'eml-cache-original.json')));
    button(manager,'检查并选择缓存恢复',guarded(async()=>{manager.close();await recover();}));
    button(manager,'导出检测到的写入冲突',guarded(()=>{const conflict=cache.conflict();if(conflict)download(JSON.stringify(conflict,null,2),'eml-preservation-conflict.json');else status.textContent='尚无检测到的写入冲突。';}));
    const input=doc.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;manager.append(input);
    button(manager,'导入保护集合',()=>input.click());
    input.addEventListener('change',guarded(async()=>{try{const file=input.files?.[0];if(!file)return;if(file.size>cache.maxBytes)throw Error('保护集合超过3MiB。');cache.importProtection(await file.text());status.textContent='保护历史已合并，当前列表未改变；重新打开此窗口刷新。';}finally{input.value='';}}));
    button(manager,'只清理保护历史',guarded(()=>{const preview=cache.previewClear();if(root.confirm(`清理 ${preview.historyCount??'无法读取'} 份历史？当前完整保护档和基础缓存保留；请先导出。`)){cache.clearHistory(true,preview.expectedRaw);list.replaceChildren();status.textContent='历史已清理；当前完整保护档保留，重新打开刷新。';}}));
    button(manager,'清理整个完整保护记录',guarded(()=>{const preview=cache.previewClear();if(root.confirm('清理本游戏整个完整保护记录（含当前保护档及历史）？基础缓存仍保留。请先导出保护原文。')){cache.clearProtection(true,preview.expectedRaw);list.replaceChildren();status.textContent='完整保护记录已清理；基础缓存未删除。';}}));
    manager.append(list);manager.showModal();
    try{
      cache.inspect();const record=JSON.parse(cache.exportProtection());
      if(record.current){const row=doc.createElement('div');row.className='hub-eml-backup-row';list.append(row);paragraph(row,'当前完整保护档 · '+record.current.savedAt);button(row,'导出当前保护档',()=>download(record.current.fullText,'eml-protected-current.json'));}
      record.history.forEach((entry,index)=>{const row=doc.createElement('div');row.className='hub-eml-backup-row';list.append(row);paragraph(row,`${index+1}. ${entry.reason} · ${entry.savedAt}`);button(row,'导出此份原文',()=>download(entry.rawText,`eml-preserved-${index+1}.json`));const restore=button(row,'恢复此份',()=>run(async()=>{manager.close();await importText(entry.rawText);}));const read=F.read(entry.rawText);restore.disabled=!read.ok&&!read.conflict;});
    }catch(error){status.textContent=`保护记录无法读取：${error.message} 原文仍可导出，明确确认后才清理。`;}
  }
  button(actions,'导出完整列表',exportFull).id='hubEMLFullExportButton';button(actions,'完整备份',manage).id='hubEMLManageButton';
  // Stop only propagation; keep native Tab/Enter/Escape behavior inside our dialogs.
  for(const type of ['keydown','keyup'])doc.addEventListener(type,event=>{if(prompt.open||manager.open)event.stopPropagation();},true);
  root.addEventListener('storage',event=>{if(event.key===cache.key||event.key===cache.oldKey||event.key===null){cache.invalidate();notice('其他页面或旧版已修改记录，请关闭其它实例后重开；当前完整列表仍可导出。',true);}});
  return {storage,persistence:{...original,serialize:state=>F.serialize(state),deserialize:text=>F.read(text),saveToCache:save,loadFromCache:load},
    mount(callbacks){host=callbacks;},exportCompatible,exportFull,
    importFile:file=>run(async()=>{if(!file)return;if(file.size>F.maxReadBytes)throw Error('导入文件超过完整读取上限。');await importText(await file.text());}),
    clear:()=>run(()=>{if(!host||!root.confirm('清空非初始数值、公式与函数定义？原列表会先保管，初始值1保留。'))return;apply(initial,F.fullText(host.getState()),'清空前保护完整列表');}),
  };
}

export const emlCompatibilityCSS=`\n.hub-eml-status{margin:.8rem 0;padding:.8rem;border:1px solid #a6bed3;border-radius:8px;background:#eef6ff;color:#16314d;overflow-wrap:anywhere}.hub-eml-status.error{background:#fff1e8;border-color:#d58a54}.hub-eml-dialog{box-sizing:border-box;width:min(44rem,calc(100vw - 2rem));max-height:85dvh;overflow:auto;border:1px solid #a8bcd0;border-radius:12px;padding:1rem;background:#fff;color:#17314a}.hub-eml-dialog::backdrop{background:#12304a80}.hub-eml-dialog p{overflow-wrap:anywhere}.hub-eml-dialog button{margin:.25rem;max-width:100%;white-space:normal;overflow-wrap:anywhere}.hub-eml-backup-row{padding:.6rem 0;border-top:1px solid #c7d3de}\n`;
export function emlUIRuntime(){return Buffer.from(`globalThis.installEMLCompatibility=${installEMLCompatibility.toString()};\n`);}
