import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dynamicSources} from '../scripts/dynamic-resources.mjs';
test('workspace layout release only changes the intended Lambda resource',()=>{
 const root=new URL('../',import.meta.url);
 const current=JSON.parse(JSON.stringify(dynamicSources(execFileSync('git',['show','e68fd849a06ce98cc61fb3f97b03fa217050add7:dynamic-sources.lock.json'],{cwd:root})).sources));
 const old=JSON.parse(execFileSync('git',['show','418a68fde1e327a4080a682c2a121808e34fcba8:dynamic-sources.lock.json'],{cwd:root})).sources;
 assert.deepEqual(current.filter(s=>s.id!=='lambda-diagram-game'),old.filter(s=>s.id!=='lambda-diagram-game'));
 const now=current.find(s=>s.id==='lambda-diagram-game'),before=old.find(s=>s.id===now.id);
 assert.equal(now.contentCode,before.contentCode+1);assert.equal(now.storageContract,before.storageContract);
 const proof=JSON.parse(readFileSync(new URL(`../${now.directory}/upstream-source.json`,import.meta.url)));
 assert.equal(proof.revision,'a1d17092f14530f032788498f6e5f9915eceecef');assert.equal(proof.hallQuotaReadonly.id,'lambda-040-quota-readonly-v1');
});
