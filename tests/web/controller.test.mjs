import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateController,nextController,controllerToken} from '../../web/src/core/controller.mjs';
const input={build:'a'.repeat(40),epoch:'00000000-0000-4000-8000-000000000001',protocol:1};
test('controller generations are strict monotonic and same epoch activation is idempotent',()=>{
  const a=nextController(null,input);assert.equal(a.generation,1);assert.deepEqual(nextController(a,input),a);
  const b=nextController(a,{...input,epoch:'00000000-0000-4000-8000-000000000002'});assert.equal(b.generation,2);assert.notEqual(controllerToken(a,true),controllerToken(b,true));assert.equal(controllerToken(undefined,false),'absent');
  assert.throws(()=>nextController({...a,generation:Number.MAX_SAFE_INTEGER},{...input,epoch:b.epoch}));
});
test('unknown undefined malformed controller identity is preserved by refusing it',()=>{
  const a=nextController(null,input);
  for(const bad of [undefined,null,{...a,schemaVersion:2},{...a,protocol:2},{...a,generation:-0},{...a,epoch:'true'},{...a,build:'main'},{...a,extra:1}]){assert.throws(()=>validateController(bad));assert.throws(()=>controllerToken(bad,true));}
  assert.throws(()=>nextController(a,{...input,extra:1}));
});
