import {validateNativeSave,lossless} from './native-save.mjs';
const limits={conway:4_000_000,eml:5*1024*1024,light:8*1024*1024,turing:8*1024*1024,'abelian-sandpile':2*1024*1024,'lambda-diagram-game':2*1024*1024,'mini-scratch':4*1024*1024};
export async function validateNativeFile(context,text,gameRoot){
  const raw=JSON.parse(text),g=globalThis;let entries;
  if(context.id==='conway'){
    if(raw?.format===g.PatternLibrary.LIBRARY_FORMAT)entries=[[g.PatternLibrary.STORAGE_KEY,text]];
    else if(raw?.format===g.LogicFunctionLibrary.LIBRARY_FORMAT)entries=[[g.LogicFunctionLibrary.STORAGE_KEY,text]];
    else{
      const restored=g.LifeEngine.deserialize(text);
      if(raw.version===1){lossless(raw,Object.fromEntries(['format','version','rows','columns','generation','alive'].map(key=>[key,raw[key]])));}
      else lossless(raw,g.LifeEngine.serialize(restored.world,restored.generation,restored.view));
      return;
    }
  }else if(context.id==='light'){
    const parsed=g.LightStorage.parseLevelFile(text);if(!parsed.ok)throw Error(parsed.errors.join('；'));lossless(raw,JSON.parse(g.LightStorage.serializeLevelFile(parsed.level,parsed.placement)));return;
  }else if(context.id==='lambda-diagram-game'){
    if(raw?.version===1){const migrated=g.LambdaSnapshot.decode(text);lossless({...raw,version:2},migrated);return;}
    const {checkpoint,...main}=raw??{};entries=[['lambda-lab-hub-v3',JSON.stringify(main)]];
    if(checkpoint!==undefined&&checkpoint!==null)entries.push(['lambda-lab-hub-checkpoint-v3',JSON.stringify(checkpoint)]);
  }else{
    const key={eml:'eml_workbench_v2',turing:'turing-machine-simulator.project.v1','abelian-sandpile':'abelian-sandpile.experiment.v1','mini-scratch':'inspiration-blocks-v5'}[context.id];if(!key)throw Error('此游戏没有已审原生文件导入格式');entries=[[key,text]];
  }
  await validateNativeSave(context,entries,gameRoot);
}
export function nativeFileReader({context,gameRoot,saves,confirm,onError,onValidated=()=>{}}){
  let generation=0;
  return async file=>{
    const selected=++generation;saves.cancelImport();confirm.cancel();
    const check=()=>{if(selected!==generation)throw Error('文件选择已变化，请重新确认');};
    try{
      if(saves.snapshot().mode!=='writable')throw Error('当前页面只读，请先重新打开兼容版本');
      const limit=limits[context.id];if(!limit||!file||file.size===0||file.size>limit)throw Error('原生文件为空或超过当前游戏导入上限');
      const authorization=await saves.prepareImport();check();const bytes=new Uint8Array(await file.arrayBuffer());check();if(bytes.length!==file.size||bytes.length>limit)throw Error('文件大小已变化或超过导入上限');
      const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);await validateNativeFile(context,text,gameRoot);check();
      if(!globalThis.crypto?.subtle)throw Error('浏览器缺少安全文件摘要能力，请通过HTTPS打开');
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');check();
      const accepted=await confirm({gameName:context.name,filename:file.name,bytes:bytes.length,digest,expected:authorization.expected});check();if(!accepted)throw Error('已取消导入');
      await saves.commitImport(authorization.token);check();onValidated(text);return text;
    }catch(error){if(selected===generation){saves.cancelImport();onError(error);}throw error;}
  };
}
