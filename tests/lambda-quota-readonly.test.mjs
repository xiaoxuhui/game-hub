import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { createHash } from 'node:crypto';
import { quotaReadonly } from '../scripts/lambda-quota-readonly.mjs';

class Element {
  constructor(tag) { this.tagName=tag; this.children=[]; this.listeners={}; this.open=false; this.dataset={}; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children=nodes; }
  setAttribute() {}
  addEventListener(name,fn) { this.listeners[name]=fn; }
  showModal() { this.open=true; }
  close() { this.open=false; }
  querySelector(selector) { this.nodes??=new Map(); if(!this.nodes.has(selector)) this.nodes.set(selector,new Element(selector)); return this.nodes.get(selector); }
}

test('staged resource reproduces the pinned input and records source hashes', () => {
  const read=p=>readFileSync(new URL('../'+p,import.meta.url));
  const hash=b=>createHash('sha256').update(b).digest('hex');
  const base='examples/lambda-039-recovery-20261121/', target='examples/lambda-quota-readonly-20261121/';
  const input=read(base+'lambda-lab.html'), output=read(target+'lambda-lab.html');
  const proof=JSON.parse(read(target+'upstream-source.json')).hallQuotaReadonly;
  assert.deepEqual(Buffer.from(quotaReadonly(input.toString('utf8'))),output);
  assert.equal(proof.inputSha256,hash(input)); assert.equal(proof.outputSha256,hash(output));
  assert.equal(proof.adapterSha256,hash(read('scripts/lambda-quota-readonly.mjs')));
  assert.deepEqual(read(base+'LICENSE'),read(target+'LICENSE'));
});

test('quota at startup exports all data and only permits reads, including pending journals', () => {
  const source=readFileSync(new URL('../examples/lambda-039-recovery-20261121/lambda-lab.html',import.meta.url),'utf8');
  const html=quotaReadonly(source), start=html.indexOf('  const localStorage=(function(root){'), end=html.indexOf("  const AUTO='lambda-lab-hub-v4'",start);
  assert.ok(start>0&&end>start);
  const map=new Map([['lambda-lab-hub-v4','{"session":{"steps":300}}'],['lambda-lab-hub-journal-v4','untouched journal'],['lambda-hub-session-archive-v1.123-abcdef012345abcdef012345','untouched backup']]);
  const initial=Object.fromEntries(map), downloads=[];
  const storage={get length(){return map.size},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,setItem(){throw new DOMException('quota exceeded','QuotaExceededError')},removeItem(){throw Error('unexpected delete')}};
  const document={head:new Element('head'),body:new Element('body'),createElement:tag=>new Element(tag)};
  const root={localStorage:storage,document,addEventListener(){},LambdaDownload:{save:(...a)=>downloads.push(a)},location:{reload(){}}};
  const context={root,document,crypto:webcrypto,TextEncoder,TextDecoder,DOMException,S:{},console};
  new Script(html.slice(start,end)+'\nglobalThis.adapter=localStorage;').runInNewContext(context);
  const dialog=document.body.children.find(n=>n.tagName==='dialog');
  assert.equal(dialog.open,true);
  assert.equal(dialog.querySelector('#lambda-c5-title').textContent,'本机存储空间不足');
  const buttons=dialog.querySelector('#lambda-c5-options').children;
  buttons.find(b=>b.textContent==='导出所有本机存档').listeners.click();
  assert.deepEqual(JSON.parse(downloads[0][1]).storage,initial);
  buttons.find(b=>b.textContent==='只读打开').listeners.click();
  assert.equal(dialog.open,false);
  assert.equal(context.adapter.getItem('lambda-lab-hub-v4'),initial['lambda-lab-hub-v4']);
  assert.throws(()=>context.adapter.setItem('lambda-lab-hub-v4','changed'),/只读模式/);
  assert.throws(()=>context.adapter.removeItem('lambda-lab-hub-v4'),/只读模式/);
  assert.deepEqual(Object.fromEntries(map),initial);
});
