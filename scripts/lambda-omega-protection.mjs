/** Apply only to the pinned, reviewed Lambda resource. */
export function protectLambdaOmega(source) {
 let html=source;
 function replace(a,b){if(html.split(a).length!==2)throw Error('Lambda Omega integration marker changed: '+a);html=html.replace(a,b)}
 replace('async function convert() {','async function convert({initial=false}={}) {');
 replace('    cancelRewind();\n    cancelConversion();const controller=new AbortController();', '    if(!initial&&workspace&&!workspace.backupBeforeRun())return false;\n    cancelRewind();\n    cancelConversion();const controller=new AbortController();');
 replace('function render(duration=0,undone=null) {','function render(duration=0,undone=null,suppressSave=false) {');
 replace('    renderDiagram(redex,duration,undone);\n    save();','    renderDiagram(redex,duration,undone);\n    if(!suppressSave)save();');
 replace('state.autoFit=true; render(); save(); return true;','state.autoFit=true; render(0,null,initial); if(!initial)save(); return true;');
 replace('workspace.prepareManualRestore();renderMode();convert();lastAutosaveSnapshot=JSON.stringify(capture());initializing=false;','workspace.prepareManualRestore();renderMode();convert({initial:true});lastAutosaveSnapshot=JSON.stringify(capture());initializing=false;');
 replace('    const adapter={getItem(key){', `    const adapter={saveRunBackup(text){
      assertUnblocked();S.decodeStartingState(text);
      const random=Array.from(crypto.getRandomValues(new Uint8Array(12)),x=>x.toString(16).padStart(2,'0')).join('');
      const key='lambda-lab-hub-before-run-v1.'+Date.now()+'-'+random;
      if(raw.getItem(key)!==null)throw Error('运行前备份名称冲突');
      raw.setItem(key,text);if(raw.getItem(key)!==text)throw Error('运行前备份核验失败');
      raw.setItem('lambda-lab-hub-before-run-latest-v1',key);
      if(raw.getItem('lambda-lab-hub-before-run-latest-v1')!==key)throw Error('运行前备份索引核验失败');
      return key;
    },getRunBackup(){const key=raw.getItem('lambda-lab-hub-before-run-latest-v1');return key===null?null:raw.getItem(key);},getItem(key){`);
 replace('    function prepareManualRestore() {', `    function backupBeforeRun(){
      try{localStorage.saveRunBackup(S.encodeBackup(captured(),checkpoint));return true;}
      catch(error){feedback('运行前备份失败，尚未开始运行：'+String(error.message||error),true);return false;}
    }
    function exportBeforeRun(){
      try{const text=localStorage.getRunBackup();if(!text)throw Error('没有运行前备份');root.LambdaDownload.save('lambda-before-run.json',text,'application/json');feedback('检测到循环，已请求导出运行前存档；请在系统窗口选择保存位置。');}
      catch(error){feedback('自动导出未能启动，运行前备份仍在本机：'+String(error.message||error),true);}
    }
    function prepareManualRestore() {`);
 replace('persist,queueSave,prepareManualRestore,\n      beginSession:', 'persist,queueSave,prepareManualRestore,backupBeforeRun,exportBeforeRun,\n      beginSession:');
 replace("    $('import-file').addEventListener('change',async()=>{", `    function selectRecoverySnapshot(text){
      let archive;try{archive=JSON.parse(text)}catch{return text}
      if(!archive||archive.type!=='raw-local-storage'||archive.game!=='lambda-diagram-game')return text;
      if(!archive.storage||typeof archive.storage!=='object'||Array.isArray(archive.storage))throw new C.LambdaError('原始恢复文件格式不正确。');
      const keys=Object.keys(archive.storage).filter(key=>/^lambda-lab-(hub-)?(before-run-v1\\.|previous-v[24]$|checkpoint-previous-v[24]$|hub-v[34]$|hub-checkpoint-v[34]$|v[12]$|checkpoint-v2$)/.test(key));
      const candidates=[],seen=new Set();let longCount=0;
      for(const key of keys.slice(0,128)){
        const raw=archive.storage[key];if(typeof raw!=='string'||seen.has(raw))continue;
        try{const state=S.decodeStartingState(raw);const parsed=JSON.parse(raw);
          if((parsed.session?.steps??0)>256||(parsed.checkpoint?.session?.steps??0)>256){longCount++;continue;}
          seen.add(raw);candidates.push({key,raw,draft:String(state.draft||'').replace(/[\\r\\n]+/g,' ').slice(0,60)});
        }catch{}
      }
      if(!candidates.length)throw new C.LambdaError(longCount?'恢复文件中的历史太长，暂不能安全导入；原始文件保持不变。':'恢复文件没有可识别的存档；原始文件保持不变。');
      const options=candidates.map((c,i)=>(i+1)+'. '+c.key+' · '+c.draft).join('\\n');
      const choice=root.prompt('请选择要恢复的存档编号。原始恢复文件不会被修改。'+(longCount?' 部分超长历史暂不可导入。':'')+'\\n'+options,'1');
      if(choice===null)return null;const n=Number(choice);
      if(!Number.isInteger(n)||n<1||n>candidates.length)throw new C.LambdaError('存档编号无效，未修改当前内容。');
      return candidates[n-1].raw;
    }
    $('import-file').addEventListener('change',async()=>{`);
 replace("try{if(file.size>S.MAX_BYTES)throw new C.LambdaError('存档文件超过 2 MiB 上限。');const snapshot=await replaySave(await file.text());", "try{if(file.size>8*1024*1024)throw new C.LambdaError('恢复文件超过 8 MiB 上限。');const selected=selectRecoverySnapshot(await file.text());if(selected===null)return;if(new TextEncoder().encode(selected).length>S.MAX_BYTES)throw new C.LambdaError('所选存档超过 2 MiB 上限。');const snapshot=await replaySave(selected);");
 replace('    const interpreter=window.LambdaMeta.isProgram(state.original);','    if(!workspace.backupBeforeRun())return;\n    const interpreter=window.LambdaMeta.isProgram(state.original);');
 replace('  function advance(path=null,display=true) {\n    if(!state.term||state.dirty||rewindJob) return false;', '  function advance(path=null,display=true) {\n    if(!state.term||state.dirty||rewindJob) return false;\n    if(!state.running&&!workspace.backupBeforeRun())return false;');
 replace("        stop();state.halt=growth?'检测到递归展开无限增长，自动运行已停止。可以回退、单步或调整归约顺序。':'检测到重复归约循环，自动运行已停止。可以回退、单步或调整归约顺序。';", "        stop();state.halt=growth?'检测到递归展开无限增长，自动运行已停止。可以回退、单步或调整归约顺序。':'检测到重复归约循环，自动运行已停止。可以回退、单步或调整归约顺序。';workspace.exportBeforeRun();");
 return html;
}
