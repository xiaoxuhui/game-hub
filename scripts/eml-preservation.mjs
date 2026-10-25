import {parseEMLJson} from './eml-compatibility.mjs';

export function createEMLPreservation(storage, F, legacy, initialFullText, parseJson) {
  const key='eml-hub-preservation-v1', oldKey='eml_workbench_v2', maxBytes=3*1048576, maxHistory=10;
  const knownBase=['schemaVersion','values','derivations','valueOrder','inputXId','inputYId','selectedValueId'];
  const copy=value=>JSON.parse(JSON.stringify(value)), own=(value,name)=>Object.prototype.hasOwnProperty.call(value,name), bytes=text=>new TextEncoder().encode(text).length;
  let last=null, invalidated=false, conflict=null;
  if(legacy.CACHE_KEY!==oldKey||!F.read(initialFullText).ok)throw Error('EML保护初始化无效。');
  const empty=()=>({schemaVersion:1,current:null,history:[]});
  function writable(){if(invalidated)throw Error('检测到其他页面修改或写入冲突，请关闭其它实例后重开。');}
  function finite(value){if(typeof value==='number'&&!Number.isFinite(value))throw Error('保护元数据含非有限数值。');if(value&&typeof value==='object')for(const item of Object.values(value))finite(item);}
  function timestamp(value){return typeof value==='string'&&value.length<=64&&Number.isFinite(Date.parse(value));}
  function full(text){const read=F.read(text);if(!read.ok||read.source!=='standalone')throw Error('保护记录需要有效的独立完整EML原文。');return read;}
  function parse(raw){
    if(raw===null)return empty();
    const doc=parseJson(raw,maxBytes);finite(doc);
    if(!doc||doc.schemaVersion!==1||!own(doc,'current')||!Array.isArray(doc.history)||doc.history.length>maxHistory)throw Error('保护记录版本或历史数量无效，原数据保留。');
    if(doc.current!==null){
      const current=doc.current;
      if(!current||!timestamp(current.savedAt)||(current.mirrorBeforeRaw!==null&&typeof current.mirrorBeforeRaw!=='string')||typeof current.mirrorAfterRaw!=='string')throw Error('保护当前记录无效。');
      full(current.fullText);
      if(F.project(current.fullText).baseText!==current.baseText)throw Error('保护当前档基础绑定不一致。');
      const mirrored=F.read(current.mirrorAfterRaw);
      if(!mirrored.ok||mirrored.fullText!==current.fullText||mirrored.source!=='full-extension')throw Error('保护镜像绑定不一致。');
    }
    const texts=new Set();
    for(const entry of doc.history){if(!entry||typeof entry.rawText!=='string'||!timestamp(entry.savedAt)||typeof entry.reason!=='string'||entry.reason.length>200||texts.has(entry.rawText))throw Error('保护历史条目无效。');texts.add(entry.rawText);}
    return doc;
  }
  function mark(before,observed,attempted){invalidated=true;conflict={before,observed,attempted};}
  function check(){
    writable();if(!last)inspect();
    const observed={ownRaw:storage.getItem(key),legacyRaw:storage.getItem(oldKey)};
    if(observed.ownRaw!==last.ownRaw||observed.legacyRaw!==last.legacyRaw){mark({ownRaw:last.ownRaw,legacyRaw:last.legacyRaw},observed,null);throw Error('其他页面或旧版已修改EML记录，未覆盖其数据。');}
  }
  function encode(doc){if(doc.history.length>maxHistory)throw Error('保护历史已达10条，请先导出后明确清理。');const raw=JSON.stringify(doc);if(bytes(raw)>maxBytes)throw Error('保护记录超过3MiB，请先导出或使用完整文件备份。');return raw;}
  function writeOwn(doc){
    const raw=encode(doc);check();const before={ownRaw:last.ownRaw,legacyRaw:last.legacyRaw};storage.setItem(key,raw);
    const observed=storage.getItem(key);
    if(observed!==raw){mark(before,{ownRaw:observed,legacyRaw:storage.getItem(oldKey)},{ownRaw:raw});throw Error('保护记录写入核验失败，未盲目回写。');}
    last={...last,ownRaw:raw,doc};return raw;
  }
  function history(doc,texts,reason){
    if(typeof reason!=='string'||reason.length>200)throw Error('保护原因无效。');
    const next={...doc,history:doc.history.map(copy)};
    for(const rawText of texts){if(rawText===null)continue;if(typeof rawText!=='string')throw Error('保护原文须为文本。');if(!next.history.some(entry=>entry.rawText===rawText))next.history.push({rawText,reason,savedAt:new Date().toISOString()});}
    encode(next);return next;
  }
  function actualBase(raw){
    const parsed=parseJson(raw,F.maxReadBytes),old=legacy.deserialize(raw);if(!old.ok)throw Error(old.error);
    const base={};for(const name of knownBase)if(own(parsed,name))base[name]=parsed[name];
    return {baseText:F.canonical(base),bare:Object.keys(parsed).every(name=>knownBase.includes(name)||name==='app'||name==='savedAt')};
  }
  function inspect(){
    const ownRaw=storage.getItem(key),doc=parse(ownRaw),legacyRaw=storage.getItem(oldKey),current=doc.current,options=[];
    const option=(label,fullText)=>{if(!options.some(item=>item.fullText===fullText)){const read=F.read(fullText);if(read.ok&&read.source==='standalone')options.push({label,fullText});}};
    if(current)option('恢复已保护的完整档',current.fullText);
    const read=legacyRaw===null?null:F.read(legacyRaw);
    if(read?.ok)option('使用当前缓存内容',read.fullText);
    if(read?.conflict){option('恢复缓存附带的完整档',read.conflict.fullText);option('使用旧版修改后的基础',read.conflict.baseText);}
    if(legacyRaw===null||!read?.ok&&!read?.conflict)option('明确以初始列表继续',initialFullText);
    const historical=[];
    for(const entry of doc.history){
      const saved=F.read(entry.rawText);
      if(saved.ok){option('历史完整档 · '+entry.savedAt,saved.fullText);historical.push(saved.fullText);}
      else if(saved.conflict){option('历史附带完整档 · '+entry.savedAt,saved.conflict.fullText);option('历史修改后基础 · '+entry.savedAt,saved.conflict.baseText);historical.push(saved.conflict.fullText,saved.conflict.baseText);}
    }
    let kind;
    if(!current)kind=legacyRaw===null?'empty':read?.ok?'legacy':read?.conflict?'conflict':'invalid-legacy';
    else if(legacyRaw===current.mirrorAfterRaw)kind='current';
    else if(legacyRaw===current.mirrorBeforeRaw)kind='pending';
    else if(read?.ok&&read.source==='full-extension'&&read.fullText===current.fullText)kind='current';
    else if(legacyRaw!==null){let match=false;try{const base=actualBase(legacyRaw);match=base.bare&&base.baseText===current.baseText&&!historical.some(text=>text!==current.fullText&&F.project(text).baseText===base.baseText);}catch{}kind=match?'current':'conflict';}
    else kind='conflict';
    const activeFullText=kind==='current'?current.fullText:kind==='legacy'?read.fullText:kind==='empty'?initialFullText:null;
    last={ownRaw,legacyRaw,doc,kind,options,activeFullText};
    return copy({ownRaw,legacyRaw,kind,options,activeFullText});
  }
  function currentWrite(fullText,doc){
    full(fullText);const after=F.wrap(fullText),baseText=F.project(fullText).baseText;
    check();const before=last.legacyRaw;
    const next={...doc,current:{...(doc.current||{}),fullText,baseText,savedAt:new Date().toISOString(),mirrorBeforeRaw:before,mirrorAfterRaw:after}};
    writeOwn(next);last.kind='pending';last.activeFullText=null;
    // Own record is already durable. An old-cache failure must not discard that full candidate.
    check();
    try{
      storage.setItem(oldKey,after);
      const observed=storage.getItem(oldKey);
      if(observed!==after){mark({ownRaw:last.ownRaw,legacyRaw:before},{ownRaw:storage.getItem(key),legacyRaw:observed},{legacyRaw:after});throw Error('EML基础镜像写入核验失败，完整档已保护，未盲目回写。');}
    }catch(error){throw Error('完整档已保护，但基础缓存尚未完成：'+error.message);}
    last={...last,legacyRaw:after,kind:'current',activeFullText:fullText};return {status:'saved'};
  }
  function save(fullText){
    check();if(!['empty','legacy','current'].includes(last.kind))throw Error('EML缓存有未解决的旧编辑或保存中断，请先明确选择恢复内容。');
    // Initial migration and observed legacy rewrites are not ordinary autosave revisions.
    // Keep their exact raw fields even after mirrorBefore is replaced by later saves.
    const externalRaw=last.legacyRaw!==null&&(!last.doc.current||last.legacyRaw!==last.doc.current.mirrorAfterRaw);
    const next=externalRaw?history(last.doc,[last.legacyRaw],'首次迁移或旧版写回原文'):last.doc;
    return currentWrite(fullText,next);
  }
  function preserve(texts,reason){check();const next=history(last.doc,texts,reason);if(JSON.stringify(next)!==JSON.stringify(last.doc))writeOwn(next);return {status:'protected'};}
  function select(snapshot,index){
    check();if(!snapshot||snapshot.ownRaw!==last.ownRaw||snapshot.legacyRaw!==last.legacyRaw||!Number.isInteger(index)||!last.options[index])throw Error('恢复选择已过时，请重新预览。');
    const chosen=last.options[index].fullText;
    const next=history(last.doc,[last.doc.current?.fullText??null,last.legacyRaw,chosen],'显式恢复选择前保管双方');
    return currentWrite(chosen,next);
  }
  function mergeOpaque(left,right,reserved){
    const result={...left};
    for(const name of Object.keys(right)){if(reserved.includes(name))continue;if(own(result,name)&&F.canonical(result[name])!==F.canonical(right[name]))throw Error('保护集合扩展元数据冲突，未覆盖。');Object.defineProperty(result,name,{value:right[name],writable:true,enumerable:true,configurable:true});}
    return result;
  }
  function importProtection(text){
    const incoming=parse(text);check();let next=mergeOpaque(last.doc,incoming,['schemaVersion','current','history']);next.history=last.doc.history.map(copy);
    const entries=incoming.history.map(copy);
    if(incoming.current)entries.push({rawText:incoming.current.fullText,reason:'导入集合中的完整当前档',savedAt:incoming.current.savedAt,importedCurrent:copy(incoming.current)});
    for(const entry of entries){const at=next.history.findIndex(item=>item.rawText===entry.rawText);if(at<0)next.history.push(entry);else next.history[at]=mergeOpaque(next.history[at],entry,['rawText','reason','savedAt']);}
    encode(next);if(JSON.stringify(next)!==JSON.stringify(last.doc))writeOwn(next);return {status:'imported'};
  }
  function previewClear(){const expectedRaw=storage.getItem(key);let count=null;try{count=parse(expectedRaw).history.length;}catch{}return {expectedRaw,historyCount:count};}
  function clearProtection(confirmed,expectedRaw){
    writable();if(confirmed!==true||(expectedRaw!==null&&typeof expectedRaw!=='string'))throw Error('请先预览并明确确认保护记录清理。');const before=storage.getItem(key);
    if(before!==expectedRaw){mark({ownRaw:expectedRaw},{ownRaw:before},null);throw Error('保护记录已被其他页面修改，未执行过期清理。');}
    storage.removeItem(key);const after=storage.getItem(key);if(after!==null){mark({ownRaw:before},{ownRaw:after},null);throw Error('保护记录清理核验失败。');}last=null;
  }
  function clearHistory(confirmed,expectedRaw){
    if(confirmed!==true||(expectedRaw!==null&&typeof expectedRaw!=='string'))throw Error('请先预览并明确确认历史清理。');check();if(last.ownRaw!==expectedRaw)throw Error('历史清理确认已过时。');writeOwn({...last.doc,history:[]});return {status:'cleared-history'};
  }
  return {key,oldKey,maxBytes,maxHistory,inspect,save,preserve,select,importProtection,previewClear,clearProtection,clearHistory,
    exportProtection:()=>storage.getItem(key)??JSON.stringify(empty()),exportLegacy:()=>storage.getItem(oldKey),
    invalidate(){invalidated=true;},conflict(){return conflict?copy(conflict):null;}};
}

export function emlPreservationRuntime(){return Buffer.from(`(function(root){'use strict';const parse=${parseEMLJson.toString()};root.EMLHubPreservation={create:(storage,format,legacy,initial)=>(${createEMLPreservation.toString()})(storage,format,legacy,initial,parse)};})(globalThis);\n`);}
