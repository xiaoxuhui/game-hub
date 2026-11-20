/** Add a verified, append-only copy before touching previously stored sessions. */
export function preserveLambdaSessions(source) {
 let html=source;
 const replace=(a,b)=>{if(html.split(a).length!==2)throw Error('Lambda preservation marker changed: '+a);html=html.replace(a,b)};
 replace('    try{startup();}catch(error){\n      choice.recovery=false;conflictBlocked=true;', `    let sessionArchived=false;
    function ensureSessionArchive(){
      if(sessionArchived)return;
      const storage=Object.create(null);
      for(let i=0;i<(normalRaw.length||0);i++){
        const key=normalRaw.key(i);
        if(!key||!(key.startsWith('lambda-lab-')||key.startsWith('lambda-hub-safe-workspace-v1.')))continue;
        // Run backups already have immutable unique keys and are not overwritten.
        if(key.includes('before-run-v1.'))continue;
        const value=normalRaw.getItem(key);if(value!==null)storage[key]=value;
      }
      if(!Object.keys(storage).length)return;
      const body=JSON.stringify({schemaVersion:1,type:'raw-local-storage',game:'lambda-diagram-game',storage});
      for(let i=0;i<(normalRaw.length||0);i++){
        const key=normalRaw.key(i);if(!key?.startsWith('lambda-hub-session-archive-v1.'))continue;
        if(normalRaw.getItem(key)===body){sessionArchived=true;return;}
      }
      const random=Array.from(crypto.getRandomValues(new Uint8Array(12)),x=>x.toString(16).padStart(2,'0')).join('');
      const key='lambda-hub-session-archive-v1.'+Date.now()+'-'+random;
      if(normalRaw.getItem(key)!==null)throw Error('备份标识冲突');
      normalRaw.setItem(key,body);if(normalRaw.getItem(key)!==body)throw Error('本机备份核验失败');
      sessionArchived=true;
    }
    try{if(backing)ensureSessionArchive();startup();}catch(error){
      choice.recovery=false;conflictBlocked=true;`);
 replace('    const adapter={saveRunBackup(text){',`    const adapter={ensureSessionArchive(){assertUnblocked();ensureSessionArchive();},
    listSessionArchives(){const keys=[];for(let i=0;i<(normalRaw.length||0);i++){const key=normalRaw.key(i);if(/^lambda-hub-session-archive-v1\\.\\d+-[0-9a-f]{24}$/.test(key))keys.push(key);}return keys.sort().reverse();},
    readSessionArchive(key){if(!/^lambda-hub-session-archive-v1\\.\\d+-[0-9a-f]{24}$/.test(key))throw Error('备份标识无效');return normalRaw.getItem(key);},
    exportAllLocal(){const storage=Object.create(null);for(let i=0;i<(normalRaw.length||0);i++){const key=normalRaw.key(i);if(key&&(key.startsWith('lambda-lab-')||key.startsWith('lambda-hub-')))storage[key]=normalRaw.getItem(key);}return JSON.stringify({schemaVersion:1,type:'raw-local-storage',game:'lambda-diagram-game',storage});},
    saveRunBackup(text){`);
 replace('      const encoded=S.encode(snapshot),current=writableCurrent(allowProtected),targets=[[AUTO,encoded,current]];', '      const encoded=S.encode(snapshot),current=writableCurrent(allowProtected);localStorage.ensureSessionArchive();const targets=[[AUTO,encoded,current]];');
 replace("    manage.addEventListener('click',()=>{", `    const exportAll=document.createElement('button');exportAll.type='button';exportAll.className='button';exportAll.textContent='导出所有本机存档';manage.after(exportAll);
    exportAll.addEventListener('click',()=>{try{root.LambdaDownload.save('lambda-all-local-storage.json',localStorage.exportAllLocal(),'application/json')}catch(error){feedback('原始存档导出失败：'+String(error.message||error),true)}});
    const archives=document.createElement('button');archives.type='button';archives.className='button';archives.textContent='查看保存前备份';exportAll.after(archives);
    archives.addEventListener('click',()=>{
      const dialog=document.createElement('dialog'),title=document.createElement('h2'),list=document.createElement('div'),close=document.createElement('button');
      title.textContent='保存前备份';close.type='button';close.textContent='关闭';close.onclick=()=>{dialog.close();dialog.remove()};
      const keys=localStorage.listSessionArchives();if(!keys.length)list.textContent='暂无保存前备份';
      for(const key of keys){const row=document.createElement('p'),button=document.createElement('button'),time=Number(key.split('.').pop().split('-')[0]);button.type='button';button.textContent='导出';button.onclick=()=>{try{const text=localStorage.readSessionArchive(key);if(text===null)throw Error('备份不存在');root.LambdaDownload.save('lambda-session-'+time+'.json',text,'application/json')}catch(error){row.append(document.createTextNode(' 导出失败：'+String(error.message||error)))}};row.append(document.createTextNode(new Date(time).toLocaleString()+' '),button);list.append(row);}
      dialog.append(title,list,close);document.body.append(dialog);if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
    });
    manage.addEventListener('click',()=>{`);
 return html;
}
