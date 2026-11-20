import {readFileSync,writeFileSync,mkdirSync,lstatSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,join,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),site=resolve(process.argv[2]||''),suffix=process.env.GAME_HUB_BUILD_SUFFIX||'site',out=join(root,'.build','pages-'+suffix),baseline='bfb8b33b91ba1f436bab4eee979d0ae22e7098b9';
if(!/^[a-z0-9-]+$/.test(suffix))throw Error('输出目录名称无效');
if(!process.argv[2]||site===root||existsSync(out))throw Error('需要干净的线上独立检出及不存在的输出目录');
const git=args=>execFileSync('git',['-c','core.autocrlf=false','-C',site,...args],{encoding:'utf8'});
if(git(['rev-parse','HEAD']).trim()!==baseline||git(['status','--porcelain=v1','--untracked-files=all']).trim())throw Error('线上基线不是预期干净提交');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),paths=git(['ls-files','-z']).split('\0').filter(Boolean),proof=JSON.parse(readFileSync(join(site,'proof/adaptations.json')));
if(hash(readFileSync(join(site,'storage-isolation.js')))!==proof.storageScriptSha256)throw Error('原存储适配摘要不符');
for(const item of proof.adapted){const path=resolve(site,'games',item.id,item.path),rel=relative(join(site,'games'),path);if(!rel||rel.startsWith('..')||isAbsolute(rel)||hash(readFileSync(path))!==item.adaptedSha256)throw Error('原适配文件摘要不符：'+item.id+'/'+item.path)}
mkdirSync(out,{recursive:true});for(const path of paths){const input=resolve(site,path),rel=relative(site,input);if(!rel||rel.startsWith('..')||isAbsolute(rel)||!lstatSync(input).isFile()||lstatSync(input).isSymbolicLink())throw Error('不安全的资源路径：'+path);const target=join(out,path);mkdirSync(dirname(target),{recursive:true});copyFileSync(input,target);}
{
 const id='lights-out-matrix',path='index.html',target=join(out,'games',id,path),original=readFileSync(target,'utf8'),entry=proof.adapted.find(item=>item.id===id&&item.path===path),anchor='  generate(5); loadExample(); setDisplay();';
 if(!entry||entry.adaptedSha256!=='76dda72cd101d0d1bb630ee5f51f1bb582a376eccb3badea0aa9225dd09820b2'||original.split(anchor).length!==2)throw Error('熄灯矩阵基线不符');
 const adapted=original.replace(anchor,anchor+'\n'+readFileSync(join(root,'pages-web/adaptations/lights-out.inc.js'),'utf8'));writeFileSync(target,adapted);entry.adaptedSha256=hash(Buffer.from(adapted));writeFileSync(join(out,'proof/adaptations.json'),JSON.stringify(proof,null,2)+'\n');
}
{
 const id='compass-polygon-studio',path='app.js',target=join(out,'games',id,path),bytes=readFileSync(target),sourceSha=hash(bytes),original=bytes.toString('utf8'),anchor='generate(5);',setIndex='function setIndex(value,animate=false)',end='render(animate);}',adapt=readFileSync(join(root,'pages-web/adaptations/compass.inc.js'),'utf8');
 if(sourceSha!=='db0a52b1231e71b5ad42a950921d6aa102f562ddef4ee5d0ecea821b4b994edc'||[anchor,setIndex,end].some(s=>original.split(s).length!==2)||proof.adapted.some(item=>item.id===id&&item.path===path))throw Error('尺规工坊基线不符');
 const updated=original.replace(setIndex,'let hubSaveState=()=>{};'+setIndex).replace(end,'render(animate);hubSaveState();}').replace(anchor,anchor+'\n'+adapt);writeFileSync(target,updated);proof.adapted.push({id,path,sourceSha256:sourceSha,adaptedSha256:hash(Buffer.from(updated))});writeFileSync(join(out,'proof/adaptations.json'),JSON.stringify(proof,null,2)+'\n');
}
{
 const id='learning-machine',path='src/app.js',target=join(out,'games',id,path),bytes=readFileSync(target),sourceSha=hash(bytes),original=bytes.toString('utf8'),anchor='  render();\n})();',adapt=readFileSync(join(root,'pages-web/adaptations/learning.inc.js'),'utf8');
 if(sourceSha!=='f8ed7a1b82b11b75fb2f3b2ba03c276c873b8ca902e702d6c7870e619c5db9cb'||original.split(anchor).length!==2||proof.adapted.some(item=>item.id===id&&item.path===path))throw Error('学习小机器基线不符');
 const updated=original.replace(anchor,adapt+'\n'+anchor);writeFileSync(target,updated);proof.adapted.push({id,path,sourceSha256:sourceSha,adaptedSha256:hash(Buffer.from(updated))});
 const entry=proof.adapted.find(item=>item.id===id&&item.path==='index.html'),htmlPath=join(out,'games',id,'index.html'),html=readFileSync(htmlPath,'utf8'),old='刷新或重置会清空学习结果';if(!entry||hash(Buffer.from(html))!=='1be77fd3c07d7b717834abe3cc11fba671734f6e9c81937e8edfaf8a30832dbf'||html.split(old).length!==2)throw Error('学习小机器入口基线不符');const newHtml=html.replace(old,'学习结果保存在当前浏览器，重置会清空');writeFileSync(htmlPath,newHtml);entry.adaptedSha256=hash(Buffer.from(newHtml));writeFileSync(join(out,'proof/adaptations.json'),JSON.stringify(proof,null,2)+'\n');
}
{
 const id='fourier-drawing-studio',path='app.js',target=join(out,'games',id,path),bytes=readFileSync(target),sourceSha=hash(bytes),original=bytes.toString('utf8'),anchor="loadShape(preset('heart'),'爱心');setCount(40);resize();requestAnimationFrame(animate);",adapt=readFileSync(join(root,'pages-web/adaptations/fourier.inc.js'),'utf8');
 if(sourceSha!=='ccea8c1100f53daa29cdbbbe91f7e06d9b1a4b0b32f596becdfdf642c64cb53a'||original.split(anchor).length!==2||proof.adapted.some(item=>item.id===id&&item.path===path))throw Error('傅里叶画室基线不符');const updated=original.replace(anchor,anchor+'\n'+adapt);writeFileSync(target,updated);proof.adapted.push({id,path,sourceSha256:sourceSha,adaptedSha256:hash(Buffer.from(updated))});writeFileSync(join(out,'proof/adaptations.json'),JSON.stringify(proof,null,2)+'\n');
}
{
 const id='lambda-diagram-game',path='lambda-lab.html',target=join(out,'games',id,path),original=readFileSync(target,'utf8'),entry=proof.adapted.find(item=>item.id===id&&item.path===path);
 if(!entry||hash(Buffer.from(original))!=='6cd10c9f798244e3dd74c37f57ebd1eb9a52ad9a08f81a685f50cf06fd6ee1ec')throw Error('Lambda 基线不符');let updated=original;
 const replace=(a,b)=>{if(updated.split(a).length!==2)throw Error('Lambda 适配锚点不唯一');updated=updated.replace(a,b)};
 replace('functionController=null,autosaveReady=false;', 'functionController=null,autosaveReady=false,autosaveBlocked=false;');
 replace('if(restoring||(!autosaveReady&&explicit!==true))return;', 'if(autosaveBlocked||restoring||(!autosaveReady&&explicit!==true))return;');
 replace('function queueSave(){autosaveReady=true;', 'function queueSave(){if(autosaveBlocked)return;autosaveReady=true;');
 replace('    function prepareManualRestore() {',readFileSync(join(root,'pages-web/adaptations/lambda-latest.inc.js'),'utf8')+'\n    function prepareManualRestore() {');
 replace('persist,queueSave,prepareManualRestore};','persist,queueSave,prepareManualRestore,restoreLatest};');
 replace('workspace.prepareManualRestore();renderMode();convert();lastAutosaveSnapshot=JSON.stringify(capture());initializing=false;','workspace.prepareManualRestore();if(!workspace.restoreLatest()){renderMode();convert();}lastAutosaveSnapshot=JSON.stringify(capture());initializing=false;');
 writeFileSync(target,updated);entry.adaptedSha256=hash(Buffer.from(updated));writeFileSync(join(out,'proof/adaptations.json'),JSON.stringify(proof,null,2)+'\n');
}
{
 const id='conway',path='scripts/app.js',target=join(out,'games',id,path),bytes=readFileSync(target),sourceSha=hash(bytes),original=bytes.toString('utf8'),anchor='  Dialog.initializeLogicFunctionLibrary();\n  render();\n})();',adapt=readFileSync(join(root,'pages-web/adaptations/conway.inc.js'),'utf8');
 if(sourceSha!=='4ceceb5c5bfe1ec70a9519941bc2e5b7309a05d9865d00bffc6117eda56a6de7'||original.split(anchor).length!==2||proof.adapted.some(item=>item.id===id&&item.path===path))throw Error('康威生命游戏基线不符');const updated=original.replace(anchor,'  Dialog.initializeLogicFunctionLibrary();\n  render();\n'+adapt+'\n})();');writeFileSync(target,updated);proof.adapted.push({id,path,sourceSha256:sourceSha,adaptedSha256:hash(Buffer.from(updated))});writeFileSync(join(out,'proof/adaptations.json'),JSON.stringify(proof,null,2)+'\n');
}
const index=join(out,'index.html'),before=readFileSync(index,'utf8');if(!before.includes('</body>'))throw Error('大厅入口不完整');writeFileSync(index,before.replace('</body>','<link rel="stylesheet" href="./offline.css"><link rel="stylesheet" href="./save.css"><script type="module" src="./offline-ui.js"></script><script type="module" src="./save-ui.js"></script></body>'));
for(const name of ['client.js','offline-ui.js','offline.css','save-vault.js','save-ui.js','save.css'])copyFileSync(join(root,'pages-web',name),join(out,name));
const names=[...new Set([...paths,'offline-ui.js','offline.css','save-vault.js','save-ui.js','save.css'])].sort(),files=names.map(path=>{const bytes=readFileSync(join(out,path));return {path,bytes:bytes.length,sha256:hash(bytes)}}),manifest=Buffer.from(JSON.stringify({schemaVersion:1,baseline,files},null,2)+'\n');writeFileSync(join(out,'offline-manifest.json'),manifest);
const worker=readFileSync(join(root,'pages-web/offline-worker.js'),'utf8'),workerSha=hash(Buffer.from(worker));writeFileSync(join(out,'sw.js'),worker.replace('__MANIFEST_SHA256__',hash(manifest)).replace('__WORKER_SHA256__',workerSha));
console.log(`离线候选：${files.length} 个文件，${files.reduce((n,f)=>n+f.bytes,0)} 字节；线上基线 ${baseline}`);
