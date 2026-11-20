import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createLambdaC5Storage,inspectLambdaC5Storage} from '../scripts/lambda-storage-c5.mjs';

function engines(){
 const context={TextEncoder,TextDecoder,setTimeout,clearTimeout,performance,AbortController};
 context.window=context;
 const html=readFileSync(new URL('./fixtures/lambda-upstream-0.3.7.html',import.meta.url),'utf8');
 const scripts=[...html.matchAll(/<script>\s*([\s\S]*?)<\/script>/g)].map(match=>match[1]);
 for(const script of scripts.slice(0,-1))runInNewContext(script,context);
 const old={TextEncoder,TextDecoder};for(const script of JSON.parse(readFileSync(new URL('./fixtures/lambda-content3-reader.json',import.meta.url),'utf8')).scripts)runInNewContext(script,old);
 return {C:context.LambdaCore,S:context.LambdaSnapshot,OldS:old.LambdaSnapshot};
}
test('full v5 unfolding history remains byte exact while old mirrors retain the current expanded value',()=>{
 const {C,S,OldS}=engines(),map=new Map(),storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
 const original=C.parse('(λx.x) fn'),defs=[{name:'fn',term:C.parse('λx.x')}];
 const text=S.encode({version:2,draft:'(λx.x) fn',functions:[{name:'fn',term:C.parse('λx.changed')}],completed:[],mode:'free',level:0,
  session:{original,steps:1,dirty:false,halt:'',functionDefinitions:defs,choices:[[0,[]]]},view:{unfoldFunctions:true,numberEncoding:'church',speed:600,scale:1,autoFit:true,historyOpen:false,helpOpen:false,hintOpen:false},selection:{start:0,end:0},error:''});
 const adapter=createLambdaC5Storage(storage,S,OldS,{eventTarget:null});adapter.setItem('lambda-lab-hub-v4',text);adapter.setItem('lambda-lab-hub-checkpoint-v4',text);
 assert.equal(map.get('lambda-lab-hub-v4'),text);assert.equal(map.get('lambda-lab-hub-checkpoint-v4'),text);
 const full=S.decode(adapter.getItem('lambda-lab-hub-v4'));assert.equal(full.version,5);assert.equal(full.session.steps,1);assert.equal(full.term.name,'fn');assert.equal(full.view.unfoldFunctions,true);
 for(const key of ['lambda-lab-hub-v3','lambda-lab-v2','lambda-lab-hub-checkpoint-v3','lambda-lab-checkpoint-v2']){const legacy=OldS.decode(map.get(key));assert.ok(C.equal(legacy.term,C.parse('λx.x')),key);}
 assert.equal(inspectLambdaC5Storage(storage,S,OldS).current.status,'healthy');
 const reloaded=createLambdaC5Storage(storage,S,OldS,{eventTarget:null});assert.equal(reloaded.getItem('lambda-lab-hub-v4'),text);
});
