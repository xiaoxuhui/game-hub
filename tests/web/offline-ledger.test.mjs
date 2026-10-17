import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LIMITS} from '../../web/src/core/contracts.mjs';
import {emptyLedger,validateLedger,applyLedger} from '../../web/src/cache/ledger.mjs';
const basePath='/hub/',options={basePath},digest='a'.repeat(64),proofHash='b'.repeat(64);
const begin=(extra={})=>({type:'begin',id:'sample',contentCode:1,digest,proofHash,bytes:100,...extra});
const run=(state,event)=>applyLedger(state,event,options);
const complete=fence=>({type:'complete',fence,proofHash,manifestDigest:digest,complete:true});
const enter=(fence,sessionId='one')=>({type:'enter',fence,sessionId,clientId:'client-'+sessionId,controllerProtocol:1});
const proof=fence=>({fence,barrier:true,active:false,ready:false,installing:false,references:0,enumerationComplete:true,possibleClients:0,protocolCompatible:true,writesSettled:true});

test('ledger validates exact known shapes and monotonic identities without mutating inputs',()=>{
  const empty=emptyLedger(),first=run(empty,begin());assert.equal(empty.installations.length,0);assert.equal(first.state.revision,1);assert.equal(first.result.fence,1);validateLedger(first.state,basePath);
  for(const state of [{...empty,unknown:1},{...empty,schemaVersion:2},{...empty,revision:-0},{...first.state,nextFence:0},{...first.state,installations:[...first.state.installations,...first.state.installations]}])assert.throws(()=>validateLedger(state,basePath));
  assert.throws(()=>run({...empty,revision:Number.MAX_SAFE_INTEGER},begin()));assert.throws(()=>run({...empty,nextFence:Number.MAX_SAFE_INTEGER},begin()));
  for(const event of [begin({bytes:0}),begin({contentCode:-0}),begin({cacheName:'other-app'}),{...complete(1),extra:true}])assert.throws(()=>run(empty,event));
});
test('one ledger budgets every phase and rejects duplicate versions and exhausted reservations',()=>{
  const first=run(emptyLedger(),begin({bytes:LIMITS.cache-LIMITS.reserve}));assert.throws(()=>run(first.state,begin({id:'second'})));assert.throws(()=>run(first.state,begin()));
  const failed=run(first.state,{type:'cancel',fence:1});assert.equal(failed.state.installations[0].phase,'failed');assert.throws(()=>run(failed.state,begin({id:'second'})));
});
test('cancelled, stale and mismatched callbacks cannot mark a cache ready',()=>{
  const first=run(emptyLedger(),begin());assert.throws(()=>run(first.state,complete(2)));assert.throws(()=>run(first.state,{...complete(1),proofHash:'c'.repeat(64)}));assert.throws(()=>run(first.state,{...complete(1),complete:false}));
  const failed=run(first.state,{type:'cancel',fence:1});assert.throws(()=>run(failed.state,complete(1)));assert.throws(()=>run(failed.state,{type:'cancel',fence:1}));
  const second=run(failed.state,begin({contentCode:2}));assert.notEqual(second.result.cacheName,first.result.cacheName);assert.equal(second.result.fence,2);
});
test('only new complete sessions activate; prior sessions and their immutable identity remain retained',()=>{
  let state=run(emptyLedger(),begin()).state;assert.throws(()=>run(state,enter(1)));state=run(state,complete(1)).state;state=run(state,enter(1)).state;
  state=run(state,begin({contentCode:2})).state;state=run(state,complete(2)).state;state=run(state,enter(2,'two')).state;
  assert.deepEqual(state.installations.map(r=>r.phase),['retained','active']);assert.deepEqual(state.sessions.map(s=>[s.sessionId,s.contentCode,s.fence]),[['one',1,1],['two',2,2]]);
  assert.throws(()=>run(state,enter(2,'two')));assert.throws(()=>run(state,enter(1,'old-new')));assert.throws(()=>run(state,{type:'leave',sessionId:'one',fence:2}));
  state=run(state,{type:'leave',sessionId:'one',fence:1}).state;assert.equal(state.sessions.length,1);assert.equal(state.installations.length,2);
});
test('deletion requires no references, a complete same-fence barrier and actual cache absence',()=>{
  let state=run(emptyLedger(),begin()).state;state=run(state,complete(1)).state;assert.throws(()=>run(state,{type:'begin-delete',fence:1,proof:proof(1)}));
  state=run(state,enter(1)).state;state=run(state,{type:'missing',fence:1}).state;assert.throws(()=>run(state,{type:'begin-delete',fence:1,proof:proof(1)}));state=run(state,{type:'leave',sessionId:'one',fence:1}).state;
  for(const patch of [{fence:2},{barrier:false},{enumerationComplete:false},{possibleClients:1},{writesSettled:false},{protocolCompatible:false},{references:1}])assert.throws(()=>run(state,{type:'begin-delete',fence:1,proof:{...proof(1),...patch}}));
  state=run(state,{type:'begin-delete',fence:1,proof:proof(1)}).state;assert.equal(state.installations.length,1);assert.throws(()=>run(state,{type:'deleted',fence:1,cacheAbsent:false}));assert.throws(()=>run(state,enter(1)));
  state=run(state,{type:'deleted',fence:1,cacheAbsent:true}).state;assert.equal(state.installations.length,0);assert.equal(state.nextFence,1);assert.equal(run(state,begin()).result.fence,2);
});
