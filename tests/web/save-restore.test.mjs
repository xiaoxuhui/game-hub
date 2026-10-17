import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeBackup} from '../../web/src/runtime/save-backup.mjs';
import {restoreRecord,acquireRecord,commitRecord} from '../../web/src/runtime/save-store.mjs';
const scope={keys:['game.save'],prefixes:['game.backup.']},context={id:'demo',storage:scope};
const backup=()=>({format:'game-hub-save',schemaVersion:1,gameId:'demo',gameVersion:'1.0.0',sourceRevision:'a'.repeat(40),createdAt:'2026-10-17T00:00:00.000Z',entries:[['game.save','{"unknown":42}']],mode:'writable',pending:false,canonicalRead:true,source:'canonical-session'});
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
test('complete backup decoding preserves original strings and accepts a committed historical readonly snapshot',()=>{
  assert.deepEqual(decodeBackup(bytes(backup()),context).entries,backup().entries);
  assert.equal(decodeBackup(bytes({...backup(),mode:'readonly'}),context).gameId,'demo');
});
test('foreign, draft, emergency and future backup formats never authorize a whole-save replacement',()=>{
  for(const patch of [{gameId:'other'},{schemaVersion:2},{canonicalRead:false},{pending:true},{source:'session-draft'},{entries:[['other.save','bad']]},{future:'unrecognized'}])assert.throws(()=>decodeBackup(bytes({...backup(),...patch}),context));
});
test('backup parser rejects duplicate escaped keys, invalid UTF8 and excessive nesting before accepting data',()=>{
  const text=JSON.stringify(backup()).replace('"schemaVersion":1','"schemaVersion":1,"schema\\u0056ersion":1');
  assert.throws(()=>decodeBackup(new TextEncoder().encode(text),context),/Duplicate/);
  assert.throws(()=>decodeBackup(Uint8Array.of(0xff),context));
  assert.throws(()=>decodeBackup(new TextEncoder().encode('['.repeat(40)+'0'+']'.repeat(40)),context),/nesting/);
});
test('restore advances fence and revision atomically, invalidating old callbacks and matching old journals',()=>{
  const original=acquireRecord(null,{gameId:'demo',writerId:'a',scope,legacy:[['game.save','old']],journals:[]}).record;
  const restored=restoreRecord(original,{gameId:'demo',expected:original,writerId:'restore-b',entries:[['game.save','restored']]},scope);
  assert.equal(restored.fence,2);assert.equal(restored.revision,1);assert.equal(restored.sequence,0);
  assert.throws(()=>commitRecord(restored,{...original,sequence:10,entries:[['game.save','late']]},scope),/conflict/);
  const next=acquireRecord(restored,{gameId:'demo',writerId:'c',scope,legacy:[],journals:[{...original,sequence:99,entries:[['game.save','stale journal']]}]}).record;
  assert.equal(next.entries[0][1],'restored');
  assert.throws(()=>restoreRecord(restored,{gameId:'demo',expected:original,writerId:'restore-c',entries:[]},scope),/conflict/);
});
