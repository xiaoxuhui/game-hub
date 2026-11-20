/** Keep bounded all-local exports importable even after JSON escaping. */
export function fixLambdaLargeArchive(source){
 let html=source;
 const replace=(a,b)=>{if(html.split(a).length!==2)throw Error('Lambda archive size marker changed: '+a);html=html.replace(a,b)};
 replace("if(file.size>8*1024*1024)throw new C.LambdaError('恢复文件超过 8 MiB 上限。');", "if(file.size>32*1024*1024)throw new C.LambdaError('恢复文件超过 32 MiB 上限，请逐个导出并导入保存前备份。');");
 replace("exportAllLocal(){const storage=Object.create(null);for(let i=0;i<(normalRaw.length||0);i++){const key=normalRaw.key(i);if(key&&(key.startsWith('lambda-lab-')||key.startsWith('lambda-hub-')))storage[key]=normalRaw.getItem(key);}return JSON.stringify({schemaVersion:1,type:'raw-local-storage',game:'lambda-diagram-game',storage});}",
 "exportAllLocal(){const storage=Object.create(null);for(let i=0;i<(normalRaw.length||0);i++){const key=normalRaw.key(i);if(key&&(key.startsWith('lambda-lab-')||key.startsWith('lambda-hub-')))storage[key]=normalRaw.getItem(key);}const text=JSON.stringify({schemaVersion:1,type:'raw-local-storage',game:'lambda-diagram-game',storage});if(new TextEncoder().encode(text).length>32*1024*1024)throw Error('本机存档超过 32 MiB，请在“查看保存前备份”中逐个导出。');return text;}");
 return html;
}
