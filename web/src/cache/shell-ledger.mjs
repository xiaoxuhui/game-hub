import {normalizeBase} from '../core/contracts.mjs';
import {sha256Hex} from '../core/digests.mjs';
export const SHELL_TOTAL=8*1024*1024,SHELL_GENERATION=4*1024*1024;
const integer=(n,min=0)=>Number.isSafeInteger(n)&&!Object.is(n,-0)&&n>=min;
function insist(value,message){if(!value)throw Error(message);}
function exact(value,keys){insist(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k)),'Unknown shell ledger shape');}
export const shellCachePrefix=base=>{normalizeBase(base);return 'game-hub-web.shell.'+sha256Hex(base).slice(0,24)+'.';};
export const emptyShellLedger=()=>({schemaVersion:1,revision:0,nextFence:0,records:[]});
export function validateShellLedger(state,basePath){
  exact(state,['schemaVersion','revision','nextFence','records']);
  insist(state.schemaVersion===1&&integer(state.revision)&&integer(state.nextFence)&&state.nextFence<=state.revision&&Array.isArray(state.records)&&state.records.length<=512,'Invalid shell ledger');
  const fences=new Set();let bytes=0;
  for(const r of state.records){exact(r,['build','fence','cacheName','bytes','phase','manifestHash']);insist(typeof r.build==='string'&&/^[a-f0-9]{40}$/.test(r.build)&&integer(r.fence,1)&&r.fence<=state.nextFence&&!fences.has(r.fence)&&r.cacheName===shellCachePrefix(basePath)+r.fence&&integer(r.bytes,1024)&&r.bytes<=SHELL_GENERATION&&['staging','ready','failed'].includes(r.phase)&&typeof r.manifestHash==='string'&&/^[a-f0-9]{64}$/.test(r.manifestHash),'Invalid shell record');fences.add(r.fence);bytes+=r.bytes;insist(bytes<=SHELL_TOTAL,'Shell budget exceeded');}
  return state;
}
export function applyShell(previous,event,{basePath}){
  validateShellLedger(previous,basePath);const state=structuredClone(previous);insist(state.revision<Number.MAX_SAFE_INTEGER,'Shell counter exhausted');let record;
  if(event?.type==='begin'){
    exact(event,['type','build','manifestHash','bytes']);insist(state.nextFence<Number.MAX_SAFE_INTEGER,'Shell fence exhausted');
    const fence=++state.nextFence;record={build:event.build,fence,cacheName:shellCachePrefix(basePath)+fence,bytes:event.bytes,phase:'staging',manifestHash:event.manifestHash};state.records.push(record);
  }else{
    insist(integer(event?.fence,1),'Shell fence required');record=state.records.find(r=>r.fence===event.fence);insist(record,'Stale shell fence');
    if(event.type==='ready'){exact(event,['type','fence','manifestHash','complete']);insist(record.phase==='staging'&&event.manifestHash===record.manifestHash&&event.complete===true,'Incomplete shell generation');record.phase='ready';}
    else if(event.type==='failed'){exact(event,['type','fence']);insist(['staging','ready'].includes(record.phase),'Shell already failed');record.phase='failed';}
    else throw Error('Unknown shell event');
  }
  state.revision++;validateShellLedger(state,basePath);return {state,result:structuredClone(record)};
}
