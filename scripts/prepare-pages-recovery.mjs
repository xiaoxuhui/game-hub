import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {createHash} from 'node:crypto';
const source=resolve(import.meta.dirname,'..'),site=resolve(process.argv[2]||''),hash=b=>createHash('sha256').update(b).digest('hex');
if(!process.argv[2]||site===source)throw Error('需要独立的已发布网页副本');
const p=join(site,'proof/adaptations.json'),proof=JSON.parse(readFileSync(p));
if(hash(readFileSync(join(site,'storage-isolation.js')))!==proof.storageScriptSha256)throw Error('原存储脚本校验失败');
for(const a of proof.adapted){const file=resolve(site,'games',a.id,a.path);if(!file.startsWith(join(site,'games')+sep)||hash(readFileSync(file))!==a.adaptedSha256)throw Error('原适配文件校验失败: '+a.id+'/'+a.path)}
let count=0;for(const a of proof.adapted){if(!/\.html$/i.test(a.path))continue;const file=join(site,'games',a.id,a.path),old=readFileSync(file,'utf8'),text=old.replace(/(storage-isolation\.js)("\s+data-game=)/,'$1?v=recovery-20261119$2');if(old===text)throw Error('找不到存储脚本: '+a.id+'/'+a.path);writeFileSync(file,text);a.adaptedSha256=hash(Buffer.from(text));count++}
const storage=readFileSync(join(source,'pages-web/storage-isolation.js'));writeFileSync(join(site,'storage-isolation.js'),storage);proof.storageScriptSha256=hash(storage);writeFileSync(p,JSON.stringify(proof,null,2)+'\n');
writeFileSync(join(site,'client.js'),readFileSync(join(source,'pages-web/client.js')));writeFileSync(join(site,'style.css'),Buffer.concat([readFileSync(join(source,'local-web/style.css')),Buffer.from('\n'),readFileSync(join(source,'pages-web/recovery.css'))]));
const index=join(site,'index.html'),oldIndex=readFileSync(index,'utf8'),newIndex=oldIndex.replace('./client.js','./client.js?v=recovery-20261119');if(oldIndex===newIndex)throw Error('找不到大厅脚本');writeFileSync(index,newIndex);console.log(`已校验适配文件并更新 ${count} 个 HTML 游戏入口`);
