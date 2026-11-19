import {readFileSync,writeFileSync,mkdirSync,existsSync,cpSync,lstatSync} from 'node:fs';
import {resolve,join,dirname,posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPublicKey} from 'node:crypto';
import {verifyEnvelope,validateCatalog,sha256,safePath} from './resource-protocol.mjs';
import {validateDynamicCatalog} from './dynamic-protocol.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),source=join(root,'.build/source-snapshot'),out=join(root,'.build/pages-site');
if(existsSync(out))throw Error('输出目录已存在，未覆盖');
const publicKey=createPublicKey({key:readFileSync(join(root,'android/app/src/main/res/raw/resource_public_key.der')),format:'der',type:'spki'}),readCatalog=n=>verifyEnvelope(readFileSync(join(source,'catalogs',n+'.signed.json')),publicKey,'resources-20261008').catalog;
const first=readCatalog('v1'),second=readCatalog('v2');validateCatalog(first,JSON.parse(readFileSync(join(root,'sources.lock.json'))).sources);validateDynamicCatalog(second);
const signed=[...first.games,...second.games.filter(g=>g.available)],manifest=JSON.parse(readFileSync(join(source,'games.json')));
if(signed.length!==manifest.games.length||new Set(signed.map(g=>g.id)).size!==signed.length)throw Error('游戏目录数量或身份不符');
mkdirSync(out,{recursive:true});mkdirSync(join(out,'games'));mkdirSync(join(out,'icons'));mkdirSync(join(out,'proof'));
const storage=readFileSync(join(root,'pages-web/storage-isolation.js')),worker=readFileSync(join(root,'pages-web/worker-storage.js'),'utf8'),proofs=[];
writeFileSync(join(out,'storage-isolation.js'),storage);writeFileSync(join(out,'client.js'),readFileSync(join(root,'pages-web/client.js')));writeFileSync(join(out,'style.css'),Buffer.concat([readFileSync(join(root,'local-web/style.css')),Buffer.from('\n'),readFileSync(join(root,'pages-web/recovery.css'))]));writeFileSync(join(out,'.nojekyll'),'');
let html=readFileSync(join(root,'local-web/index.html'),'utf8').replace('本机网页版','网页版');writeFileSync(join(out,'index.html'),html);
cpSync(join(source,'icons'),join(out,'icons'),{recursive:true});for(const n of ['v1','v2'])writeFileSync(join(out,'proof',n+'.signed.json'),readFileSync(join(source,'catalogs',n+'.signed.json')));
for(const item of manifest.games){const g=signed.find(x=>x.id===item.id);if(!g||g.contentCode!==item.contentCode||g.archiveSha256!==item.archiveSha256||g.entryPage!==item.entry||JSON.stringify(g.files.map(x=>x.path))!==JSON.stringify(item.files))throw Error(item.id+': 资源身份不符');const dest=join(out,'games',item.id);mkdirSync(dest,{recursive:true});
 for(const f of g.files){safePath(f.path);const input=join(source,'games',item.id,...f.path.split('/'));if(!lstatSync(input).isFile()||lstatSync(input).isSymbolicLink())throw Error('资源不是普通文件');let bytes=readFileSync(input);if(bytes.length!==f.bytes||sha256(bytes)!==f.sha256)throw Error(item.id+': 原始文件校验失败 '+f.path);let changed=false;
  if(/\.html$/i.test(f.path)){const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),match=/<head\b[^>]*>/i.exec(text);if(!match)throw Error(item.id+': HTML 缺少 head');const relative=posix.relative(posix.dirname('games/'+item.id+'/'+f.path),'storage-isolation.js');const injection=`<script src="${relative}" data-game="${item.id}"></script>`;bytes=Buffer.from(text.slice(0,match.index+match[0].length)+injection+text.slice(match.index+match[0].length));changed=true;}
  if(item.id==='snake-speed'&&f.path==='python-worker.js'){bytes=Buffer.concat([Buffer.from(worker.replaceAll('__GAME_ID__',item.id)+'\n'),bytes]);changed=true;}
  const target=join(dest,...f.path.split('/'));mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes,{flag:'wx'});if(changed)proofs.push({id:item.id,path:f.path,sourceSha256:f.sha256,adaptedSha256:sha256(bytes)});
 }}
writeFileSync(join(out,'games.json'),JSON.stringify({schemaVersion:1,games:manifest.games.map(({id,name,version,contentCode,entry})=>({id,name,version,contentCode,entry}))},null,2)+'\n');writeFileSync(join(out,'proof/adaptations.json'),JSON.stringify({schemaVersion:1,sequences:manifest.sequences,storageScriptSha256:sha256(storage),adapted:proofs},null,2)+'\n');
console.log(`GitHub Pages 候选：${signed.length} 款，${proofs.length} 项适配，目录 ${out}`);
