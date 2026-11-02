import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {createPublicKey} from 'node:crypto';
import {sha256,strictJson,verifyEnvelope,LIMITS,assetName} from './resource-protocol.mjs';
import {captureReleaseSnapshot,validateReleaseSnapshot} from './resource-catalog.mjs';
import {verifyDynamicResources} from './dynamic-resources.mjs';
import {validateDynamicCatalog} from './dynamic-protocol.mjs';
import {validateSuccessor} from './dynamic-catalog.mjs';
import {validateDualCatalogs,expandedSuccessor} from './expanded-channel.mjs';
import {validateExpandedSigning} from './expanded-signer.mjs';
import {verifyExpandedHistory} from './expanded-history.mjs';
import {publicDownloadUrl} from './resource-successor.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),keyId='resources-20261008',releaseId=407394942;
const der=readFileSync(join(root,'android/app/src/main/res/raw/resource_public_key.der'));
if(sha256(der)!=='649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673')throw Error('Production public key changed');
const publicKey=createPublicKey({key:der,format:'der',type:'spki'}),put=(dir,name,data)=>writeFileSync(join(dir,name),data,{flag:'wx'}),json=(dir,name)=>strictJson(readFileSync(join(dir,name)),4*1048576);
async function download(asset){const response=await fetch(String(publicDownloadUrl(asset)),{headers:{'User-Agent':'game-hub-expanded-successor','Cache-Control':'no-cache'},signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`Asset HTTP ${response.status}`);const chunks=[];let n=0;for await(const chunk of response.body){n+=chunk.length;if(n>LIMITS.archive)throw Error('Asset byte limit');chunks.push(chunk)}const bytes=Buffer.concat(chunks);if(asset.state!=='uploaded'||n!==asset.size||asset.digest!==`sha256:${sha256(bytes)}`)throw Error('Public asset mismatch');return bytes;}
async function current(snapshot,expectedLegacy,expectedExpanded){
 const assets=snapshot.assetPages.flatMap(p=>p.assets),legacy=assets.filter(a=>a.name==='catalog.signed.json'),expanded=assets.filter(a=>a.name==='catalog-expanded.signed.json');
 if(snapshot.release.id!==releaseId||legacy.length!==1||expanded.length!==1)throw Error('Current channel identity unavailable');
 const [legacyBytes,expandedBytes]=await Promise.all([download(legacy[0]),download(expanded[0])]);
 if(sha256(legacyBytes)!==expectedLegacy||sha256(expandedBytes)!==expectedExpanded)throw Error('Current signed channel moved');
 const l=verifyEnvelope(legacyBytes,publicKey,keyId),e=verifyEnvelope(expandedBytes,publicKey,keyId);validateDynamicCatalog(l.catalog,Date.parse(l.catalog.issuedAt));validateDynamicCatalog(e.catalog,Date.parse(e.catalog.issuedAt));validateReleaseSnapshot(l.catalog,snapshot,'game-resources-v2');validateReleaseSnapshot(e.catalog,snapshot,'game-resources-v2');validateDualCatalogs(l,e);
 if(e.catalog.expandedPreviousSha256===undefined){if(!expandedBytes.equals(legacyBytes))throw Error('Expanded bootstrap is not exact legacy bytes');}
 else await verifyExpandedHistory(snapshot,publicKey,download);
 return {assets,legacy:legacy[0],expanded:expanded[0],legacyBytes,expandedBytes,l,e};
}
function candidates(){return verifyDynamicResources();}
function plan(games,legacySha,expandedSha){const candidate=json(root,'.build/dynamic-candidate/candidate.json');return {producerCommit:candidate.bundleCommit,legacySha,expandedSha,candidateSha:sha256(JSON.stringify(games)),games:games.map(g=>({id:g.id,assetName:assetName(g),archiveSha256:g.archiveSha256,archiveBytes:g.archiveBytes}))};}
function verifyPlan(dir,games,legacySha,expandedSha){if(JSON.stringify(json(dir,'expanded-plan.json'))!==JSON.stringify(plan(games,legacySha,expandedSha)))throw Error('Expanded candidate plan changed');}
export function fakeSnapshot(snapshot,games){const fake=structuredClone(snapshot),all=fake.assetPages.flatMap(p=>p.assets);let id=Math.max(...all.map(a=>a.id))+1;for(const game of games)if(!all.some(a=>a.name===assetName(game)))all.push({id:id++,name:assetName(game),state:'uploaded',size:game.archiveBytes,digest:`sha256:${game.archiveSha256}`});fake.assetPages=[];for(let i=0;i<all.length;i+=100)fake.assetPages.push({page:fake.assetPages.length+1,hasNext:i+100<all.length,assets:all.slice(i,i+100)});return fake;}
function make(state,games,snapshot){const payload=expandedSuccessor(state.l,state.e,games,snapshot,Date.now(),true);payload.expandedPreviousSha256=sha256(state.expandedBytes);payload.legacySnapshotSha256=sha256(state.legacyBytes);validateExpandedSigning(state.legacyBytes,state.expandedBytes,payload,snapshot,publicKey);return payload;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [mode,dir,legacySha,expandedSha]=process.argv.slice(2);if(!['preflight','payload','online'].includes(mode)||!dir||!/^[a-f0-9]{64}$/.test(legacySha??'')||!/^[a-f0-9]{64}$/.test(expandedSha??'')||process.argv.length!==6)throw Error('Usage: expanded-successor.mjs preflight|payload|online directory legacy-sha expanded-sha');
  const snapshot=await captureReleaseSnapshot(fetch,'game-resources-v2');
  if(mode==='preflight'){
    const state=await current(snapshot,legacySha,expandedSha),games=candidates(),candidateSnapshot=fakeSnapshot(snapshot,games),payload=make(state,games,candidateSnapshot);
    put(dir,'expanded-preflight-snapshot.json',JSON.stringify(snapshot,null,2)+'\n');put(dir,'legacy.signed.json',state.legacyBytes);put(dir,'previous-expanded.signed.json',state.expandedBytes);put(dir,'expanded-plan.json',JSON.stringify(plan(games,legacySha,expandedSha),null,2)+'\n');
    console.log(`Preflight verified expanded successor ${payload.catalogSequence}; ${games.length} immutable candidates`);
  }else if(mode==='payload'){
    const state=await current(snapshot,legacySha,expandedSha),games=candidates();verifyPlan(dir,games,legacySha,expandedSha);
    const payload=make(state,games,snapshot);put(dir,'expanded-signing-snapshot.json',JSON.stringify(snapshot,null,2)+'\n');put(dir,'expanded-payload.json',JSON.stringify(payload)+'\n');console.log(`Prepared expanded successor ${payload.catalogSequence}`);
  }else{
    const assets=snapshot.assetPages.flatMap(p=>p.assets),legacy=assets.filter(a=>a.name==='catalog.signed.json'),currentAssets=assets.filter(a=>a.name==='catalog-expanded.signed.json');
    if(legacy.length!==1||currentAssets.length!==1)throw Error('Online channel identity unavailable');
    const legacyBytes=await download(legacy[0]),currentBytes=await download(currentAssets[0]),local=readFileSync(join(dir,'expanded.signed.json'));
    if(sha256(legacyBytes)!==legacySha||!currentBytes.equals(local))throw Error('Online signed channel differs');
    const l=verifyEnvelope(legacyBytes,publicKey,keyId),e=verifyEnvelope(currentBytes,publicKey,keyId);validateDynamicCatalog(l.catalog,Date.parse(l.catalog.issuedAt));validateDynamicCatalog(e.catalog);validateReleaseSnapshot(l.catalog,snapshot,'game-resources-v2');validateReleaseSnapshot(e.catalog,snapshot,'game-resources-v2');validateDualCatalogs(l,e);
    const oldBytes=readFileSync(join(dir,'previous-expanded.signed.json')),previous=verifyEnvelope(oldBytes,publicKey,keyId);validateSuccessor(previous.catalog,e.catalog);
    const historyName=`catalog-expanded-seq${previous.catalog.catalogSequence}-${expandedSha.slice(0,12)}.signed.json`,history=assets.filter(a=>a.name===historyName);if(history.length!==1||sha256(await download(history[0]))!==expandedSha)throw Error('Expanded signed history missing');
    const entries=await verifyExpandedHistory(snapshot,publicKey,download),catalogs=entries.map(item=>item.catalog);
    const checks=[];for(const game of catalogs.flatMap(c=>c.games)){if(checks.some(x=>x.assetId===game.assetId))continue;const asset=assets.find(a=>a.id===game.assetId);if(!asset)throw Error('Expanded historical ZIP missing');const bytes=await download(asset);if(sha256(bytes)!==game.archiveSha256||bytes.length!==game.archiveBytes)throw Error('Expanded ZIP mismatch');checks.push({id:game.id,assetId:game.assetId,sha256:game.archiveSha256,bytes:bytes.length});}
    put(dir,'expanded-online-snapshot.json',JSON.stringify(snapshot,null,2)+'\n');put(dir,'expanded-online-verified.json',JSON.stringify({catalogSequence:e.catalog.catalogSequence,catalogSha256:sha256(currentBytes),legacySha256:legacySha,catalogAssetId:currentAssets[0].id,historyAssetId:history[0].id,verifiedSequences:catalogs.map(c=>c.catalogSequence),games:checks},null,2)+'\n');console.log(`Verified online expanded sequence ${e.catalog.catalogSequence}; ${checks.length} resources across ${catalogs.length} catalogs`);
  }
 }catch(error){console.error(error.message);process.exitCode=1;}
}
