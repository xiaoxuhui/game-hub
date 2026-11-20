import fs from 'node:fs';

// Apply to the reviewed, pinned resource so older published adapters remain reproducible.
export function quotaReadonly(input) {
  let html = input;
  const replace = (before, after) => {
    if (!html.includes(before) || html.indexOf(before) !== html.lastIndexOf(before)) throw Error(`Expected exactly one marker: ${before.slice(0, 90)}`);
    html = html.replace(before, after);
  };
  replace("try{const token=String(Date.now())+'-'+Math.random();source.setItem(pendingKey,JSON.stringify({prefix,token}));choice.pendingToken=token;}\n        catch{return {storage:unavailable,safe:true,prefix:'',previous:active,overflow:true,timedOut:true};}", "const token=String(Date.now())+'-'+Math.random();choice.pendingToken=token;choice.pendingMarker=JSON.stringify({prefix,token});");
  replace('    let sessionArchived=false;', '    let sessionArchived=false,quotaReadOnly=false;');
  replace('    try{if(backing)ensureSessionArchive();startup();}catch(error){', `    let archiveError=null;
    try{if(backing)ensureSessionArchive();if(choice.pendingMarker)normalRaw.setItem(pendingKey,choice.pendingMarker);}catch(error){archiveError=error;}
    if(archiveError&&(archiveError.name==='QuotaExceededError'||archiveError.code===22||archiveError.code===1014||/quota|exceeded|配额/i.test(String(archiveError.message||'')))){
      quotaReadOnly=true;
      const node=show('本机存储空间不足','无法创建保护副本。所有原始存档和备份保持不变。可以先导出，再只读打开并手动查看保存的状态；只读模式不会自动保存新修改。');
      button('导出所有本机存档',()=>{try{root.LambdaDownload.save('lambda-all-local-data.json',adapter.exportAllLocal(),'application/json');dialogStatus.textContent='已请求导出，请在系统窗口确认保存。';}catch(error){dialogStatus.textContent='导出失败：'+String(error.message||error);}});
      button('只读打开',()=>{node.close();});
    }else try{if(archiveError)throw archiveError;startup();}catch(error){`);
  replace('    if(choice.safe){\n      const section=', '    if(choice.safe&&!quotaReadOnly){\n      const section=');
  replace('    const adapter={ensureSessionArchive(){assertUnblocked();ensureSessionArchive();},', "    const assertWritable=()=>{assertUnblocked();if(quotaReadOnly)throw Error('只读模式无法保存，请先导出存档并释放本游戏的存储配额。');};\n    const adapter={quotaReadOnly(){return quotaReadOnly;},ensureSessionArchive(){assertWritable();ensureSessionArchive();},");
  replace('      assertUnblocked();S.decodeStartingState(text);', '      assertWritable();S.decodeStartingState(text);');
  replace('removeRunBackup(key,expected){assertUnblocked();', 'removeRunBackup(key,expected){assertWritable();');
  replace('finishStartup(){if(!choice.pendingToken)return;', 'finishStartup(){if(quotaReadOnly||!choice.pendingToken)return;');
  replace('getItem(key){assertUnblocked();return backups.has(key)?raw.getItem(backups.get(key)):c5.getItem(mapped.get(key)||key);},removeItem(key){assertUnblocked();', 'getItem(key){assertUnblocked();const source=quotaReadOnly&&choice.timedOut&&choice.previous?choice.previous:raw;return backups.has(key)?source.getItem(backups.get(key)):quotaReadOnly?source.getItem(mapped.get(key)||key):c5.getItem(mapped.get(key)||key);},removeItem(key){assertWritable();');
  replace('setItem(key,value){\n      assertUnblocked();', 'setItem(key,value){\n      assertWritable();');
  replace("        storageLocked=false;\n        $('storage-status').textContent=checkpoint?'本机存档已保留，可手动恢复':'已打开新会话';", "        storageLocked=localStorage.quotaReadOnly();\n        $('storage-status').textContent=storageLocked?'只读模式：原存档保留，新修改不会自动保存':checkpoint?'本机存档已保留，可手动恢复':'已打开新会话';");
  replace("try{const snapshot=await replaySave(checkpoint);storeSnapshot(snapshot,{allowProtected:true});apply(snapshot);lastCaptured=signature(captured());feedback('已恢复保存时的状态。自动运行保持暂停，可单步或继续运行。');api.toast('已恢复当前状态');}", "try{const snapshot=await replaySave(checkpoint);if(!localStorage.quotaReadOnly())storeSnapshot(snapshot,{allowProtected:true});apply(snapshot);lastCaptured=signature(captured());feedback(localStorage.quotaReadOnly()?'已只读查看保存时的状态；新修改不会自动保存。':'已恢复保存时的状态。自动运行保持暂停，可单步或继续运行。');api.toast(localStorage.quotaReadOnly()?'已只读查看':'已恢复当前状态');}");
  return html;
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/lambda-quota-readonly.mjs')) {
  fs.writeFileSync(process.argv[3], quotaReadonly(fs.readFileSync(process.argv[2], 'utf8')));
}
