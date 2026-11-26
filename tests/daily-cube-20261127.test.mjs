import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
test('cube update preserves all other resource identities',()=>{
 const root=new URL('../',import.meta.url),old=JSON.parse(execFileSync('git',['show','e68fd849a06ce98cc61fb3f97b03fa217050add7:dynamic-sources.lock.json'],{cwd:root})).sources,current=JSON.parse(readFileSync(new URL('../dynamic-sources.lock.json',import.meta.url))).sources;
 assert.deepEqual(current.filter(s=>s.id!=='cube-step-solver'),old.filter(s=>s.id!=='cube-step-solver'));
 const now=current.find(s=>s.id==='cube-step-solver'),before=old.find(s=>s.id===now.id);
 assert.equal(now.contentCode,before.contentCode+1);assert.equal(now.storageContract,before.storageContract);assert.equal(now.revision,'c5cec98ef729c95c6353164c5b2fbc9f859540e4');assert.ok(now.files.includes('backup.js'));
});
