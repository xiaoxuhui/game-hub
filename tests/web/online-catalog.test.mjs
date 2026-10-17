import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateOnlineCatalog,validateHistory,snapshot,changes} from '../../web/src/core/online-catalog.mjs';
import {boundedText} from '../../web/src/core/http.mjs';
const game=()=>({id:'sample',displayName:'游戏',version:'1.0.0',contentCode:1,digest:'a'.repeat(64),entryUrl:`/hub/games/sample/1/${'a'.repeat(64)}/index.html`,entryPage:'index.html',sourceRepository:'https://github.com/xiaoxuhui/sample.git',sourceRevision:'b'.repeat(40),storage:{keys:['sample.save'],prefixes:[]},files:[{path:'index.html',bytes:10,sha256:'c'.repeat(64),mime:'text/html'},{path:'LICENSE',bytes:20,sha256:'d'.repeat(64),mime:'text/plain'}],mode:'online',category:'模拟',iconKind:'generic'});
const catalog=()=>({schemaVersion:1,platform:'web',trust:'https-online',shellVersion:'0.1.0',basePath:'/hub/',sourceCommit:'e'.repeat(40),games:[game()]});
test('online directory only grants exact same-base immutable entries, never signed/offline trust',()=>{
  assert.equal(validateOnlineCatalog(catalog(),'/hub/').games.length,1);
  for(const mutate of [c=>c.trust='signed',c=>c.basePath='/',c=>c.games[0].entryUrl='https://evil.invalid/',c=>c.games[0].files[0].path='../x',c=>c.games.push(game()),c=>c.games[0].files[0].mime='text/css']){const c=catalog();mutate(c);assert.throws(()=>validateOnlineCatalog(c,'/hub/'));}
});
test('updates distinguish same feature version content changes, new games and newer shell',()=>{
  const before=snapshot(catalog()),next=catalog();next.games[0].contentCode=2;next.games[0].digest='f'.repeat(64);next.shellVersion='0.2.0';next.games.push({...game(),id:'second'});
  assert.deepEqual(changes(before,next),{added:['second'],updated:['sample'],shell:true});
  assert.deepEqual(changes(null,catalog()),{added:[],updated:[],shell:false});
});
test('failed identities and downgrades cannot become a latest result or replace existing entries',()=>{
  const before=snapshot(catalog());
  for(const mutate of [c=>c.games[0].contentCode=0,c=>c.games[0].digest='f'.repeat(64),c=>c.games[0].sourceRevision='f'.repeat(40),c=>c.games=[],c=>c.shellVersion='0.0.9']){const c=catalog();mutate(c);assert.throws(()=>changes(before,c));}
  assert.throws(()=>validateHistory({games:[{}],shellVersion:'0.1.0'}));
  const duplicate=snapshot(catalog());duplicate.games.push(duplicate.games[0]);assert.throws(()=>validateHistory(duplicate));
});
test('bounded response rejects wrong MIME, oversized declared/stream bytes and invalid UTF8',async()=>{
  assert.equal(await boundedText(new Response('{}',{headers:{'Content-Type':'application/json; charset=utf-8'}}),8,'application/json'),'{}');
  await assert.rejects(()=>boundedText(new Response('{}',{headers:{'Content-Type':'text/html'}}),8,'application/json'),/格式/);
  await assert.rejects(()=>boundedText(new Response('{}',{headers:{'Content-Type':'application/json','Content-Length':'100'}}),8,'application/json'),/限制/);
  let cancelled=false;const stream=new ReadableStream({pull(c){c.enqueue(new Uint8Array(9));},cancel(){cancelled=true;}});
  await assert.rejects(()=>boundedText(new Response(stream,{headers:{'Content-Type':'application/json'}}),8,'application/json'),/限制/);assert.equal(cancelled,true);
  await assert.rejects(()=>boundedText(new Response(new Uint8Array([255]),{headers:{'Content-Type':'application/json'}}),8,'application/json'));
});
