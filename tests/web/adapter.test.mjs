import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adaptPage,gameCsp} from '../../scripts/web/adapt.mjs';
test('adapter keeps script execution order and exact inline bytes without executable inline HTML',()=>{
  const body='\nwindow.answer=42;\n',text=`<html><body><script src="./a.js?v=1" defer></script><script>${body}</script><script type="module" src="./b.js"></script></body></html>`;
  const result=adaptPage({path:'index.html',text,paths:new Set(['a.js','b.js'])});
  assert.deepEqual(result.scripts.map(s=>s.type),['classic','classic','module']);
  assert.equal(result.generated[0].data.toString(),body);assert.equal(result.scripts[0].path,'a.js');
  assert.equal((result.html.toString().match(/<script\b/g)||[]).length,1);
  assert.match(result.html.toString(),/hub-runtime\/bootstrap.mjs/);assert.doesNotMatch(gameCsp,/script-src[^;]*unsafe/);
});
test('adapter refuses external scripts, missing dependencies, executable attributes and unknown ordering',()=>{
  for(const script of ['<script src="https://evil.invalid/a.js"></script>','<script src="missing.js"></script>','<script src="a.js" async></script>','<script type="unknown">x()</script>','<button onclick="x()">x</button>','<base href="https://evil.invalid/">'])assert.throws(()=>adaptPage({path:'index.html',text:`<body>${script}</body>`,paths:new Set(['a.js'])}));
});
