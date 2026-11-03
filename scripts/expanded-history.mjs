import {verifyEnvelope,sha256} from './resource-protocol.mjs';
import {validateDynamicCatalog} from './dynamic-protocol.mjs';
import {validateReleaseSnapshot} from './resource-catalog.mjs';
import {validateSuccessor} from './dynamic-history.mjs';
import {validateDualCatalogs} from './expanded-channel.mjs';

export async function verifyExpandedHistory(snapshot,publicKey,download,now=Date.now(),expectedReleaseId=407394942){
  const assets=snapshot.assetPages.flatMap(p=>p.assets),current=assets.filter(a=>a.name==='catalog-expanded.signed.json');
  if(snapshot.release?.id!==expectedReleaseId||current.length!==1)throw Error('Expanded current identity missing');
  async function read(asset){const bytes=await download(asset);if(!Buffer.isBuffer(bytes)||asset.state!=='uploaded'||bytes.length!==asset.size||asset.digest!==`sha256:${sha256(bytes)}`)throw Error('History asset bytes mismatch');return bytes;}
  const history=assets.filter(a=>/^catalog-expanded-seq[1-9][0-9]*-[0-9a-f]{12}\.signed\.json$/.test(a.name));
  if(!history.length)throw Error('Expanded bootstrap history missing');
  const entries=[];
  for(const asset of [...history,current[0]]){
    const bytes=await read(asset),proof=verifyEnvelope(bytes,publicKey,'resources-20261008'),catalog=proof.catalog,digest=sha256(bytes);
    validateDynamicCatalog(catalog,asset===current[0]?now:Date.parse(catalog.issuedAt));validateReleaseSnapshot(catalog,snapshot,'game-resources-v2');
    if(catalog.releaseId!==expectedReleaseId)throw Error('Expanded release mismatch');
    if(asset!==current[0]&&asset.name!==`catalog-expanded-seq${catalog.catalogSequence}-${digest.slice(0,12)}.signed.json`)throw Error('Expanded history name mismatch');
    entries.push({asset,bytes,proof,digest});
  }
  const currentEntry=entries.pop();entries.sort((a,b)=>BigInt(a.proof.catalog.catalogSequence)<BigInt(b.proof.catalog.catalogSequence)?-1:1);entries.push(currentEntry);
  const legacyAssets=assets.filter(a=>a.name==='catalog.signed.json'||/^catalog-seq[1-9][0-9]*-[0-9a-f]{12}\.signed\.json$/.test(a.name)),legacyCache=new Map();
  async function legacyByHash(hash){
    if(!/^[a-f0-9]{64}$/.test(hash??''))throw Error('Invalid legacy history anchor');
    if(legacyCache.has(hash))return legacyCache.get(hash);
    const found=legacyAssets.filter(a=>a.digest===`sha256:${hash}`);if(found.length!==1)throw Error('Legacy history anchor missing or ambiguous');
    const raw=await read(found[0]);if(sha256(raw)!==hash)throw Error('Legacy history bytes mismatch');const proof=verifyEnvelope(raw,publicKey,'resources-20261008');validateDynamicCatalog(proof.catalog,Date.parse(proof.catalog.issuedAt));validateReleaseSnapshot(proof.catalog,snapshot,'game-resources-v2');if(proof.catalog.releaseId!==expectedReleaseId)throw Error('Legacy history release mismatch');legacyCache.set(hash,proof);return proof;
  }
  const root=entries[0];if(root.proof.catalog.expandedPreviousSha256!==undefined||root.proof.catalog.legacySnapshotSha256!==undefined)throw Error('Expanded bootstrap must be original legacy bytes');
  validateDualCatalogs(await legacyByHash(root.digest),root.proof);
  for(let i=1;i<entries.length;i++){
    const prev=entries[i-1],next=entries[i];validateSuccessor(prev.proof.catalog,next.proof.catalog);
    if(next.proof.catalog.expandedPreviousSha256!==prev.digest)throw Error('Expanded history chain broken');
    validateDualCatalogs(await legacyByHash(next.proof.catalog.legacySnapshotSha256),next.proof);
  }
  return entries.map(e=>({sequence:e.proof.catalog.catalogSequence,assetId:e.asset.id,sha256:e.digest,catalog:e.proof.catalog}));
}
