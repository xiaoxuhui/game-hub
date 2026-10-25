import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
test('C1 advances only logic and traffic source objects while keeping the other seven unchanged',()=>{
 const before=JSON.parse(execFileSync('git',['show','cd413ba63eadc0d61502272ffd0425db197f8279:dynamic-sources.lock.json'],{cwd:new URL('../',import.meta.url)})).sources,current=JSON.parse(readFileSync(new URL('../dynamic-sources.lock.json',import.meta.url))).sources;
 assert.equal(current.length,before.length);assert.deepEqual(current.map(g=>g.id),before.map(g=>g.id));
 const changed=current.filter(g=>JSON.stringify(g)!==JSON.stringify(before.find(o=>o.id===g.id))).map(g=>g.id);assert.deepEqual(changed,['logic-circuit','traffic-planner']);
 const logic=current.find(g=>g.id==='logic-circuit'),traffic=current.find(g=>g.id==='traffic-planner');assert.equal(logic.revision,'690f4b606aa280560e8540fc513755527e07387e');assert.equal(logic.contentCode,28);assert.equal(traffic.revision,'86f8fb77de41c9ddef37fbd998c44d01c0623727');assert.equal(traffic.contentCode,2);assert.ok(traffic.files.includes('src/reversing.js'));for(const game of [logic,traffic])assert.equal(game.storageContract,game.id+'-dynamic-v1');
});
