import {validateSourceLock,normalizeBase,resourcePath} from './contracts.mjs';
export const SHELL_VERSION='0.1.0';
const version=value=>typeof value==='string'&&value.length<=32&&/^\d+\.\d+\.\d+$/.test(value);
function compare(a,b){const x=a.split('.').map(BigInt),y=b.split('.').map(BigInt);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;return 0;}
export function validateOnlineCatalog(catalog,base){
  normalizeBase(base);
  if(!catalog||catalog.schemaVersion!==1||catalog.platform!=='web'||catalog.trust!=='https-online'||catalog.basePath!==base||!version(catalog.shellVersion)||!Array.isArray(catalog.games)||!/^[a-f0-9]{40}$/.test(catalog.sourceCommit))throw Error('目录格式或部署路径不匹配');
  const sources=catalog.games.map(g=>({id:g.id,displayName:g.displayName,version:g.version,webContentCode:g.contentCode,repository:g.sourceRepository,revision:g.sourceRevision,entryPage:g.entryPage,buildKind:'static',storage:g.storage,files:g.files}));
  validateSourceLock({schemaVersion:1,platform:'web',sources});
  for(const game of catalog.games){
    if(game.mode!=='online'||game.entryUrl!==resourcePath(base,game.id,game.contentCode,game.digest,game.entryPage))throw Error('游戏入口身份不匹配');
    if(typeof game.category!=='string'||game.category.length>20||typeof game.iconKind!=='string'||!/^[a-z-]+$/.test(game.iconKind))throw Error('游戏显示信息不匹配');
  }
  return catalog;
}
export function snapshot(catalog){return {shellVersion:catalog.shellVersion,games:catalog.games.map(g=>({id:g.id,contentCode:g.contentCode,digest:g.digest,version:g.version,sourceRevision:g.sourceRevision}))};}
export function validateHistory(previous){
  if(!previous||!Array.isArray(previous.games)||previous.games.length>32||!version(previous.shellVersion)||previous.games.some(g=>!g||!/^[a-z][a-z0-9-]{0,63}$/.test(g.id)||!Number.isSafeInteger(g.contentCode)||g.contentCode<1||!/^[a-f0-9]{64}$/.test(g.digest)||!version(g.version)||!/^[a-f0-9]{40}$/.test(g.sourceRevision))||new Set(previous.games.map(g=>g.id)).size!==previous.games.length)throw Error('检查历史损坏');
  return previous;
}
export function changes(previous,catalog){
  if(compare(catalog.shellVersion,SHELL_VERSION)<0)throw Error('大厅目录版本倒退');
  if(!previous)return {added:[],updated:[],shell:compare(catalog.shellVersion,SHELL_VERSION)>0};
  validateHistory(previous);
  if(compare(catalog.shellVersion,previous.shellVersion)<0)throw Error('大厅目录版本倒退');
  if(previous.games.some(before=>!catalog.games.some(g=>g.id===before.id)))throw Error('资源目录缺少既有游戏，已保留当前入口');
  const old=new Map(previous.games.map(g=>[g.id,g])),added=[],updated=[];
  for(const game of catalog.games){
    const before=old.get(game.id);if(!before){added.push(game.id);continue;}
    if(game.contentCode<before.contentCode)throw Error('资源目录版本倒退，已保留当前入口');
    const changed=['digest','version','sourceRevision'].some(k=>game[k]!==before[k]);
    if(changed&&game.contentCode===before.contentCode)throw Error('同编号资源身份改变，已拒绝此目录');
    if(game.contentCode>before.contentCode)updated.push(game.id);
  }
  return {added,updated,shell:compare(catalog.shellVersion,SHELL_VERSION)>0};
}
