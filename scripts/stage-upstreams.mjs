import {readFileSync,writeFileSync,mkdirSync,existsSync,realpathSync,lstatSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256,strictJson,safePath,LIMITS} from './resource-protocol.mjs';
import {inspectResources} from './resource-bundle.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const staticFiles=['index.html','src/styles.css','src/project-config.js','src/domain/sandpile.js','src/domain/challenge.js','src/domain/lesson.js','src/domain/levels.js','src/storage/persistence.js','src/controller.js','src/renderer.js','src/teaching.js','src/app.js','LICENSE'];
const lambdaInputs=['index.html','src/style.css',...['core','diagram','presets','library','snapshot','download','workspace-tools','viewport','app'].map(n=>`src/${n}.js`),'LICENSE'];
const git=(directory,args,bytes=false)=>execFileSync('git',args,{cwd:directory,maxBuffer:LIMITS.file+1,encoding:bytes?undefined:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});
function regular(path){if(!lstatSync(path).isFile()||realpathSync(path)!==resolve(path))throw new Error('Upstream input link or special file');return readFileSync(path);}
function committed(source,directory,path){
  safePath(path);const data=regular(join(directory,path));
  const blob=git(directory,['show',`${source.revision}:${path}`],true);
  if(!data.equals(blob))throw new Error(`Fixed input differs from Git blob: ${source.id}/${path}`);
  return {path,bytes:data.length,sha256:sha256(data)};
}
export function validateProof(proof,source,inputs,outputs){
  if(proof.schemaVersion!==1||proof.id!==source.id||proof.repository!==source.repository||proof.revision!==source.revision||proof.version!==source.version||proof.buildKind!==source.kind||proof.entryPage!==source.entryPage)throw new Error('Upstream proof identity');
  if(JSON.stringify(proof.inputs)!==JSON.stringify(inputs)||JSON.stringify(proof.outputs)!==JSON.stringify(outputs))throw new Error('Upstream proof immutable byte manifests');
  if(source.kind==='inline-html'&&(!proof.trackedArtifact||proof.trackedArtifact.matchesRebuild!==true||proof.trackedArtifact.sha256!==outputs.find(o=>o.path===source.entryPage)?.sha256))throw new Error('Frozen tracked artifact differs from rebuild; explicit reviewed difference needed');
  return proof;
}
function outputFiles(directory,base=directory){return readdirSync(directory).sort().flatMap(name=>{const path=join(directory,name);if(lstatSync(path).isDirectory()){if(realpathSync(path)!==resolve(path))throw new Error('Integration directory link');return outputFiles(path,base);}const data=regular(path);return [{path:relative(base,path).split(sep).join('/'),bytes:data.length,sha256:sha256(data)}];});}
export function stageUpstreams(output){
  const build=join(root,'.build');if(realpathSync(build)!==resolve(build))throw new Error('Independent build root link');
  output=resolve(output);if(dirname(output)!==resolve(build)||existsSync(output))throw new Error('Fresh direct independent build subdirectory required');
  const lock=strictJson(readFileSync(join(root,'dynamic-upstreams.lock.json')));
  if(lock.schemaVersion!==1||lock.sources.length!==2||new Set(lock.sources.map(s=>s.id)).size!==2)throw new Error('Fixed upstream source set');
  // Verify all source inputs before writing any integration outputs.
  const prepared=lock.sources.map(source=>{
    if(!['abelian-sandpile','lambda-diagram-game'].includes(source.id)||source.repository!==`https://github.com/xiaoxuhui/${source.id}.git`||!/^[0-9a-f]{40}$/.test(source.revision)||source.kind!==(source.id==='abelian-sandpile'?'static-copy':'inline-html'))throw new Error('Fixed upstream identity');
    const directory=join(build,'upstream-dynamic',source.id);
    if(realpathSync(directory)!==resolve(directory)||git(directory,['rev-parse','HEAD']).trim()!==source.revision||git(directory,['remote','get-url','origin']).trim()!==source.repository)throw new Error('Independent upstream Git identity');
    const paths=[...(source.kind==='static-copy'?staticFiles:lambdaInputs),'package.json','scripts/build.mjs'].sort();
    const inputs=paths.map(path=>committed(source,directory,path));
    if(strictJson(readFileSync(join(directory,'package.json'))).version!==source.version)throw new Error('Upstream package version');
    if(!/^MIT License\r?\n/.test(readFileSync(join(directory,'LICENSE'),'utf8')))throw new Error('Upstream full MIT required');
    return {source,directory,inputs};
  });
  mkdirSync(output);
  for(const {source,directory,inputs} of prepared){
    execFileSync(process.execPath,['scripts/build.mjs'],{cwd:directory,stdio:'inherit'});
    inputs.forEach(input=>committed(source,directory,input.path));
    const entries=(source.kind==='static-copy'?staticFiles:[source.entryPage,'LICENSE']).map(path=>({path,data:regular(join(directory,path==='LICENSE'&&source.kind==='inline-html'?'LICENSE':`dist/${path}`))}));
    if(source.kind==='static-copy')for(const entry of entries){if(!entry.data.equals(git(directory,['show',`${source.revision}:${entry.path}`],true)))throw new Error('Copied runtime differs from fixed Git blob');}
    inspectResources(entries,source.id);
    const outputs=entries.map(e=>({path:e.path,bytes:e.data.length,sha256:sha256(e.data)})).sort((a,b)=>a.path<b.path?-1:1);
    const proof={schemaVersion:1,id:source.id,repository:source.repository,revision:source.revision,version:source.version,buildKind:source.kind,entryPage:source.entryPage,inputs,outputs};
    if(source.kind==='inline-html'){
      const original=git(directory,['show',`${source.revision}:dist/lambda-lab.html`],true);
      proof.trackedArtifact={path:'dist/lambda-lab.html',bytes:original.length,sha256:sha256(original),matchesRebuild:original.equals(entries.find(e=>e.path===source.entryPage).data)};
    }
    validateProof(proof,source,inputs,outputs);
    const target=join(output,source.id);mkdirSync(target);
    for(const entry of entries){mkdirSync(dirname(join(target,entry.path)),{recursive:true});writeFileSync(join(target,entry.path),entry.data,{flag:'wx'});}
    writeFileSync(join(target,'upstream-source.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
    const actual=outputFiles(target).filter(f=>f.path!=='upstream-source.json');
    validateProof(strictJson(readFileSync(join(target,'upstream-source.json'))),source,inputs,actual);
    console.log(`Staged ${source.id} ${source.version}, ${entries.length} runtime/license files; fixed ${source.revision}`);
  }
  return output;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{if(process.argv.length!==3)throw new Error('Usage: stage-upstreams.mjs fresh-direct-build-subdirectory');stageUpstreams(process.argv[2]);}
  catch(error){console.error(error.message);process.exitCode=1;}
}
