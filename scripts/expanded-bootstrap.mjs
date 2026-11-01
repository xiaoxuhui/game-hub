import {verifyEnvelope,sha256} from './resource-protocol.mjs';
import {validateDynamicCatalog} from './dynamic-protocol.mjs';
import {validateReleaseSnapshot} from './resource-catalog.mjs';

// Bootstrap is intentionally a byte-for-byte copy of the signed legacy catalog.
// No private signing key or caller-supplied unverified catalog is accepted.
export function validateBootstrap(snapshot,legacyBytes,publicKey,now=Date.now(),expectedReleaseId=407394942,allowIdenticalExisting=false){
  const checked=verifyEnvelope(legacyBytes,publicKey,'resources-20261008'),catalog=checked.catalog;
  validateDynamicCatalog(catalog,now);if(catalog.games.length>16)throw Error('Legacy catalog exceeds 16');
  if(catalog.releaseId!==expectedReleaseId||snapshot.release?.id!==expectedReleaseId)throw Error('Unexpected production release');
  validateReleaseSnapshot(catalog,snapshot,'game-resources-v2');
  const assets=snapshot.assetPages.flatMap(p=>p.assets),legacy=assets.filter(a=>a.name==='catalog.signed.json'),expanded=assets.filter(a=>a.name==='catalog-expanded.signed.json');
  if(legacy.length!==1||legacy[0].state!=='uploaded'||legacy[0].size!==legacyBytes.length||legacy[0].digest!==`sha256:${sha256(legacyBytes)}`)throw Error('Legacy catalog asset identity mismatch');
  if(expanded.length){
    if(!allowIdenticalExisting||expanded.length!==1||expanded[0].state!=='uploaded'||expanded[0].size!==legacyBytes.length||expanded[0].digest!==`sha256:${sha256(legacyBytes)}`)throw Error('Expanded catalog already exists or differs; inspect and resume safely');
  }
  return {legacyId:legacy[0].id,expandedId:expanded[0]?.id??null,sequence:catalog.catalogSequence,catalogSha256:sha256(legacyBytes),payloadSha256:checked.payloadSha256,gameIds:catalog.games.map(g=>g.id)};
}
