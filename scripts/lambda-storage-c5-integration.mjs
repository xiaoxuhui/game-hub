import { readFileSync } from 'node:fs';
import { sha256 } from './resource-protocol.mjs';

export const LAMBDA_C5_INTEGRATION = 'lambda-content4-storage-c5-manual-restore-v1';
const c5Module = readFileSync(new URL('./lambda-storage-c5.mjs', import.meta.url), 'utf8');
const legacyFixtureBytes = readFileSync(new URL('../tests/fixtures/lambda-content3-reader.json', import.meta.url));
const legacyFixture = JSON.parse(legacyFixtureBytes.toString('utf8'));

function c5ApiSource() {
  if (/^\s*import\s/m.test(c5Module)) throw Error('C5 browser module must remain dependency-free');
  return c5Module.replace(/^export\s+/gm, '');
}

function oldReaderSource() {
  const indices = legacyFixture.scripts.map((_, index) => index);
  if (!Array.isArray(legacyFixture.scriptIndexes) || legacyFixture.scriptIndexes.length !== 4 || indices.length !== 4 || indices.some(i => typeof legacyFixture.scripts[i] !== 'string')) {
    throw Error('Fixed issued content3 reader fixture is invalid');
  }
  return indices.map(i => {
    const source = legacyFixture.scripts[i];
    if (/<\/script/i.test(source)) throw Error('Legacy reader fixture cannot be embedded in HTML script');
    return `(function(globalThis,window){\n${source}\n})(legacyRoot,legacyRoot);`;
  }).join('\n');
}

export function lambdaC5IntegrationProof() {
  return {
    id: LAMBDA_C5_INTEGRATION,
    storageAdapterSha256: sha256(Buffer.from(c5Module)),
    legacyReaderFixtureSha256: sha256(legacyFixtureBytes)
  };
}

