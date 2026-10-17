import {LIMITS} from './contracts.mjs';
const integer=n=>Number.isSafeInteger(n)&&n>=0;
export function controlledEligibility({baseURL,controllerURL,scopeURL,handshake,crypto,idb,cache,registrations=[]}){
  const base=new URL(baseURL);
  if(!base.pathname.endsWith('/')||base.search||base.hash)return false;
  const script=new URL('sw.js',base).href;
  return Boolean(controllerURL===script&&scopeURL===base.href&&handshake===1&&crypto&&idb&&cache&&
    registrations.filter(r=>r.scope.startsWith(base.href)||base.href.startsWith(r.scope)).every(r=>r.scope===base.href&&r.scriptURL===script));
}
export function reserveBytes({committed,reserved,requested,budget=LIMITS.cache,margin=LIMITS.reserve}){
  if(![committed,reserved,requested,budget,margin].every(integer)||requested===0)throw Error('Invalid byte reservation');
  if(committed>budget||reserved>budget-committed||margin>budget-committed-reserved||requested>budget-committed-reserved-margin)throw Error('Insufficient reserved budget');
  return reserved+requested;
}
// Pure transition guards. Actual Cache/IDB commits and proof verification belong
// to the coordinator; calling these functions alone never grants offline trust.
export function transitionInstallation(record,event){
  if(!integer(record.fence)||!integer(event.fence)||event.fence!==record.fence)throw Error('Stale installation fence');
  const next={...record};
  switch(event.type){
    case 'verified':
      if(record.phase!=='staging'||event.complete!==true||event.manifestDigest!==record.manifestDigest)throw Error('Incomplete installation');
      next.phase='ready';break;
    case 'activate':
      if(record.phase!=='ready'||event.newSession!==true)throw Error('Only a new session may activate ready resources');
      next.phase='active';break;
    case 'cancel':
      if(record.phase!=='staging')throw Error('Cannot cancel committed installation');
      next.phase='failed';break;
    case 'missing':
      if(!['ready','active'].includes(record.phase))throw Error('No committed installation to repair');
      next.phase='repair';break;
    case 'begin-delete':
      if(!['failed','retained','repair'].includes(record.phase)||!mayCollect(event.proof))throw Error('Referenced or unproven resources retained');
      next.phase='deleting';break;
    case 'deleted':
      if(record.phase!=='deleting'||event.cacheAbsent!==true)throw Error('Deletion not complete');
      next.phase='absent';break;
    default:throw Error('Unknown installation transition');
  }
  return next;
}
export function mayCollect(proof){
  return Boolean(proof&&proof.barrier===true&&proof.active===false&&proof.ready===false&&proof.installing===false&&
    proof.references===0&&proof.enumerationComplete===true&&proof.possibleClients===0&&proof.protocolCompatible===true);
}
