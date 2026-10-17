import {GAME_CSP,LIMITS,mimeForPath,normalizeBase,resourcePath} from '../core/contracts.mjs';
import {sha256Hex,fileTreeDigest} from '../core/digests.mjs';
import {strictJson} from '../core/strict-json.mjs';
function insist(value,message){if(!value)throw Error(message);}
function abort(signal){if(signal?.aborted)throw new DOMException('Resource operation cancelled','AbortError');}
function fileIdentity(file){
  insist(file&&Object.keys(file).length===4&&['path','bytes','sha256','mime'].every(k=>Object.hasOwn(file,k))&&Number.isSafeInteger(file.bytes)&&file.bytes>=0&&!Object.is(file.bytes,-0)&&file.bytes<=LIMITS.file&&typeof file.sha256==='string'&&/^[a-f0-9]{64}$/.test(file.sha256)&&file.mime===mimeForPath(file.path),'Invalid resource file identity');
}
export function resourceURL(origin,basePath,game,path){
  const parsed=new URL(origin);insist(parsed.origin===origin&&(parsed.protocol==='https:'||(parsed.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(parsed.hostname))),'Unsafe resource origin');
  return origin+resourcePath(basePath,game.id,game.contentCode,game.digest,path);
}
function headers(mime){return {'Content-Type':mime+(/^(?:text\/|application\/(?:javascript|json))/.test(mime)?'; charset=utf-8':''),'Content-Security-Policy':GAME_CSP,'X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Referrer-Policy':'no-referrer','Cache-Control':'public, max-age=31536000, immutable'};}
export function canonicalResponse(bytes,file,csp){
  fileIdentity(file);insist(csp===GAME_CSP&&bytes instanceof Uint8Array&&bytes.length===file.bytes&&sha256Hex(bytes)===file.sha256,'Unverified canonical resource');
  return new Response(bytes,{status:200,headers:{...headers(file.mime),'Content-Length':String(bytes.length)}});
}
async function readBody(response,max,signal){
  abort(signal);insist(response.body,'Resource response has no body');const reader=response.body.getReader(),chunks=[];let length=0;
  try{while(true){abort(signal);const {done,value}=await reader.read();abort(signal);if(done)break;insist(value instanceof Uint8Array,'Invalid resource stream');length+=value.length;insist(length<=max,'Resource body exceeds signed length');chunks.push(value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export async function verifyResponse(response,file,{url,network=false,signal}={}){
  fileIdentity(file);abort(signal);
  insist(response&&response.status===200&&response.redirected===false&&(network?response.type==='basic':['basic','default'].includes(response.type)),'Resource response type or status');
  if(network)insist(typeof url==='string'&&response.url===url,'Resource response URL changed');
  insist(response.headers.get('content-type')?.split(';')[0].trim()===file.mime,'Resource MIME mismatch');
  const declared=response.headers.get('content-length'),encoding=response.headers.get('content-encoding');
  if(declared!==null){insist(/^(?:0|[1-9][0-9]*)$/.test(declared)&&Number.isSafeInteger(Number(declared))&&Number(declared)<=LIMITS.file*2,'Invalid resource Content-Length');if(!encoding||encoding==='identity')insist(Number(declared)===file.bytes,'Resource declared length mismatch');}
  if(!network)for(const name of ['content-security-policy','x-content-type-options','cross-origin-resource-policy','referrer-policy'])insist(response.headers.get(name)===new Headers(headers(file.mime)).get(name),'Cached security headers differ');
  const bytes=await readBody(response,file.bytes,signal);insist(bytes.length===file.bytes&&sha256Hex(bytes)===file.sha256,'Resource bytes or digest mismatch');return bytes;
}
export function completionMarker(record,origin,basePath){
  normalizeBase(basePath);resourceURL(origin,basePath,record,'index.html');
  insist(Number.isSafeInteger(record.fence)&&record.fence>0&&typeof record.proofHash==='string'&&/^[a-f0-9]{64}$/.test(record.proofHash),'Invalid completion fence');
  const value={schemaVersion:1,id:record.id,contentCode:record.contentCode,digest:record.digest,fence:record.fence,proofHash:record.proofHash,manifestDigest:record.digest},bytes=new TextEncoder().encode(JSON.stringify(value)+'\n');insist(bytes.length<=1024,'Completion marker limit');
  return {url:origin+basePath+'__hub/resources/'+record.fence+'.json',bytes};
}
export function markerResponse(marker){return canonicalResponse(marker.bytes,{path:'marker.json',bytes:marker.bytes.length,sha256:sha256Hex(marker.bytes),mime:'application/json'},GAME_CSP);}
export async function verifyCache(cache,{record,game,origin,basePath,signal}){
  insist(record.id===game.id&&record.contentCode===game.contentCode&&record.digest===game.digest&&game.csp===GAME_CSP&&Array.isArray(game.files)&&game.files.length>0&&game.files.length<=LIMITS.files&&fileTreeDigest(game.files)===game.digest,'Cache manifest identity mismatch');
  const marker=completionMarker(record,origin,basePath),urls=game.files.map(f=>resourceURL(origin,basePath,game,f.path)),expected=[...urls,marker.url].map(u=>'GET '+u).sort(),keys=(await cache.keys()).map(k=>k.method+' '+k.url).sort();abort(signal);
  insist(JSON.stringify(keys)===JSON.stringify(expected),'Cache is incomplete or has unlisted entries');
  const response=await cache.match(marker.url);insist(response?.status===200&&['basic','default'].includes(response.type)&&response.redirected===false&&response.headers.get('content-type')?.split(';')[0].trim()==='application/json','Missing completion marker');
  const raw=await readBody(response,1024,signal),parsed=strictJson(raw,1024),wanted=strictJson(marker.bytes,1024);insist(JSON.stringify(parsed)===JSON.stringify(wanted),'Completion marker identity mismatch');
  let bytes=0;for(let i=0;i<game.files.length;i++){await verifyResponse(await cache.match(urls[i]),game.files[i],{signal});bytes+=game.files[i].bytes;}return {files:game.files.length,bytes};
}
