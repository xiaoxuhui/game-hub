import {checkEntries} from './save-store.mjs';
const sameKeys=(a,b)=>JSON.stringify(Object.keys(a).sort())===JSON.stringify(Object.keys(b).sort());
function knownEqual(raw,normalized){
  if(raw===null||typeof raw!=='object')return raw===normalized;
  if(Array.isArray(raw))return Array.isArray(normalized)&&raw.length===normalized.length&&raw.every((item,index)=>knownEqual(item,normalized[index]));
  return normalized!==null&&typeof normalized==='object'&&!Array.isArray(normalized)&&Object.keys(raw).every(key=>Object.hasOwn(normalized,key)&&knownEqual(raw[key],normalized[key]));
}
function lossless(raw,written){if(!knownEqual(raw,written))throw Error('当前游戏保存器无法保留此存档的全部字段，请保留原文件并使用兼容的新版本');}
function parse(text,limit){if(new TextEncoder().encode(text).length>limit)throw Error('原生存档超过本游戏导入上限');return JSON.parse(text);}
function light(text){
  const raw=parse(text,8*1024*1024),api=globalThis.LightStorage;
  if(!raw||raw.schema!==api.SAVE_SCHEMA||raw.version!==api.SAVE_VERSION||!raw.stars||Array.isArray(raw.stars)||typeof raw.stars!=='object'||!raw.boards||Array.isArray(raw.boards)||typeof raw.boards!=='object'||!Array.isArray(raw.snapshots))throw Error('光线存档格式无效');
  const normalized=api.migrate(raw);
  // Native load can salvage by dropping invalid fields. A whole-file restore
  // must reject losses, including fields the old native writer cannot retain.
  if(!sameKeys(raw.stars,normalized.stars)||!sameKeys(raw.boards,normalized.boards)||!knownEqual(raw,normalized))throw Error('光线存档包含会被原生读取器丢弃的数据');
}
export async function validateNativeSave(context,entries,gameRoot){
  const original=checkEntries(entries,context.storage),map=new Map(original),has=key=>map.has(key),read=key=>map.get(key),g=globalThis;
  switch(context.id){
    case 'conway':
      for(const [key,api] of [['conway-life-game.custom-patterns.v1',g.PatternLibrary],['conway-life-game.logic-functions.v1',g.LogicFunctionLibrary]])if(has(key)){const text=read(key),decoded=api.parseLibrary(text);lossless(JSON.parse(text),JSON.parse(api.serializeLibrary(decoded)));}
      break;
    case 'eml':if(has('eml_workbench_v2')){const result=g.EMLPersistence.deserialize(read('eml_workbench_v2'));if(!result.ok)throw Error(result.error);}break;
    case 'light':if(has('light-game/save'))light(read('light-game/save'));break;
    case 'turing':{
      const codec=await import(new URL('hub-runtime/native/turing/project-codec.mjs',gameRoot)),campaign=await import(new URL('hub-runtime/native/turing/campaign.mjs',gameRoot));
      if(has('turing-machine-simulator.project.v1')){const raw=parse(read('turing-machine-simulator.project.v1'),8*1024*1024);codec.parseProjectJson(read('turing-machine-simulator.project.v1'));
        // The UI builds this project from controls on every save. The pure
        // parser's spread alone is not evidence that UI writes retain extras.
        const fields=['format','version','name','description','input','blankSymbol','initialState','acceptStates','rejectStates','haltStates','rules','maxSteps','speed'];lossless(raw,Object.fromEntries(fields.map(key=>[key,raw[key]])));}
      if(has('turing-machine-simulator.campaign.v1')){
        const raw=parse(read('turing-machine-simulator.campaign.v1'),8*1024*1024),normalized=campaign.normalizeCampaignProgress(raw);
        if(!raw||raw.version!==1||!raw.drafts||typeof raw.drafts!=='object'||Array.isArray(raw.drafts)||!sameKeys(raw.drafts,normalized.drafts)||!knownEqual(raw,normalized))throw Error('训练进度包含无效关卡或草稿');
      }
      break;
    }
    case 'abelian-sandpile':{
      const key=g.SandpileStorage.KEYS.experiment;
      if(has(key)){const text=read(key),decoded=g.SandpileStorage.decode(text,g.SandpileLevels);lossless(JSON.parse(text),JSON.parse(g.SandpileStorage.encode(decoded,g.SandpileLevels)));}
      else if(Object.values(g.SandpileStorage.KEYS).some(has))throw Error('沙堆备份缺少权威完整实验存档');
      break;
    }
    case 'lambda-diagram-game':{
      const keys=['lambda-lab-hub-v3','lambda-lab-hub-checkpoint-v3','lambda-lab-v2','lambda-lab-checkpoint-v2'];
      for(const key of keys)if(has(key)){const text=read(key),decoded=g.LambdaSnapshot.decode(text);lossless(JSON.parse(text),JSON.parse(g.LambdaSnapshot.encode(decoded)));}
      if(has('lambda-lab-hub-mirror-ready-v3')){const flags=parse(read('lambda-lab-hub-mirror-ready-v3'),1024);if(!flags||typeof flags.auto!=='boolean'||typeof flags.checkpoint!=='boolean')throw Error('Lambda镜像状态无效');lossless(flags,{auto:flags.auto,checkpoint:flags.checkpoint});}
      const helpers=await import(new URL('hub-runtime/native/lambda-storage.mjs',gameRoot)),storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
      const adapter=helpers.createLambdaStorage(storage,g.LambdaSnapshot,helpers.migrateLambdaStorage);
      for(const key of keys.slice(0,2)){const text=adapter.getItem(key);if(text!==null)g.LambdaSnapshot.decode(text);}
      break;
    }
    case 'red-green-puzzle':{
      const api=await import(new URL('core.js',gameRoot));if(has(api.STORAGE_KEY)){const raw=parse(read(api.STORAGE_KEY),1024*1024);if(!raw||raw.schemaVersion!==1||!api.validSize(raw.size))throw Error('红绿参数无效');lossless(raw,{schemaVersion:1,size:raw.size});}break;
    }
    case 'mini-scratch':{
      const api=await import(new URL('src/project.js',gameRoot));
      // The native reader uses the newest available slot; historical backup
      // strings remain opaque and are never rewritten or executed here.
      const key=['inspiration-blocks-v5','inspiration-blocks-v4','inspiration-blocks-v3','inspiration-blocks-v2','inspiration-blocks-v1'].find(has);
      if(key){const raw=parse(read(key),16*1024*1024);lossless(raw,api.validateProject(raw));}break;
    }
    default:throw Error('此游戏尚未具备已审原生存档校验器');
  }
  return original;
}
