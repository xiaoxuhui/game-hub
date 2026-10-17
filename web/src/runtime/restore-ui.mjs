import {decodeBackup,decodeHistoryRecord,MAX_BACKUP_BYTES} from './save-backup.mjs';
import {validateNativeSave} from './native-save.mjs';
import {downloadSnapshot} from './backup-download.mjs';
const element=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
const button=(id,text)=>{const node=element('button',text);node.id=id;node.type='button';return node;};
const sha256=async bytes=>{if(!globalThis.crypto?.subtle)throw Error('浏览器缺少安全文件摘要能力，请通过HTTPS打开');return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');};
export function mountRestore({bar,saves,context,gameRoot}){
  const open=button('game-hub-restore','恢复'),dialog=element('dialog'),heading=element('h2','恢复游戏存档'),explain=element('p','仅恢复当前游戏。先校验并预览，确认后完整替换；原存档自动备份。游戏原生文件请使用游戏内的导入功能。');
  dialog.id='hub-restore-dialog';heading.id='hub-restore-title';dialog.setAttribute('aria-labelledby',heading.id);
  const fileLabel=element('label','选择大厅完整备份文件'),input=element('input');input.id='hub-restore-file';input.type='file';input.accept='.json,application/json';fileLabel.append(input);
  const historyLabel=element('label','本机自动备份'),history=element('select');history.id='hub-restore-history';history.append(new Option('请选择历史快照',''));historyLabel.append(history);
  const provenance=element('p','历史快照未记录原游戏版本；预览使用当前游戏校验。文件中的游戏版本表示导出时的读取器版本。'),message=element('p'),preview=element('pre');message.id='hub-restore-message';message.setAttribute('role','status');preview.id='hub-restore-preview';
  const actions=element('div'),confirm=button('hub-restore-confirm','确认完整替换'),close=button('hub-restore-close','取消'),reload=button('hub-restore-reload','重新打开游戏');confirm.disabled=true;reload.hidden=true;
  actions.append(confirm,reload,close);dialog.append(heading,explain,fileLabel,historyLabel,provenance,message,preview,actions);document.body.append(dialog);bar.append(open);
  const original=button('hub-restore-export-original','导出本页原档');original.disabled=!saves.snapshot().canonicalRead;original.title='本页最后确认的完整存档，可能不是另一标签的最新数据；与未保存草稿分别导出';dialog.insertBefore(original,fileLabel);original.addEventListener('click',()=>downloadSnapshot(context,saves.committedSnapshot(),'original'));
  const draft=button('hub-restore-export-draft','导出本页草稿');draft.title='未保存草稿单独导出，不能直接当完整正式备份恢复';dialog.insertBefore(draft,fileLabel);draft.addEventListener('click',()=>downloadSnapshot(context,saves.snapshot(),'draft'));
  let generation=0,queue=Promise.resolve(),selected=null,rows=[],restoring=false,requiresReload=false;
  function invalidate(){generation++;selected=null;confirm.disabled=true;preview.textContent='';saves.cancelRestore();}
  function schedule(load){
    invalidate();const revision=generation;message.textContent='正在校验备份…';
    // Serialize previews so an older async native validation/flush cannot replace
    // the private session token after a newer file was selected or dialog closed.
    queue=queue.catch(()=>{}).then(async()=>{
      if(revision!==generation)return;
      try{
        const candidate=await load();if(revision!==generation)return;
        const digest=await sha256(candidate.bytes),entries=await validateNativeSave(context,candidate.entries,gameRoot);if(revision!==generation)return;
        const confirmation=await saves.prepareRestore(entries);if(revision!==generation){saves.cancelRestore();return;}
        selected={token:confirmation.token,digest};
        preview.textContent=`${context.name}\n${candidate.description}\nSHA-256: ${digest}\n将导入 ${confirmation.keys} 项，完整替换当前 ${confirmation.replacedKeys} 项\n${confirmation.protectedOriginal?'受保护原档将被替换，原始字节自动备份；可先导出或取消。\n':''}${confirmation.hasDraft?'本页未保存草稿不会写入恢复结果；请先导出草稿，重新打开后本页草稿将丢失。\n':''}当前存档 revision: ${confirmation.expected.revision}\n${entries.map(([key,value])=>`${key.slice(0,120)} · ${value.length} 字符`).join('\n')}`;
        message.textContent='校验通过。请核对后确认，或取消保留当前存档。';confirm.disabled=false;
      }catch(error){if(revision===generation){message.textContent='无法恢复：'+error.message;confirm.disabled=true;}}
    });
  }
  input.addEventListener('change',()=>{
    history.value='';const file=input.files[0];if(!file){invalidate();message.textContent='请选择文件';return;}
    schedule(async()=>{if(file.size===0||file.size>MAX_BACKUP_BYTES)throw Error('备份为空或超过256MiB上限');const bytes=new Uint8Array(await file.arrayBuffer()),backup=decodeBackup(bytes,context);return {bytes,entries:backup.entries,description:`导出读取器 ${backup.gameVersion} · ${backup.createdAt}`};});
  });
  history.addEventListener('change',()=>{
    input.value='';const row=rows[Number(history.value)];if(history.value===''||!row){invalidate();message.textContent='请选择历史快照';return;}
    schedule(async()=>{const bytes=new TextEncoder().encode(JSON.stringify(row.record)),record=decodeHistoryRecord(bytes,context);return {bytes,entries:record.entries,description:`本机历史快照 · revision ${record.revision} · 原版本未记录`};});
  });
  open.addEventListener('click',()=>{
    if(requiresReload){location.reload();return;}
    invalidate();input.value='';history.value='';draft.disabled=!saves.snapshot().pending;message.textContent='请选择备份文件或本机历史快照';dialog.showModal();input.focus();const revision=generation;
    void saves.backups().then(backups=>{if(revision!==generation)return;rows=backups;history.replaceChildren(new Option('请选择历史快照',''));rows.forEach((row,index)=>history.append(new Option(`自动备份 ${index+1} · revision ${row.record.revision}`,String(index))));}).catch(error=>{if(revision===generation)message.textContent='历史快照无法读取：'+error.message;});
  });
  function dismiss(){if(restoring)return;invalidate();dialog.close();open.focus();}
  close.addEventListener('click',dismiss);dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
  confirm.addEventListener('click',()=>{
    if(!selected||restoring)return;const candidate=selected;selected=null;restoring=true;confirm.disabled=true;input.disabled=true;history.disabled=true;close.disabled=true;message.textContent='正在恢复，请稍候…';
    void saves.restore(candidate.token).then(()=>{message.textContent='恢复完成。当前游戏页面保持只读，请重新打开游戏。';reload.hidden=false;}).catch(error=>{message.textContent='恢复未完成：'+error.message+'。请重新打开游戏并检查存档。';reload.hidden=false;}).finally(()=>{restoring=false;requiresReload=true;open.textContent='重新打开';open.title='重新打开游戏后读取当前正式存档';close.disabled=false;close.textContent='关闭';});
  });
  reload.addEventListener('click',()=>location.reload());
}
