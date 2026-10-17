import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {nativeTuring} from './native-validation.mjs';
import {sourceLock,projectRoot} from './inputs.mjs';
import {sha256} from './files.mjs';

export async function auditNativeSource(root=projectRoot,fetcher=fetch){
  const source=sourceLock(root).sources.find(s=>s.id==='turing');nativeTuring(root,source);
  const manifest=JSON.parse(readFileSync(join(root,'web/native-validation/turing/provenance.json'))),repo=new URL(source.repository).pathname.slice(1,-4);
  const results=await Promise.allSettled(manifest.files.map(async file=>{
    const url=`https://raw.githubusercontent.com/${repo}/${source.revision}/${file.sourcePath}`;
    const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok||!response.body)throw Error('Native source HTTP failure: '+file.sourcePath);
    const reader=response.body.getReader(),parts=[];let total=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>file.bytes)throw Error('Native upstream byte limit: '+file.sourcePath);parts.push(value);}}
    catch(error){await reader.cancel().catch(()=>{});throw error;}
    const bytes=Buffer.concat(parts);if(total!==file.bytes||sha256(bytes)!==file.sha256)throw Error('Native upstream source mismatch: '+file.sourcePath);
    return file.path;
  }));
  const failed=results.filter(r=>r.status==='rejected');if(failed.length)throw new AggregateError(failed.map(r=>r.reason),'Native upstream source audit failed');
  return {repository:source.repository,revision:source.revision,files:results.length,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))auditNativeSource().then(value=>console.log(JSON.stringify(value)),error=>{console.error(error.message);for(const cause of error.errors??[])console.error(cause.message);process.exitCode=1;});
