import {readFileSync,writeFileSync} from 'node:fs';import {join,resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {createPublicKey} from 'node:crypto';
import {sha256,strictJson,LIMITS} from './resource-protocol.mjs';import {captureReleaseSnapshot,validateReleaseSnapshot} from './resource-catalog.mjs';import {publicDownloadUrl} from './resource-successor.mjs';import {expandedActivationState} from './expanded-activation.mjs';import {verifyExpandedActivationIntent} from './expanded-activation-proof.mjs';
const keyId='resources-20261008';
async function fetchAsset(asset){const r=await fetch(String(publicDownloadUrl(asset)),{headers:{'User-Agent':'game-hub-expanded-activation','Cache-Control':'no-cache'},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`Asset HTTP ${r.status}`);const chunks=[];let n=0;for await(const chunk of r.body){n+=chunk.length;if(n>LIMITS.envelope)throw Error('Catalog asset too large');chunks.push(chunk)}const bytes=Buffer.concat(chunks);if(asset.state!=='uploaded'||asset.size!==n||asset.digest!==`sha256:${sha256(bytes)}`)throw Error('Public catalog asset bytes mismatch');return bytes;}
export async function inspectExpandedActivation(snapshot,intent,legacyBytes,previousBytes,signedBytes,signingSnapshot,publicKey,download,now=Date.now()){
 const proofs=verifyExpandedActivationIntent(intent,legacyBytes,previousBytes,signedBytes,signingSnapshot,publicKey,now),state=expandedActivationState(snapshot,intent);
 validateReleaseSnapshot(proofs.legacy.catalog,snapshot,'game-resources-v2');validateReleaseSnapshot(proofs.previous.catalog,snapshot,'game-resources-v2');validateReleaseSnapshot(proofs.next.catalog,snapshot,'game-resources-v2');
 const assets=snapshot.assetPages.flatMap(p=>p.assets),read=async(name,expected)=>{const matches=assets.filter(a=>a.name===name);if(matches.length!==1)throw Error('Activation asset missing');const bytes=await download(matches[0]);if(!Buffer.isBuffer(bytes)||bytes.length!==matches[0].size||matches[0].digest!==`sha256:${sha256(bytes)}`||!bytes.equals(expected))throw Error('Activation public bytes mismatch');};
 await read('catalog.signed.json',legacyBytes);
 if(state.phase==='prepared')await read('catalog-expanded.signed.json',previousBytes);
 else {await read(state.historyName,previousBytes);if(state.phase==='published')await read('catalog-expanded.signed.json',signedBytes);}
 return {...state,legacySha:intent.legacySha,previousSha:intent.previousSha,newSha:intent.newSha};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [directory,outputName]=process.argv.slice(2);if(!directory||!/^activation-check-[a-z0-9-]+\.json$/.test(outputName??'')||process.argv.length!==4)throw Error('Usage: expanded-activation-check.mjs evidence-directory activation-check-<id>.json');
  const der=readFileSync(new URL('../android/app/src/main/res/raw/resource_public_key.der',import.meta.url));if(sha256(der)!=='649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673')throw Error('Production public key changed');const key=createPublicKey({key:der,format:'der',type:'spki'}),read=name=>readFileSync(join(directory,name)),intent=strictJson(read('expanded-activation-intent.json')),signing=strictJson(read('expanded-signing-snapshot.json'),4*1048576),snapshot=await captureReleaseSnapshot(fetch,'game-resources-v2');
  const state=await inspectExpandedActivation(snapshot,intent,read('legacy.signed.json'),read('previous-expanded.signed.json'),read('expanded.signed.json'),signing,key,fetchAsset);writeFileSync(join(directory,outputName),JSON.stringify(state,null,2)+'\n',{flag:'wx'});console.log(`Verified expanded activation state: ${state.phase}`);
 }catch(error){console.error(error.message);process.exitCode=1;}
}
