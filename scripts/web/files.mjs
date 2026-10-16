import {createHash} from 'node:crypto';
import {readdirSync,lstatSync,realpathSync,readFileSync,rmSync} from 'node:fs';
import {resolve,relative,join,isAbsolute,sep} from 'node:path';
import {safePath,mimeForPath} from '../../web/src/core/contracts.mjs';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export function inside(root,target){
  root=resolve(root);target=resolve(target);const rel=relative(root,target);
  if(!rel||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))throw Error('Path outside owned root');return target;
}
export function files(directory,base=directory){
  directory=resolve(directory);if(lstatSync(directory).isSymbolicLink()||realpathSync(directory)!==directory)throw Error('Directory link refused');
  return readdirSync(directory).sort().flatMap(name=>{
    const full=join(directory,name),stat=lstatSync(full);if(stat.isSymbolicLink())throw Error('File link refused');
    if(stat.isDirectory())return files(full,base);if(!stat.isFile())throw Error('Special file refused');
    const path=relative(base,full).split(sep).join('/');safePath(path);return [{path,data:readFileSync(full)}];
  }).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
export const metadata=entries=>entries.map(f=>({path:f.path,bytes:f.data.length,sha256:sha256(f.data),mime:mimeForPath(f.path)}));
export const treeHash=entries=>sha256(JSON.stringify(metadata(entries)));
export function removeOwned(buildRoot,target){inside(buildRoot,target);files(target);rmSync(target,{recursive:true,force:true});}
