import {readFileSync} from 'node:fs';
import {sha256} from './resource-protocol.mjs';

export const LAMBDA_INTEGRATION='lambda-storage-isolation-v1';
export function migrateLambdaStorage(storage,decode){
  const auto='lambda-lab-hub-v3',checkpoint='lambda-lab-hub-checkpoint-v3';
  if(storage.getItem(auto)!==null)return false;
  const current=storage.getItem('lambda-lab-v2')||storage.getItem('lambda-lab-v1');
  const saved=storage.getItem('lambda-lab-checkpoint-v2');
  if(current===null&&saved===null)return false;
  if(current!==null)decode(current);if(saved!==null)decode(saved);
  const writes=[];
  if(saved!==null&&storage.getItem(checkpoint)===null)writes.push([checkpoint,saved]);
  if(current!==null)writes.push([auto,current]);
  const before=writes.map(([key])=>[key,storage.getItem(key)]);
  try{for(const [key,value] of writes)storage.setItem(key,value);}
  catch(error){for(const [key,value] of before){try{if(value===null)storage.removeItem(key);else storage.setItem(key,value);}catch{}}throw error;}
  return true;
}
export function integrateLambdaHtml(bytes){
  const declaration="const AUTO='lambda-lab-v2',CHECKPOINT='lambda-lab-checkpoint-v2',LEGACY='lambda-lab-v1';";
  const load='const text=localStorage.getItem(AUTO)||localStorage.getItem(LEGACY);';
  let html=bytes.toString('utf8');
  for(const marker of [declaration,load])if(html.split(marker).length!==2)throw new Error('Lambda integration requires exact reviewed workspace markers');
  html=html.replace(declaration,"const AUTO='lambda-lab-hub-v3',CHECKPOINT='lambda-lab-hub-checkpoint-v3',LEGACY='lambda-lab-hub-legacy-v3';");
  html=html.replace(load,`(${migrateLambdaStorage.toString()})(localStorage,S.decode);\n        ${load}`);
  return Buffer.from(html);
}
export function integrationProof(input,output){
  return {id:LAMBDA_INTEGRATION,inputSha256:sha256(input),outputSha256:sha256(output),adapterSha256:sha256(readFileSync(new URL(import.meta.url)))};
}
