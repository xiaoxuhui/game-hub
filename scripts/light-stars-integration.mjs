import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {sha256} from './resource-protocol.mjs';

export const LIGHT_REVISION='85163534ccae2b023928c877e002581a8f35f0cb';
export const LIGHT_INTEGRATION='light-stars-persist-v1';
export const LIGHT_APP_SHA256='50900439da27dad2faaef1ffabaa2e8c5461bf0c5aadf80f40014a40564e312b';

export function adaptLightStars(bytes) {
 if(sha256(bytes)!==LIGHT_APP_SHA256)throw Error('Unreviewed Light app bytes');
 const text=bytes.toString('utf8');
 const before='        state.stars[level.id] = stars;\n        rememberStars(level.id, stars);';
 if(text.split(before).length!==2)throw Error('Light stars save marker changed');
 // state.stars aliases store.data.stars. Mutating it first makes updateStars
 // believe there is no improvement and skip persistence.
 let result=text.replace(before,'        rememberStars(level.id, stars);');
 const startup='  // 先读档再进关卡：selectLevel 会把该关上次的布局恢复出来';
 if(result.split(startup).length!==2)throw Error('Light storage startup marker changed');
 result=result.replace(startup,`  // Refuse to overwrite an unrecognized, damaged or externally changed save.
  const persistOriginal=store.persist.bind(store);
  let observedRaw=null,storageProtected=false,protectedRaw=null,protectionNotice=null;
  function canonical(value){
    if(Array.isArray(value))return value.map(canonical);
    if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
    return value;
  }
  function protectSave(raw,reason){
    storageProtected=true;protectedRaw=raw;
    if(protectionNotice)return;
    const notice=document.createElement('section');notice.setAttribute('role','alert');
    const message=document.createElement('p');message.textContent=reason+' 原始存档未覆盖，本次修改不会自动保存。';notice.append(message);
    if(raw!==null){const button=document.createElement('button');button.type='button';button.textContent='导出原始存档';button.addEventListener('click',()=>storage.downloadFile('light-original-save.json',new Blob([protectedRaw],{type:'application/json'})));notice.append(button);}
    document.body.prepend(notice);protectionNotice=notice;
  }
  try{
    observedRaw=store.backend.getItem(storage.STORAGE_KEY);
    if(observedRaw!==null){
      const input=JSON.parse(observedRaw),normalized=JSON.parse(storage.serializeSave(storage.parseSave(observedRaw)));
      if(JSON.stringify(canonical(input))!==JSON.stringify(canonical(normalized)))protectSave(observedRaw,'检测到无法完整识别的存档。');
    }
  }catch(error){protectSave(observedRaw,'无法安全读取或识别本机存档。');}
  store.persist=function(){
    if(storageProtected)return false;
    try{const current=store.backend.getItem(storage.STORAGE_KEY);if(current!==observedRaw){protectSave(current,'本机存档在另一个页面发生变化。');return false;}}
    catch(error){protectSave(observedRaw,'无法安全检查本机存档。');return false;}
    const ok=persistOriginal();
    if(ok){try{observedRaw=store.backend.getItem(storage.STORAGE_KEY);}catch(error){protectSave(observedRaw,'无法核对写入后的存档。');}}
    return ok;
  };

`+startup);
 return Buffer.from(result);
}

export function integrateLightResource(source,directory) {
 if(source.id!=='light'||source.revision!==LIGHT_REVISION||source.resourceIntegration!==LIGHT_INTEGRATION)throw Error('Unreviewed Light resource identity');
 const file=join(directory,'scripts','app.js');writeFileSync(file,adaptLightStars(readFileSync(file)));
}
