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
export function createLambdaStorage(storage,S,migrate){
  const auto='lambda-lab-hub-v3',cp='lambda-lab-hub-checkpoint-v3',ready='lambda-lab-hub-mirror-ready-v3',journal='lambda-lab-hub-journal-v3',backup='lambda-lab-hub-upgrade-backup-v2';
  const oldAuto='lambda-lab-v2',oldCp='lambda-lab-checkpoint-v2';
  const archives={[auto]:'lambda-lab-hub-old-edit-archive-v3',[cp]:'lambda-lab-hub-old-checkpoint-archive-v3'};
  const allowed=new Set([auto,cp,ready,backup,oldAuto,oldCp,...Object.values(archives)]);
  const flags=()=>{const value=JSON.parse(storage.getItem(ready)||'{"auto":false,"checkpoint":false}');if(!value||typeof value.auto!=='boolean'||typeof value.checkpoint!=='boolean')throw Error('Invalid migration status');return value;};
  const archive=(key,text)=>[archives[key],JSON.stringify([...(JSON.parse(storage.getItem(archives[key])||'[]')),text])];
  function apply(changes){for(const [key,value] of changes){if(!allowed.has(key)||(value!==null&&typeof value!=='string'))throw Error('Invalid migration journal');if(value===null)storage.removeItem(key);else storage.setItem(key,value);}}
  function recover(){const raw=storage.getItem(journal);if(raw!==null){const record=JSON.parse(raw);if(record.schemaVersion!==1||!Array.isArray(record.after))throw Error('Invalid migration journal');for(const [key,value] of record.after){if(!allowed.has(key)||(value!==null&&typeof value!=='string'))throw Error('Invalid migration journal');if([auto,cp,oldAuto,oldCp].includes(key)&&value!==null)S.decode(value);}apply(record.after);storage.removeItem(journal);}}
  function transaction(changes){
    recover();const before=changes.map(([key])=>[key,storage.getItem(key)]);
    storage.setItem(journal,JSON.stringify({schemaVersion:1,before,after:changes}));
    try{apply(changes);storage.removeItem(journal);}
    catch(error){try{apply(before);storage.removeItem(journal);}catch{}throw error;}
  }
  function ensureMigration(){
    recover();if(storage.getItem(auto)!==null)return;
    const pending=new Map(),staged={getItem:key=>pending.has(key)?pending.get(key):storage.getItem(key),setItem:(key,value)=>pending.set(key,value),removeItem:key=>pending.set(key,null)};
    if(migrate(staged,S.decode)){
      if(storage.getItem(backup)===null)pending.set(backup,JSON.stringify({auto:storage.getItem(oldAuto),checkpoint:storage.getItem(oldCp),legacy:storage.getItem('lambda-lab-v1')}));
      transaction([...pending]);
    }
  }
  function base(text){const s=S.decode(text);const copy=JSON.parse(S.encode(s));copy.version=2;copy.session={...copy.session,original:s.term,steps:0};delete copy.session.paths;copy.functions=copy.functions.map(({name,term})=>({name,term}));copy.view.strategy='normal';copy.view.direction='left';return S.encode(copy);}
  function canonical(text){const s=JSON.parse(S.encode(S.decode(text)));delete s.savedAt;s.functions=s.functions.map(({name,term})=>({name,term}));return JSON.stringify(s);}
  function merge(fullText,oldText){
    const full=S.decode(fullText),old=S.decode(oldText),result=JSON.parse(S.encode(old));
    result.view.strategy=full.view.strategy;result.view.direction=full.view.direction;
    result.functions=result.functions.map(fn=>{const previous=full.functions.find(f=>f.name===fn.name&&JSON.stringify(f.term)===JSON.stringify(fn.term));return previous?.source===undefined?fn:{...fn,source:previous.source};});
    if(JSON.stringify(old.session.original)===JSON.stringify(full.term)){
      result.session={...full.session,steps:full.session.steps+old.session.steps,dirty:old.session.dirty,halt:old.session.halt};
      if(full.session.paths)result.session.paths=[...full.session.paths,...Array(old.session.steps).fill(null)];
    }
    return S.encode(result);
  }
  function getItem(key){
    ensureMigration();if(key!==auto&&key!==cp)return storage.getItem(key);
    const text=storage.getItem(key),published=flags()[key===auto?'auto':'checkpoint'];if(text===null||!published)return text;
    const old=storage.getItem(key===auto?oldAuto:oldCp);
    if(old===null){if(key===cp){transaction([archive(key,text),[cp,null],[ready,JSON.stringify({...flags(),checkpoint:false})]]);return null;}return text;}
    if(canonical(old)===canonical(base(text)))return text;
    const next=merge(text,old);transaction([archive(key,text),[key,next],[key===auto?oldAuto:oldCp,base(next)]]);return next;
  }
  function setItem(key,text){
    if(key!==auto&&key!==cp)return storage.setItem(key,text);
    ensureMigration();const state=flags(),prior=storage.getItem(key),old=storage.getItem(key===auto?oldAuto:oldCp);
    if(state[key===auto?'auto':'checkpoint']&&prior!==null&&old!==null&&canonical(old)!==canonical(base(prior)))throw Error('旧版进度发生变化，请重新打开游戏后继续。');
    const changes=[[key,text],[key===auto?oldAuto:oldCp,base(text)]];
    state[key===auto?'auto':'checkpoint']=true;
    if(key===auto&&!state.checkpoint&&storage.getItem(cp)!==null){changes.push([oldCp,base(storage.getItem(cp))]);state.checkpoint=true;}
    changes.push([ready,JSON.stringify(state)]);transaction(changes);
  }
  function removeItem(key){if(key===cp){transaction([[cp,null],[oldCp,null],[ready,JSON.stringify({...flags(),checkpoint:false})]]);}else storage.removeItem(key);}
  return {getItem,setItem,removeItem};
}
export function integrateLambdaHtml(bytes){
  const declaration="const AUTO='lambda-lab-v2',CHECKPOINT='lambda-lab-checkpoint-v2',LEGACY='lambda-lab-v1';";
  const load='const text=localStorage.getItem(AUTO)||localStorage.getItem(LEGACY);';
  let html=bytes.toString('utf8');
  for(const marker of [declaration,load])if(html.split(marker).length!==2)throw new Error('Lambda integration requires exact reviewed workspace markers');
  html=html.replace(declaration,`const localStorage=(()=>{let adapter;const get=()=>adapter||(adapter=(${createLambdaStorage.toString()})(root.localStorage,S,${migrateLambdaStorage.toString()}));return {getItem:key=>get().getItem(key),setItem:(key,value)=>get().setItem(key,value),removeItem:key=>get().removeItem(key)};})();\n  const AUTO='lambda-lab-hub-v3',CHECKPOINT='lambda-lab-hub-checkpoint-v3',LEGACY='lambda-lab-hub-legacy-v3';`);
  return Buffer.from(html);
}
export function integrationProof(input,output){
  return {id:LAMBDA_INTEGRATION,inputSha256:sha256(input),outputSha256:sha256(output),adapterSha256:sha256(readFileSync(new URL(import.meta.url)))};
}
