import {readFileSync,writeFileSync,mkdirSync,existsSync,mkdtempSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {strictJson} from '../resource-protocol.mjs';
import {normalizeBase,resourcePath} from '../../web/src/core/contracts.mjs';
import {files,metadata,sha256,inside,removeOwned} from './files.mjs';
import {projectRoot,sourceLock,readSource,prepareInputs,assertClean,git,recursiveBuildInputs} from './inputs.mjs';
import {replaceLocalOutput} from './local-output.mjs';
import {adaptGame,gameCsp} from './adapt.mjs';
import {vectorIcon} from './icons.mjs';

export function adapterFiles(root){return [...recursiveBuildInputs.flatMap(directory=>files(join(root,directory)).map(f=>({...f,path:directory+'/'+f.path}))),{path:'web/package.json',data:readFileSync(join(root,'web/package.json'))}].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);}
function put(root,path,data){inside(root,join(root,path));mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),data);}
export function expectedPayload(root,base){
  normalizeBase(base);const lock=sourceLock(root),version=JSON.parse(readFileSync(join(root,'web/package.json'))).version;
  if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Web shell version');
  const entries=[],games=[];
  for(const source of lock.sources){
    const raw=readSource(root,source),adapted=adaptGame(root,source,raw,base),digest=adapted.digest,entryUrl=resourcePath(base,source.id,source.webContentCode,digest,source.entryPage),prefix=`games/${source.id}/${source.webContentCode}/${digest}/`;
    for(const item of adapted.entries)entries.push({...item,path:prefix+item.path});
    games.push({id:source.id,displayName:source.displayName,version:source.version,contentCode:source.webContentCode,digest,entryUrl,entryPage:source.entryPage,category:source.category,iconKind:source.iconKind,sourceRepository:source.repository,sourceRevision:source.revision,storage:source.storage,sourceFiles:source.files,files:adapted.files,csp:gameCsp,mode:'online'});
  }
  entries.push(...files(join(root,'web/src')).filter(f=>!f.path.startsWith('runtime/')));
  entries.push({path:'assets/hub.svg',data:readFileSync(join(root,'android/icon-source/game-hub-icon.svg'))});
  for(const id of ['conway','eml','light','turing'])entries.push({path:`assets/${id}.png`,data:readFileSync(join(root,`android/app/src/main/res/drawable-nodpi/game_${id}.png`))});
  for(const kind of ['simulation','logic','puzzle','generic'])entries.push({path:`assets/${kind}.svg`,data:vectorIcon(root,kind)});
  for(const path of ['LICENSE','THIRD_PARTY_NOTICES.md','licenses/Apache-2.0.txt'])entries.push({path,data:readFileSync(join(root,path))});
  const sourceCommit=git(root,['rev-parse','HEAD']);
  entries.push({path:'catalog.json',data:Buffer.from(JSON.stringify({schemaVersion:1,platform:'web',trust:'https-online',shellVersion:version,basePath:base,sourceCommit,games},null,2)+'\n')});
  entries.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  if(new Set(entries.map(f=>f.path.toLowerCase())).size!==entries.length)throw Error('Output path collision');
  // Adapter inputs include TypeScript source that is never served as a game
  // resource, so their identity uses path/length/hash independently of MIME.
  const adapterSha256=sha256(JSON.stringify(adapterFiles(root).map(f=>({path:f.path,bytes:f.data.length,sha256:sha256(f.data)}))));
  return {entries,manifest:{schemaVersion:1,platform:'web',sourceCommit,inputLockSha256:sha256(readFileSync(join(root,'web/sources.lock.json'))),adapterSha256,shellVersion:version,basePath:base,games,files:metadata(entries)}};
}
export function verifyWeb(root=projectRoot,output=join(root,'.build/web-dist')){
  assertClean(root);inside(join(root,'.build'),output);const manifest=strictJson(readFileSync(join(output,'build-manifest.json')),4*1024*1024);
  const expected=expectedPayload(root,manifest.basePath).manifest;
  if(JSON.stringify(manifest)!==JSON.stringify(expected))throw Error('Web manifest differs from locked inputs and actual adapter');
  const actual=metadata(files(output).filter(f=>f.path!=='build-manifest.json'));
  if(JSON.stringify(actual)!==JSON.stringify(expected.files))throw Error('Web output file/hash/MIME mismatch');
  console.log(`Verified web ${manifest.shellVersion}: ${manifest.games.length} games, ${actual.length} files, ${manifest.sourceCommit}`);return manifest;
}
export async function buildWeb({root=projectRoot,base='/',output=join(root,'.build/web-dist')}={}){
  assertClean(root);normalizeBase(base);inside(join(root,'.build'),output);await prepareInputs(root);
  const buildRoot=join(root,'.build');mkdirSync(buildRoot,{recursive:true});const staging=mkdtempSync(join(buildRoot,'web-staging-')),backup=staging+'-previous';
  try{
    const {entries,manifest}=expectedPayload(root,base);
    for(const entry of entries)put(staging,entry.path,entry.data);
    put(staging,'build-manifest.json',JSON.stringify(manifest,null,2)+'\n');
    verifyWeb(root,staging);
    return replaceLocalOutput({buildRoot,staging,output,backup,validate:path=>verifyWeb(root,path)});
  }finally{if(existsSync(staging))removeOwned(buildRoot,staging);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2).filter(v=>v!=='--');let base='/',output=join(projectRoot,'.build/web-dist'),verify=false;
  try{for(let i=0;i<args.length;i++){if(args[i]==='--base')base=args[++i];else if(args[i]==='--out')output=resolve(projectRoot,args[++i]);else if(args[i]==='--verify')verify=true;else throw Error('Unknown web build argument');}
    if(verify)verifyWeb(projectRoot,output);else await buildWeb({base,output});
  }catch(e){console.error(e.message);process.exitCode=1;}
}
