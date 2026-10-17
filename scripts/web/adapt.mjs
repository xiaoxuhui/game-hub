import {readFileSync} from 'node:fs';
import {join,posix} from 'node:path';
import {safePath,normalizeBase} from '../../web/src/core/contracts.mjs';
import {files,metadata,treeHash} from './files.mjs';
import {sourceProofBytes} from '../../web/src/core/digests.mjs';
import {nativeTuring,nativeLambda,splitEmlBeforeUI} from './native-validation.mjs';
import {guardNativeFileReads} from './native-file-adapter.mjs';
import {guardAudioStart} from './audio-adapter.mjs';

export const gameCsp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const attr=(text,name)=>new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`,'i').exec(text)?.[1];
export function adaptPage({path,text,paths}){
  const scripts=[],generated=[],directory=posix.dirname(path),pageId=path.replace(/\W/g,'-');
  if(/<base\b/i.test(text))throw Error('Game base element refused');
  text=text.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,(_all,attributes,body)=>{
    const src=attr(attributes,'src'),type=attr(attributes,'type')||'classic';
    if(!['classic','text/javascript','module'].includes(type)||/\basync\b/i.test(attributes))throw Error('Unreviewed game script type/order');
    let scriptPath;
    if(src){
      if(body.trim())throw Error('Mixed inline/external script');
      const url=new URL(src,'https://input.invalid/'+path);
      if(url.origin!=='https://input.invalid'||url.hash)throw Error('External script refused');
      scriptPath=url.pathname.slice(1);safePath(scriptPath);
      if(!paths.has(scriptPath))throw Error('Script outside fixed file list');
    }else{
      scriptPath=posix.join(directory,`hub-inline-${pageId}-${scripts.length}.js`);safePath(scriptPath);
      if(paths.has(scriptPath))throw Error('Generated script collision');
      generated.push({path:scriptPath,data:Buffer.from(body)});
    }
    scripts.push({path:scriptPath,type:type==='module'?'module':'classic'});return '';
  });
  if(/<script\b/i.test(text)||/\son[a-z]+\s*=/i.test(text))throw Error('Unreviewed executable HTML');
  if(!/<\/body\s*>/i.test(text))throw Error('Game body missing');
  const relative=posix.relative(directory,'hub-runtime/');
  text=text.replace(/<\/head\s*>/i,`<link rel="icon" href="${relative}/favicon.svg"></head>`);
  text=text.replace(/<\/body\s*>/i,`<script type="module" src="${relative}/bootstrap.mjs" data-page="${path}"></script></body>`);
  return {html:Buffer.from(text),scripts,generated};
}
export function adaptGame(root,source,raw,base){
  normalizeBase(base);if(raw.some(f=>f.path.startsWith('hub-runtime/')||f.path.startsWith('hub-inline-')))throw Error('Reserved adapter path');
  const paths=new Set(raw.map(f=>f.path)),pages={},entries=[],preflightAfter={};
  for(const item of raw){
    if(!item.path.endsWith('.html')){
      if(source.id==='light'&&item.path==='scripts/storage.js'){
        const text=item.data.toString('utf8'),probe='      const probe = STORAGE_KEY + "/probe";\n      storage.setItem(probe, "1");\n      storage.removeItem(probe);\n';
        if(text.split(probe).length!==2)throw Error('Unreviewed light persistence probe');
        // The hall facade already detects storage failure. A foreign probe key
        // would select the native memory fallback and bypass durable saves.
        entries.push({...item,data:Buffer.from(text.replace(probe,'      // Hall save facade reports persistent storage availability and failures.\n'))});
      }else entries.push(item);
      continue;
    }
    const adapted=adaptPage({path:item.path,text:item.data.toString('utf8'),paths});
    if(source.id==='eml'){
      if(adapted.scripts.length!==1||adapted.generated.length!==1)throw Error('Unreviewed EML script layout');
      const file=adapted.generated[0],[libraries,ui]=splitEmlBeforeUI(file.data.toString('utf8')),uiPath=file.path.replace(/\.js$/,'-ui.js');
      file.data=Buffer.from(libraries);adapted.generated.push({path:uiPath,data:Buffer.from(ui)});adapted.scripts.push({path:uiPath,type:'classic'});
    }
    const anchors={conway:'scripts/logic-function-library.js',light:'scripts/storage.js','abelian-sandpile':'src/storage/persistence.js','lambda-diagram-game':'hub-inline-lambda-lab-html-5.js',eml:adapted.scripts[0]?.path};
    if(Object.hasOwn(anchors,source.id)){
      const anchor=anchors[source.id];if(adapted.scripts.filter(script=>script.path===anchor&&script.type==='classic').length!==1)throw Error('Missing reviewed native preflight boundary');preflightAfter[item.path]=anchor;
    }else if(['turing','red-green-puzzle','mini-scratch'].includes(source.id))preflightAfter[item.path]=null;
    else throw Error('Missing reviewed native preflight adapter');
    entries.push({path:item.path,data:adapted.html},...adapted.generated);pages[item.path]=adapted.scripts;
  }
  const guarded=guardAudioStart(source.id,guardNativeFileReads(source.id,entries));entries.splice(0,entries.length,...guarded);
  for(const item of files(join(root,'web/src/runtime')))entries.push({path:'hub-runtime/'+item.path,data:item.data});
  if(source.id==='turing')for(const item of nativeTuring(root,source))entries.push({...item,path:'hub-runtime/native/turing/'+item.path});
  if(source.id==='lambda-diagram-game')for(const item of nativeLambda(source,raw))entries.push({...item,path:'hub-runtime/native/'+item.path});
  entries.push({path:'hub-runtime/favicon.svg',data:readFileSync(join(root,'android/icon-source/game-hub-icon.svg'))});
  entries.push({path:'hub-runtime/source-proof.json',data:Buffer.from(sourceProofBytes({id:source.id,sourceRepository:source.repository,sourceRevision:source.revision,sourceFiles:metadata(raw)}))});
  entries.push({path:'hub-runtime/context.json',data:Buffer.from(JSON.stringify({schemaVersion:1,id:source.id,name:source.displayName,version:source.version,contentCode:source.webContentCode,sourceRevision:source.revision,storage:source.storage,basePath:base,pages,preflightAfter})+'\n')});
  entries.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  if(new Set(entries.map(f=>f.path.toLowerCase())).size!==entries.length)throw Error('Adapted output collision');
  return {entries,digest:treeHash(entries),files:metadata(entries)};
}
