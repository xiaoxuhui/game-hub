import {verifySignedCatalog} from '../core/signed-catalog.mjs';
import {sha256Hex} from '../core/digests.mjs';
import {normalizeBase} from '../core/contracts.mjs';
function insist(value,message){if(!value)throw Error(message);}
function clock(value){insist(Number.isSafeInteger(value)&&value>=0&&!Object.is(value,-0)&&Number.isFinite(new Date(value).getTime()),'Invalid receipt clock');return value;}
function exact(value,fields){insist(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===fields.length&&fields.every(k=>Object.hasOwn(value,k)),'Unknown receipt shape');}
function envelopeCopy(bytes){insist(bytes instanceof Uint8Array&&bytes.length>0&&bytes.length<=8*1024*1024,'Invalid receipt envelope');return new Uint8Array(bytes);}
function checksum(record){return sha256Hex(JSON.stringify({schemaVersion:record.schemaVersion,envelopeSha256:sha256Hex(record.envelope),verifiedAt:record.verifiedAt,history:record.history}));}

// Internal reusable authority. Production uses only the fixed trust wrapper.
export function createCatalogAuthority({spki,keyId,origin,basePath,crypto=globalThis.crypto}){
  insist(spki instanceof Uint8Array&&spki.length>=128&&spki.length<=2048,'Invalid pinned SPKI');normalizeBase(basePath);
  const trust={spki:new Uint8Array(spki),keyId,origin,basePath,crypto},brands=new WeakMap();
  const known=receipt=>{const entry=brands.get(receipt);insist(entry,'Foreign or unverified receipt');return entry;};
  function brand(result,bytes,verifiedAt,kind){brands.set(result,{envelope:bytes,verifiedAt,kind});return result;}
  return Object.freeze({
    async fresh(bytes,{previous=null,now=Date.now()}={}){
      const envelope=envelopeCopy(bytes);clock(now);const history=previous===null?null:(known(previous),previous.history);
      return brand(await verifySignedCatalog(envelope,{...trust,history,now}),envelope,now,'fresh');
    },
    async restore(record){
      // Capture every external input synchronously, before any crypto await.
      exact(record,['schemaVersion','envelope','verifiedAt','history','receiptSha256']);
      const copy=structuredClone(record);copy.envelope=envelopeCopy(copy.envelope);clock(copy.verifiedAt);
      insist(copy.schemaVersion===1&&typeof copy.receiptSha256==='string'&&/^[a-f0-9]{64}$/.test(copy.receiptSha256)&&checksum(copy)===copy.receiptSha256,'Receipt checksum mismatch');
      const result=await verifySignedCatalog(copy.envelope,{...trust,history:copy.history,now:copy.verifiedAt});
      insist(JSON.stringify(result.history)===JSON.stringify(copy.history),'Stored history differs from signed proof');
      return brand(result,copy.envelope,copy.verifiedAt,'stored');
    },
    serialize(receipt){
      const entry=known(receipt),record={schemaVersion:1,envelope:new Uint8Array(entry.envelope),verifiedAt:entry.verifiedAt,history:structuredClone(receipt.history)};
      return {...record,receiptSha256:checksum(record)};
    },
    async assertSuccessor(later,earlier){
      const entry=known(later);known(earlier);
      insist(later.history.acceptedAt>=earlier.history.acceptedAt,'Accepted clock watermark rollback');
      // Recheck the signed transition at its original verification time. The
      // result is deliberately discarded and never receives a fresh brand.
      await verifySignedCatalog(entry.envelope,{...trust,history:earlier.history,now:entry.verifiedAt});
    },
    requireFresh(receipt,{now=Date.now()}={}){
      insist(known(receipt).kind==='fresh','Stored receipt cannot authorize new work');clock(now);
      insist(now<Date.parse(receipt.catalog.expiresAt)&&now>=Date.parse(receipt.catalog.issuedAt)-300000&&now>=receipt.history.acceptedAt-300000,'Authorization is no longer fresh');return receipt;
    }
  });
}