export function lambdaC5BrowserAdapterSource() {
  return `const localStorage=(function(root){
    'use strict';
    const legacyRoot={};
    ${oldReaderSource()}
    const OldS=legacyRoot.LambdaSnapshot;
    const C5=(()=>{${c5ApiSource()}\nreturn {captureLambdaC5Snapshot,inspectLambdaC5Storage,resolveLambdaC5Storage,createLambdaC5Storage,LAMBDA_C5_STORAGE_KEYS};})();
    const unavailable={getItem(){return null;},setItem(){throw new Error('浏览器存储不可用');},removeItem(){throw new Error('浏览器存储不可用');}};
    let backing;
    try{backing=root.localStorage;}catch{backing=null;}
    const raw=backing||unavailable;
    const c5=C5.createLambdaC5Storage(raw,S,OldS,{eventTarget:backing?root:null});
    const safeExport=(reason,snapshot)=>{
      const payload=JSON.stringify({schemaVersion:1,game:'lambda-diagram-game',reason,exportedAt:new Date().toISOString(),storage:snapshot},null,2);
      try{root.LambdaDownload.save('lambda-lab-storage-recovery.json',payload,'application/json');return true;}
      catch(error){return String(error?.message||error);}
    };
    let dialog=null,dialogBody=null,dialogStatus=null,conflictBlocked=false;
    function ensureDialog(){
      if(dialog)return dialog;
      dialog=document.createElement('dialog');dialog.id='lambda-c5-review';dialog.setAttribute('aria-labelledby','lambda-c5-title');
      dialog.innerHTML='<form method="dialog" class="lambda-c5-card"><h2 id="lambda-c5-title"></h2><p id="lambda-c5-description"></p><div id="lambda-c5-options"></div><p id="lambda-c5-status" role="status" aria-live="polite"></p></form>';
      const style=document.createElement('style');style.textContent='#lambda-c5-review{max-width:min(38rem,calc(100vw - 2rem));max-height:calc(100dvh - 2rem);overflow:auto;border:1px solid #64748b;border-radius:1rem;padding:0;background:#fff;color:#172033;box-shadow:0 1rem 4rem #0006}#lambda-c5-review::backdrop{background:#101827b8}#lambda-c5-review .lambda-c5-card{padding:1.25rem;display:grid;gap:.75rem}#lambda-c5-review h2{margin:0;font-size:1.2rem}#lambda-c5-review p{margin:0;line-height:1.5}#lambda-c5-review #lambda-c5-options{display:grid;gap:.5rem}#lambda-c5-review button{min-height:2.75rem;padding:.55rem .8rem;border:1px solid #64748b;border-radius:.6rem;background:#f8fafc;color:inherit;text-align:left;font:inherit;cursor:pointer}#lambda-c5-review button:focus-visible{outline:3px solid #2563eb;outline-offset:2px}#lambda-c5-review [data-kind="danger"]{border-color:#b91c1c;color:#991b1b}';document.head.append(style);document.body.append(dialog);
      dialogBody=dialog.querySelector('#lambda-c5-options');dialogStatus=dialog.querySelector('#lambda-c5-status');
      dialog.addEventListener('cancel',event=>event.preventDefault());return dialog;
    }
    function show(title,description){
      const node=ensureDialog();node.querySelector('#lambda-c5-title').textContent=title;
      node.querySelector('#lambda-c5-description').textContent=description;dialogBody.replaceChildren();dialogStatus.textContent='';
      if(!node.open){if(typeof node.showModal==='function')node.showModal();else node.setAttribute('open','');}
      return node;
    }
    function button(label,action,{danger=false}={}){
      const b=document.createElement('button');b.type='button';b.textContent=label;if(danger)b.dataset.kind='danger';
      b.addEventListener('click',action);dialogBody.append(b);return b;
    }
    function needsReview(group){return group.status==='conflict'||group.status==='tombstone';}
    function updateReview(notice=''){
      const inspection=C5.inspectLambdaC5Storage(raw,S,OldS);
      const pending=['current','checkpoint'].find(kind=>needsReview(inspection[kind]));
      if(!pending){conflictBlocked=false;if(dialog?.open)dialog.close();root.location.reload();return;}
      conflictBlocked=true;
      const group=inspection[pending],name=pending==='current'?'当前存档':'检查点';
      show('检测到Lambda存档冲突',name+'存在多个版本或未完成的写入记录。原始值会先归档；请选择要继续使用的版本。取消不会写入。');
      dialogStatus.textContent=notice;
      for(const candidate of group.candidates){
        const s=candidate.summary||{};
        const draft=String(s.draft||''),preview=draft.length>96?draft.slice(0,96)+'…':draft;
        const label=(candidate.id==='v4'?'新版完整存档':candidate.id==='v3'?'旧版三代存档':'旧版二代存档')+
          ' · 已完成 '+String(s.completed??'未知')+' · 模式 '+String(s.mode??'未知')+' · 关卡 '+String(s.level??'未知')+' · 表达式 '+preview;
        button(label,()=>resolveChoice(pending,candidate.id,inspection));
      }
      if(group.tombstone)button('保留“已清除”的检查点',()=>resolveChoice(pending,'clear',inspection),{danger:true});
      if(group.candidates.length===0)button('归档后清空损坏存档',()=>resolveChoice(pending,'clear',inspection),{danger:true});
      button('导出当前全部原始存档',()=>{
        const result=safeExport('conflict-review',inspection.snapshot);
        dialogStatus.textContent=result===true?'已请求下载当前预览对应的全部原始存档。':'导出失败：'+String(result);
      });
      button('取消并保留全部原始数据',()=>{dialogStatus.textContent='已取消；所有存档原文均未改动。关闭此页后可稍后再选择。'});
    }
    function resolveChoice(kind,choice,inspection){
      try{
        C5.resolveLambdaC5Storage(raw,S,OldS,{kind,choice,inspection});
        updateReview();
      }catch(error){
        if(/changed since conflict inspection/.test(String(error?.message||error)))updateReview('存档在预览后发生变化，尚未写入。请检查刷新的候选内容后重新选择。');
        else dialogStatus.textContent='处理失败，原始存档仍保留：'+String(error?.message||error);
      }
    }
    function startup(){
      if(!backing)return;
      let inspection=C5.inspectLambdaC5Storage(raw,S,OldS);
      for(const kind of ['current','checkpoint']){
        const group=inspection[kind];
        if(group.status==='migrate'){
          C5.resolveLambdaC5Storage(raw,S,OldS,{kind,choice:group.autoChoice,inspection});
          inspection=C5.inspectLambdaC5Storage(raw,S,OldS);
        }
      }
      if(!needsReview(inspection.current)&&!needsReview(inspection.checkpoint)&&inspection.current.status==='empty'){
        const legacy=raw.getItem('lambda-lab-v1');
        if(legacy!==null&&raw.getItem('lambda-lab-hub-legacy-v4')===null){S.decode(legacy);c5.setItem('lambda-lab-hub-legacy-v4',legacy);}
      }
      if(needsReview(inspection.current)||needsReview(inspection.checkpoint))updateReview();
    }
    try{startup();}catch(error){
      conflictBlocked=true;
      const snapshot=(()=>{try{return C5.captureLambdaC5Snapshot(raw);}catch{return null;}})();
      const node=show('Lambda存档需要处理','自动恢复已停止，原始数据未清空。详细原因：'+String(error?.message||error));
      button('导出全部原始存档',()=>{const result=safeExport('startup-error',snapshot);dialogStatus.textContent=result===true?'已请求下载原始数据导出文件。':'导出失败：'+String(result);});
      button('关闭并保留原始数据',()=>{dialogStatus.textContent='页面已停在此处；原始存档保持不变。'});
    }
    root.addEventListener('storage',event=>{
      if(!backing||(event.key!==null&&!C5.LAMBDA_C5_STORAGE_KEYS.includes(event.key)))return;
      conflictBlocked=true;
      const snapshot=c5.exportObserved();
      const node=show('另一个页面修改了Lambda存档','为避免覆盖其他页面的进度，本页面已停止写入。请导出本页观察到的全部存档原文后重新打开游戏。');
      button('导出观察到的全部存档',()=>{try{root.LambdaDownload.save('lambda-lab-storage-recovery.json',snapshot,'application/json');dialogStatus.textContent='已请求下载导出文件。';}catch(error){dialogStatus.textContent='导出失败：'+String(error?.message||error);}});
      button('重新加载',()=>root.location.reload());
    });
    const mapped=new Map([['lambda-lab-v2','lambda-lab-hub-v4'],['lambda-lab-checkpoint-v2','lambda-lab-hub-checkpoint-v4'],['lambda-lab-v1','lambda-lab-hub-legacy-v4']]);
    const assertUnblocked=()=>{if(conflictBlocked)throw new Error('Lambda存档冲突尚未处理；当前页面已停止读取和写入。');};
    const adapter={getItem(key){assertUnblocked();return c5.getItem(mapped.get(key)||key);},removeItem(key){assertUnblocked();return c5.removeItem(mapped.get(key)||key);},setItem(key,value){
      assertUnblocked();
      try{return c5.setItem(mapped.get(key)||key,value);}catch(error){
        if(error?.name==='QuotaExceededError'||/quota|storage full|配额/i.test(String(error?.message||''))){
          const snapshot=C5.captureLambdaC5Snapshot(raw);show('设备存储空间不足','自动存档未能写入。现有存档保持原样；请先导出恢复文件，再清理设备空间。');
          button('导出全部Lambda存档',()=>{const result=safeExport('quota',snapshot);dialogStatus.textContent=result===true?'已请求下载导出文件。':'导出失败：'+String(result);});
          button('保留存档并关闭提示',()=>{dialogStatus.textContent='原存档未被本次写入覆盖。'});
        }
        throw error;
      }
    }};
    root.LambdaC5Recovery={exportObserved:()=>c5.exportObserved()};
    return adapter;
  })(root);
  const AUTO='lambda-lab-hub-v4',CHECKPOINT='lambda-lab-hub-checkpoint-v4',LEGACY='lambda-lab-hub-legacy-v4';`;
}

