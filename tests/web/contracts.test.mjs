import test from 'node:test';
import assert from 'node:assert/strict';
import { safePath, normalizeBase, resourcePath, validateSourceLock, ownsKey } from '../../web/src/core/contracts.mjs';

const source = () => ({ id:'sample-game', displayName:'示范', version:'1.0.0', webContentCode:1,
  repository:'https://github.com/xiaoxuhui/sample.git', revision:'a'.repeat(40), entryPage:'index.html',
  storage:{keys:['sample.save'],prefixes:['sample.backup.']},
  files:[{path:'index.html',bytes:100,sha256:'b'.repeat(64),mime:'text/html'},{path:'LICENSE',bytes:20,sha256:'c'.repeat(64),mime:'text/plain'}] });
const lock = () => ({schemaVersion:1,platform:'web',sources:[source()]});

test('resource paths reject escapes, encodings, aliases and native executables',()=>{
  assert.equal(safePath('assets/app.min.js'),'assets/app.min.js');
  for(const path of ['../x','/x','a//b','a/./b','a\\b','%2e%2e/x','a?x','a#x','a:b','a\0b','run.apk','a.jar']) assert.throws(()=>safePath(path),undefined,path);
});
test('base path is a canonical directory and resource identities never depend on location origin',()=>{
  assert.equal(normalizeBase('/'),'/');assert.equal(normalizeBase('/hub/'),'/hub/');
  for(const path of ['hub/','/hub','//hub/','/../','/a%20b/','https://example.com/'])assert.throws(()=>normalizeBase(path));
  assert.equal(resourcePath('/hub/','sample-game',2,'a'.repeat(64),'campaign.html'),`/hub/games/sample-game/2/${'a'.repeat(64)}/campaign.html`);
  assert.throws(()=>resourcePath('/hub/','../x',2,'a'.repeat(64),'index.html'));
});
test('source lock binds full immutable SHA, a complete safe file list and a license',()=>{
  assert.equal(validateSourceLock(lock()).sources.length,1);
  for(const mutate of [l=>l.sources[0].revision='main',l=>l.sources[0].repository='file:///D:/soft/game',l=>l.sources[0].files.pop(),l=>l.sources[0].entryPage='missing.html',l=>l.platform='android',l=>l.schemaVersion=2]){
    const item=lock();mutate(item);assert.throws(()=>validateSourceLock(item));
  }
});
test('file and identity collisions cannot hide across casing, directories or games',()=>{
  for(const name of ['INDEX.HTML','index.html/x']){const item=lock();item.sources[0].files.push({...item.sources[0].files[0],path:name});assert.throws(()=>validateSourceLock(item));}
  const duplicate=lock();duplicate.sources.push(source());assert.throws(()=>validateSourceLock(duplicate));
  const tooBig=lock();tooBig.sources[0].files[0].bytes=21*1024*1024;assert.throws(()=>validateSourceLock(tooBig));
});
test('storage ownership uses declared exact keys or prefixes, never a substring match',()=>{
  const storage=source().storage;
  assert.ok(ownsKey(storage,'sample.save'));assert.ok(ownsKey(storage,'sample.backup.123'));
  for(const key of ['other.sample.save','sample.save2','sample.backup','__hub.settings',''])assert.equal(ownsKey(storage,key),false);
  const collision=lock();collision.sources.push({...source(),id:'second-game'});assert.throws(()=>validateSourceLock(collision));
});
