import {GAME_CSP,normalizeBase} from './contracts.mjs';
import {validateOnlineCatalog,snapshot,SHELL_VERSION} from './online-catalog.mjs';
import {sha256Hex} from './digests.mjs';
import {strictJson} from './strict-json.mjs';

const CHANNEL='game-hub-web-v1',SKEW=300000,MAX_AGE=90*86400000;
const SHA=/^[a-f0-9]{64}$/,COMMIT=/^[a-f0-9]{40}$/,ID=/^[a-z][a-z0-9-]{0,63}$/;
const VERSION=/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const CAPABILITIES=new Set(['storage','files','worker','audio','microphone']);
const ICONS=new Set(['conway','eml','light','turing','simulation','logic','puzzle','generic']);
const GAME_FIELDS='id displayName version contentCode digest entryUrl entryPage category iconKind sourceRepository sourceRevision storage sourceFiles files csp available adapterRevision storageContract webCapabilities releaseNotes'.split(' ');
function insist(value,message){if(!value)throw Error(message);}
function exact(value,fields){insist(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===fields.length&&fields.every(k=>Object.hasOwn(value,k)),'Unknown or missing signed field');}
function version(value){insist(typeof value==='string'&&value.length<=32&&VERSION.test(value),'Invalid signed version');return value;}
function compare(a,b){const x=a.split('.').map(BigInt),y=b.split('.').map(BigInt);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;return 0;}
function sequence(value){insist(typeof value==='string'&&/^[1-9][0-9]{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n,'Invalid catalog sequence');return BigInt(value);}
function clock(value){insist(Number.isSafeInteger(value)&&value>=0&&Number.isFinite(new Date(value).getTime()),'Invalid authorization clock');return value;}
function date(value){insist(typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value,'Noncanonical signed date');return Date.parse(value);}
function origin(value){let parsed;try{parsed=new URL(value);}catch{throw Error('Invalid origin');}insist(typeof value==='string'&&parsed.origin===value&&(parsed.protocol==='https:'||(parsed.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(parsed.hostname))),'Unsafe origin');return value;}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function rejectNegativeZero(value){if(typeof value==='number')insist(!Object.is(value,-0),'Noncanonical negative zero');else if(value&&typeof value==='object')Object.values(value).forEach(rejectNegativeZero);}
function decode64(value,max){
  insist(typeof value==='string'&&value.length>0&&value.length<=4*Math.ceil(max/3)&&value.length%4===0&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value),'Invalid Base64');
  const raw=atob(value);insist(raw.length<=max&&btoa(raw)===value,'Noncanonical Base64');return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
function historyCopy(value,expectedOrigin,basePath){
  if(value===null)return null;
  // Capture before the first crypto await; callers cannot replace the watermark.
  const copy=structuredClone(value);rejectNegativeZero(copy);
  exact(copy,['schemaVersion','channel','origin','basePath','catalogSequence','payloadSha256','shellVersion','acceptedAt','games']);
  insist(copy.schemaVersion===1&&copy.channel===CHANNEL&&copy.origin===expectedOrigin&&copy.basePath===basePath,'Invalid signed history scope');
  sequence(copy.catalogSequence);version(copy.shellVersion);clock(copy.acceptedAt);insist(SHA.test(copy.payloadSha256),'Invalid history payload digest');
  insist(Array.isArray(copy.games)&&copy.games.length>0&&copy.games.length<=32,'Invalid history games');const ids=new Set();
  for(const game of copy.games){exact(game,['id','contentCode','digest','descriptorHash','storageHash']);insist(typeof game.id==='string'&&ID.test(game.id)&&!ids.has(game.id)&&Number.isSafeInteger(game.contentCode)&&game.contentCode>0&&[game.digest,game.descriptorHash,game.storageHash].every(s=>typeof s==='string'&&SHA.test(s)),'Invalid history identity');ids.add(game.id);}
  return copy;
}
function validatePayload(p,expectedOrigin,basePath,now){
  exact(p,['schemaVersion','channel','catalogSequence','issuedAt','expiresAt','origin','basePath','shellVersion','sourceCommit','games']);rejectNegativeZero(p);
  insist(p.schemaVersion===1&&p.channel===CHANNEL,'Unknown signed channel');sequence(p.catalogSequence);
  insist(origin(p.origin)===expectedOrigin&&normalizeBase(p.basePath)===basePath,'Signed deployment scope mismatch');
  const issued=date(p.issuedAt),expires=date(p.expiresAt);insist(expires>issued&&expires-issued<=MAX_AGE&&now>=issued-SKEW&&now<expires,'Expired or future authorization');
  version(p.shellVersion);insist(compare(p.shellVersion,SHELL_VERSION)>=0&&typeof p.sourceCommit==='string'&&COMMIT.test(p.sourceCommit),'Signed shell identity');
  insist(Array.isArray(p.games)&&p.games.length>0&&p.games.length<=32,'Signed game count');
  for(const g of p.games){
    exact(g,GAME_FIELDS);version(g.version);
    insist(g.csp===GAME_CSP&&typeof g.available==='boolean'&&typeof g.adapterRevision==='string'&&COMMIT.test(g.adapterRevision)&&g.storageContract==='game-hub-web-save-v1'&&ICONS.has(g.iconKind),'Signed game contract');
    insist(Array.isArray(g.webCapabilities)&&g.webCapabilities.length<=CAPABILITIES.size&&new Set(g.webCapabilities).size===g.webCapabilities.length&&g.webCapabilities.every(c=>CAPABILITIES.has(c))&&(!g.webCapabilities.includes('microphone')||g.webCapabilities.includes('audio')),'Unknown or inconsistent capability');
    insist(typeof g.releaseNotes==='string'&&g.releaseNotes.length<=2000&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(g.releaseNotes),'Invalid release notes');
  }
  // Reuse the reviewed online metadata/tree checks, without granting online or
  // installed state. Only this temporary validation view carries mode=online.
  return validateOnlineCatalog({schemaVersion:1,platform:'web',trust:'https-online',shellVersion:p.shellVersion,basePath,sourceCommit:p.sourceCommit,games:p.games.map(g=>({...g,mode:'online'}))},basePath);
}
function nextHistory(p,online,payloadSha256,now,previous){
  const descriptors=new Map(snapshot(online).games.map(g=>[g.id,g.descriptorHash]));
  const games=p.games.map(g=>({id:g.id,contentCode:g.contentCode,digest:g.digest,
    descriptorHash:sha256Hex(JSON.stringify({base:descriptors.get(g.id),adapterRevision:g.adapterRevision,storageContract:g.storageContract,webCapabilities:[...g.webCapabilities].sort(),releaseNotes:g.releaseNotes,available:g.available})),
    storageHash:sha256Hex(JSON.stringify({contract:g.storageContract,keys:[...g.storage.keys].sort(),prefixes:[...g.storage.prefixes].sort()}))}));
  if(previous){
    insist(now>=previous.acceptedAt-SKEW&&compare(p.shellVersion,previous.shellVersion)>=0,'Clock or shell history rollback');
    const seq=sequence(p.catalogSequence),old=sequence(previous.catalogSequence);insist(seq>=old&&(seq!==old||payloadSha256===previous.payloadSha256),'Catalog sequence rollback or reuse');
    const current=new Map(games.map(g=>[g.id,g]));
    for(const before of previous.games){const after=current.get(before.id);insist(after&&after.contentCode>=before.contentCode&&after.storageHash===before.storageHash&&(after.contentCode!==before.contentCode||(after.digest===before.digest&&after.descriptorHash===before.descriptorHash)),'Game removed, rolled back or identity replaced');}
  }
  return {schemaVersion:1,channel:CHANNEL,origin:p.origin,basePath:p.basePath,catalogSequence:p.catalogSequence,payloadSha256,shellVersion:p.shellVersion,acceptedAt:Math.max(now,previous?.acceptedAt??0),games};
}

// Pure fresh authorization. No Cache/IDB writes and no expired-install bypass.
export async function verifySignedCatalog(bytes,{spki,keyId,origin:expectedOrigin,basePath,now=Date.now(),history=null,crypto=globalThis.crypto}={}){
  insist(bytes instanceof Uint8Array,'Envelope bytes required');
  insist(spki instanceof Uint8Array&&spki.length>=128&&spki.length<=2048,'SPKI bytes required');const keyBytes=new Uint8Array(spki);
  insist(typeof keyId==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(keyId),'Invalid pinned key id');origin(expectedOrigin);normalizeBase(basePath);clock(now);
  const previous=historyCopy(history,expectedOrigin,basePath),envelope=strictJson(bytes,8*1024*1024);
  exact(envelope,['envelopeVersion','keyId','payloadBase64','signatureBase64']);insist(envelope.envelopeVersion===1&&envelope.keyId===keyId,'Unknown signature envelope');
  const payload=decode64(envelope.payloadBase64,4*1024*1024),signature=decode64(envelope.signatureBase64,384);insist(signature.length===384,'RSA3072 signature length');
  insist(crypto?.subtle&&typeof crypto.subtle.importKey==='function'&&typeof crypto.subtle.verify==='function','WebCrypto unavailable');
  const key=await crypto.subtle.importKey('spki',keyBytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  insist(key.type==='public'&&key.algorithm.name==='RSASSA-PKCS1-v1_5'&&key.algorithm.modulusLength===3072&&key.algorithm.hash.name==='SHA-256','RSA3072 key required');
  insist(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,signature,payload),'Signature verification failed');
  const catalog=strictJson(payload),online=validatePayload(catalog,expectedOrigin,basePath,now),payloadSha256=sha256Hex(payload);
  return freeze({catalog,payloadSha256,history:nextHistory(catalog,online,payloadSha256,now,previous)});
}
