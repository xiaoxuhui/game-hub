import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../scripts/lambda-long-history-30s.inc.js',import.meta.url),'utf8');
const select=new Function('backing','unavailable','root',source+'\nreturn choice;');
function memory(seed={}) {const m=new Map(Object.entries(seed));return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),dump:()=>Object.fromEntries(m)}}
const run=storage=>select(storage,storage,{addEventListener(){}});
const key='lambda-lab-hub-v4',pending='lambda-hub-long-start-pending-v1';
const state=n=>JSON.stringify({session:{steps:n}});

test('257 steps are attempted and interrupted startup retains the original',()=>{
 const s=memory({[key]:state(257)}),first=run(s);assert.equal(first.safe,false);assert.ok(s.getItem(pending));
 const next=run(s);assert.equal(next.safe,true);assert.equal(next.timedOut,true);assert.equal(next.previous.getItem(key),state(257));assert.equal(s.getItem(key),state(257));
});
test('2^32 steps may be attempted; larger histories remain protected',()=>{
 const max=memory({[key]:state(4294967296)});assert.equal(run(max).safe,false);
 const over=memory({[key]:state(4294967297)});assert.equal(run(over).timedOut,true);assert.equal(over.getItem(key),state(4294967297));
});
test('existing isolated workspace stays selected when an old long original exists',()=>{
 const prefix='lambda-hub-safe-workspace-v1.0.',s=memory({[key]:state(300),[prefix+key]:state(2)});
 const c=run(s);assert.equal(c.prefix,prefix);assert.equal(c.storage.getItem(key),state(2));assert.equal(s.getItem(key),state(300));
});
