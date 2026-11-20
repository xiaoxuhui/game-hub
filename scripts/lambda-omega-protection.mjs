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
 replace('    const interpreter=window.LambdaMeta.isProgram(state.original);','    if(!workspace.backupBeforeRun())return;\n    const interpreter=window.LambdaMeta.isProgram(state.original);');
 replace('  function advance(path=null,display=true) {\n    if(!state.term||state.dirty||rewindJob) return false;', '  function advance(path=null,display=true) {\n    if(!state.term||state.dirty||rewindJob) return false;\n    if(!state.running&&!workspace.backupBeforeRun())return false;');
 replace("        stop();state.halt=growth?'检测到递归展开无限增长，自动运行已停止。可以回退、单步或调整归约顺序。':'检测到重复归约循环，自动运行已停止。可以回退、单步或调整归约顺序。';", "        stop();state.halt=growth?'检测到递归展开无限增长，自动运行已停止。可以回退、单步或调整归约顺序。':'检测到重复归约循环，自动运行已停止。可以回退、单步或调整归约顺序。';workspace.exportBeforeRun();");
 return html;
}
