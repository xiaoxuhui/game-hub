import {sha256,verifyEnvelope,signCatalog,strictJson,LIMITS} from './resource-protocol.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPublicKey} from 'node:crypto';
import {validateDynamicCatalog} from './dynamic-protocol.mjs';
import {validateReleaseSnapshot} from './resource-catalog.mjs';
import {validateSuccessor} from './dynamic-catalog.mjs';
import {validateDualCatalogs} from './expanded-channel.mjs';

// All three catalogs are bound to the same complete Release snapshot. Input
// catalog proofs are signed raw bytes; caller never asserts their validity.
export function validateExpandedSigning(legacyBytes,previousBytes,next,snapshot,publicKey,now=Date.now(),expectedReleaseId=407394942){
  const legacy=verifyEnvelope(legacyBytes,publicKey,'resources-20261008'),previous=verifyEnvelope(previousBytes,publicKey,'resources-20261008');
  validateDynamicCatalog(legacy.catalog,now);validateDynamicCatalog(previous.catalog,now);validateDynamicCatalog(next,now);
  if(legacy.catalog.releaseId!==expectedReleaseId||previous.catalog.releaseId!==expectedReleaseId||next.releaseId!==expectedReleaseId)throw Error('Unexpected release');
  validateReleaseSnapshot(legacy.catalog,snapshot,'game-resources-v2');validateReleaseSnapshot(previous.catalog,snapshot,'game-resources-v2');validateReleaseSnapshot(next,snapshot,'game-resources-v2');
  const assets=snapshot.assetPages.flatMap(p=>p.assets);
  for(const [name,bytes] of [['catalog.signed.json',legacyBytes],['catalog-expanded.signed.json',previousBytes]]){
    const found=assets.filter(a=>a.name===name);if(found.length!==1||found[0].state!=='uploaded'||found[0].size!==bytes.length||found[0].digest!==`sha256:${sha256(bytes)}`)throw Error('Signed catalog asset mismatch');
  }
  if(next.expandedPreviousSha256!==sha256(previousBytes)||next.legacySnapshotSha256!==sha256(legacyBytes))throw Error('Expanded signed history or legacy anchor mismatch');
  validateDualCatalogs(legacy,previous);validateSuccessor(previous.catalog,next);
  if(BigInt(next.catalogSequence)<=BigInt(legacy.catalog.catalogSequence))throw Error('Expanded sequence must exceed legacy');
  const bytes=Buffer.from(JSON.stringify(next));if(bytes.length>LIMITS.payload)throw Error('Expanded payload limit');
  validateDualCatalogs(legacy,{catalog:next,payloadSha256:sha256(bytes)});
  return {sequence:next.catalogSequence,payloadSha256:sha256(bytes),legacySha256:sha256(legacyBytes),previousSha256:sha256(previousBytes)};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [mode,input,keyPath,output,snapshotPath,legacyPath,previousPath]=process.argv.slice(2);
  if(mode!=='sign'||!input||!keyPath||!output||!snapshotPath||!legacyPath||!previousPath||process.argv.length!==9)throw Error('Usage: expanded-signer.mjs sign payload key-path|- output snapshot legacy-signed previous-expanded-signed');
  const der=readFileSync(new URL('../android/app/src/main/res/raw/resource_public_key.der',import.meta.url));if(sha256(der)!=='649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673')throw Error('Production public key changed');
  const publicKey=createPublicKey({key:der,format:'der',type:'spki'}),payload=strictJson(readFileSync(input)),snapshot=strictJson(readFileSync(snapshotPath),4*1048576);
  const result=validateExpandedSigning(readFileSync(legacyPath),readFileSync(previousPath),payload,snapshot,publicKey);
  const privateKey=readFileSync(keyPath==='-'?0:keyPath);try{const signed=signCatalog(payload,privateKey,'resources-20261008'),verified=verifyEnvelope(signed,publicKey,'resources-20261008');if(verified.payloadSha256!==result.payloadSha256)throw Error('Expanded signature does not match reviewed payload');writeFileSync(output,signed,{flag:'wx'});console.log('Signed expanded catalog '+result.sequence+'; '+result.payloadSha256);}finally{privateKey.fill(0);}
 }catch(error){console.error(error.message);process.exitCode=1;}
}
