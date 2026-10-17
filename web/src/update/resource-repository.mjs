function insist(value,message){if(!value)throw Error(message);}
export function reservationBytes(game,receipt){
  return game.files.reduce((n,f)=>n+f.bytes,0)+receipt.envelope.length+new TextEncoder().encode(JSON.stringify({...receipt,envelope:undefined})).length+1024;
}

// Internal coordinator factory. Its production wrapper pins trust and the clock.
// Cache completeness and current controller are verified by the installer/SW.
export function createResourceRepository({database,authority,now=Date.now}){
  const windowFor=receipt=>({notBefore:Math.max(Date.parse(receipt.catalog.issuedAt)-300000,receipt.history.acceptedAt-300000),expiresAt:Date.parse(receipt.catalog.expiresAt)});
  async function snapshot(){
    const snapshot=await database.snapshot();let current=null;
    if(snapshot.authority.present)current=await authority.restore(snapshot.authority.record);
    insist(current||snapshot.state.installations.length===0,'Authority missing; resource repair required');
    const proofs=new Map();
    for(const [hash,item] of Object.entries(snapshot.proofs)){
      insist(item.present,'Installation proof missing; repair required');const proof=await authority.restore(item.record);
      insist(proof.payloadSha256===hash,'Proof identity mismatch');await authority.assertSuccessor(current,proof);proofs.set(hash,proof);
    }
    for(const record of snapshot.state.installations){
      const proof=proofs.get(record.proofHash),game=proof?.catalog.games.find(g=>g.id===record.id&&g.contentCode===record.contentCode&&g.digest===record.digest);
      insist(game&&record.bytes===reservationBytes(game,snapshot.proofs[record.proofHash].record),'Installation identity or reservation mismatch');
    }
    return {...snapshot,current,verifiedProofs:proofs};
  }
  async function fresh(envelope,previous){const receipt=await authority.fresh(envelope,{previous,now:now()});authority.requireFresh(receipt,{now:now()});return receipt;}
  return Object.freeze({
    async inspect(){const s=await snapshot();return {state:s.state,catalog:s.current?.catalog??null};},
    async check(envelope){
      const s=await snapshot(),receipt=await fresh(envelope,s.current),serialized=authority.serialize(receipt);authority.requireFresh(receipt,{now:now()});
      await database.commit({expected:s.token,expectedProofTokens:s.proofTokens,receipt:serialized,authorization:windowFor(receipt)});return receipt.catalog;
    },
    async begin(envelope,id){
      const s=await snapshot(),receipt=await fresh(envelope,s.current),game=receipt.catalog.games.find(g=>g.id===id);insist(game?.available===true,'Game is not available for installation');
      const serialized=authority.serialize(receipt),retained=s.proofs[receipt.payloadSha256]?.record??serialized;
      const event={type:'begin',id:game.id,contentCode:game.contentCode,digest:game.digest,proofHash:receipt.payloadSha256,bytes:reservationBytes(game,retained)};
      authority.requireFresh(receipt,{now:now()});const outcome=await database.commit({expected:s.token,expectedProofTokens:s.proofTokens,event,receipt:serialized,authorization:windowFor(receipt),proof:serialized,expectedProofToken:s.proofTokens[receipt.payloadSha256]??'absent'});return {record:outcome.result,game};
    },
    async complete(fence,confirmation){
      insist(confirmation&&Object.keys(confirmation).length===2&&Object.hasOwn(confirmation,'manifestDigest')&&Object.hasOwn(confirmation,'complete'),'Complete confirmation required');
      const input=structuredClone(confirmation),s=await snapshot(),record=s.state.installations.find(r=>r.fence===fence);insist(record?.phase==='staging','Stale or cancelled installation');
      const receipt=await fresh(s.authority.record.envelope,s.current);insist(receipt.payloadSha256===record.proofHash,'Catalog changed during download; retry');
      authority.requireFresh(receipt,{now:now()});const result=await database.commit({expected:s.token,expectedProofTokens:s.proofTokens,receipt:authority.serialize(receipt),authorization:windowFor(receipt),event:{type:'complete',fence,proofHash:record.proofHash,manifestDigest:input.manifestDigest,complete:input.complete}});return result.result;
    },
    async cancel(fence){const s=await snapshot();return (await database.commit({expected:s.token,expectedProofTokens:s.proofTokens,event:{type:'cancel',fence}})).result;},
    async proof(fence){
      const s=await snapshot(),record=s.state.installations.find(r=>r.fence===fence);insist(record,'Unknown installation');const proof=s.verifiedProofs.get(record.proofHash);
      return {record,game:proof.catalog.games.find(g=>g.id===record.id),receipt:authority.serialize(proof)};
    },
    close:()=>database.close()
  });
}
