import {LIMITS,normalizeBase} from '../core/contracts.mjs';
import {sha256Hex} from '../core/digests.mjs';
import {mayCollect} from '../core/install-state.mjs';
const PHASES=new Set(['staging','ready','active','retained','failed','repair','deleting']);
const ID=/^[a-z][a-z0-9-]{0,63}$/,SHA=/^[a-f0-9]{64}$/;
const RECORD=['id','contentCode','digest','fence','cacheName','bytes','phase','proofHash'];
const SESSION=['sessionId','clientId','controllerProtocol','id','contentCode','digest','fence'];
function insist(value,message){if(!value)throw Error(message);}
function exact(value,fields){insist(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===fields.length&&fields.every(k=>Object.hasOwn(value,k)),'Unknown ledger shape');}
const integer=(v,min=0)=>Number.isSafeInteger(v)&&!Object.is(v,-0)&&v>=min;
const identifier=v=>typeof v==='string'&&v.length>0&&v.length<=180&&!/[\x00-\x20\x7f]/.test(v);
const next=v=>{insist(integer(v)&&v<Number.MAX_SAFE_INTEGER,'Ledger counter exhausted');return v+1;};
const cacheName=(base,fence)=>`game-hub-web.resources.${sha256Hex(base).slice(0,24)}.${fence}`;
const identity=r=>JSON.stringify([r.id,r.contentCode,r.digest]);
export const emptyLedger=()=>({schemaVersion:1,revision:0,nextFence:0,installations:[],sessions:[]});

// Validate persisted data before any mutation. A malformed record is never reset.
export function validateLedger(state,basePath){
  normalizeBase(basePath);exact(state,['schemaVersion','revision','nextFence','installations','sessions']);
  insist(state.schemaVersion===1&&integer(state.revision)&&integer(state.nextFence)&&state.nextFence<=state.revision&&Array.isArray(state.installations)&&state.installations.length<=512&&Array.isArray(state.sessions)&&state.sessions.length<=2048,'Invalid ledger root');
  const fences=new Set(),versions=new Set(),active=new Set(),ready=new Set();let bytes=0;
  for(const r of state.installations){
    exact(r,RECORD);insist(typeof r.id==='string'&&ID.test(r.id)&&integer(r.contentCode,1)&&typeof r.digest==='string'&&SHA.test(r.digest)&&integer(r.fence,1)&&r.fence<=state.nextFence&&!fences.has(r.fence)&&!versions.has(identity(r))&&r.cacheName===cacheName(basePath,r.fence)&&integer(r.bytes,1)&&PHASES.has(r.phase)&&typeof r.proofHash==='string'&&SHA.test(r.proofHash),'Invalid ledger installation');
    fences.add(r.fence);versions.add(identity(r));bytes+=r.bytes;insist(Number.isSafeInteger(bytes)&&bytes<=LIMITS.cache-LIMITS.reserve,'Ledger budget exceeded');
    if(r.phase==='active'){insist(!active.has(r.id),'Multiple active versions');active.add(r.id);}
    if(r.phase==='ready'){insist(!ready.has(r.id),'Multiple ready versions');ready.add(r.id);}
  }
  const sessions=new Set();
  for(const s of state.sessions){
    exact(s,SESSION);const r=state.installations.find(r=>r.fence===s.fence);
    insist(identifier(s.sessionId)&&identifier(s.clientId)&&s.controllerProtocol===1&&!sessions.has(s.sessionId)&&r&&identity(s)===identity(r)&&['active','retained','repair'].includes(r.phase),'Invalid ledger session');sessions.add(s.sessionId);
  }
  return state;
}

// Mechanical internal bookkeeping only; the coordinator verifies proofs/cache.
export function applyLedger(previous,event,{basePath}){
  validateLedger(previous,basePath);insist(event&&typeof event==='object','Ledger event required');const state=structuredClone(previous);let result;
  if(event.type==='begin'){
    exact(event,['type','id','contentCode','digest','bytes','proofHash']);
    insist(!state.installations.some(r=>identity(r)===identity(event)),'Version already reserved');
    const fence=next(state.nextFence);state.nextFence=fence;
    result={id:event.id,contentCode:event.contentCode,digest:event.digest,fence,cacheName:cacheName(basePath,fence),bytes:event.bytes,phase:'staging',proofHash:event.proofHash};state.installations.push(result);
  }else{
    insist(integer(event.fence,1),'Installation fence required');const record=state.installations.find(r=>r.fence===event.fence);insist(record,'Stale installation fence');
    switch(event.type){
      case 'complete':
        exact(event,['type','fence','proofHash','manifestDigest','complete']);insist(record.phase==='staging'&&event.complete===true&&event.proofHash===record.proofHash&&event.manifestDigest===record.digest,'Incomplete or stale installation');
        for(const other of state.installations)if(other.id===record.id&&other.phase==='ready')other.phase='retained';record.phase='ready';break;
      case 'cancel':
        exact(event,['type','fence']);insist(record.phase==='staging','Cannot cancel committed or failed work');record.phase='failed';break;
      case 'enter':{
        exact(event,['type','fence','sessionId','clientId','controllerProtocol']);insist(['ready','active'].includes(record.phase)&&!state.sessions.some(s=>s.sessionId===event.sessionId),'Not a new complete session');
        for(const other of state.installations)if(other.id===record.id&&other.phase==='active')other.phase='retained';record.phase='active';
        const session={sessionId:event.sessionId,clientId:event.clientId,controllerProtocol:event.controllerProtocol,id:record.id,contentCode:record.contentCode,digest:record.digest,fence:record.fence};state.sessions.push(session);result=session;break;
      }
      case 'leave':{
        exact(event,['type','fence','sessionId']);const index=state.sessions.findIndex(s=>s.sessionId===event.sessionId&&s.fence===event.fence);insist(index>=0,'Session identity mismatch');result=state.sessions.splice(index,1)[0];break;
      }
      case 'missing':
        exact(event,['type','fence']);insist(['ready','active','retained'].includes(record.phase),'No complete installation to repair');record.phase='repair';break;
      case 'begin-delete':
        exact(event,['type','fence','proof']);exact(event.proof,['fence','barrier','active','ready','installing','references','enumerationComplete','possibleClients','protocolCompatible','writesSettled']);
        insist(['failed','retained','repair'].includes(record.phase)&&!state.sessions.some(s=>s.fence===record.fence)&&event.proof.fence===record.fence&&event.proof.writesSettled===true&&integer(event.proof.references)&&integer(event.proof.possibleClients)&&mayCollect(event.proof),'Referenced or unproven cache retained');record.phase='deleting';break;
      case 'deleted':
        exact(event,['type','fence','cacheAbsent']);insist(record.phase==='deleting'&&event.cacheAbsent===true,'Cache deletion incomplete');state.installations=state.installations.filter(r=>r.fence!==record.fence);break;
      default:throw Error('Unknown ledger event');
    }
    result??=record;
  }
  state.revision=next(state.revision);validateLedger(state,basePath);return {state,result:structuredClone(result)};
}
