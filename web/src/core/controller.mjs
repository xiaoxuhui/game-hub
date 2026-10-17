import {sha256Hex} from './digests.mjs';
function insist(value,message){if(!value)throw Error(message);}
function exact(value,fields){insist(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===fields.length&&fields.every(k=>Object.hasOwn(value,k)),'Unknown controller identity');}
function request(value){exact(value,['build','epoch','protocol']);insist(typeof value.build==='string'&&/^[a-f0-9]{40}$/.test(value.build)&&typeof value.epoch==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value.epoch)&&value.protocol===1,'Invalid controller identity');}
export function validateController(value){exact(value,['schemaVersion','protocol','build','epoch','generation']);request({build:value.build,epoch:value.epoch,protocol:value.protocol});insist(value.schemaVersion===1&&Number.isSafeInteger(value.generation)&&value.generation>0,'Invalid controller generation');return value;}
export function controllerToken(value,present){if(!present)return 'absent';validateController(value);return sha256Hex(JSON.stringify(value));}
export function nextController(previous,input){
  request(input);if(previous!==null){validateController(previous);if(previous.build===input.build&&previous.epoch===input.epoch)return structuredClone(previous);insist(previous.generation<Number.MAX_SAFE_INTEGER,'Controller generation exhausted');}
  return {schemaVersion:1,protocol:1,build:input.build,epoch:input.epoch,generation:(previous?.generation??0)+1};
}