export function lambdaC5AdapterEvidence() {
  return {
    integration: LAMBDA_C5_INTEGRATION,
    browserAdapterSha256: sha256(Buffer.from(lambdaC5BrowserAdapterSource())),
    ...lambdaC5IntegrationProof()
  };
}

export function lambdaManualRestoreHtml(source) {
  const replacements = [
    ["let functions=[],checkpoint=null,saveTimer=null,restoring=false,editing=null;", "let functions=[],checkpoint=null,saveTimer=null,restoring=false,editing=null,autosaveReady=false;"],
    ["function persist() {", "function persist(explicit=false) {"],
    ["function persist(explicit=false) {\n      clearTimeout(saveTimer);", "function persist(explicit=false) {\n      if(explicit===true)autosaveReady=true;\n      clearTimeout(saveTimer);"],
    ["clearTimeout(saveTimer);if(restoring)return;", "clearTimeout(saveTimer);if(restoring||(!autosaveReady&&explicit!==true))return;"],
    ["function queueSave(){if(!restoring){", "function queueSave(){autosaveReady=true;if(!restoring){"],
    ["return {expand:t=>L.expand(t,functions),persist,queueSave,restoreInitial};", "return {expand:t=>L.expand(t,functions),persist,queueSave,prepareManualRestore};"],
    ["function save() { workspace?.queueSave(); }", "let initializing=true;function save() { if(!initializing)workspace?.queueSave(); }"],
    ["if(!workspace.restoreInitial()){renderMode();convert();}\n  workspace.persist();", "workspace.prepareManualRestore();renderMode();convert();initializing=false;"]
  ];
  let html=source;
  for(const [before,after] of replacements){if(html.split(before).length!==2)throw new Error('Lambda manual-restore integration requires exact reviewed markers');html=html.replace(before,after);}
  const start="    function restoreInitial() {",end="    $('function-form').addEventListener";
  if(html.split(start).length!==2||html.split(end).length!==2)throw new Error('Lambda manual-restore handler markers');
  const from=html.indexOf(start),to=html.indexOf(end,from);
  if(to<=from)throw new Error('Lambda manual-restore handler boundary');
  const handler=`    function prepareManualRestore() {
      try {
        // Keep the local session available, but never replace the fresh page on startup.
        // The existing restore button is the explicit opt-in for the local save point/session.
        const text=localStorage.getItem(CHECKPOINT)||localStorage.getItem(AUTO)||localStorage.getItem(LEGACY);
        if(text){const snapshot=S.decode(text);checkpoint=S.encode(snapshot);}
      }catch(e){feedback('本机存档无法读取：'+String(e?.message||e)+'。可通过“导入存档”载入备份。',true);}
      $('restore-state').disabled=!checkpoint;
      $('storage-status').textContent=checkpoint?'本机存档已保留，可手动恢复':'已打开新会话';
      renderLibrary();
    }
`;
  html=html.slice(0,from)+handler+html.slice(to);
  const explicitHandlers = [
    ["$('save-state').addEventListener", "$('restore-state').addEventListener"],
    ["$('restore-state').addEventListener", "$('export-state').addEventListener"],
    ["$('clear-all').addEventListener", "$('import-state').addEventListener"],
    ["$('import-file').addEventListener", "window.addEventListener('pagehide'"]
  ];
  for(const [start,end] of explicitHandlers){
    const from=html.indexOf(start),to=html.indexOf(end,from+start.length);
    if(from<0||to<=from)throw new Error('Lambda manual-restore explicit-action handler drift');
    const section=html.slice(from,to);
    if(!section.includes('persist();'))throw new Error('Lambda manual-restore explicit-action write missing');
    html=html.slice(0,from)+section.replace(/persist\(\);/g,'persist(true);')+html.slice(to);
  }
  return html;
}
