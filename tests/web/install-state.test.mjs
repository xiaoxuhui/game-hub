import {test} from 'node:test';
import assert from 'node:assert/strict';
import {controlledEligibility,reserveBytes,transitionInstallation,mayCollect} from '../../web/src/core/install-state.mjs';
const control={baseURL:'https://hub.example/hub/',controllerURL:'https://hub.example/hub/sw.js',scopeURL:'https://hub.example/hub/',handshake:1,crypto:true,idb:true,cache:true,registrations:[{scope:'https://hub.example/hub/',scriptURL:'https://hub.example/hub/sw.js'}]};
test('registration ready alone, wrong script/scope, foreign game SW and absent capabilities cannot grant control',()=>{
  assert.equal(controlledEligibility(control),true);
  assert.equal(controlledEligibility({...control,registrations:[...control.registrations,{scope:'https://hub.example/other/',scriptURL:'https://hub.example/other/sw.js'}]}),true);
  for(const patch of [{controllerURL:null},{controllerURL:'https://hub.example/sw.js'},{scopeURL:'https://hub.example/'},{handshake:0},{crypto:false},{idb:false},{cache:false},{registrations:[{scope:'https://hub.example/hub/games/x/',scriptURL:'https://hub.example/hub/games/x/sw.js'}]}])assert.equal(controlledEligibility({...control,...patch}),false);
});
test('byte reservations account for current generations, concurrent staging and safety margin',()=>{
  assert.equal(reserveBytes({committed:0,reserved:0,requested:1024}),1024);
  assert.equal(reserveBytes({committed:60,reserved:10,requested:10,budget:100,margin:20}),20);
  for(const patch of [{requested:11},{reserved:30},{committed:101},{requested:0},{requested:NaN},{budget:Number.MAX_SAFE_INTEGER+1}])assert.throws(()=>reserveBytes({committed:60,reserved:10,requested:10,budget:100,margin:20,...patch}));
});
const stage={phase:'staging',fence:7,manifestDigest:'a'.repeat(64)};
test('only complete exact-manifest current-fence work can become ready and a new session active',()=>{
  const verified={type:'verified',fence:7,complete:true,manifestDigest:stage.manifestDigest};
  const ready=transitionInstallation(stage,verified);assert.equal(ready.phase,'ready');assert.equal(stage.phase,'staging');
  for(const patch of [{fence:6},{complete:false},{manifestDigest:'b'.repeat(64)}])assert.throws(()=>transitionInstallation(stage,{...verified,...patch}));
  assert.throws(()=>transitionInstallation(ready,{type:'activate',fence:7,newSession:false}));
  assert.equal(transitionInstallation(ready,{type:'activate',fence:7,newSession:true}).phase,'active');
});
test('cancelled or superseded callbacks cannot commit and missing committed files require repair',()=>{
  const failed=transitionInstallation(stage,{type:'cancel',fence:7});assert.equal(failed.phase,'failed');
  assert.throws(()=>transitionInstallation(failed,{type:'verified',fence:7,complete:true,manifestDigest:stage.manifestDigest}));
  assert.throws(()=>transitionInstallation({...stage,fence:8},{type:'cancel',fence:7}));
  assert.equal(transitionInstallation({...stage,phase:'active'},{type:'missing',fence:7}).phase,'repair');
});
const proof={barrier:true,active:false,ready:false,installing:false,references:0,enumerationComplete:true,possibleClients:0,protocolCompatible:true};
test('unknown enumeration, frozen possible clients, old SW, or a reference prevents collection',()=>{
  assert.equal(mayCollect(proof),true);
  for(const patch of [{barrier:false},{active:true},{ready:true},{installing:true},{references:1},{references:undefined},{enumerationComplete:false},{possibleClients:1},{protocolCompatible:false}])assert.equal(mayCollect({...proof,...patch}),false);
  assert.equal(mayCollect(null),false);
});
test('deletion uses a barrier and current fence; a crash cannot mark partial removal absent',()=>{
  const retained={...stage,phase:'retained'},deleting=transitionInstallation(retained,{type:'begin-delete',fence:7,proof});
  assert.equal(deleting.phase,'deleting');
  assert.throws(()=>transitionInstallation({...stage,phase:'active'},{type:'begin-delete',fence:7,proof}));
  assert.throws(()=>transitionInstallation(deleting,{type:'deleted',fence:6,cacheAbsent:true}));
  assert.throws(()=>transitionInstallation(deleting,{type:'deleted',fence:7,cacheAbsent:false}));
  assert.equal(transitionInstallation(deleting,{type:'deleted',fence:7,cacheAbsent:true}).phase,'absent');
});
