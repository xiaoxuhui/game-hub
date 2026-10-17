import {strictJson} from './strict-json.mjs';
import {checkEntries} from './save-store.mjs';
// Separate from resource budgets. Covers worst-case JSON escaping of the
// 32Mi-character whole-save contract; native game validators impose tighter limits.
export const MAX_BACKUP_BYTES=256*1024*1024;
export function decodeHistoryRecord(bytes,context){
  const record=strictJson(bytes,MAX_BACKUP_BYTES),fields=['schema','gameId','writerId','fence','revision','sequence','entries'];
  if(!record||Array.isArray(record)||Object.keys(record).sort().join()!==fields.sort().join()||record.schema!==1||record.gameId!==context.id||typeof record.writerId!=='string'||!record.writerId||['fence','revision','sequence'].some(key=>!Number.isSafeInteger(record[key])||record[key]<0))throw Error('未知或无效历史快照，原数据保持');
  return {...record,entries:checkEntries(record.entries,context.storage)};
}
export function decodeBackup(bytes,context){
  if(!(bytes instanceof Uint8Array))throw Error('Backup bytes required');
  const backup=strictJson(bytes,MAX_BACKUP_BYTES);
  const fields=['format','schemaVersion','gameId','gameVersion','sourceRevision','createdAt','entries','mode','pending','canonicalRead','source'];
  if(!backup||Array.isArray(backup)||Object.keys(backup).sort().join()!==fields.sort().join()||backup.format!=='game-hub-save'||backup.schemaVersion!==1)throw Error('未知备份格式，原数据保持');
  if(backup.gameId!==context.id)throw Error('备份属于其他游戏');
  if(backup.canonicalRead!==true||backup.pending!==false||backup.source!=='canonical-session'||!['writable','readonly'].includes(backup.mode))throw Error('应急导出或未保存草稿不能直接替换完整存档');
  if(typeof backup.gameVersion!=='string'||!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(backup.gameVersion)||typeof backup.sourceRevision!=='string'||!/^[0-9a-f]{40}$/.test(backup.sourceRevision)||typeof backup.createdAt!=='string'||!Number.isFinite(Date.parse(backup.createdAt))||new Date(backup.createdAt).toISOString()!==backup.createdAt)throw Error('备份来源身份无效');
  return {...backup,entries:checkEntries(backup.entries,context.storage)};
}
