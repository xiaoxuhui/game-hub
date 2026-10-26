import {test} from 'node:test';
import assert from 'node:assert/strict';
import {migrateLambdaStorage,createLambdaStorage,integrateLambdaHtml,integrationProof,integrateLambdaC5Html,lambdaC5IntegrationProof} from '../scripts/lambda-storage-integration.mjs';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {sha256} from '../scripts/resource-protocol.mjs';
const old='lambda-lab-v2',cp='lambda-lab-checkpoint-v2',fresh='lambda-lab-hub-v3',newCp='lambda-lab-hub-checkpoint-v3';
function store(entries={}){const map=new Map(Object.entries(entries));return {map,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};}
const decode=text=>{const x=JSON.parse(text);if(![1,2,3].includes(x.version))throw Error('invalid');return x;};
test('hall migration copies validated current state and checkpoint without changing any old bytes',()=>{
  const s=store({[old]:'{"version":2,"history":"full"}',[cp]:'{"version":2,"checkpoint":true}',unrelated:'sentinel'}),before=new Map(s.map);
  assert.equal(migrateLambdaStorage(s,decode),true);assert.equal(s.getItem(fresh),before.get(old));assert.equal(s.getItem(newCp),before.get(cp));
  for(const [key,value] of before)assert.equal(s.getItem(key),value);
});
test('new state including empty state prevents migration and cleared checkpoint resurrection',()=>{
  for(const current of ['{"version":3,"paths":[["arg"]]}','{"version":2,"draft":""}']){
    const s=store({[old]:'{"version":2}',[cp]:'{"version":2}',[fresh]:current}),before=new Map(s.map);
    assert.equal(migrateLambdaStorage(s,decode),false);assert.deepEqual(s.map,before);
  }
});
test('invalid old current or checkpoint prevents all migration writes',()=>{
  for(const entries of [{[old]:'bad',[cp]:'{"version":2}'},{[old]:'{"version":2}',[cp]:'bad'}]){
    const s=store(entries),before=new Map(s.map);assert.throws(()=>migrateLambdaStorage(s,decode));assert.deepEqual(s.map,before);
  }
});
test('migration rolls back partial new-key writes after a storage failure and preserves legacy',()=>{
  const s=store({[old]:'{"version":2}',[cp]:'{"version":2}',unrelated:'safe'}),before=new Map(s.map),set=s.setItem;
  s.setItem=(key,value)=>{if(key===fresh)throw Error('quota');set(key,value);};
  assert.throws(()=>migrateLambdaStorage(s,decode),/quota/);assert.deepEqual(s.map,before);
});
test('legacy v1 and checkpoint-only migrations work, existing new checkpoint is never overwritten',()=>{
  const s=store({'lambda-lab-v1':'{"version":1}',[cp]:'{"version":2}',[newCp]:'{"version":3}'});
  migrateLambdaStorage(s,decode);assert.equal(s.getItem(fresh),' {"version":1}'.trim());assert.equal(s.getItem(newCp),'{"version":3}');
  const only=store({[cp]:'{"version":2}'});migrateLambdaStorage(only,decode);assert.equal(only.getItem(newCp),only.getItem(cp));
  assert.equal(migrateLambdaStorage(store(),decode),false);
});
test('HTML adapter requires exact markers and records both source and integrated bytes',()=>{
  const input=Buffer.from("const AUTO='lambda-lab-v2',CHECKPOINT='lambda-lab-checkpoint-v2',LEGACY='lambda-lab-v1';\nconst text=localStorage.getItem(AUTO)||localStorage.getItem(LEGACY);");
  const output=integrateLambdaHtml(input);assert.match(output.toString(),/lambda-lab-hub-v3/);assert.match(output.toString(),/migrateLambdaStorage/);
  const p=integrationProof(input,output);assert.notEqual(p.inputSha256,p.outputSha256);assert.equal(p.adapterSha256.length,64);
  assert.throws(()=>integrateLambdaHtml(Buffer.from('unknown')),/exact reviewed/);assert.throws(()=>integrateLambdaHtml(Buffer.concat([input,input])),/exact reviewed/);
});
test('content4 adapter embeds the frozen old reader, full C5 runtime and accessible recovery hooks',()=>{
 const input=execFileSync('git',['show','64c8932af9a0b5cc886db25910b3923a16aa0677:examples/lambda-diagram-game/lambda-lab.html'],{maxBuffer:2000000});
 const output=integrateLambdaC5Html(input),html=output.toString('utf8'),proof=lambdaC5IntegrationProof(input,output);
 assert.ok(html.includes("const AUTO='lambda-lab-hub-v4',CHECKPOINT='lambda-lab-hub-checkpoint-v4'"));
 assert.ok(html.includes('const localStorage=(function(root){'));
 assert.ok(html.includes("const OldS=legacyRoot.LambdaSnapshot"));assert.ok(html.includes('function inspectLambdaC5Storage'));
 assert.ok(html.includes('保留“已清除”的检查点'));assert.ok(html.includes('导出观察到的全部存档'));
 assert.ok(html.includes('存储空间不足'));assert.ok(html.includes('存档冲突尚未处理'));
 assert.ok(html.includes("event.key!==null&&!C5.LAMBDA_C5_STORAGE_KEYS.includes(event.key)"));
 assert.ok(html.includes('resolveChoice(pending,candidate.id,inspection)'));
 assert.ok(proof.storageAdapterSha256);assert.ok(proof.legacyReaderFixtureSha256);
 const embedded=[...html.matchAll(/<script>\s*([\s\S]*?)<\/script>/g)].map(match=>match[1]).find(script=>script.includes('const legacyRoot={}'));
 assert.ok(embedded);assert.doesNotThrow(()=>new Script(embedded));
 assert.equal(proof.inputSha256,sha256(input));assert.equal(proof.outputSha256,sha256(output));
 assert.throws(()=>integrateLambdaC5Html(Buffer.from('unreviewed')),/exact reviewed/);
});
function engine(html){const ctx={TextEncoder,TextDecoder};const scripts=[...html.matchAll(/<script>\s*([\s\S]*?)<\/script>/g)].map(m=>m[1]);for(const i of [0,4,5])runInNewContext(scripts[i],ctx);return {C:ctx.LambdaCore,S:ctx.LambdaSnapshot};}
const c3Fixture=JSON.parse(readFileSync(new URL('./fixtures/lambda-content3-reader.json',import.meta.url),'utf8'));
const latest=(()=>{const ctx={TextEncoder,TextDecoder};for(const source of c3Fixture.scripts)runInNewContext(source,ctx);return {C:ctx.LambdaCore,S:ctx.LambdaSnapshot};})();
const historical=engine(execFileSync('git',['show','64c8932af9a0b5cc886db25910b3923a16aa0677:examples/lambda-diagram-game/lambda-lab.html'],{maxBuffer:2000000}).toString());
function fixture(){const {C,S}=latest;const full={version:3,draft:'(λa.a) u ((λb.b) v)',functions:[{name:'ID',term:C.parse('λx.x'),source:'λx.x'}],completed:[],mode:'free',level:0,session:{original:C.parse('(λa.a) u ((λb.b) v)'),steps:1,paths:[['arg']],dirty:false,halt:''},view:{speed:600,strategy:'applicative',direction:'right',scale:1,autoFit:true,historyOpen:false,helpOpen:false,hintOpen:false},selection:{start:0,end:0},error:''};return S.encode(full);}
test('new full v3 persists while fixed old reader reads latest v2 base without losing extensions',()=>{
 const s=store(),w=createLambdaStorage(s,latest.S,migrateLambdaStorage),text=fixture();w.setItem(fresh,text);w.setItem(newCp,text);
 const basic=historical.S.decode(s.getItem(old));assert.equal(historical.C.format(basic.term),'(λa.a) u v');assert.equal(basic.version,2);
 s.setItem(old,historical.S.encode(basic));assert.equal(w.getItem(fresh),text);
 assert.equal(latest.S.decode(w.getItem(newCp)).view.direction,'right');assert.equal(historical.C.format(historical.S.decode(s.getItem(cp)).term),'(λa.a) u v');
});
test('old normal steps append to complete mixed history and preserve source and strategy extensions',()=>{
 const s=store(),w=createLambdaStorage(s,latest.S,migrateLambdaStorage);w.setItem(fresh,fixture());const basic=historical.S.decode(s.getItem(old));basic.session.steps=1;basic.view.speed=123;s.setItem(old,historical.S.encode(basic));
 const merged=latest.S.decode(w.getItem(fresh));assert.equal(latest.C.format(merged.term),'u v');assert.equal(merged.session.steps,2);
 assert.equal(JSON.stringify(merged.session.paths),'[["arg"],null]');assert.equal(merged.functions[0].source,'λx.x');assert.equal(merged.view.strategy,'applicative');assert.equal(merged.view.direction,'right');assert.equal(merged.view.speed,123);
 assert.equal(JSON.parse(s.getItem('lambda-lab-hub-old-edit-archive-v3')).length,1);
});
test('old expression replacement archives every prior full session and accepts the new base',()=>{
 const s=store(),w=createLambdaStorage(s,latest.S,migrateLambdaStorage);w.setItem(fresh,fixture());
 for(const expr of ['λq.q','λr.r']){const basic=historical.S.decode(s.getItem(old));basic.draft=expr;basic.session.original=historical.C.parse(expr);basic.session.steps=0;s.setItem(old,historical.S.encode(basic));assert.equal(latest.C.format(latest.S.decode(w.getItem(fresh)).term),expr);}
 const all=JSON.parse(s.getItem('lambda-lab-hub-old-edit-archive-v3'));assert.equal(all.length,2);assert.equal(latest.S.decode(all[0]).session.paths[0][0],'arg');
});
test('failed base write rolls back full storage and next startup recovers an interrupted journal',()=>{
 const s=store(),w=createLambdaStorage(s,latest.S,migrateLambdaStorage);w.setItem(fresh,fixture());const before=new Map(s.map),set=s.setItem;
 s.setItem=(key,value)=>{if(key===old)throw Error('quota');set(key,value);};assert.throws(()=>w.setItem(fresh,fixture()),/quota/);
 assert.equal(s.getItem(fresh),before.get(fresh));assert.equal(s.getItem(old),before.get(old));
 s.setItem=set;s.setItem('lambda-lab-hub-journal-v3',JSON.stringify({schemaVersion:1,after:[[fresh,before.get(fresh)],[old,before.get(old)]]}));
 createLambdaStorage(s,latest.S,migrateLambdaStorage).getItem(fresh);assert.equal(s.getItem('lambda-lab-hub-journal-v3'),null);
 s.setItem('lambda-lab-hub-journal-v3',JSON.stringify({schemaVersion:1,after:[['other-game','bad']]}));assert.throws(()=>w.getItem(fresh),/Invalid migration journal/);assert.equal(s.getItem('other-game'),null);
 s.setItem('lambda-lab-hub-journal-v3',JSON.stringify({schemaVersion:1,after:[[fresh,before.get(fresh)],[old,'{"version":99}']]}));assert.throws(()=>w.getItem(fresh),/存档无效/);assert.equal(s.getItem(old),before.get(old));
});
test('concurrent old writes cannot be overwritten by a stale new capture',()=>{
 const s=store(),w=createLambdaStorage(s,latest.S,migrateLambdaStorage);w.setItem(fresh,fixture());const basic=historical.S.decode(s.getItem(old));basic.session.steps=1;const changed=historical.S.encode(basic);s.setItem(old,changed);
 assert.throws(()=>w.setItem(fresh,fixture()),/旧版进度发生变化/);assert.equal(s.getItem(old),changed);assert.equal(latest.C.format(latest.S.decode(w.getItem(fresh)).term),'u v');
});
