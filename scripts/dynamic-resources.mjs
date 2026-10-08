import { readFileSync, writeFileSync, mkdirSync, readdirSync, lstatSync, realpathSync, existsSync, renameSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strictJson, safePath, sha256, mime, assetName } from './resource-protocol.mjs';
import { dynamicId, validateDynamicCatalog } from './dynamic-protocol.mjs';
import { createZip, readStoredZip, inspectResources } from './resource-bundle.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
function git(directory, args) { return execFileSync('git', args, {cwd:directory, encoding:'utf8', env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'}}).trim(); }
export function dynamicSources(bytes) {
  const lock=strictJson(bytes); if(lock.schemaVersion!==1 || !Array.isArray(lock.sources) || lock.sources.length>16) throw new Error('Dynamic source lock');
  const ids=new Set();
  for(const source of lock.sources) {
    if(!dynamicId(source.id) || ids.has(source.id) || !/^https:\/\/github\.com\/xiaoxuhui\/[A-Za-z0-9_.-]+\.git$/.test(source.repository) || !/^[0-9a-f]{40}$/.test(source.revision)) throw new Error('Dynamic immutable source identity');
    ids.add(source.id);safePath(source.directory);
    if(!Array.isArray(source.files) || !source.files.length || new Set(source.files).size!==source.files.length) throw new Error('Dynamic source file list');
    source.files.forEach(safePath); if(!source.files.includes('LICENSE') || !source.files.includes(source.entryPage)) throw new Error('Dynamic required files');
  }
  return lock;
}
export function packDynamic(source, entries) {
  if(entries.map(e=>e.path).sort().join('\0')!==[...source.files].sort().join('\0')) throw new Error('Dynamic complete files');
  inspectResources(entries,source.id);const archive=createZip(entries);
  const game={id:source.id,displayName:source.displayName,iconKind:source.iconKind,available:source.available,version:source.version,contentCode:source.contentCode,
    sourceRepository:source.repository,sourceRevision:source.revision,minHostVersionCode:4,maxHostVersionCode:2147483647,resourceProtocol:2,bridgeProtocol:1,
    storageContract:source.storageContract,entryPage:source.entryPage,archiveBytes:archive.length,archiveSha256:sha256(archive),
    files:[...entries].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0).map(e=>({path:e.path,bytes:e.data.length,sha256:sha256(e.data),mime:mime(e.path)})),releaseNotes:source.releaseNotes};
  const issued=new Date(),expires=new Date(issued.getTime()+86400000);
  validateDynamicCatalog({schemaVersion:2,channel:'game-hub-resources-v2',releaseId:1,catalogSequence:'1',issuedAt:issued.toISOString(),expiresAt:expires.toISOString(),games:[{...game,assetId:1}]},issued.getTime());
  if(source.storageContract!==`${source.id}-dynamic-v1`) throw new Error('Production storage contract');
  return {game,archive};
}
function walk(directory, base=directory) {
  return readdirSync(directory).sort().flatMap(name=>{
    const file=join(directory,name),stat=lstatSync(file);
    if(stat.isSymbolicLink() || realpathSync(file)!==resolve(file)) throw new Error('Dynamic source link');
    if(stat.isDirectory()) return walk(file,base);
    if(!stat.isFile()) throw new Error('Dynamic special file');
    return [{path:relative(base,file).split(sep).join('/'),data:readFileSync(file)}];
  });
}
export function verifyDynamicResources(output=join(root,'.build/dynamic-candidate'), checkout=root) {
  const bytes=readFileSync(join(checkout,'dynamic-sources.lock.json')),lock=dynamicSources(bytes),candidate=strictJson(readFileSync(join(output,'candidate.json')));
  if(candidate.schemaVersion!==1 || candidate.sourceLockSha256!==sha256(bytes) || candidate.bundleCommit!==git(checkout,['rev-parse','HEAD'])) throw new Error('Stale dynamic candidate');
  const games=strictJson(readFileSync(join(output,'games.unsigned.json')));
  if(!Array.isArray(games) || games.length!==lock.sources.length || new Set(games.map(g=>g.id)).size!==games.length) throw new Error('Dynamic candidate identities');
  const expected=[...games.map(assetName),'candidate.json','games.unsigned.json'].sort();
  if(JSON.stringify(readdirSync(output).sort())!==JSON.stringify(expected) || expected.some(name=>!lstatSync(join(output,name)).isFile() || lstatSync(join(output,name)).isSymbolicLink())) throw new Error('Unexpected dynamic candidate file');
  for(const game of games) {
    const source=lock.sources.find(s=>s.id===game.id);if(!source) throw new Error('Unknown dynamic candidate');
    const archive=readFileSync(join(output,assetName(game))),packed=packDynamic(source,readStoredZip(archive));
    if(!packed.archive.equals(archive) || JSON.stringify(packed.game)!==JSON.stringify(game)) throw new Error('Dynamic candidate metadata mismatch');
  }
  console.log(`Verified ${games.length} dynamic resource ZIPs; ${candidate.bundleCommit}`);return games;
}
export function prepareDynamicResources(checkout=root) {
  if(process.env.GAME_HUB_LOCAL_SOURCES || git(checkout,['status','--porcelain=v1','--untracked-files=all'])) throw new Error('Dynamic production requires clean independent checkout and remote SHA sources');
  const bytes=readFileSync(join(checkout,'dynamic-sources.lock.json')),lock=dynamicSources(bytes),build=join(checkout,'.build');mkdirSync(build,{recursive:true});
  if(realpathSync(build)!==resolve(build)) throw new Error('Dynamic build root link');
  const sources=join(build,'dynamic-sources');mkdirSync(sources,{recursive:true});
  if(realpathSync(sources)!==resolve(sources)) throw new Error('Dynamic checkout root link');
  const staging=mkdtempSync(join(build,'dynamic-staging-')),output=join(build,'dynamic-candidate'),backup=staging+'-previous';
  try {
    const games=lock.sources.map(source=>{
      const directory=join(sources,source.id);
      const fresh=!existsSync(directory);
      if(fresh) execFileSync('git',['clone','--quiet','--no-local','--no-checkout',source.repository,directory],{cwd:checkout,stdio:'inherit',env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
      if(realpathSync(directory)!==resolve(directory) || git(directory,['remote','get-url','origin'])!==source.repository || !fresh && git(directory,['status','--porcelain=v1','--untracked-files=all'])) throw new Error('Dynamic checkout identity or dirty tree');
      git(directory,['config','core.autocrlf','false']);git(directory,['fetch','--quiet','origin',source.revision]);git(directory,['checkout','--quiet','--detach',source.revision]);
      if(git(directory,['rev-parse','HEAD'])!==source.revision || git(directory,['status','--porcelain=v1','--untracked-files=all'])) throw new Error('Dynamic immutable checkout');
      const content=join(directory,source.directory);if(realpathSync(content)!==resolve(content)) throw new Error('Dynamic directory link');
      const entries=walk(content);if(!entries.some(e=>e.path==='LICENSE' && /^MIT License\r?\n/.test(e.data.toString('utf8')))) throw new Error('Dynamic MIT license');
      const packed=packDynamic(source,entries);writeFileSync(join(staging,assetName(packed.game)),packed.archive);return packed.game;
    });
    writeFileSync(join(staging,'games.unsigned.json'),JSON.stringify(games,null,2)+'\n');
    writeFileSync(join(staging,'candidate.json'),JSON.stringify({schemaVersion:1,bundleCommit:git(checkout,['rev-parse','HEAD']),sourceLockSha256:sha256(bytes)})+'\n');
    verifyDynamicResources(staging,checkout);
    if(existsSync(output)) renameSync(output,backup);
    try {renameSync(staging,output);}catch(error){if(existsSync(backup))renameSync(backup,output);throw error;}
    if(existsSync(backup))rmSync(backup,{recursive:true,force:true});return games;
  }finally{if(existsSync(staging))rmSync(staging,{recursive:true,force:true});}
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try{if(process.argv.length===2)prepareDynamicResources();else if(process.argv.length===3 && process.argv[2]==='--verify')verifyDynamicResources();else throw new Error('Usage: dynamic-resources.mjs [--verify]');}
  catch(error){console.error(error.message);process.exitCode=1;}
}
