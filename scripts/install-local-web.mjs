import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync,rmSync,copyFileSync,cpSync} from 'node:fs';
import {createPublicKey,createHash,randomUUID} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {captureReleaseSnapshot,validateReleaseSnapshot} from './resource-catalog.mjs';
import {verifyEnvelope,validateCatalog,sha256,LIMITS,assetName,safePath} from './resource-protocol.mjs';
import {validateDynamicCatalog} from './dynamic-protocol.mjs';
import {publicDownloadUrl} from './resource-successor.mjs';
import {v1PublicDownloadUrl} from './resource-v1-successor.mjs';
import {readStoredZip} from './resource-bundle.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function verifyArchive(game,bytes){
 if(bytes.length!==game.archiveBytes||sha256(bytes)!==game.archiveSha256)throw Error(`${game.id}: 资源包摘要不匹配`);
 const entries=readStoredZip(bytes),files=[...game.files].sort((a,b)=>a.path.localeCompare(b.path,'en')),actual=[...entries].sort((a,b)=>a.path.localeCompare(b.path,'en'));
 if(files.length!==actual.length)throw Error(`${game.id}: 文件数量不符`);
 for(let i=0;i<files.length;i++){const f=files[i],e=actual[i];safePath(f.path);if(f.path!==e.path||f.bytes!==e.data.length||f.sha256!==sha256(e.data))throw Error(`${game.id}: 文件校验失败 ${f.path}`);}
 if(!files.some(f=>f.path===game.entryPage))throw Error(`${game.id}: 游戏入口缺失`);
 return entries;
}
export function assignPorts(games){const used=new Set();return [...games].sort((a,b)=>a.id.localeCompare(b.id,'en')).map(g=>{let n=createHash('sha256').update(g.id).digest().readUInt32BE(0)%1000;while(used.has(n))n=(n+1)%1000;used.add(n);return {...g,port:18500+n};});}
async function bytesFrom(asset,tag,max){const url=tag==='game-resources-v1'?v1PublicDownloadUrl(asset):publicDownloadUrl(asset);let response;for(let attempt=0;attempt<3;attempt++){try{response=await fetch(url,{headers:{'User-Agent':'game-hub-local-web','Cache-Control':'no-cache'},signal:AbortSignal.timeout(60000)});break;}catch(e){if(attempt===2)throw e;}}if(!response.ok)throw Error(`${asset.name}: HTTP ${response.status}`);const pieces=[];let n=0;for await(const chunk of response.body){n+=chunk.length;if(n>max)throw Error('下载超出大小限制');pieces.push(chunk);}const bytes=Buffer.concat(pieces);if(asset.state!=='uploaded'||n!==asset.size||`sha256:${sha256(bytes)}`!==asset.digest)throw Error(`${asset.name}: 公开资产校验失败`);return bytes;}
async function catalogue(tag,name,key){const snap=await captureReleaseSnapshot(fetch,tag),assets=snap.assetPages.flatMap(p=>p.assets),matches=assets.filter(a=>a.name===name);if(matches.length!==1)throw Error('资源目录不存在');const raw=await bytesFrom(matches[0],tag,LIMITS.envelope),catalog=verifyEnvelope(raw,key,'resources-20261008').catalog;if(tag==='game-resources-v1')validateCatalog(catalog,JSON.parse(readFileSync(join(root,'sources.lock.json'))).sources);else validateDynamicCatalog(catalog);validateReleaseSnapshot(catalog,snap,tag);return {snap,assets,catalog,raw};}
export async function install(target){
 target=resolve(target);if(existsSync(target))throw Error('目标目录已存在，未覆盖：'+target);const stage=target+'.installing';if(existsSync(stage))throw Error('安装暂存目录已存在，请检查：'+stage);
 mkdirSync(stage,{recursive:false});let completed=false;
 try{const key=createPublicKey({key:readFileSync(join(root,'android/app/src/main/res/raw/resource_public_key.der')),format:'der',type:'spki'}),sources=JSON.parse(readFileSync(join(root,'sources.lock.json'))).sources;
  const [v1,v2]=await Promise.all([catalogue('game-resources-v1','catalog.signed.json',key),catalogue('game-resources-v2','catalog-expanded.signed.json',key)]);
  const games=assignPorts([...v1.catalog.games.map(g=>({...g,channel:'v1',name:sources.find(s=>s.id===g.id).displayName})),...v2.catalog.games.filter(g=>g.available).map(g=>({...g,channel:'v2',name:g.displayName}))]);
  if(new Set(games.map(g=>g.id)).size!==games.length)throw Error('两个目录中存在重复游戏');
  cpSync(join(root,'local-web'),stage,{recursive:true});mkdirSync(join(stage,'games'));mkdirSync(join(stage,'icons'));mkdirSync(join(stage,'catalogs'));writeFileSync(join(stage,'catalogs','v1.signed.json'),v1.raw);writeFileSync(join(stage,'catalogs','v2.signed.json'),v2.raw);
  let next=0;async function worker(){while(true){const i=next++;if(i>=games.length)return;const game=games[i],catalog=game.channel==='v1'?v1:v2,tag=game.channel==='v1'?'game-resources-v1':'game-resources-v2',asset=catalog.assets.find(a=>a.id===game.assetId&&a.name===assetName(game));if(!asset)throw Error(`${game.id}: 下载资产不存在`);const data=await bytesFrom(asset,tag,LIMITS.archive),entries=verifyArchive(game,data),dir=join(stage,'games',game.id);mkdirSync(dir,{recursive:true});for(const e of entries){const dest=join(dir,...e.path.split('/'));mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,e.data,{flag:'wx'});}const icon=join(root,'android/app/src/main/res/drawable-nodpi',(['conway','eml','light','turing'].includes(game.id)?'game_':'game_icon_')+game.id.replaceAll('-','_')+'.png');if(existsSync(icon))copyFileSync(icon,join(stage,'icons',game.id+'.png'));console.log(`已校验 ${i+1}/${games.length} ${game.name}`);}}
  const results=await Promise.allSettled(Array.from({length:4},worker)),failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;const result={schemaVersion:1,app:'game-hub-local-web',installationId:randomUUID(),installedAt:new Date().toISOString(),sequences:{v1:v1.catalog.catalogSequence,v2:v2.catalog.catalogSequence},games:games.map(g=>({id:g.id,name:g.name,version:g.version,contentCode:g.contentCode,port:g.port,entry:g.entryPage,archiveSha256:g.archiveSha256,files:g.files.map(f=>f.path)}))};writeFileSync(join(stage,'node-path.txt'),process.execPath+'\n');writeFileSync(join(stage,'games.json'),JSON.stringify(result,null,2)+'\n');renameSync(stage,target);completed=true;console.log(`本地游戏安装完成：${games.length} 款，目录 ${target}`);return result;
 }finally{if(!completed&&existsSync(stage))rmSync(stage,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){install(process.argv[2]||'').catch(e=>{console.error(e.stack);process.exitCode=1;});}
