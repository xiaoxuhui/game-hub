import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dynamicSources} from '../scripts/dynamic-resources.mjs';
const root=new URL('../',import.meta.url);
test('daily resource update changes only the reviewed Lambda and adds particle life',()=>{
 // Check the reviewed historical transition, independent of later game updates.
 const sources=dynamicSources(execFileSync('git',['show','071210d34b8cde90e5fdc4b10dcf3c7578ef057b:dynamic-sources.lock.json'],{cwd:root})).sources;
 const old=JSON.parse(execFileSync('git',['show','0c8ebf50d3c7a0f2b607d4b03eacb733e572eed2:dynamic-sources.lock.json'],{cwd:root})).sources;
 assert.deepEqual(JSON.parse(JSON.stringify(sources.filter(x=>!['lambda-diagram-game','particle-life-lab'].includes(x.id)))),old.filter(x=>x.id!=='lambda-diagram-game'));
 const lambda=sources.find(x=>x.id==='lambda-diagram-game'),previous=old.find(x=>x.id===lambda.id);
 assert.equal(lambda.contentCode,previous.contentCode+1);assert.equal(lambda.version,'0.5.1');assert.equal(lambda.storageContract,previous.storageContract);
 const proof=JSON.parse(readFileSync(new URL(`../${lambda.directory}/upstream-source.json`,import.meta.url)));
 assert.equal(proof.revision,'e1368ee43bb5513db3ad6ba8046ede75e82032b5');assert.equal(proof.hallQuotaReadonly.id,'lambda-040-quota-readonly-v1');
 const particle=sources.find(x=>x.id==='particle-life-lab');assert.equal(particle.contentCode,1);assert.equal(particle.directory,'web-dist');assert.equal(particle.entryPage,'index.html');assert.deepEqual(particle.files,['LICENSE','index.html']);
});
