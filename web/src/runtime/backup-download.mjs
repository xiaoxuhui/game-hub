export function downloadSnapshot(context,snapshot,kind=snapshot.canonicalRead?'session':'emergency'){
  const backup={format:'game-hub-save',schemaVersion:1,gameId:context.id,gameVersion:context.version,sourceRevision:context.sourceRevision,createdAt:new Date().toISOString(),...snapshot,...(!snapshot.canonicalRead?{warning:'未能读取正式存档，此文件仅包含原始旧档或本页草稿，并非正式存档的完整备份'}:{})};
  const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)+'\n'],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=`${context.id}-${kind}-backup.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
