import {validateDynamicCatalog} from './dynamic-protocol.mjs';
import {validateSuccessor} from './dynamic-history.mjs';
import {validateReleaseSnapshot,attachAssets} from './resource-catalog.mjs';

const assert=(v,m)=>{if(!v)throw new Error(m)};
const canonical=value=>JSON.stringify(sort(value));
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])]));return value;}
function proof(input){assert(input&&input.catalog&&/^[a-f0-9]{64}$/.test(input.payloadSha256),'Verified signed proof required');validateDynamicCatalog(input.catalog,Date.parse(input.catalog.issuedAt));return input.catalog;}

// The legacy directory is always a subset; an expanded directory may be ahead
// while a planned legacy update waits to activate. Equal sequence requires the
// exact same signed payload bytes so upgraded clients never see a collision.
export function validateDualCatalogs(legacyProof,expandedProof){
  const legacy=proof(legacyProof),expanded=proof(expandedProof);
  assert(legacy.games.length<=16,'Legacy catalog exceeds 16');
  assert(legacy.releaseId===expanded.releaseId,'Channel release identity mismatch');
  const l=BigInt(legacy.catalogSequence),e=BigInt(expanded.catalogSequence);
  assert(e>=l,'Expanded sequence behind legacy');
  if(e===l)assert(legacyProof.payloadSha256===expandedProof.payloadSha256,'Equal-sequence payload conflict');
  for(const old of legacy.games){
    const next=expanded.games.find(g=>g.id===old.id);
    assert(next,'Expanded catalog omits legacy game');
    assert(next.contentCode>=old.contentCode,'Expanded game behind legacy');
    if(next.contentCode===old.contentCode){const identity=g=>Object.fromEntries(Object.entries(g).filter(([key])=>key!=='available'));assert(canonical(identity(next))===canonical(identity(old)),'Same-code channel descriptor conflict');}
  }
  return {legacy,expanded};
}

// Legacy activation must follow an already verified expanded publication.
// Previous legacy is supplied to preserve immutable identity and version checks.
export function validateLegacyTransition(previousLegacyProof,nextLegacyProof,expandedProof,snapshot){
  const previous=proof(previousLegacyProof),next=proof(nextLegacyProof);
  assert(BigInt(next.catalogSequence)===BigInt(previous.catalogSequence)+1n,'Legacy sequence must advance exactly one');
  validateSuccessor(previous,next);validateReleaseSnapshot(next,snapshot,'game-resources-v2');
  const dual=validateDualCatalogs(nextLegacyProof,expandedProof);
  for(const game of next.games)assert(dual.expanded.games.find(g=>g.id===game.id).available===game.available,'Legacy availability not yet mirrored by expanded catalog');
  return next;
}

// Expanded updates retain every ID from both channels and use a sequence above
// both watermarks. Asset binding is validated against a complete public snapshot.
export function expandedSuccessor(legacyProof,expandedProof,candidates,snapshot,now=Date.now(),reserveLegacyAdvance=false){
  const {legacy,expanded}=validateDualCatalogs(legacyProof,expandedProof);
  assert(Array.isArray(candidates)&&new Set(candidates.map(g=>g.id)).size===candidates.length,'Candidate identities');
  const replacements=attachAssets(candidates,snapshot.release,snapshot.assetPages.flatMap(p=>p.assets),'game-resources-v2');
  const games=expanded.games.map(g=>replacements.find(x=>x.id===g.id)??g);
  games.push(...replacements.filter(g=>!expanded.games.some(x=>x.id===g.id)));
  const legacyFloor=BigInt(legacy.catalogSequence)+(reserveLegacyAdvance?1n:0n);
  const sequence=(BigInt(expanded.catalogSequence)>legacyFloor?BigInt(expanded.catalogSequence):legacyFloor)+1n;
  const payload={schemaVersion:2,channel:'game-hub-resources-v2',releaseId:legacy.releaseId,catalogSequence:String(sequence),issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+89*86400000).toISOString(),games};
  validateDynamicCatalog(payload,now);validateReleaseSnapshot(payload,snapshot,'game-resources-v2');validateSuccessor(expanded,payload);
  // A fresh successor has strictly greater sequence; hash is irrelevant here.
  validateDualCatalogs(legacyProof,{catalog:payload,payloadSha256:'0'.repeat(64)});
  return payload;
}
