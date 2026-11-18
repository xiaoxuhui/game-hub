(function(root){'use strict';root.resolveTuringFiniteLimit=function resolveTuringFiniteLimit(fieldValue, savedLimit) {
 const text=String(fieldValue??'').trim(), number=/^\d+$/.test(text)?Number(text):NaN;
 if(Number.isSafeInteger(number)&&number>=1&&number<=1_000_000)return number;
 return Number.isSafeInteger(savedLimit)&&savedLimit>=1&&savedLimit<=1_000_000?savedLimit:10000;
};root.createTuringEditorDraft=function createTuringEditorDraft(storage,archivePrevious) {
 const key='turing-machine-simulator.editor-draft.v1',fields=['input','blankSymbol','initialState','acceptStates','rejectStates','haltStates','rules'];
 let observed=storage.getItem(key);
 function parse(raw){if(raw===null)return null;const data=JSON.parse(raw);if(!data||data.version!==1||fields.some(field=>typeof data[field]!=='string'))throw Error('原有草稿无法识别，未覆盖。');return data;}
 function load(base){const data=parse(observed);if(!data||(Object.hasOwn(data,'baseLegacy')&&data.baseLegacy!==base))return null;const result=Object.fromEntries(fields.map(field=>[field,data[field]]));if(data.maxSteps===null||Number.isSafeInteger(data.maxSteps)&&data.maxSteps>=1&&data.maxSteps<=1_000_000)result.maxSteps=data.maxSteps;if(Number.isSafeInteger(data.finiteMaxSteps)&&data.finiteMaxSteps>=1&&data.finiteMaxSteps<=1_000_000)result.finiteMaxSteps=data.finiteMaxSteps;return result;}
 function save(project,base){if(storage.getItem(key)!==observed)throw Error('草稿已被其他页面修改，未覆盖。');let old;try{old=parse(observed);}catch(error){if(!archivePrevious)throw error;archivePrevious(observed);old=null;}if(old&&Object.hasOwn(old,'baseLegacy')&&old.baseLegacy!==base){if(!archivePrevious)throw Error('旧草稿对应其他项目，未覆盖。');archivePrevious(observed);old=null;}const settings={};if(project.maxSteps===null||Number.isSafeInteger(project.maxSteps)&&project.maxSteps>=1&&project.maxSteps<=1_000_000)settings.maxSteps=project.maxSteps;if(Number.isSafeInteger(project.finiteMaxSteps)&&project.finiteMaxSteps>=1&&project.finiteMaxSteps<=1_000_000)settings.finiteMaxSteps=project.finiteMaxSteps;const next={...old,version:1,...Object.fromEntries(fields.map(field=>[field,project[field]])),...settings,baseLegacy:base};const raw=JSON.stringify(next);storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('草稿写入核验失败。');observed=raw;}
 function rebase(before,after,project){if(storage.getItem(key)!==observed)throw Error('草稿已被其他页面修改，未覆盖。');const old=parse(observed);if(!old||old.baseLegacy!==before)return;const updated=project?{...Object.fromEntries(fields.map(field=>[field,project[field]])),maxSteps:project.maxSteps,finiteMaxSteps:project.finiteMaxSteps}:{};const raw=JSON.stringify({...old,...updated,baseLegacy:after});storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('草稿写入核验失败。');observed=raw;}
 return{load,save,rebase};
};root.installTuringCompatibility=function installTuringCompatibility(root,current,initialProject){
 const document=root.document,F=root.TuringHubFormat.create(current,root.TuringHubLegacy.codec),initial=JSON.stringify(initialProject);let storage;
 try{storage=root.localStorage;}catch{storage={getItem(){throw Error('浏览器存储不可用。');},setItem(){throw Error('浏览器存储不可用。');},removeItem(){throw Error('浏览器存储不可用。');}};}
 let cache=root.TuringHubPreservation.create(storage,F,initial),host=null,metadata={...initialProject},legacyLimit=null,readOnly=false,applying=false,busy=false,lastImportRaw=null,pendingImportRaw=null,draft=null;const dialogs=new Set();
 const bar=document.createElement('section');bar.id='hubTuringControls';bar.className='hub-turing-controls';bar.setAttribute('aria-busy','false');
 const status=document.createElement('p');status.id='hubTuringStatus';status.setAttribute('role','status');bar.append(status);document.querySelector('.topbar').after(bar);
 const button=(label,action,parent=bar,id)=>{const node=document.createElement('button');node.type='button';node.className='btn';node.textContent=label;if(id)node.id=id;node.addEventListener('click',()=>action());parent.append(node);return node;};
 function message(text){status.textContent=(readOnly?'自动保存暂停；':'')+text;}
 function suspend(text){readOnly=true;message(text+' 可继续计算并导出完整项目/草稿。');}
 function collect(fields){return{...metadata,...fields,name:metadata.name??fields.name,description:metadata.description??fields.description};}
 function adopt(project){metadata={...project};delete metadata.gameHubTuring;}
 function fullText(){return JSON.stringify(host.getProject(),null,2);}
 function download(name,text){host.download(name,text,'application/json');message('已请求导出文件，请在系统保存界面确认完成。');}
 function fullExport(){download('turing-full-project.json',fullText());}
 function draftStore(){return draft??=root.createTuringEditorDraft(storage,raw=>cache.preserve([raw],'保存新草稿之前保留旧草稿原文'));}
 function saveDraft(project){try{draftStore().save({...project,finiteMaxSteps:root.resolveTuringFiniteLimit(document.getElementById('maxSteps')?.value,legacyLimit)},storage.getItem(cache.oldKey));return true;}catch(error){message('草稿未保存：'+error.message+' 请先导出当前项目。');return false;}}
 function readDraft(){if(readOnly)return null;try{const result=draftStore().load(storage.getItem(cache.oldKey));if(result?.maxSteps===null&&result.finiteMaxSteps)legacyLimit=result.finiteMaxSteps;if(result)delete result.finiteMaxSteps;return result;}catch(error){message('原草稿未覆盖：'+error.message);return null;}}
 function limitFor(text,preferred=null){const read=F.read(text);if(!read.ok)throw Error(read.error);if(read.state.maxSteps!==null)return read.state.maxSteps;if(preferred!==null&&preferred!==undefined){F.project(text,preferred);return preferred;}return root.resolveTuringFiniteLimit(document.getElementById('maxSteps')?.value,legacyLimit);}
 function save(project){
  if(readOnly)return'自动保存已暂停；请先完整导出，再从备份管理明确恢复。';
  const candidate=JSON.stringify(project);if(!F.read(candidate).ok){if(saveDraft(project))message('编辑草稿已保存；规则完整后可应用。');return null;}
  try{const text=JSON.stringify(project),limit=limitFor(text),before=storage.getItem(cache.oldKey);cache.save(text,limit);legacyLimit=project.maxSteps===null?limit:null;message(project.maxSteps===null?`完整Max项目已保护；旧版兼容视图上限为${limit}步，不代表Max。`:'完整项目及旧版兼容缓存已保存。');try{if(draft)draft.rebase(before,storage.getItem(cache.oldKey),{...project,finiteMaxSteps:limit});}catch(error){message('项目已保存，但草稿未更新：'+error.message);}return null;}catch(error){suspend(error.message);return status.textContent;}
 }
 function speedSave(write){if(readOnly)return'自动保存暂停，目标速度仅用于当前会话。';try{return write();}catch(error){message(error.message);return'目标速度保存失败；当前调速仍可用。';}}
 function protect(texts,reason){
  if(readOnly)return root.confirm('自动保存已暂停，当前原文尚未获得新的持久保护。是否仅在本会话替换？请先使用完整导出保存需要保留的内容。');
  try{cache.preserve(texts,reason);return true;}catch(error){if(!root.confirm(error.message+' 当前原文未能完成保护。是否仅在本会话替换，并暂停自动保存？取消可保留当前内容。')){message('已取消替换：'+error.message);return false;}suspend('明确仅在本会话替换，未完成持久保护。');return true;}
 }
 function beforeReplace(project){if(applying){adopt(project);return true;}const incoming=pendingImportRaw??JSON.stringify(project);if(!protect([fullText(),incoming],'替换项目之前保全完整原文及输入'))return false;host.pause();adopt(project);return true;}
 function protectDraftReplacement(){if(!protect([fullText()],'清空规则之前保全当前草稿原文'))return false;return true;}
 function dialog(title){const node=document.createElement('dialog');node.className='hub-turing-dialog';node.setAttribute('aria-label',title);const heading=document.createElement('h2');heading.textContent=title;node.append(heading);document.body.append(node);dialogs.add(node);return node;}
 function removeDialog(node){dialogs.delete(node);if(node.open)node.close();node.remove();}
 function choose(title,options){return new Promise(resolve=>{const node=dialog(title);let done=false;const finish=value=>{if(done)return;done=true;removeDialog(node);resolve(value);};const explanation=document.createElement('p');explanation.textContent='基础被旧版修改或保存尚未完成。请明确选择；取消只读打开，不自动覆盖原文。';node.append(explanation);options.forEach((item,index)=>{const read=F.read(item.fullText),name=read.ok?read.state.name:'原文';button(`${item.label} · ${name}${read.ok&&read.state.maxSteps===null?' · 完整Max':''}`,()=>finish(index),node);});button('取消，仅本会话打开',()=>finish(null),node);node.addEventListener('cancel',event=>{event.preventDefault();finish(null);});node.showModal();});}
 for(const type of['keydown','keyup'])document.addEventListener(type,event=>{if([...dialogs].some(node=>node.open))event.stopPropagation();},true);
 async function run(action){if(busy)return;busy=true;bar.setAttribute('aria-busy','true');try{await action();}catch(error){message(error.message);}finally{busy=false;bar.setAttribute('aria-busy','false');}}
 async function restoreStartup(){
  let snapshot;
  try{snapshot=cache.inspect();}catch(error){suspend('保护记录无法读取：'+error.message+' 备份管理仍可导出原始保护记录和旧缓存。');return initialProject;}
  if(['empty','legacy','current'].includes(snapshot.kind)){const read=F.read(snapshot.activeFullText);if(!read.ok){suspend(read.error);return initialProject;}legacyLimit=read.state.maxSteps===null?(snapshot.legacyMaxSteps??null):null;return read.state;}
  const index=await choose('选择图灵机恢复内容',snapshot.options);if(index===null){suspend('已取消恢复选择，原项目缓存与保护记录未改。');return initialProject;}
  const selected=snapshot.options[index];try{const limit=limitFor(selected.fullText,selected.legacyMaxSteps??null);if(limit===null){suspend('未选择旧版有限上限，恢复未写入。');return initialProject;}cache.select(snapshot,index,limit);const read=F.read(selected.fullText);legacyLimit=read.state.maxSteps===null?limit:null;return read.state;}catch(error){suspend(error.message);return initialProject;}
 }
 async function start(applyInitial){const app=document.getElementById('app');app.inert=true;bar.setAttribute('aria-busy','true');try{const project=await restoreStartup();applying=true;adopt(project);applyInitial(project);}catch(error){suspend(error.message);}finally{applying=false;app.inert=false;bar.setAttribute('aria-busy','false');bar.dataset.ready='true';}}
 async function importFile(file){
  if(!file)return;if(file.size>20_000_000){message('项目文件超过20 MB，未读取或替换当前项目。');return;}
  await run(async()=>{const text=await file.text();lastImportRaw=text;const previousLimit=legacyLimit;let read=F.read(text),selectedRaw;
   if(!read.ok&&!read.conflict){if(!readOnly){try{cache.preserve([text],'导入校验失败的原始文件');}catch(error){suspend(error.message);}}message('项目文件无效：'+read.error+' 最近导入原文仍可在备份管理导出。');return;}
   if(read.conflict){const choices=[{label:'使用旧版修改后的有限基础',fullText:read.conflict.baseText},{label:'恢复附带的完整项目',fullText:read.conflict.fullText,legacyMaxSteps:read.conflict.legacyMaxSteps}],index=await choose('选择图灵机导入内容',choices);if(index===null){message('已取消导入，当前项目和缓存未改；输入原文可导出。');return;}selectedRaw=choices[index].fullText;read=F.read(selectedRaw);if(read.state.maxSteps===null)legacyLimit=choices[index].legacyMaxSteps??null;}else{selectedRaw=read.fullText;if(read.state.maxSteps===null)legacyLimit=read.legacyMaxSteps??null;}
   pendingImportRaw=text;try{if(host.applyProject(read.state)===false)legacyLimit=previousLimit;}finally{pendingImportRaw=null;}
  });
 }
 function compatibleExport(){const text=fullText(),read=F.read(text);if(!read.ok)throw Error('当前草稿不能形成兼容运行项目：'+read.error+' 请使用完整项目/草稿导出。');const limit=limitFor(text);if(read.state.maxSteps===null)legacyLimit=limit;download('turing-machine-project.json',F.wrap(text,limit));}
 async function restoreOption(option){
  if(!root.confirm('恢复将替换当前编辑内容；将先保护当前完整项目或草稿原文。继续？'))return;
  const limit=limitFor(option.fullText,option.legacyMaxSteps??null);if(limit===null){message('已取消恢复，未采用默认上限。');return;}
  cache.preserve([fullText()],'明确恢复之前保全当前会话草稿');const snapshot=cache.inspect(),index=snapshot.options.findIndex(item=>item.fullText===option.fullText&&item.legacyMaxSteps===option.legacyMaxSteps);if(index<0)throw Error('恢复候选已变化，请重新预览。');cache.select(snapshot,index,limit);const read=F.read(option.fullText);legacyLimit=read.state.maxSteps===null?limit:null;readOnly=false;applying=true;try{adopt(read.state);host.applyProject(read.state);}finally{applying=false;}
 }
 async function manage(){
  host.pause();const node=dialog('图灵机完整项目备份管理');const content=document.createElement('div');node.append(content);
  function render(){content.replaceChildren();let snapshot=null,record=null;
   try{snapshot=cache.inspect();record=JSON.parse(cache.exportProtection());}catch(error){const text=document.createElement('p');text.textContent='保护记录不可解析，但原文导出与显式清理仍可用：'+error.message;content.append(text);}
   const action=(label,callback)=>button(label,async()=>{try{await callback();render();}catch(error){message(error.message);}},content);
   action('导出完整保护记录原文',()=>download('turing-preservation-raw.json',cache.exportProtection()));
   action('导出旧项目缓存原文',()=>{const raw=cache.exportLegacy();if(raw===null)throw Error('当前没有旧项目缓存。');download('turing-legacy-cache-raw.json',raw);});
   if(lastImportRaw!==null)action('导出最近导入文件原文',()=>download('turing-last-import-raw.json',lastImportRaw));
   if(record?.current)action('导出受保护的当前完整原文',()=>download('turing-protected-current.json',record.current.fullText));
   for(const[at,entry]of(record?.history??[]).entries())action(`导出历史原文 ${at+1} · ${entry.reason}`,()=>download(`turing-history-${at+1}.json`,entry.rawText));
   for(const option of snapshot?.options??[])action(option.label+' · '+(F.read(option.fullText).state?.name??'原文'),()=>restoreOption(option));
   const input=document.createElement('input');input.type='file';input.accept='application/json,.json';input.setAttribute('aria-label','导入图灵机保护集合');input.addEventListener('change',async()=>{const file=input.files?.[0];input.value='';try{if(!file)return;if(file.size>cache.maxBytes)throw Error('保护集合超过3MiB，未读取。');cache.importProtection(await file.text());message('已合并保护历史，当前项目及旧缓存未替换。');render();}catch(error){message(error.message);}});content.append(input);
   action('只清理历史，保留当前完整项目',()=>{const preview=cache.previewClear();if(root.confirm(`将清理${preview.historyCount??'未知数量'}条历史，当前保护档和旧项目缓存保留。请先导出需要的原文。继续？`))cache.clearHistory(true,preview.expectedRaw);});
   action('清理整个保护记录，保留旧项目缓存',()=>{const preview=cache.previewClear();if(root.confirm(`将清理整个保护键（${preview.historyCount??'未知数量'}条历史及当前保护档），旧项目缓存保留。请先导出原文。继续？`)){cache.clearProtection(true,preview.expectedRaw);cache=root.TuringHubPreservation.create(storage,F,initial);suspend('保护键已明确清理，旧项目缓存保留；请明确选择恢复后再继续自动保存。');}});
  }
  render();await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;removeDialog(node);resolve();};button('关闭备份管理',finish,node);node.addEventListener('cancel',event=>{event.preventDefault();finish();});node.showModal();});
 }
 button('完整项目/草稿导出',()=>run(fullExport),bar,'hubTuringFullExport');button('完整项目备份管理',()=>run(manage),bar,'hubTuringManage');
 root.addEventListener('storage',event=>{if(event.storageArea===storage&&(event.key===cache.key||event.key===cache.oldKey||event.key===null)){cache.invalidate();suspend('检测到其它页面或旧版写入，未覆盖其内容；请先完整导出，再关闭其它实例并重新打开。');}});
 const exportButton=document.getElementById('exportProject');exportButton.textContent='旧版兼容导出';message('完整项目保护已就绪。');
 return{storage,mount(value){host=value;},collect,beforeReplace,protectDraftReplacement,save,saveDraft,readDraft,speedSave,start,importFile,displayLimit:()=>root.resolveTuringFiniteLimit(legacyLimit===null?document.getElementById('maxSteps')?.value:legacyLimit,null),compatibleExport:()=>run(compatibleExport)};
};})(globalThis);
