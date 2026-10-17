import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkEntries,owns,acquireRecord,commitRecord,createFacade} from '../../web/src/runtime/save-store.mjs';
const scope={keys:['one'],prefixes:['game.']};
const identity={gameId:'demo',writerId:'writer-a',scope};
test('save snapshots preserve exact opaque bytes, reject foreign and duplicate keys',()=>{
  const entries=[['one','{ "future": {"x":42} }'],['game.backup','corrupt old bytes']];
  assert.deepEqual(checkEntries(entries,scope),entries);assert.equal(owns(scope,'elsewhere'),false);
  for(const bad of [[['elsewhere','x']],[['one','x'],['one','y']],[['one',null]]])assert.throws(()=>checkEntries(bad,scope));
});
test('writer acquisition recovers only the matching newer whole journal and advances fence',()=>{
  const old=acquireRecord(null,{...identity,legacy:[['one','legacy']],journals:[]}).record;
  const good={...old,sequence:2,entries:[['one','recovered']]},stale={...good,writerId:'other',sequence:99,entries:[['one','wrong']]};
  const next=acquireRecord(old,{...identity,writerId:'writer-b',legacy:[],journals:[stale,good]});
  assert.deepEqual(next.record.entries,good.entries);assert.equal(next.record.fence,2);assert.equal(next.recovered,good);assert.equal(next.backups.length,1);
  const empty=acquireRecord({...old,entries:[]},{...identity,writerId:'writer-c',legacy:[['one','ancient']],journals:[]});assert.deepEqual(empty.record.entries,[]);
});
test('transaction mutation rejects stale fences and revisions, never merges snapshots',()=>{
  const old=acquireRecord(null,{...identity,legacy:[],journals:[]}).record;
  const newer=acquireRecord(old,{...identity,writerId:'writer-b',legacy:[],journals:[]}).record;
  const write={...old,sequence:1,entries:[['one','a']]};assert.throws(()=>commitRecord(newer,write,scope),/conflict/);
  const committed=commitRecord(old,write,scope);assert.equal(committed.revision,1);assert.deepEqual(committed.entries,write.entries);
  assert.throws(()=>commitRecord(committed,write,scope),/conflict/);
});
test('a newer current-writer journal with unknown schema or extensions blocks takeover',()=>{
  const previous=acquireRecord(null,{...identity,legacy:[['one','old']],journals:[]}).record;
  for(const extra of [{schema:2},{future:'opaque'}, {entries:[['foreign','bad']]}]){
    const journal={...previous,sequence:2,...extra};
    assert.throws(()=>acquireRecord(previous,{...identity,writerId:'b',legacy:[],journals:[journal]}),/preserved|scope/);
    assert.equal(previous.fence,1);assert.equal(previous.entries[0][1],'old');
  }
});
test('scoped facade clear and property access cannot touch another game; failed journaling is not success',()=>{
  let snapshot=[['one','original']],fail=false;const storage=createFacade(scope,snapshot,entries=>{if(fail)throw Error('quota');snapshot=entries;});
  storage['game.future']='unknown';assert.equal(storage.getItem('game.future'),'unknown');assert.equal(storage.length,2);
  assert.deepEqual(Object.keys(storage),['one','game.future']);assert.throws(()=>storage.setItem('foreign','bad'),/scope/);
  fail=true;assert.throws(()=>storage.setItem('one','lost'),/quota/);assert.equal(storage.one,'original');fail=false;
  storage.clear();assert.deepEqual(snapshot,[]);assert.equal(storage.getItem('one'),null);
});
