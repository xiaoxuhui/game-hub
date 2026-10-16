export const LIMITS = Object.freeze({ file:20*1024*1024, game:100*1024*1024, files:2000, games:32, cache:150*1024*1024, reserve:20*1024*1024 });
const ID=/^[a-z][a-z0-9-]{0,63}$/;
const SHA=/^[0-9a-f]{64}$/;
const MIME=new Set(['text/html','text/css','application/javascript','application/json','text/plain','image/png','image/jpeg','image/webp','image/gif','image/svg+xml','image/x-icon','font/woff2']);
function insist(value,message){if(!value)throw new Error(message);}
export function mimeForPath(path){
  if(path.split('/').at(-1)==='LICENSE')return 'text/plain';
  const type=({html:'text/html',js:'application/javascript',mjs:'application/javascript',css:'text/css',json:'application/json',md:'text/plain',txt:'text/plain',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',ico:'image/x-icon',woff2:'font/woff2'})[path.split('.').at(-1).toLowerCase()];
  insist(type,'Unsupported resource extension');return type;
}
export function safePath(value){
  insist(typeof value==='string' && value.length>0 && value.length<=240 && !/[\\:%?#\x00-\x20]/.test(value),'Unsafe path');
  const parts=value.split('/');
  insist(parts.length<=16 && parts.every(p=>/^[A-Za-z0-9_.-]+$/.test(p) && !['.','..','.git'].includes(p) && !p.endsWith('.') && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)),'Unsafe path component');
  insist(!/\.(?:apk|dex|jar|class|so|exe|dll|bat|cmd|ps1)$/i.test(value),'Native executable');
  return value;
}
export function normalizeBase(value){
  insist(typeof value==='string' && value.startsWith('/') && value.endsWith('/'),'Base path must be an absolute directory');
  if(value!=='/')safePath(value.slice(1,-1));
  return value;
}
export function resourcePath(base,id,code,digest,entry){
  normalizeBase(base);insist(ID.test(id),'Game id');insist(Number.isSafeInteger(code)&&code>0,'Content code');insist(SHA.test(digest),'Content digest');safePath(entry);
  return `${base}games/${id}/${code}/${digest}/${entry}`;
}
export function ownsKey(storage,key){return typeof key==='string' && (storage.keys.includes(key)||storage.prefixes.some(p=>key.startsWith(p)));}
function exact(object,required,optional=[]){
  insist(object && typeof object==='object' && !Array.isArray(object),'Expected object');
  insist(required.every(k=>Object.hasOwn(object,k)) && Object.keys(object).every(k=>[...required,...optional].includes(k)),'Unknown or missing field');
}
export function validateSourceLock(lock){
  exact(lock,['schemaVersion','platform','sources']);
  insist(lock.schemaVersion===1&&lock.platform==='web'&&Array.isArray(lock.sources)&&lock.sources.length>0&&lock.sources.length<=LIMITS.games,'Web source contract');
  const ids=new Set(),owners=[];
  for(const game of lock.sources){
    exact(game,['id','displayName','version','webContentCode','repository','revision','entryPage','storage','files','buildKind'],['sourceDirectory','category','iconKind','sourceProof']);
    insist(ID.test(game.id)&&!ids.has(game.id),'Duplicate game identity');ids.add(game.id);
    insist(typeof game.displayName==='string'&&game.displayName.length>0&&game.displayName.length<=80&&!/[\x00-\x1f]/.test(game.displayName),'Display name');
    insist(/^\d+\.\d+\.\d+$/.test(game.version)&&Number.isSafeInteger(game.webContentCode)&&game.webContentCode>0,'Web version');
    insist(/^https:\/\/github\.com\/xiaoxuhui\/[A-Za-z0-9_.-]+\.git$/.test(game.repository)&&/^[0-9a-f]{40}$/.test(game.revision),'Immutable public source');
    insist(['static','eml','turing','dynamic'].includes(game.buildKind),'Unknown build adapter');
    if(game.buildKind==='dynamic'){insist(typeof game.sourceDirectory==='string','Dynamic directory required');safePath(game.sourceDirectory);}
    else insist(!Object.hasOwn(game,'sourceDirectory'),'Unexpected source directory');
    safePath(game.entryPage);exact(game.storage,['keys','prefixes']);
    insist([game.storage.keys,game.storage.prefixes].every(a=>Array.isArray(a)&&a.length<=128&&new Set(a).size===a.length&&a.every(v=>typeof v==='string'&&v.length>=4&&v.length<=180&&!/[\x00-\x1f]/.test(v)&&!v.startsWith('game-hub-web.'))),'Storage ownership');
    for(const previous of owners){
      insist(!game.storage.keys.some(k=>ownsKey(previous,k))&&!previous.keys.some(k=>ownsKey(game.storage,k))&&!game.storage.prefixes.some(p=>previous.prefixes.some(q=>p.startsWith(q)||q.startsWith(p))),'Storage owners collide');
    }
    owners.push(game.storage);
    insist(Array.isArray(game.files)&&game.files.length>0&&game.files.length<=LIMITS.files,'File count');
    const paths=new Set();let bytes=0;
    for(const file of game.files){
      exact(file,['path','bytes','sha256','mime']);safePath(file.path);
      const key=file.path.toLowerCase();
      insist(!key.startsWith('__hub/')&&!paths.has(key)&&![...paths].some(p=>key.startsWith(p+'/')||p.startsWith(key+'/')),'File path collision');paths.add(key);
      insist(Number.isSafeInteger(file.bytes)&&file.bytes>=0&&file.bytes<=LIMITS.file&&SHA.test(file.sha256)&&MIME.has(file.mime)&&file.mime===mimeForPath(file.path),'File identity or MIME mismatch');bytes+=file.bytes;
    }
    insist(bytes<=LIMITS.game&&game.files.some(f=>f.path===game.entryPage)&&game.files.some(f=>f.path==='LICENSE'),'Complete game and license');
  }
  return lock;
}
