import {verifyEnvelope,sha256} from './resource-protocol.mjs';
import {validateExpandedSigning} from './expanded-signer.mjs';
import {expandedActivationState} from './expanded-activation.mjs';

// Verify local signed artifacts, prior channel asset bindings and intent before
// a caller decides whether any activation or exact-byte recovery is permissible.
export function verifyExpandedActivationIntent(intent,legacyBytes,previousBytes,signedBytes,signingSnapshot,publicKey,now=Date.now()){
 const legacy=verifyEnvelope(legacyBytes,publicKey,'resources-20261008'),previous=verifyEnvelope(previousBytes,publicKey,'resources-20261008'),next=verifyEnvelope(signedBytes,publicKey,'resources-20261008');
 const expected=validateExpandedSigning(legacyBytes,previousBytes,next.catalog,signingSnapshot,publicKey,now);
 if(intent.legacySha!==sha256(legacyBytes)||intent.previousSha!==sha256(previousBytes)||intent.newSha!==sha256(signedBytes)||intent.newSize!==signedBytes.length||intent.previousSequence!==previous.catalog.catalogSequence||expected.payloadSha256!==next.payloadSha256)throw Error('Signed artifacts do not match activation intent');
 if(expandedActivationState(signingSnapshot,intent).phase!=='prepared')throw Error('Signing snapshot is not the pre-activation state');
 return {legacy,previous,next};
}
