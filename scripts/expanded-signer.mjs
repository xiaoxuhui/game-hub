import {sha256,verifyEnvelope,LIMITS} from './resource-protocol.mjs';
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
  validateDualCatalogs(legacy,previous);validateSuccessor(previous.catalog,next);
  if(BigInt(next.catalogSequence)<=BigInt(legacy.catalog.catalogSequence))throw Error('Expanded sequence must exceed legacy');
  const bytes=Buffer.from(JSON.stringify(next));if(bytes.length>LIMITS.payload)throw Error('Expanded payload limit');
  validateDualCatalogs(legacy,{catalog:next,payloadSha256:sha256(bytes)});
  return {sequence:next.catalogSequence,payloadSha256:sha256(bytes),legacySha256:sha256(legacyBytes),previousSha256:sha256(previousBytes)};
}
