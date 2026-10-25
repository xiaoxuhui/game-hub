export function installTuringCompatibility(root,current,initialProject){
 const document=root.document,F=root.TuringHubFormat.create(current,root.TuringHubLegacy.codec),initial=JSON.stringify(initialProject);let storage;
 try{storage=root.localStorage;}catch{storage={getItem(){throw Error('浏览器存储不可用。');},setItem(){throw Error('浏览器存储不可用。');},removeItem(){throw Error('浏览器存储不可用。');}};}
 let cache=root.TuringHubPreservation.create(storage,F,initial),host=null,metadata={...initialProject},legacyLimit=null,readOnly=false,applying=false,busy=false,lastImportRaw=null,pendingImportRaw=null;const dialogs=new Set();
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
 function chooseLimit(preferred=legacyLimit){const answer=root.prompt('Max在当前版本不限步数。为让旧版本读取兼容项目，请明确填写旧版有限步数上限（1–1000000）；该有限值不等价于Max。取消后仍可完整导出。',preferred===null||preferred===undefined?'':String(preferred));if(answer===null)return null;if(!/^\d+$/.test(answer.trim())||!Number.isSafeInteger(Number(answer))||Number(answer)<1||Number(answer)>1_000_000){message('旧版兼容步数必须为1–1000000整数，未采用默认值。');return null;}return Number(answer);}
 function limitFor(text,preferred=legacyLimit){const read=F.read(text);if(!read.ok)throw Error(read.error);if(read.state.maxSteps!==null)return read.state.maxSteps;if(preferred!==null&&preferred!==undefined){F.project(text,preferred);return preferred;}return chooseLimit(null);}
 function save(project){
  if(readOnly)return'自动保存已暂停；请先完整导出，再从备份管理明确恢复。';
  try{const text=JSON.stringify(project),limit=limitFor(text);if(limit===null){suspend('未选择旧版Max兼容上限，未写入项目缓存。');return status.textContent;}cache.save(text,limit);if(project.maxSteps===null)legacyLimit=limit;message(project.maxSteps===null?`完整Max项目已保护；旧版兼容视图上限为${limit}步，不代表Max。`:'完整项目及旧版兼容缓存已保存。');return null;}catch(error){suspend(error.message);return status.textContent;}
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
 function compatibleExport(){const text=fullText(),read=F.read(text);if(!read.ok)throw Error('当前草稿不能形成兼容运行项目：'+read.error+' 请使用完整项目/草稿导出。');const limit=limitFor(text);if(limit===null){message('已取消兼容导出，未采用默认上限。');return;}if(read.state.maxSteps===null&&!root.confirm(`旧版只会按${limit}步的有限视图运行；完整Max仍保留供新版恢复。是否导出兼容项目？`))return;if(read.state.maxSteps===null)legacyLimit=limit;download('turing-machine-project.json',F.wrap(text,limit));}
 function setLimit(){const choice=chooseLimit();if(choice===null)return;const snapshot=cache.inspect();if(!['empty','legacy','current'].includes(snapshot.kind))throw Error('当前有旧编辑/未完成保存，请先在备份管理明确恢复。');legacyLimit=choice;readOnly=false;save(host.getProject());}
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
 button('完整项目/草稿导出',()=>run(fullExport),bar,'hubTuringFullExport');button('旧版兼容步数设置',()=>run(setLimit),bar,'hubTuringLimit');button('完整项目备份管理',()=>run(manage),bar,'hubTuringManage');
 root.addEventListener('storage',event=>{if(event.storageArea===storage&&(event.key===cache.key||event.key===cache.oldKey||event.key===null)){cache.invalidate();suspend('检测到其它页面或旧版写入，未覆盖其内容；请先完整导出，再关闭其它实例并重新打开。');}});
 const exportButton=document.getElementById('exportProject');exportButton.textContent='旧版兼容导出';message('完整项目保护已就绪。');
 return{storage,mount(value){host=value;},collect,beforeReplace,protectDraftReplacement,save,speedSave,start,importFile,compatibleExport:()=>run(compatibleExport)};
}

export const turingCompatibilityCSS=`
.hub-turing-controls{display:flex;flex-wrap:wrap;gap:.5rem;padding:.75rem 1rem;border:1px solid #9aa9c9;border-radius:.75rem;margin:.75rem 12px;min-width:0}.hub-turing-controls p{flex-basis:100%;margin:0;overflow-wrap:anywhere;font-size:.9rem}.hub-turing-controls button,.hub-turing-dialog button{max-width:100%;white-space:normal;overflow-wrap:anywhere}.hub-turing-dialog{max-width:min(42rem,94vw);max-height:85dvh;overflow:auto;border-radius:.75rem;padding:1rem}.hub-turing-dialog button{display:block;margin:.5rem 0;padding:.5rem}.hub-turing-dialog input{max-width:100%}.hub-turing-dialog::backdrop{background:#17233c99}
@media(max-width:640px){.speed{flex:1 1 100%;margin-left:0;flex-wrap:wrap;justify-content:center;max-width:100%}.speed>span,.speed>strong{white-space:nowrap}.speed input[type="range"]{flex:1 1 8rem;min-width:5rem}.speed input[type="number"]{flex:0 0 76px}}
`;
export function turingUIRuntime(){return Buffer.from(`(function(root){'use strict';root.installTuringCompatibility=${installTuringCompatibility.toString()};})(globalThis);\n`);}
