import {readFileSync,existsSync,mkdirSync,realpathSync,lstatSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {strictJson} from '../resource-protocol.mjs';
import {validateSourceLock} from '../../web/src/core/contracts.mjs';
import {files,metadata,inside} from './files.mjs';

export const projectRoot=fileURLToPath(new URL('../../',import.meta.url));
export const recursiveBuildInputs=Object.freeze(['web/src','scripts/web','web/native-validation']);
export function git(root,args){return execFileSync('git',args,{cwd:root,encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0',GIT_HTTP_LOW_SPEED_LIMIT:'1024',GIT_HTTP_LOW_SPEED_TIME:'60'}}).trim();}
export function assertClean(root){
  if(git(root,['status','--porcelain=v1','--untracked-files=all']))throw Error('Web build requires clean independent checkout');
  if(process.env.GAME_HUB_LOCAL_SOURCES)throw Error('Original worktree source override refused');
  // Git's clean filters can hide CRLF working bytes that differ from HEAD.
  // Prove the actual bytes of every tracked build input, not only porcelain.
  const algorithm=git(root,['rev-parse','--show-object-format']);if(!['sha1','sha256'].includes(algorithm))throw Error('Unknown Git object format');
  const paths=['web','scripts/web','scripts/bundle.mjs','scripts/resource-protocol.mjs','package.json','pnpm-lock.yaml','LICENSE','THIRD_PARTY_NOTICES.md','licenses','android/icon-source/game-hub-icon.svg','android/app/src/main/res/drawable-nodpi','android/app/src/main/res/drawable'];
  const tracked=new Set();
  for(const entry of git(root,['ls-tree','-r','-z','HEAD','--',...paths]).split('\0').filter(Boolean)){
    const tab=entry.indexOf('\t'),[mode,type,objectId]=entry.slice(0,tab).split(' '),path=entry.slice(tab+1),full=join(root,path);
    tracked.add(path);
    if(type!=='blob'||!['100644','100755'].includes(mode)||lstatSync(full).isSymbolicLink()||realpathSync(full)!==resolve(full))throw Error('Build input must be an ordinary tracked file');
    const bytes=readFileSync(full),actual=createHash(algorithm).update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if(actual!==objectId)throw Error('Committed input bytes differ: '+path);
  }
  for(const directory of recursiveBuildInputs)if(existsSync(join(root,directory)))for(const file of files(join(root,directory)))if(!tracked.has(directory+'/'+file.path))throw Error('Untracked build input (including ignored files): '+directory+'/'+file.path);
}
export function sourceLock(root=projectRoot){return validateSourceLock(strictJson(readFileSync(join(root,'web/sources.lock.json')),4*1024*1024));}
export function sourceDirectory(root,source){return source.buildKind==='dynamic'?join(root,'.build/dynamic-sources',source.id,source.sourceDirectory):join(root,'.build/resource-source-assets/games',source.id);}
export function readSource(root,source){
  const directory=sourceDirectory(root,source);inside(join(root,'.build'),directory);
  const entries=files(directory),expected=[...source.files].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  if(JSON.stringify(metadata(entries))!==JSON.stringify(expected))throw Error(`${source.id}: immutable input byte/file mismatch`);
  if(!/^MIT License\r?\n/.test(entries.find(f=>f.path==='LICENSE').data.toString('utf8')))throw Error('Source MIT license missing');
  return entries;
}
export async function prepareInputs(root=projectRoot){
  assertClean(root);const lock=sourceLock(root),builtin=lock.sources.filter(s=>s.buildKind!=='dynamic');
  const assemblerSources=builtin.map(source=>({...source,files:source.buildKind==='turing'?['dist/**']:source.files.map(f=>source.buildKind==='eml'&&f.path!=='LICENSE'?'dist/'+f.path:f.path)}));
  let needBuiltin=false;for(const source of builtin){try{readSource(root,source);}catch{needBuiltin=true;}}
  if(needBuiltin){const {assemble}=await import('../bundle.mjs');assemble(assemblerSources,root,join(root,'.build/resource-source-assets'),git(root,['rev-parse','HEAD']));}
  const parent=join(root,'.build/dynamic-sources');mkdirSync(parent,{recursive:true});
  if(realpathSync(parent)!==resolve(parent))throw Error('Dynamic parent link');
  for(const source of lock.sources.filter(s=>s.buildKind==='dynamic')){
    const checkout=join(parent,source.id),fresh=!existsSync(checkout);
    if(fresh){execFileSync('git',['clone','--quiet','--no-local','--no-checkout',source.repository,checkout],{cwd:root,stdio:'inherit',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_HTTP_LOW_SPEED_LIMIT:'1024',GIT_HTTP_LOW_SPEED_TIME:'60'}});git(checkout,['config','core.autocrlf','false']);git(checkout,['checkout','--quiet','--detach',source.revision]);}
    if(lstatSync(checkout).isSymbolicLink()||realpathSync(checkout)!==resolve(checkout)||git(checkout,['remote','get-url','origin'])!==source.repository||git(checkout,['rev-parse','HEAD'])!==source.revision||git(checkout,['status','--porcelain=v1','--untracked-files=all']))throw Error('Dynamic fixed checkout proof differs');
    readSource(root,source);
  }
  for(const source of builtin)readSource(root,source);
  console.log(`Verified ${lock.sources.length} immutable web inputs (${lock.sources.reduce((n,s)=>n+s.files.length,0)} files)`);return lock;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))prepareInputs().catch(e=>{console.error(e.message);process.exitCode=1;});
