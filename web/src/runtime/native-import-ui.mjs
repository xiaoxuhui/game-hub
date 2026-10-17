export function nativeImportConfirmation(){
  const dialog=document.createElement('dialog');dialog.id='hub-native-import-dialog';dialog.setAttribute('aria-labelledby','hub-native-import-title');
  const title=document.createElement('h2');title.id='hub-native-import-title';title.textContent='导入游戏文件';
  const explanation=document.createElement('p');explanation.textContent='请核对文件。确认后先自动备份当前完整存档，再交给游戏导入；游戏自身可能还会要求选择合并方式。取消保留当前存档。';
  const preview=document.createElement('pre');preview.id='hub-native-import-preview';
  const confirm=document.createElement('button');confirm.id='hub-native-import-confirm';confirm.type='button';confirm.textContent='备份原档并继续';
  const cancel=document.createElement('button');cancel.id='hub-native-import-cancel';cancel.type='button';cancel.textContent='取消';
  dialog.append(title,explanation,preview,confirm,cancel);document.body.append(dialog);let pending=null;
  function settle(accepted){const resolve=pending;pending=null;if(dialog.open)dialog.close();resolve?.(accepted);}
  confirm.addEventListener('click',()=>settle(true));cancel.addEventListener('click',()=>settle(false));dialog.addEventListener('cancel',event=>{event.preventDefault();settle(false);});window.addEventListener('pagehide',()=>settle(false));
  const ask=details=>{settle(false);preview.textContent=`${details.gameName}\n文件：${details.filename.slice(0,300)}\n大小：${details.bytes} 字节\nSHA-256: ${details.digest}\n当前存档 revision: ${details.expected.revision}`;return new Promise(resolve=>{pending=resolve;dialog.showModal();cancel.focus();});};
  ask.cancel=()=>settle(false);return ask;
}
