import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPublicKey} from 'node:crypto';
import {assetName,sha256,strictJson,verifyEnvelope,LIMITS} from './resource-protocol.mjs';
import {captureReleaseSnapshot,validateReleaseSnapshot,attachAssets} from './resource-catalog.mjs';
import {validateSigningInput} from './dynamic-catalog.mjs';
import {validateDynamicCatalog} from './dynamic-protocol.mjs';
import {verifyDynamicResources} from './dynamic-resources.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const releaseId=407394942,keyId='resources-20261008';
const der=readFileSync(join(root,'android/app/src/main/res/raw/resource_public_key.der'));
if(sha256(der)!=='649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673')throw new Error('Production trust root changed');
const publicKey=createPublicKey({key:der,format:'der',type:'spki'});
const put=(directory,name,bytes)=>writeFileSync(join(directory,name),bytes,{flag:'wx'});
const json=(directory,name)=>strictJson(readFileSync(join(directory,name)),4*1048576);
function previous(directory,expected){
  if(!/^[0-9a-f]{64}$/.test(expected))throw new Error('Exact previous catalog SHA required');
  const bytes=readFileSync(join(directory,'previous.signed.json'));
  if(sha256(bytes)!==expected)throw new Error('Previous signed history changed');
  const catalog=verifyEnvelope(bytes,publicKey,keyId).catalog;
  validateDynamicCatalog(catalog,Date.parse(catalog.issuedAt));
  if(catalog.releaseId!==releaseId)throw new Error('Fixed resource release changed');
  return catalog;
}
export function successorPayload(old,games,snapshot,sequence,now=Date.now()){
  if(!/^[1-9][0-9]{0,18}$/.test(sequence)||BigInt(sequence)!==BigInt(old.catalogSequence)+1n)throw new Error('Exact next sequence required');
  if(!games.length||new Set(games.map(g=>g.id)).size!==games.length)throw new Error('Candidate identity set');
  const replacements=attachAssets(games,snapshot.release,snapshot.assetPages.flatMap(p=>p.assets),'game-resources-v2');
  const merged=old.games.map(g=>replacements.find(n=>n.id===g.id)??g);
  merged.push(...replacements.filter(g=>!old.games.some(o=>o.id===g.id)));
  const payload={schemaVersion:2,channel:'game-hub-resources-v2',releaseId:old.releaseId,catalogSequence:sequence,
    issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+89*86400000).toISOString(),games:merged};
  validateSigningInput(payload,snapshot,old,now);return payload;
}
export function validateHistoryCatalogs(history,current,snapshot){
  const catalogs=[...history,current].sort((a,b)=>BigInt(a.catalogSequence)<BigInt(b.catalogSequence)?-1:1);
  if(BigInt(current.catalogSequence)!==BigInt(catalogs.length))throw new Error('Incomplete signed history chain');
  for(let i=0;i<catalogs.length;i++){
    if(catalogs[i].catalogSequence!==String(i+1))throw new Error('Duplicate or missing signed history sequence');
    validateSigningInput(catalogs[i],snapshot,i?catalogs[i-1]:null,Date.parse(catalogs[i].issuedAt));
  }
  return catalogs;
}
export function publicDownloadUrl(asset){
  if(!Number.isSafeInteger(asset.id)||asset.id<1)throw new Error('Public asset identity');
  const url=new URL(asset.browser_download_url);
  if(url.origin!=='https://github.com'||url.pathname!==`/xiaoxuhui/game-hub/releases/download/game-resources-v2/${asset.name}`)throw new Error('Public asset URL changed');
  // catalog.signed.json is replaced by a new immutable asset ID. Bind the CDN cache key to that ID.
  url.searchParams.set('verified_asset_id',String(asset.id));return url;
}
async function download(asset){
  const url=publicDownloadUrl(asset);
  const response=await fetch(url,{headers:{'User-Agent':'game-hub-resource-successor','Cache-Control':'no-cache'},signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error(`Asset HTTP ${response.status}`);
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>LIMITS.archive)throw new Error('Asset byte limit');chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);
  if(bytes.length!==asset.size||asset.state!=='uploaded'||asset.digest!==`sha256:${sha256(bytes)}`)throw new Error('Public asset bytes mismatch');
  return bytes;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const [mode,directory,expected,sequence]=process.argv.slice(2);
    if(!directory||!expected||!sequence)throw new Error('Usage: resource-successor.mjs preflight|payload|online directory previous-sha next-sequence');
    if(mode==='preflight'){
      const snapshot=await captureReleaseSnapshot(fetch,'game-resources-v2');
      if(snapshot.release.id!==releaseId)throw new Error('Fixed resource release changed');
      const assets=snapshot.assetPages.flatMap(p=>p.assets),current=assets.filter(a=>a.name==='catalog.signed.json');
      if(current.length!==1)throw new Error('Current catalog unavailable; inspect interrupted issuance');
      const bytes=await download(current[0]);if(sha256(bytes)!==expected)throw new Error('Expected old catalog differs; inspect current issuance');
      put(directory,'previous.signed.json',bytes);put(directory,'before-snapshot.json',JSON.stringify(snapshot,null,2)+'\n');
      const old=previous(directory,expected);validateReleaseSnapshot(old,snapshot,'game-resources-v2');
      if(BigInt(sequence)!==BigInt(old.catalogSequence)+1n)throw new Error('Exact next sequence required');
      const games=verifyDynamicResources();
      // Validate new metadata, cumulative identities and rollback rules before any credentials or uploads.
      const fake=structuredClone(snapshot);let id=Math.max(...assets.map(a=>a.id))+1;
      for(const game of games){if(!assets.some(a=>a.name===assetName(game)))fake.assetPages.at(-1).assets.push({id:id++,name:assetName(game),state:'uploaded',size:game.archiveBytes,digest:`sha256:${game.archiveSha256}`});}
      // A synthetic page is only for local candidate admission; real issuance requires freshly captured complete pages.
      const all=fake.assetPages.flatMap(p=>p.assets),pages=[];
      for(let i=0;i<all.length;i+=100)pages.push({page:pages.length+1,hasNext:i+100<all.length,assets:all.slice(i,i+100)});
      const admission={...fake,assetPages:pages};
      successorPayload(old,games,admission,sequence);
      console.log(`Preflight verified previous sequence ${old.catalogSequence}, ${games.length} immutable candidates`);
    }else if(mode==='payload'){
      const old=previous(directory,expected),snapshot=await captureReleaseSnapshot(fetch,'game-resources-v2');
      validateReleaseSnapshot(old,snapshot,'game-resources-v2');
      const current=snapshot.assetPages.flatMap(p=>p.assets).filter(a=>a.name==='catalog.signed.json');
      if(current.length!==1||current[0].digest!==`sha256:${expected}`)throw new Error('Current history moved since preflight');
      const payload=successorPayload(old,verifyDynamicResources(),snapshot,sequence);
      put(directory,'signing-snapshot.json',JSON.stringify(snapshot,null,2)+'\n');
      put(directory,'payload.json',JSON.stringify(payload)+'\n');console.log(`Prepared asset-bound successor sequence ${sequence}`);
    }else if(mode==='online'){
      const old=previous(directory,expected),snapshot=await captureReleaseSnapshot(fetch,'game-resources-v2');
      validateReleaseSnapshot(old,snapshot,'game-resources-v2');
      const assets=snapshot.assetPages.flatMap(p=>p.assets),current=assets.filter(a=>a.name==='catalog.signed.json');
      if(current.length!==1)throw new Error('Current catalog missing');
      const bytes=await download(current[0]),local=readFileSync(join(directory,'catalog.signed.json'));
      if(!bytes.equals(local))throw new Error('Online signed bytes differ from reviewed issuance');
      const next=verifyEnvelope(bytes,publicKey,keyId).catalog;validateSigningInput(next,snapshot,old);
      if(next.catalogSequence!==sequence)throw new Error('Online sequence mismatch');
      const history=assets.filter(a=>a.name===`catalog-seq${old.catalogSequence}-${expected.slice(0,12)}.signed.json`);
      if(history.length!==1||sha256(await download(history[0]))!==expected)throw new Error('Archived signed history missing');
      const historical=[];
      for(const asset of assets.filter(a=>/^catalog-seq[1-9][0-9]*-[0-9a-f]{12}\.signed\.json$/.test(a.name))){
        const raw=await download(asset),catalog=verifyEnvelope(raw,publicKey,keyId).catalog;
        if(asset.name!==`catalog-seq${catalog.catalogSequence}-${sha256(raw).slice(0,12)}.signed.json`)throw new Error('Historical catalog name/bytes mismatch');
        historical.push(catalog);
      }
      const catalogs=validateHistoryCatalogs(historical,next,snapshot);
      const results=[];
      for(const game of catalogs.flatMap(c=>c.games)){
        if(results.some(r=>r.assetId===game.assetId))continue;
        const asset=assets.find(a=>a.id===game.assetId),zip=await download(asset);
        if(sha256(zip)!==game.archiveSha256||zip.length!==game.archiveBytes)throw new Error('Signed ZIP identity mismatch');
        results.push({id:game.id,contentCode:game.contentCode,assetId:asset.id,bytes:zip.length,sha256:sha256(zip)});
      }
      put(directory,'online-snapshot.json',JSON.stringify(snapshot,null,2)+'\n');
      put(directory,'online-verified.json',JSON.stringify({catalogSequence:sequence,catalogAssetId:current[0].id,catalogSha256:sha256(bytes),historyAssetId:history[0].id,verifiedHistorySequences:catalogs.map(c=>c.catalogSequence),resources:results},null,2)+'\n');
      console.log(`Verified online sequence ${sequence}, ${results.length} cumulative resources across ${catalogs.length} signed catalogs`);
    }else throw new Error('Unknown successor mode');
  }catch(error){console.error(error.message);process.exitCode=1;}
}
