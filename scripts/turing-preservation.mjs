import{parseTuringJSON}from'./turing-compatibility.mjs';

export function createTuringPreservation(storage,F,initialFullText,parseJSON){
 const key='turing-hub-preservation-v1',oldKey='turing-machine-simulator.project.v1',maxBytes=3*1048576,maxHistory=10;
 const copy=value=>JSON.parse(JSON.stringify(value)),own=(value,name)=>Object.prototype.hasOwnProperty.call(value,name),size=text=>new TextEncoder().encode(text).length;
 let last=null,invalidated=false,conflict=null;
 if(!F.read(initialFullText).ok||F.read(initialFullText).source!=='standalone')throw Error('图灵机保护初始化无效。');
 const empty=()=>({schemaVersion:1,current:null,history:[]});
 function full(text){const read=F.read(text);if(!read.ok||read.source!=='standalone')throw Error('保护当前档需要有效的独立完整项目原文。');return read;}
 function finiteMetadata(value){if(typeof value==='number'&&!Number.isFinite(value))throw Error('保护元数据含非有限数。');if(value&&typeof value==='object')for(const child of Object.values(value))finiteMetadata(child);}
 const timestamp=value=>typeof value==='string'&&value.length<=64&&Number.isFinite(Date.parse(value));
 const validLimit=value=>Number.isSafeInteger(value)&&value>=1&&value<=1_000_000;
 function parse(raw){
  if(raw===null)return empty();const doc=parseJSON(raw,maxBytes);finiteMetadata(doc);
  if(!doc||doc.schemaVersion!==1||!own(doc,'current')||!Array.isArray(doc.history)||doc.history.length>maxHistory)throw Error('保护记录版本或历史数量无效，原文保留。');
  if(doc.current!==null){const current=doc.current;if(!current||!timestamp(current.savedAt)||(current.mirrorBeforeRaw!==null&&typeof current.mirrorBeforeRaw!=='string')||typeof current.mirrorAfterRaw!=='string'||!validLimit(current.legacyMaxSteps))throw Error('保护当前记录无效。');full(current.fullText);const projected=F.project(current.fullText,current.legacyMaxSteps);if(projected.baseText!==current.baseText||projected.legacyMaxSteps!==current.legacyMaxSteps)throw Error('保护当前档基础绑定无效。');const mirror=F.read(current.mirrorAfterRaw);if(!mirror.ok||mirror.source!=='full-extension'||mirror.fullText!==current.fullText||mirror.legacyMaxSteps!==current.legacyMaxSteps)throw Error('保护镜像绑定无效。');}
  const seen=new Set();for(const entry of doc.history){if(!entry||typeof entry.rawText!=='string'||!timestamp(entry.savedAt)||typeof entry.reason!=='string'||entry.reason.length>200||seen.has(entry.rawText))throw Error('保护历史条目无效。');seen.add(entry.rawText);}return doc;
 }
 function writable(){if(invalidated)throw Error('其他页面修改或写入冲突已停止自动保存，请关闭其它实例后重新打开。');}
 function mark(before,observed,attempted){invalidated=true;conflict={before,observed,attempted};}
 function check(){writable();if(!last)inspect();const observed={ownRaw:storage.getItem(key),legacyRaw:storage.getItem(oldKey)};if(observed.ownRaw!==last.ownRaw||observed.legacyRaw!==last.legacyRaw){mark({ownRaw:last.ownRaw,legacyRaw:last.legacyRaw},observed,null);throw Error('旧版或其它页面已修改项目，未覆盖其原文。');}}
 function encode(doc){if(doc.history.length>maxHistory)throw Error('历史已达10条，请先导出后明确清理。');const raw=JSON.stringify(doc);if(size(raw)>maxBytes)throw Error('保护记录超过3MiB，请完整导出或明确仅在本会话继续。');return raw;}
 function writeOwn(doc){const raw=encode(doc);check();const before={ownRaw:last.ownRaw,legacyRaw:last.legacyRaw};storage.setItem(key,raw);const observed=storage.getItem(key);if(observed!==raw){mark(before,{ownRaw:observed,legacyRaw:storage.getItem(oldKey)},{ownRaw:raw});throw Error('完整保护记录读回不一致，未盲目回写。');}last={...last,ownRaw:raw,doc};return raw;}
 function history(doc,texts,reason){if(typeof reason!=='string'||reason.length>200)throw Error('保护原因无效。');const next={...doc,history:doc.history.map(copy)};for(const rawText of texts){if(rawText===null)continue;if(typeof rawText!=='string')throw Error('保护输入必须为原文。');if(!next.history.some(entry=>entry.rawText===rawText))next.history.push({rawText,reason,savedAt:new Date().toISOString()});}encode(next);return next;}
 function actualBase(raw){const parsed=parseJSON(raw,F.maxReadBytes),base=Object.fromEntries(F.baseKeys.map(name=>[name,parsed[name]])),projected=F.project(JSON.stringify(base));return{baseText:projected.baseText,bare:Object.keys(parsed).every(name=>F.baseKeys.includes(name))};}
 function inspect(){
  const ownRaw=storage.getItem(key),doc=parse(ownRaw),legacyRaw=storage.getItem(oldKey),current=doc.current,options=[],historical=[];
  function option(label,fullText,legacyMaxSteps){if(options.some(item=>item.fullText===fullText&&item.legacyMaxSteps===legacyMaxSteps))return;const read=F.read(fullText);if(read.ok&&read.source==='standalone')options.push({label,fullText,...(validLimit(legacyMaxSteps)?{legacyMaxSteps}:{})});}
  if(current)option('恢复已保护的完整项目',current.fullText,current.legacyMaxSteps);
  const read=legacyRaw===null?null:F.read(legacyRaw);
  if(read?.ok)option('使用当前缓存项目',read.fullText,read.legacyMaxSteps);
  if(read?.conflict){option('恢复缓存附带的完整项目',read.conflict.fullText,read.conflict.legacyMaxSteps);option('使用旧版修改后的有限基础',read.conflict.baseText);}
  if(legacyRaw===null||!read?.ok&&!read?.conflict)option('明确使用初始项目',initialFullText);
  for(const entry of doc.history){const saved=F.read(entry.rawText);if(saved.ok){const limit=saved.legacyMaxSteps??entry.importedCurrent?.legacyMaxSteps;option('历史项目 · '+entry.savedAt,saved.fullText,limit);historical.push(saved.fullText);}else if(saved.conflict){option('历史附带完整项目 · '+entry.savedAt,saved.conflict.fullText,saved.conflict.legacyMaxSteps);option('历史旧版有限基础 · '+entry.savedAt,saved.conflict.baseText);historical.push(saved.conflict.fullText,saved.conflict.baseText);}}
  let kind;
  if(!current)kind=legacyRaw===null?'empty':read?.ok?'legacy':read?.conflict?'conflict':'invalid-legacy';
  else if(legacyRaw===current.mirrorAfterRaw)kind='current';
  else if(legacyRaw===current.mirrorBeforeRaw)kind='pending';
  else if(read?.ok&&read.source==='full-extension'&&read.fullText===current.fullText&&read.legacyMaxSteps===current.legacyMaxSteps)kind='current';
  else if(legacyRaw!==null){let match=false;try{const base=actualBase(legacyRaw);match=base.bare&&base.baseText===current.baseText&&!historical.some(text=>{if(text===current.fullText)return false;try{return F.project(text,current.legacyMaxSteps).baseText===base.baseText;}catch{return true;}});}catch{}kind=match?'current':'conflict';}
  else kind='conflict';
  const activeFullText=kind==='current'?current.fullText:kind==='legacy'?read.fullText:kind==='empty'?initialFullText:null,legacyMaxSteps=kind==='current'?current.legacyMaxSteps:kind==='legacy'?read.legacyMaxSteps:undefined;
  last={ownRaw,legacyRaw,doc,kind,options,activeFullText};return copy({ownRaw,legacyRaw,kind,options,activeFullText,legacyMaxSteps});
 }
 function currentWrite(fullText,legacyMaxSteps,doc){
  full(fullText);const projected=F.project(fullText,legacyMaxSteps),after=F.wrap(fullText,projected.legacyMaxSteps);check();const before=last.legacyRaw,next={...doc,current:{...(doc.current||{}),fullText,legacyMaxSteps:projected.legacyMaxSteps,baseText:projected.baseText,savedAt:new Date().toISOString(),mirrorBeforeRaw:before,mirrorAfterRaw:after}};
  writeOwn(next);last.kind='pending';last.activeFullText=null;check();
  try{storage.setItem(oldKey,after);const observed=storage.getItem(oldKey);if(observed!==after){mark({ownRaw:last.ownRaw,legacyRaw:before},{ownRaw:storage.getItem(key),legacyRaw:observed},{legacyRaw:after});throw Error('旧版镜像读回不一致，未盲目回滚。');}}catch(error){throw Error('完整项目已保护，旧版镜像尚未完成：'+error.message);}
  last={...last,legacyRaw:after,kind:'current',activeFullText:fullText};return{status:'saved'};
 }
 function save(fullText,legacyMaxSteps){check();if(!['empty','legacy','current'].includes(last.kind))throw Error('旧编辑或保存中断尚未解决，请先明确选择。');const external=last.legacyRaw!==null&&(!last.doc.current||last.legacyRaw!==last.doc.current.mirrorAfterRaw),next=external?history(last.doc,[last.legacyRaw],'首次迁移或旧版写回原文'):last.doc;return currentWrite(fullText,legacyMaxSteps,next);}
 function preserve(texts,reason){check();const next=history(last.doc,texts,reason);if(JSON.stringify(next)!==JSON.stringify(last.doc))writeOwn(next);return{status:'protected'};}
 function select(snapshot,index,legacyMaxSteps){check();if(!snapshot||snapshot.ownRaw!==last.ownRaw||snapshot.legacyRaw!==last.legacyRaw||!Number.isInteger(index)||!last.options[index])throw Error('恢复选择已过时，请重新预览。');const chosen=last.options[index],texts=[last.doc.current?.mirrorAfterRaw??null,last.legacyRaw,chosen.fullText],next=history(last.doc,texts,'明确选择前保全双方原文');return currentWrite(chosen.fullText,legacyMaxSteps??chosen.legacyMaxSteps,next);}
 function mergeOpaque(a,b,known=[]){const out=copy(a);for(const[name,value]of Object.entries(b)){if(known.includes(name))continue;if(own(out,name)&&JSON.stringify(out[name])!==JSON.stringify(value))throw Error('导入元数据冲突，未删除或覆盖未知字段。');Object.defineProperty(out,name,{value:copy(value),writable:true,enumerable:true,configurable:true});}return out;}
 function importProtection(raw){check();const incoming=parse(raw);let next=mergeOpaque(last.doc,incoming,['schemaVersion','current','history']);next.current=last.doc.current;next.history=last.doc.history.map(copy);const entries=incoming.history.map(copy);if(incoming.current)entries.push({rawText:incoming.current.fullText,reason:'导入集合中的完整当前档',savedAt:incoming.current.savedAt,importedCurrent:copy(incoming.current)});for(const entry of entries){const at=next.history.findIndex(item=>item.rawText===entry.rawText);if(at<0)next.history.push(entry);else next.history[at]=mergeOpaque(next.history[at],entry,['rawText','reason','savedAt']);}encode(next);if(JSON.stringify(next)!==JSON.stringify(last.doc))writeOwn(next);return{status:'imported'};}
 function previewClear(){const expectedRaw=storage.getItem(key);let count=null;try{count=parse(expectedRaw).history.length;}catch{}return{expectedRaw,historyCount:count};}
 function clearProtection(confirmed,expectedRaw){writable();if(confirmed!==true||(expectedRaw!==null&&typeof expectedRaw!=='string'))throw Error('须预览并明确确认清理。');const before=storage.getItem(key);if(before!==expectedRaw){mark({ownRaw:expectedRaw},{ownRaw:before},null);throw Error('保护原文已变化，未执行过期清理。');}storage.removeItem(key);const after=storage.getItem(key);if(after!==null){mark({ownRaw:before},{ownRaw:after},null);throw Error('清理读回核验失败。');}last=null;}
 function clearHistory(confirmed,expectedRaw){if(confirmed!==true||(expectedRaw!==null&&typeof expectedRaw!=='string'))throw Error('须预览并明确确认历史清理。');check();if(last.ownRaw!==expectedRaw)throw Error('历史清理确认已过时。');writeOwn({...last.doc,history:[]});return{status:'cleared-history'};}
 return{key,oldKey,maxBytes,maxHistory,inspect,save,preserve,select,importProtection,previewClear,clearProtection,clearHistory,exportProtection:()=>storage.getItem(key)??JSON.stringify(empty()),exportLegacy:()=>storage.getItem(oldKey),invalidate(){invalidated=true;},conflict(){return conflict?copy(conflict):null;}};
}

export function turingPreservationRuntime(){return Buffer.from(`(function(root){'use strict';root.TuringHubPreservation={create:(storage,format,initial)=>(${createTuringPreservation.toString()})(storage,format,initial,root.TuringHubFormat.parse)};})(globalThis);\n`);}
