import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createRequire}from'node:module';import{runInNewContext}from'node:vm';
import{sha256}from'../scripts/resource-protocol.mjs';import{parseEMLJson,createEMLFormat,emlFormatRuntime}from'../scripts/eml-compatibility.mjs';import{emlLegacyRuntime,EML_REVISION,EML_LEGACY_REVISION,EML_OLD_HASHES}from'../scripts/eml-legacy-reader.mjs';
const require=createRequire(import.meta.url),P=require('./fixtures/eml/new/persistence.js'),V=require('./fixtures/eml/new/value-store.js'),E=require('./fixtures/eml/new/expression.js'),C=require('./fixtures/eml/new/eml-composition.js');
const legacy={expression:require('./fixtures/eml/old/expression.js'),store:require('./fixtures/eml/old/value-store.js'),persistence:require('./fixtures/eml/old/persistence.js')};
const format=()=>createEMLFormat(P,legacy,parseEMLJson),plain=value=>JSON.parse(JSON.stringify(value));
function cosState(){const state=V.createInitialState(),expr=E.cos(E.ONE),key=E.canonicalKey(expr),id=V.valueIdFor(key);state.values[id]={id,canonicalExpression:expr,canonicalKey:key,displayText:E.render(expr),protected:false,derivationIds:[],createdAt:new Date(0).toISOString()};state.valueOrder.push(id);state.selectedValueId=id;state.extraFuture={nested:[1,2,'保留原文']};return state;}
function compositionState(){const state=V.createInitialState(),definition=C.parseDefinition('F(x) = EML(x,x)').definition,evaluation=C.evaluate(definition,[E.ONE]);assert.equal(evaluation.ok,true);const next=V.addCompositionEvaluation(state,evaluation,[V.initialValueId]).state;return V.addCustomFunction(next,'F',definition.displayText,1,{parameterNames:definition.parameterNames,body:definition.body}).state;}
test('EML frozen old/new module fixtures preserve complete public source identities and MIT licenses',()=>{
 const base=new URL('./fixtures/eml/',import.meta.url),proof=JSON.parse(readFileSync(new URL('source-proof.json',base)));assert.equal(proof.length,20);
 for(const record of proof){assert.equal(record.repository,'https://github.com/xiaoxuhui/EML.git');assert.equal(record.revision,record.label==='old'?EML_LEGACY_REVISION:EML_REVISION);const bytes=readFileSync(new URL(record.fixture,base));assert.equal(bytes.length,record.bytes);assert.equal(sha256(bytes),record.sha256);if(record.path==='LICENSE')assert.match(bytes.toString(),/^MIT License/);}
 for(const[name,hash]of Object.entries(EML_OLD_HASHES))assert.equal(sha256(readFileSync(new URL('old/'+name,base))),hash);
});
test('actual old reader refuses both new cos and composition; base/full wrapper restores the exact full original for new reader',()=>{
 const F=format();for(const state of[cosState(),compositionState()]){const full=P.serialize(state);assert.equal(P.deserialize(full).ok,true);assert.equal(legacy.persistence.deserialize(full).ok,false);const wrapped=F.wrap(full),old=legacy.persistence.deserialize(wrapped),restored=F.read(wrapped);assert.equal(old.ok,true);assert.equal(restored.ok,true);assert.equal(restored.fullText,full);assert.deepEqual(restored.state,P.deserialize(full).state);assert.ok(restored.omitted.values+restored.omitted.derivations+restored.omitted.customFunctions>0);}
});
test('legacy projection preserves every representable numeric expression without inventing composition provenance or dangling indices',()=>{
 const state=compositionState(),F=format(),projected=F.project(P.serialize(state));assert.equal(projected.omitted.derivations,1);assert.equal(projected.omitted.customFunctions,1);assert.equal(projected.omitted.values,0);assert.equal(Object.keys(projected.base.derivations).length,0);assert.deepEqual(projected.base.valueOrder,state.valueOrder);
 for(const id of state.valueOrder){assert.deepEqual(plain(projected.base.values[id].canonicalExpression),plain(state.values[id].canonicalExpression));assert.deepEqual(projected.base.values[id].derivationIds,[]);}
 const cos=F.project(P.serialize(cosState()));assert.equal(cos.omitted.values,1);assert.equal(cos.base.selectedValueId,null);assert.equal(cos.base.valueOrder.length,1);
});
test('actual legacy serialize and saveToCache may retain unknown full extension; no-op preserves full but edits are explicit conflicts',()=>{
 const F=format(),full=P.serialize(compositionState()),wrapped=F.wrap(full),old=legacy.persistence.deserialize(wrapped);assert.equal(old.ok,true);
 const noop=legacy.persistence.serialize(old.state);assert.equal(F.read(noop).fullText,full);
 const edited=legacy.store.setInput(old.state,'x',legacy.store.initialValueId),storage=new Map();legacy.persistence.saveToCache({setItem:(key,value)=>storage.set(key,value)},edited);
 const raw=storage.get(legacy.persistence.CACHE_KEY);assert.ok(JSON.parse(raw)[F.extensionKey]);const conflict=F.read(raw);assert.equal(conflict.ok,false);assert.equal(conflict.conflict.fullText,full);assert.equal(P.deserialize(conflict.conflict.baseText).ok,true);assert.equal(JSON.parse(conflict.conflict.baseText).inputXId,legacy.store.initialValueId);assert.equal(conflict.conflict.originalText,raw);
 const cleared=legacy.persistence.serialize(legacy.store.clearNonInitial());assert.equal(Object.hasOwn(JSON.parse(cleared),F.extensionKey),false);assert.equal(F.read(cleared).source,'standalone');
});
test('new reader accepts fixed old plain v2 and original new plain full files without narrowing source mathematics',()=>{
 const F=format(),old=legacy.persistence.serialize(legacy.store.createInitialState()),current=P.serialize(cosState());assert.equal(F.read(old).ok,true);assert.equal(F.read(current).ok,true);assert.equal(F.read(current).fullText,current);
});
test('real old EML calculation and its complete provenance survive the compatibility projection',()=>{
 const evaluator=require('./fixtures/eml/old/evaluator.js'),initial=legacy.store.createInitialState(),evaluation=evaluator.evaluateEML(legacy.expression.ONE,legacy.expression.ONE),state=legacy.store.addEvaluation(initial,evaluation,legacy.store.initialValueId,legacy.store.initialValueId).state;
 const F=format(),text=legacy.persistence.serialize(state),projected=F.project(text),wrapped=F.wrap(text);assert.equal(Object.keys(projected.base.derivations).length,1);assert.deepEqual(plain(projected.base.derivations),state.derivations);assert.equal(projected.omitted.values,0);assert.equal(projected.omitted.derivations,0);assert.equal(legacy.persistence.deserialize(wrapped).ok,true);
});
test('malformed, future, duplicate, nested and wrongly bound full extensions reject without silently falling back',()=>{
 const F=format(),wrapped=JSON.parse(F.wrap(P.serialize(cosState())));
 for(const mutate of[doc=>doc[F.extensionKey].schemaVersion=2,doc=>doc[F.extensionKey].fullText='bad',doc=>doc[F.extensionKey].baseText='{}',doc=>doc[F.extensionKey].fullText=JSON.stringify(doc),doc=>doc.values={}] ){
  const doc=structuredClone(wrapped);mutate(doc);const result=F.read(JSON.stringify(doc));assert.equal(result.ok,false);assert.equal(result.conflict,undefined);
 }
 assert.equal(F.read('{"schemaVersion":2,"schemaVersion":2}').ok,false);
 assert.equal(F.read('null').ok,false);assert.equal(F.read('[]').ok,false);
});
test('user-file parser retains upstream decimal/exponent grammar and valid deep expression shapes while rejecting duplicate keys',()=>{
 assert.deepEqual(parseEMLJson('{"a":1.0,"b":1e0,"c":-0,"s":"\\u0061\\\""}'),{a:1,b:1,c:-0,s:'a"'});
 let value={type:'integer',value:1};for(let i=0;i<40;i++)value={type:'neg',child:value};assert.equal(parseEMLJson(JSON.stringify(value)).type,'neg');
 assert.throws(()=>parseEMLJson('{"a":0,"\\u0061":1}'),/重复/);assert.throws(()=>parseEMLJson(' '.repeat(5*1048576+1)),/大小/);
 assert.throws(()=>parseEMLJson('['.repeat(130)+'0'+']'.repeat(130)),/嵌套/);assert.throws(()=>parseEMLJson('{"s":"bad\nline"}'));assert.throws(()=>parseEMLJson('{"x":1}x'));
 const F=format(),state=V.createInitialState();state.values[V.initialValueId].canonicalExpression.value=1;let text=P.serialize(state).replace('"value": 1','"value": 1.0');assert.equal(F.read(text).ok,true);
 const deep=V.createInitialState(),key=E.canonicalKey(value),id=V.valueIdFor(key);deep.values[id]={id,canonicalExpression:value,canonicalKey:key,displayText:E.render(value),protected:false,derivationIds:[],createdAt:new Date(0).toISOString()};deep.valueOrder.push(id);const full=P.serialize(deep);assert.equal(P.deserialize(full).ok,true);assert.equal(F.read(F.wrap(full)).fullText,full);
});
test('full compatibility envelope above 5MiB is refused while a valid full backup remains accessible unchanged',()=>{
 const F=format(),state=V.createInitialState();state.future='\\'.repeat(2*1048576);const full=P.serialize(state);assert.equal(F.read(full).ok,true);assert.throws(()=>F.wrap(full),/大小/);assert.equal(F.read(full).fullText,full);
});
test('valid old UTF-16 length-limited Chinese full file remains readable even when its UTF-8 size exceeds 5MiB',()=>{
 const F=format(),state=V.createInitialState();state.future='汉'.repeat(2*1048576);const full=P.serialize(state);assert.ok(full.length<5*1048576);assert.ok(Buffer.byteLength(full)>5*1048576);assert.equal(legacy.persistence.deserialize(full).ok,true);assert.equal(P.deserialize(full).ok,true);assert.equal(F.read(full).ok,true);assert.equal(F.read(full).fullText,full);assert.throws(()=>F.wrap(full),/大小/);
});
test('upstream-valid self-reference provenance that old reader rejects must be omitted without deleting the exact value',()=>{
 const F=format(),state=V.createInitialState(),id=V.initialValueId;state.values[id].derivationIds=['self'];state.derivations.self={id:'self',operation:'EML',xValueId:id,yValueId:id,resultValueId:id,directFormula:'1 = 1',rawExpression:E.ONE,rewriteSteps:[]};const text=P.serialize(state);assert.equal(P.deserialize(text).ok,true);assert.equal(legacy.persistence.deserialize(text).ok,false);const projected=F.project(text);assert.equal(Object.keys(projected.base.derivations).length,0);assert.equal(legacy.persistence.deserialize(F.wrap(text)).ok,true);
});
test('emitted frozen legacy reader is isolated from the live new expression global and actual emitted codec reads full extensions',()=>{
 const sentinel={live:true},context={TextEncoder,EMLExpression:sentinel,EMLHubFormat:null};runInNewContext(emlLegacyRuntime().toString(),context);assert.equal(context.EMLExpression,sentinel);assert.equal(context.EMLHubLegacy.expression.isValidExpression(E.cos(E.ONE)),false);runInNewContext(emlFormatRuntime().toString(),context);const F=context.EMLHubFormat.create(P,context.EMLHubLegacy),text=P.serialize(compositionState());assert.equal(F.read(F.wrap(text)).fullText,text);assert.equal(context.EMLExpression,sentinel);
});
