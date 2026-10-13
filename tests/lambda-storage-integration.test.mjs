import {test} from 'node:test';
import assert from 'node:assert/strict';
import {migrateLambdaStorage,integrateLambdaHtml,integrationProof} from '../scripts/lambda-storage-integration.mjs';
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
