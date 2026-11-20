import {readFileSync} from 'node:fs';
const longHistoryGuard=readFileSync(new URL('./lambda-long-history-guard.inc.js',import.meta.url),'utf8');
/** Apply only to the pinned, reviewed Lambda resource. */
export function protectLambdaOmega(source) {
 let html=source;
 function replace(a,b){if(html.split(a).length!==2)throw Error('Lambda Omega integration marker changed: '+a);html=html.replace(a,b)}
 replace('async function convert() {','async function convert({initial=false}={}) {');
 replace('    cancelRewind();\n    cancelConversion();const controller=new AbortController();', '    if(!initial&&workspace&&!workspace.backupBeforeRun())return false;\n    cancelRewind();\n    cancelConversion();const controller=new AbortController();');
 replace('function render(duration=0,undone=null) {','function render(duration=0,undone=null,suppressSave=false) {');
 replace('    renderDiagram(redex,duration,undone);\n    save();','    renderDiagram(redex,duration,undone);\n    if(!suppressSave)save();');
 replace('state.autoFit=true; render(); save(); return true;','state.autoFit=true; render(0,null,initial); if(!initial)save(); return true;');
 replace('workspace.prepareManualRestore();renderMode();convert();lastAutosaveSnapshot=JSON.stringify(capture());initializing=false;','workspace.prepareManualRestore();renderMode();if(!workspace.restoreProtected())convert({initial:true});lastAutosaveSnapshot=JSON.stringify(capture());initializing=false;');
 replace('    const raw=backing||unavailable;\n    const c5=C5.createLambdaC5Storage(raw,S,OldS,{eventTarget:backing?root:null});',longHistoryGuard+'\n    const c5=C5.createLambdaC5Storage(raw,S,OldS,{eventTarget:backing?mappedEvents:null});');
 replace('    function startup(){\n      if(!backing)return;', `    function startup(){
      if(!backing)return;
      if(choice.safe&&!choice.overflow){
        if(raw.getItem('lambda-lab-hub-v4')!==null)choice.recovery=true;
        else {
          const pointer=choice.previous.getItem('lambda-lab-hub-before-run-latest-v1')||normalRaw.getItem('lambda-lab-hub-before-run-latest-v1');
          const text=pointer&&pointer.startsWith('lambda-lab-hub-before-run-v1.')?(choice.previous.getItem(pointer)||normalRaw.getItem(pointer)):null;
          if(text)try{
            const item=JSON.parse(text);
            if((item.session?.steps??0)<=256&&(item.checkpoint?.session?.steps??0)<=256){
              const snapshot=S.decode(text,{compact:true});c5.setItem('lambda-lab-hub-v4',S.encode(snapshot));
              if(snapshot.checkpointText)c5.setItem('lambda-lab-hub-checkpoint-v4',snapshot.checkpointText);
              choice.recovery=true;
            }
          }catch(error){console.warn('运行前备份未能恢复，原始存档仍保留',error);}
        }
      }`);
 replace('    try{startup();}catch(error){\n      conflictBlocked=true;', '    try{startup();}catch(error){\n      choice.recovery=false;conflictBlocked=true;');
 replace('    root.addEventListener(\'storage\',event=>{\n      if(!backing||(event.key!==null&&!C5.LAMBDA_C5_STORAGE_KEYS.includes(event.key)))return;', `    root.addEventListener('storage',event=>{
      const changed=choice.safe&&event.key?.startsWith(choice.prefix)?event.key.slice(choice.prefix.length):event.key;
      if(!backing||(changed!==null&&!C5.LAMBDA_C5_STORAGE_KEYS.includes(changed)))return;`);
 replace("    root.addEventListener('storage',event=>{", `    if(choice.safe){
      const section=document.createElement('section');section.id='lambda-long-history';section.setAttribute('role','status');
      section.textContent=choice.recovery?'已从运行前备份恢复。较长的原始历史仍保留。':'上次历史过长，原始存档保持不变。请先导出原始存档，或导入备份选择要恢复的状态。';
      const exportButton=document.createElement('button');exportButton.type='button';exportButton.textContent='导出原始存档';
      exportButton.addEventListener('click',()=>{try{
        const storage=Object.create(null),keys=[...C5.LAMBDA_C5_STORAGE_KEYS,'lambda-lab-hub-previous-v4','lambda-lab-hub-checkpoint-previous-v4','lambda-lab-hub-before-run-latest-v1'];
        const pointer=choice.previous.getItem('lambda-lab-hub-before-run-latest-v1');if(pointer)keys.push(pointer);
        for(const key of keys){const value=choice.previous.getItem(key);if(value!==null)storage[key]=value;}
        root.LambdaDownload.save('lambda-recovery-raw.json',JSON.stringify({schemaVersion:1,type:'raw-local-storage',game:'lambda-diagram-game',storage}),'application/json');
      }catch(error){section.append(document.createTextNode(' 导出失败：'+String(error.message||error)));}});
      section.append(' ',exportButton);document.body.prepend(section);
      if(!choice.recovery){
        const dialog=document.createElement('dialog');dialog.id='lambda-long-history-choice';
        const text=document.createElement('p');text.textContent=section.textContent;
        const exportCopy=document.createElement('button');exportCopy.type='button';exportCopy.textContent='导出原始存档';exportCopy.onclick=()=>exportButton.click();
        const importCopy=document.createElement('button');importCopy.type='button';importCopy.textContent='导入备份并选择恢复';importCopy.onclick=()=>{dialog.close();document.getElementById('import-file').click()};
        const later=document.createElement('button');later.type='button';later.textContent='保留原始存档，稍后处理';later.onclick=()=>dialog.close();
        dialog.append(text,exportCopy,importCopy,later);document.body.append(dialog);if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
      }
    }
    root.addEventListener('storage',event=>{`);
 replace('    const adapter={getItem(key){', `    const adapter={saveRunBackup(text){
      assertUnblocked();S.decodeStartingState(text);
      const random=Array.from(crypto.getRandomValues(new Uint8Array(12)),x=>x.toString(16).padStart(2,'0')).join('');
      const key='lambda-lab-hub-before-run-v1.'+Date.now()+'-'+random;
      if(normalRaw.getItem(key)!==null)throw Error('运行前备份名称冲突');
      normalRaw.setItem(key,text);if(normalRaw.getItem(key)!==text)throw Error('运行前备份核验失败');
      normalRaw.setItem('lambda-lab-hub-before-run-latest-v1',key);
      if(normalRaw.getItem('lambda-lab-hub-before-run-latest-v1')!==key)throw Error('运行前备份索引核验失败');
      return key;
    },getRunBackup(){const key=normalRaw.getItem('lambda-lab-hub-before-run-latest-v1');return key===null?null:normalRaw.getItem(key);},
    latestRunBackupKey(){return normalRaw.getItem('lambda-lab-hub-before-run-latest-v1');},
    listRunBackups(){const keys=[];for(let i=0;i<(normalRaw.length||0);i++){const key=normalRaw.key(i);if(/^lambda-lab-hub-before-run-v1\\.\\d+-[0-9a-f]{24}$/.test(key))keys.push(key);}return keys.sort().reverse();},
    readRunBackup(key){if(!/^lambda-lab-hub-before-run-v1\\.\\d+-[0-9a-f]{24}$/.test(key))throw Error('备份标识无效');return normalRaw.getItem(key);},
    removeRunBackup(key,expected){assertUnblocked();if(!/^lambda-lab-hub-before-run-v1\\.\\d+-[0-9a-f]{24}$/.test(key))throw Error('备份标识无效');if(normalRaw.getItem('lambda-lab-hub-before-run-latest-v1')===key)throw Error('最新运行前备份受保护');if(normalRaw.getItem(key)!==expected)throw Error('备份已变化，请刷新列表');normalRaw.removeItem(key);},
    protectedRecovery(){return !!choice.recovery;},getItem(key){`);
 replace('    let lastAuto=null,lastCaptured=null;', `    let lastAuto=null,lastCaptured=null;
    const manage=document.createElement('button');manage.type='button';manage.className='button';manage.textContent='管理运行前备份';document.getElementById('export-state').after(manage);
    manage.addEventListener('click',()=>{
      const dialog=document.createElement('dialog');dialog.id='lambda-run-backups';
      const title=document.createElement('h2');title.textContent='运行前备份';
      const note=document.createElement('p');note.textContent='这些是自动保存的运行前快照。原存档不会自动删除；最新备份受保护。可逐项导出，确认后删除不再需要的旧备份。';
      const list=document.createElement('div'),close=document.createElement('button');close.type='button';close.textContent='关闭';
      close.onclick=()=>{if(typeof dialog.close==='function')dialog.close();dialog.remove()};
      function renderBackups(){
        list.replaceChildren();const keys=localStorage.listRunBackups();const latest=localStorage.latestRunBackupKey();
        if(!keys.length){list.textContent='暂无运行前备份';return;}
        for(const key of keys){const row=document.createElement('p'),name=document.createElement('span');const time=Number(key.split('.').pop().split('-')[0]);name.textContent=(Number.isFinite(time)?new Date(time).toLocaleString():key)+(key===latest?'（最新，受保护）':'');row.append(name,' ');
          const download=document.createElement('button');download.type='button';download.textContent='导出';download.onclick=()=>{try{const text=localStorage.readRunBackup(key);if(text===null)throw Error('备份不存在');root.LambdaDownload.save('lambda-before-run-'+time+'.json',text,'application/json');}catch(error){note.textContent='导出失败：'+String(error.message||error)}};row.append(download);
          if(key!==latest){const remove=document.createElement('button');remove.type='button';remove.textContent='删除此旧备份';remove.onclick=()=>{if(!root.confirm('将删除所选的自动运行前备份，不影响当前存档。请先确认已导出需要保留的内容。继续删除吗？'))return;try{const text=localStorage.readRunBackup(key);if(text===null)throw Error('备份不存在');localStorage.removeRunBackup(key,text);renderBackups()}catch(error){note.textContent='未删除：'+String(error.message||error)}};row.append(' ',remove)}list.append(row);
        }
      }
      dialog.append(title,note,list,close);document.body.append(dialog);renderBackups();if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
    });`);
 replace('    function prepareManualRestore() {', `    function backupBeforeRun(){
      try{localStorage.saveRunBackup(S.encodeBackup(captured(),checkpoint));return true;}
      catch(error){feedback('运行前备份失败，尚未开始运行；可在「管理运行前备份」导出并清理不需要的旧备份：'+String(error.message||error),true);return false;}
    }
    function exportBeforeRun(){
      try{const text=localStorage.getRunBackup();if(!text)throw Error('没有运行前备份');root.LambdaDownload.save('lambda-before-run.json',text,'application/json');feedback('检测到循环，已请求导出运行前存档；请在系统窗口选择保存位置。');}
      catch(error){feedback('自动导出未能启动，运行前备份仍在本机：'+String(error.message||error),true);}
    }
    function restoreProtected(){
      if(!localStorage.protectedRecovery())return false;
      try{const text=localStorage.getItem(AUTO);if(!text)return false;apply(S.decode(text,{compact:true}));return true;}
      catch(error){feedback('原运行前备份仍保留，自动恢复失败：'+String(error.message||error),true);return false;}
    }
    function prepareManualRestore() {`);
 replace('persist,queueSave,prepareManualRestore,\n      beginSession:', 'persist,queueSave,prepareManualRestore,backupBeforeRun,exportBeforeRun,restoreProtected,\n      beginSession:');
 replace("    $('import-file').addEventListener('change',async()=>{", `    function selectRecoverySnapshot(text){
      let archive;try{archive=JSON.parse(text)}catch{return text}
      if(!archive||archive.type!=='raw-local-storage'||archive.game!=='lambda-diagram-game')return text;
      if(!archive.storage||typeof archive.storage!=='object'||Array.isArray(archive.storage))throw new C.LambdaError('原始恢复文件格式不正确。');
      const keys=Object.keys(archive.storage).filter(key=>/^(lambda-hub-safe-workspace-v1\\.\\d+\\.)?lambda-lab-(hub-)?(before-run-v1\\.|previous-v[24]$|checkpoint-previous-v[24]$|legacy-v[34]$|hub-v[34]$|hub-checkpoint-v[34]$|v[12]$|checkpoint-v2$)/.test(key));
      const candidates=[],seen=new Set();let longCount=0;
      for(const key of keys.slice(0,128)){
        const raw=archive.storage[key];if(typeof raw!=='string'||seen.has(raw))continue;
        try{const state=S.decodeStartingState(raw);const parsed=JSON.parse(raw);let importText=raw,compacted=false;
          if((parsed.session?.steps??0)>256||(parsed.checkpoint?.session?.steps??0)>256){
            const session=parsed.session,choiceFree=!session?.paths&&(!session?.choices||session.choices.length===0);
            const result=choiceFree&&!(parsed.checkpoint?.session?.steps>256)&&state.session.original?root.LambdaTrace.step(state.session.original,null):null;
            if(!result||JSON.stringify(result.term)!==JSON.stringify(state.session.original)){longCount++;continue;}
            const compact={...parsed,session:{...session,original:state.session.original,steps:0,halt:''}};delete compact.session.paths;delete compact.session.choices;
            importText=JSON.stringify(compact);S.decodeStartingState(importText);compacted=true;
          }
          seen.add(raw);candidates.push({key,raw,importText,compacted,draft:String(state.draft||'').replace(/[\\r\\n]+/g,' ').slice(0,60)});
        }catch{}
      }
      if(!candidates.length)throw new C.LambdaError(longCount?'恢复文件中的历史太长，暂不能安全导入；原始文件保持不变。':'已检查前 128 个相关存储项，未找到可识别的存档；原始文件保持不变。');
      const options=candidates.map((c,i)=>(i+1)+'. '+c.key+' · '+c.draft+(c.compacted?' · 自循环历史保留原文件，本次恢复当前表达式和设置':'')).join('\\n');
      const choice=root.prompt('请选择要恢复的存档编号。原始恢复文件不会被修改。'+(longCount?' 部分超长历史暂不可导入。':'')+(keys.length>128?' 仅显示前 128 个相关存储项，其他数据保留在原文件。':'')+'\\n'+options,'1');
      if(choice===null)return null;const n=Number(choice);
      if(!Number.isInteger(n)||n<1||n>candidates.length)throw new C.LambdaError('存档编号无效，未修改当前内容。');
      const selected=candidates[n-1];if(selected.compacted)localStorage.saveRunBackup(selected.raw);return selected.importText;
    }
    $('import-file').addEventListener('change',async()=>{`);
 replace("try{if(file.size>S.MAX_BYTES)throw new C.LambdaError('存档文件超过 2 MiB 上限。');const snapshot=await replaySave(await file.text());", "try{if(file.size>8*1024*1024)throw new C.LambdaError('恢复文件超过 8 MiB 上限。');const selected=selectRecoverySnapshot(await file.text());if(selected===null)return;if(new TextEncoder().encode(selected).length>S.MAX_BYTES)throw new C.LambdaError('所选存档超过 2 MiB 上限。');const snapshot=await replaySave(selected);");
 replace('    const interpreter=window.LambdaMeta.isProgram(state.original);','    if(!workspace.backupBeforeRun())return;\n    const interpreter=window.LambdaMeta.isProgram(state.original);');
 replace('  function advance(path=null,display=true) {\n    if(!state.term||state.dirty||rewindJob) return false;', '  function advance(path=null,display=true) {\n    if(!state.term||state.dirty||rewindJob) return false;\n    if(!state.running&&!workspace.backupBeforeRun())return false;');
 replace("        stop();state.halt=growth?'检测到递归展开无限增长，自动运行已停止。可以回退、单步或调整归约顺序。':'检测到重复归约循环，自动运行已停止。可以回退、单步或调整归约顺序。';", "        stop();state.halt=growth?'检测到递归展开无限增长，自动运行已停止。可以回退、单步或调整归约顺序。':'检测到重复归约循环，自动运行已停止。可以回退、单步或调整归约顺序。';workspace.exportBeforeRun();");
 return html;
}
