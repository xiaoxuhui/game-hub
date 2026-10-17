import {normalizeBase,safePath,mimeForPath,SHELL_CSP} from '../core/contracts.mjs';
import {sha256Hex} from '../core/digests.mjs';
import {canonicalResponse,verifyResponse} from './resource-files.mjs';
import {SHELL_GENERATION} from './shell-ledger.mjs';
function insist(value,message){if(!value)throw Error(message);}
export function validateShellManifest(manifest){
  insist(manifest&&Object.keys(manifest).length===4&&['schemaVersion','build','basePath','files'].every(k=>Object.hasOwn(manifest,k))&&manifest.schemaVersion===1&&/^[a-f0-9]{40}$/.test(manifest.build),'Unknown shell manifest');normalizeBase(manifest.basePath);
  insist(Array.isArray(manifest.files)&&manifest.files.length>0&&manifest.files.length<=512,'Invalid shell file count');let bytes=1024;const paths=new Set();
  for(const file of manifest.files){
    safePath(file.path);insist(!['sw.js','build-manifest.json','catalog.json'].includes(file.path)&&!file.path.startsWith('__hub/current')&&!file.path.startsWith('games/')&&Object.keys(file).length===4&&['path','bytes','sha256','mime'].every(k=>Object.hasOwn(file,k))&&Number.isSafeInteger(file.bytes)&&file.bytes>=0&&!Object.is(file.bytes,-0)&&/^[a-f0-9]{64}$/.test(file.sha256)&&file.mime===mimeForPath(file.path)&&!paths.has(file.path.toLowerCase()),'Invalid shell file');paths.add(file.path.toLowerCase());bytes+=file.bytes;insist(bytes<=SHELL_GENERATION,'Shell generation budget exceeded');
  }
  return {hash:sha256Hex(JSON.stringify(manifest)),bytes};
}
export function shellMarker(record,manifest,origin){
  const identity=validateShellManifest(manifest);insist(record.build===manifest.build&&record.manifestHash===identity.hash&&record.bytes===identity.bytes&&Number.isSafeInteger(record.fence)&&record.fence>0,'Shell cache identity differs');
  const bytes=new TextEncoder().encode(JSON.stringify({schemaVersion:1,build:record.build,fence:record.fence,manifestHash:record.manifestHash})+'\n');insist(bytes.length<=1024,'Shell marker limit');
  return {url:origin+manifest.basePath+'__hub/shell/'+record.fence+'.json',bytes,file:{path:'marker.json',bytes:bytes.length,sha256:sha256Hex(bytes),mime:'application/json'}};
}
export function shellResponse(bytes,file){const response=canonicalResponse(bytes,file,SHELL_CSP);response.headers.set('cache-control','no-cache, must-revalidate');return response;}
export async function verifyShellResponse(response,file){
  insist(response?.headers.get('cache-control')==='no-cache, must-revalidate','Shell response cache policy differs');return await verifyResponse(response,file,{csp:SHELL_CSP});
}
export async function verifyShellCache(cache,{record,manifest,origin}){
  const marker=shellMarker(record,manifest,origin),urls=manifest.files.map(f=>origin+manifest.basePath+f.path),expected=[...urls,marker.url].map(url=>'GET '+url).sort(),keys=(await cache.keys()).map(r=>r.method+' '+r.url).sort();
  insist(JSON.stringify(keys)===JSON.stringify(expected),'Shell cache is incomplete or unlisted');await verifyShellResponse(await cache.match(marker.url),marker.file);
  for(let i=0;i<manifest.files.length;i++)await verifyShellResponse(await cache.match(urls[i]),manifest.files[i]);return true;
}
