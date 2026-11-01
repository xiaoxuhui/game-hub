import {verifyEnvelope,sha256} from './resource-protocol.mjs';
import {validateDynamicCatalog} from './dynamic-protocol.mjs';
import {validateReleaseSnapshot} from './resource-catalog.mjs';
import {validateLegacyTransition} from './expanded-channel.mjs';

// Inputs are actual downloaded signed bytes, never caller assertions about signatures.
export function validateLegacyAgainstExpanded(previousBytes,nextLegacy,expandedBytes,snapshot,publicKey,now=Date.now(),expectedReleaseId=407394942){
  const previous=verifyEnvelope(previousBytes,publicKey,'resources-20261008'),expanded=verifyEnvelope(expandedBytes,publicKey,'resources-20261008');
  validateDynamicCatalog(previous.catalog,now);validateDynamicCatalog(expanded.catalog,now);
  if(previous.catalog.releaseId!==expectedReleaseId||expanded.catalog.releaseId!==expectedReleaseId)throw Error('Unexpected release');
  validateReleaseSnapshot(previous.catalog,snapshot,'game-resources-v2');validateReleaseSnapshot(expanded.catalog,snapshot,'game-resources-v2');
  const assets=snapshot.assetPages.flatMap(p=>p.assets);
  for(const [name,bytes] of [['catalog.signed.json',previousBytes],['catalog-expanded.signed.json',expandedBytes]]){
    const matches=assets.filter(a=>a.name===name);if(matches.length!==1||matches[0].state!=='uploaded'||matches[0].size!==bytes.length||matches[0].digest!==`sha256:${sha256(bytes)}`)throw Error('Channel catalog asset identity mismatch');
  }
  // A prospective legacy payload has not yet been signed. Force expanded ahead,
  // avoiding equal-sequence signature/hash ambiguity during interrupted release.
  if(BigInt(expanded.catalog.catalogSequence)<=BigInt(nextLegacy.catalogSequence))throw Error('Expanded must be published ahead of legacy');
  const next={catalog:nextLegacy,payloadSha256:sha256(JSON.stringify(nextLegacy))};
  validateLegacyTransition(previous,next,expanded,snapshot);return {expandedSequence:expanded.catalog.catalogSequence,expandedSha256:sha256(expandedBytes)};
}
