import {verifyEnvelope,sha256} from './resource-protocol.mjs';
import {validateExpandedSigning} from './expanded-signer.mjs';
import {expandedActivationState} from './expanded-activation.mjs';

// Verify local signed artifacts, prior channel asset bindings and intent before
// a caller decides whether any activation or exact-byte recovery is permissible.
export function makeExpandedActivationIntent(legacyBytes,previousBytes,signedBytes,signingSnapshot,publicKey,now=Date.now()){
 const previous=verifyEnvelope(previousBytes,publicKey,'resources-20261008'),next=verifyEnvelope(signedBytes,publicKey,'resources-20261008');
 validateExpandedSigning(legacyBytes,previousBytes,next.catalog,signingSnapshot,publicKey,now);
 const assets=signingSnapshot.assetPages.flatMap(p=>p.assets),legacy=assets.filter(a=>a.name==='catalog.signed.json'),expanded=assets.filter(a=>a.name==='catalog-expanded.signed.json');
 if(legacy.length!==1||expanded.length!==1)throw Error('Signing channel identities missing');
 const previousSha=sha256(previousBytes),sequence=previous.catalog.catalogSequence;
 const intent={legacyId:legacy[0].id,legacySha:sha256(legacyBytes),previousId:expanded[0].id,previousSha,previousSequence:sequence,historyName:`catalog-expanded-seq${sequence}-${previousSha.slice(0,12)}.signed.json`,newSha:sha256(signedBytes),newSize:signedBytes.length};
 verifyExpandedActivationIntent(intent,legacyBytes,previousBytes,signedBytes,signingSnapshot,publicKey,now);return intent;
}

export function verifyExpandedActivationIntent(intent,legacyBytes,previousBytes,signedBytes,signingSnapshot,publicKey,now=Date.now()){
 const legacy=verifyEnvelope(legacyBytes,publicKey,'resources-20261008'),previous=verifyEnvelope(previousBytes,publicKey,'resources-20261008'),next=verifyEnvelope(signedBytes,publicKey,'resources-20261008');
 const expected=validateExpandedSigning(legacyBytes,previousBytes,next.catalog,signingSnapshot,publicKey,now);
 if(intent.legacySha!==sha256(legacyBytes)||intent.previousSha!==sha256(previousBytes)||intent.newSha!==sha256(signedBytes)||intent.newSize!==signedBytes.length||intent.previousSequence!==previous.catalog.catalogSequence||expected.payloadSha256!==next.payloadSha256)throw Error('Signed artifacts do not match activation intent');
 if(expandedActivationState(signingSnapshot,intent).phase!=='prepared')throw Error('Signing snapshot is not the pre-activation state');
 return {legacy,previous,next};
}
