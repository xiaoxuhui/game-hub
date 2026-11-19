import {readFileSync,writeFileSync,mkdirSync,lstatSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,join,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),site=resolve(process.argv[2]||''),out=join(root,'.build/pages-site'),baseline='bfb8b33b91ba1f436bab4eee979d0ae22e7098b9';
if(!process.argv[2]||site===root||existsSync(out))throw Error('需要干净的线上独立检出及不存在的输出目录');
const git=args=>execFileSync('git',['-c','core.autocrlf=false','-C',site,...args],{encoding:'utf8'});
if(git(['rev-parse','HEAD']).trim()!==baseline||git(['status','--porcelain=v1','--untracked-files=all']).trim())throw Error('线上基线不是预期干净提交');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),paths=git(['ls-files','-z']).split('\0').filter(Boolean),proof=JSON.parse(readFileSync(join(site,'proof/adaptations.json')));
if(hash(readFileSync(join(site,'storage-isolation.js')))!==proof.storageScriptSha256)throw Error('原存储适配摘要不符');
for(const item of proof.adapted){const path=resolve(site,'games',item.id,item.path),rel=relative(join(site,'games'),path);if(!rel||rel.startsWith('..')||isAbsolute(rel)||hash(readFileSync(path))!==item.adaptedSha256)throw Error('原适配文件摘要不符：'+item.id+'/'+item.path)}
mkdirSync(out,{recursive:true});for(const path of paths){const input=resolve(site,path),rel=relative(site,input);if(!rel||rel.startsWith('..')||isAbsolute(rel)||!lstatSync(input).isFile()||lstatSync(input).isSymbolicLink())throw Error('不安全的资源路径：'+path);const target=join(out,path);mkdirSync(dirname(target),{recursive:true});copyFileSync(input,target);}
const index=join(out,'index.html'),before=readFileSync(index,'utf8');if(!before.includes('</body>'))throw Error('大厅入口不完整');writeFileSync(index,before.replace('</body>','<link rel="stylesheet" href="./offline.css"><script type="module" src="./offline-ui.js"></script></body>'));
for(const name of ['offline-ui.js','offline.css'])copyFileSync(join(root,'pages-web',name),join(out,name));
const names=[...paths,'offline-ui.js','offline.css'].sort(),files=names.map(path=>{const bytes=readFileSync(join(out,path));return {path,bytes:bytes.length,sha256:hash(bytes)}}),manifest=Buffer.from(JSON.stringify({schemaVersion:1,baseline,files},null,2)+'\n');writeFileSync(join(out,'offline-manifest.json'),manifest);
const worker=readFileSync(join(root,'pages-web/offline-worker.js'),'utf8'),workerSha=hash(Buffer.from(worker));writeFileSync(join(out,'sw.js'),worker.replace('__MANIFEST_SHA256__',hash(manifest)).replace('__WORKER_SHA256__',workerSha));
console.log(`离线候选：${files.length} 个文件，${files.reduce((n,f)=>n+f.bytes,0)} 字节；线上基线 ${baseline}`);
