import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertRegistrations,validateControlReply} from '../../web/src/control/identity.mjs';
const context={basePath:'/hub/',build:'a'.repeat(40),protocol:1},origin='https://games.example.invalid',scope=origin+'/hub/',scriptURL=scope+'sw.js',nonce='a'.repeat(32);
const active={scriptURL,state:'activated'},registration={scope,active,installing:null,waiting:null};
test('controller registration rejects overlapping or unexpected script scopes without deleting anything',()=>{
  assert.equal(assertRegistrations([registration,{scope:origin+'/other/',active:{scriptURL:origin+'/other/sw.js'}}],{origin,...context}),registration);
  for(const bad of [[],[{...registration,scope:origin+'/'}],[registration,{...registration,scope:scope+'games/'}],[{...registration,active:{scriptURL:scriptURL+'?v=1'}}],[{...registration,waiting:{scriptURL:scope+'foreign.js'}}]])assert.throws(()=>assertRegistrations(bad,{origin,...context}));
});
test('handshake reply binds exact fields nonce protocol build and deployment identity',()=>{
  const reply={type:'hub-control-result',protocol:1,build:context.build,basePath:context.basePath,scope,scriptURL,nonce,controlled:true};
  assert.equal(validateControlReply(reply,{context,origin,nonce}),true);
  for(const replacement of [{nonce:'b'.repeat(32)},{protocol:2},{build:'b'.repeat(40)},{basePath:'/'},{scope:origin+'/'},{scriptURL:scope+'other.js'},{controlled:false},{extra:true}])assert.throws(()=>validateControlReply({...reply,...replacement},{context,origin,nonce}));
});
