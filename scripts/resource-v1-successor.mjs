import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPublicKey} from 'node:crypto';
import {assetName,sha256,strictJson,verifyEnvelope,validateCatalog,signCatalog,LIMITS} from './resource-protocol.mjs';
import {captureReleaseSnapshot,validateReleaseSnapshot,attachAssets} from './resource-catalog.mjs';
import {verifyResources} from './resource-bundle.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const releaseId=407293817,keyId='resources-20261008',tag='game-resources-v1';
const sources=strictJson(readFileSync(join(root,'sources.lock.json'))).sources;
const der=readFileSync(join(root,'android/app/src/main/res/raw/resource_public_key.der'));
if(sha256(der)!=='649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673')throw new Error('Production trust root changed');
const publicKey=createPublicKey({key:der,format:'der',type:'spki'});
const put=(directory,name,bytes)=>writeFileSync(join(directory,name),bytes,{flag:'wx'});
const json=(directory,name)=>strictJson(readFileSync(join(directory,name)),4*1048576);
function exactSequence(next,old){
 if(!/^[1-9][0-9]{0,18}$/.test(next)||BigInt(next)!==BigInt(old)+1n)throw new Error('Exact next sequence required');
}
export function validateV1SigningInput(payload,snapshot,old=null,now=Date.now()){
 validateCatalog(payload,sources,now);validateReleaseSnapshot(payload,snapshot,tag);
 if(payload.releaseId!==releaseId)throw new Error('Fixed v1 release changed');
 if(!old){if(payload.catalogSequence!=='1')throw new Error('Initial sequence must be 1; signed history required');return payload;}
 validateCatalog(old,sources,Date.parse(old.issuedAt));
 if(old.releaseId!==releaseId)throw new Error('Previous fixed release changed');
 exactSequence(payload.catalogSequence,old.catalogSequence);
 const identity=g=>JSON.stringify(Object.fromEntries(Object.entries(g).sort(([a],[b])=>a.localeCompare(b))));
 for(const prior of old.games){
  const game=payload.games.find(g=>g.id===prior.id);
  if(!game||game.contentCode<prior.contentCode)throw new Error('Cumulative identity or content rollback');
  if(game.contentCode===prior.contentCode&&identity(game)!==identity(prior))throw new Error('Same-code metadata or archive changed');
 }
 return payload;
}
export function v1SuccessorPayload(old,games,snapshot,sequence,now=Date.now()){
 exactSequence(sequence,old.catalogSequence);
 if(games.length!==4||new Set(games.map(g=>g.id)).size!==4)throw new Error('Four unique candidate identities required');
 const replacements=attachAssets(games,snapshot.release,snapshot.assetPages.flatMap(p=>p.assets),tag);
 const payload={schemaVersion:1,channel:'game-hub-resources-v1',releaseId,catalogSequence:sequence,
  issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+89*86400000).toISOString(),games:replacements};
 return validateV1SigningInput(payload,snapshot,old,now);
}
export function validateV1History(history,current,snapshot){
 const catalogs=[...history,current].sort((a,b)=>BigInt(a.catalogSequence)<BigInt(b.catalogSequence)?-1:1);
 if(BigInt(current.catalogSequence)!==BigInt(catalogs.length))throw new Error('Incomplete signed history chain');
 for(let i=0;i<catalogs.length;i++){
  if(catalogs[i].catalogSequence!==String(i+1))throw new Error('Duplicate or missing signed sequence');
  validateV1SigningInput(catalogs[i],snapshot,i?catalogs[i-1]:null,Date.parse(catalogs[i].issuedAt));
 }
 return catalogs;
}
export function v1PublicDownloadUrl(asset){
 if(!Number.isSafeInteger(asset.id)||asset.id<1)throw new Error('Public asset identity');
 const url=new URL(asset.browser_download_url);
 if(url.origin!=='https://github.com'||url.pathname!==`/xiaoxuhui/game-hub/releases/download/${tag}/${asset.name}`)throw new Error('Public asset URL changed');
 url.searchParams.set('verified_asset_id',String(asset.id));return url;
}
async function download(asset){
 const response=await fetch(v1PublicDownloadUrl(asset),{headers:{'User-Agent':'game-hub-v1-successor','Cache-Control':'no-cache'},signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error(`Asset HTTP ${response.status}`);
 const chunks=[];let size=0;
 for await(const chunk of response.body){size+=chunk.length;if(size>LIMITS.archive)throw new Error('Asset byte limit');chunks.push(chunk);}
 const bytes=Buffer.concat(chunks);
 if(bytes.length!==asset.size||asset.state!=='uploaded'||asset.digest!==`sha256:${sha256(bytes)}`)throw new Error('Public asset bytes mismatch');
 return bytes;
}
function previous(directory,expected){
 if(!/^[0-9a-f]{64}$/.test(expected))throw new Error('Exact previous SHA required');
 const bytes=readFileSync(join(directory,'previous.signed.json'));
 if(sha256(bytes)!==expected)throw new Error('Previous signed bytes changed');
 const catalog=verifyEnvelope(bytes,publicKey,keyId).catalog;
 validateCatalog(catalog,sources,Date.parse(catalog.issuedAt));
 if(catalog.releaseId!==releaseId)throw new Error('Previous release identity');return catalog;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [mode,directory,expected,sequence]=process.argv.slice(2);
  if(process.argv.length!==6||!directory||!expected||!sequence)throw new Error('Usage: resource-v1-successor.mjs preflight|payload|sign|online directory previous-sha next-sequence');
  if(mode==='preflight'){
   const snapshot=await captureReleaseSnapshot(fetch,tag);
   if(snapshot.release.id!==releaseId)throw new Error('Fixed release changed');
   const assets=snapshot.assetPages.flatMap(p=>p.assets),current=assets.filter(a=>a.name==='catalog.signed.json');
   if(current.length!==1)throw new Error('Current catalog unavailable; inspect interrupted issuance');
   const bytes=await download(current[0]);if(sha256(bytes)!==expected)throw new Error('Expected current catalog changed');
   put(directory,'previous.signed.json',bytes);put(directory,'before-snapshot.json',JSON.stringify(snapshot,null,2)+'\n');
   const old=previous(directory,expected);validateReleaseSnapshot(old,snapshot,tag);exactSequence(sequence,old.catalogSequence);
   const games=verifyResources(),fake=structuredClone(snapshot);let id=Math.max(...assets.map(a=>a.id))+1;
   for(const game of games)if(!assets.some(a=>a.name===assetName(game)))fake.assetPages.at(-1).assets.push({id:id++,name:assetName(game),state:'uploaded',size:game.archiveBytes,digest:`sha256:${game.archiveSha256}`});
   const all=fake.assetPages.flatMap(p=>p.assets),pages=[];
   for(let i=0;i<all.length;i+=100)pages.push({page:pages.length+1,hasNext:i+100<all.length,assets:all.slice(i,i+100)});
   v1SuccessorPayload(old,games,{...fake,assetPages:pages},sequence);
   console.log(`Preflight verified v1 sequence ${old.catalogSequence} and four immutable candidates`);
  }else if(mode==='payload'){
   const old=previous(directory,expected),snapshot=await captureReleaseSnapshot(fetch,tag);validateReleaseSnapshot(old,snapshot,tag);
   const current=snapshot.assetPages.flatMap(p=>p.assets).filter(a=>a.name==='catalog.signed.json');
   if(current.length!==1||current[0].digest!==`sha256:${expected}`)throw new Error('Current signed history moved');
   const payload=v1SuccessorPayload(old,verifyResources(),snapshot,sequence);
   put(directory,'signing-snapshot.json',JSON.stringify(snapshot,null,2)+'\n');put(directory,'payload.json',JSON.stringify(payload)+'\n');
   console.log(`Prepared asset-bound v1 sequence ${sequence}`);
  }else if(mode==='sign'){
   // Authenticate the previous production signature and full snapshot before reading any private key.
   const old=previous(directory,expected),payload=json(directory,'payload.json');
   if(payload.catalogSequence!==sequence)throw new Error('Requested signing sequence mismatch');
   validateV1SigningInput(payload,json(directory,'signing-snapshot.json'),old);
   const key=readFileSync(0);
   try{const signed=signCatalog(payload,key,keyId);verifyEnvelope(signed,publicKey,keyId);put(directory,'catalog.signed.json',signed);console.log(`Signed verified v1 sequence ${sequence}`);}finally{key.fill(0);}
  }else if(mode==='online'){
   const old=previous(directory,expected),snapshot=await captureReleaseSnapshot(fetch,tag);validateReleaseSnapshot(old,snapshot,tag);
   const assets=snapshot.assetPages.flatMap(p=>p.assets),current=assets.filter(a=>a.name==='catalog.signed.json');
   if(current.length!==1)throw new Error('Current catalog missing');
   const bytes=await download(current[0]);if(!bytes.equals(readFileSync(join(directory,'catalog.signed.json'))))throw new Error('Online signed bytes differ');
   const next=verifyEnvelope(bytes,publicKey,keyId).catalog;validateV1SigningInput(next,snapshot,old);
   if(next.catalogSequence!==sequence)throw new Error('Online sequence mismatch');
   const history=assets.filter(a=>a.name===`catalog-seq${old.catalogSequence}-${expected.slice(0,12)}.signed.json`);
   if(history.length!==1||sha256(await download(history[0]))!==expected)throw new Error('Archived previous signature missing');
   const historical=[];
   for(const asset of assets.filter(a=>/^catalog-seq[1-9][0-9]*-[0-9a-f]{12}\.signed\.json$/.test(a.name))){
    const raw=await download(asset),catalog=verifyEnvelope(raw,publicKey,keyId).catalog;
    if(asset.name!==`catalog-seq${catalog.catalogSequence}-${sha256(raw).slice(0,12)}.signed.json`)throw new Error('Historical name or bytes mismatch');historical.push(catalog);
   }
   const catalogs=validateV1History(historical,next,snapshot),results=[];
   for(const game of catalogs.flatMap(c=>c.games)){
    if(results.some(r=>r.assetId===game.assetId))continue;
    const asset=assets.find(a=>a.id===game.assetId),zip=await download(asset);
    if(sha256(zip)!==game.archiveSha256||zip.length!==game.archiveBytes)throw new Error('Signed ZIP identity mismatch');
    results.push({id:game.id,contentCode:game.contentCode,assetId:asset.id,bytes:zip.length,sha256:sha256(zip)});
   }
   put(directory,'online-snapshot.json',JSON.stringify(snapshot,null,2)+'\n');
   put(directory,'online-verified.json',JSON.stringify({catalogSequence:sequence,catalogAssetId:current[0].id,catalogSha256:sha256(bytes),historyAssetId:history[0].id,verifiedHistorySequences:catalogs.map(c=>c.catalogSequence),resources:results},null,2)+'\n');
   console.log(`Verified online v1 sequence ${sequence}, ${results.length} cumulative ZIPs across ${catalogs.length} signed catalogs`);
  }else throw new Error('Unknown successor mode');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
