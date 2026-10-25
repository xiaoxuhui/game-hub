import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dynamicSources} from '../scripts/dynamic-resources.mjs';

test('traffic planner uses an immutable licensed eight-file offline source',()=>{
 const lock=dynamicSources(readFileSync(new URL('../dynamic-sources.lock.json',import.meta.url))),g=lock.sources.find(s=>s.id==='traffic-planner');
 assert.ok(g);assert.equal(g.repository,'https://github.com/xiaoxuhui/traffic-planner.git');assert.match(g.revision,/^[a-f0-9]{40}$/);
 assert.equal(g.directory,'dist');assert.equal(g.version,'0.1.0');assert.equal(g.contentCode,2);assert.equal(g.storageContract,'traffic-planner-dynamic-v1');assert.equal(g.iconKind,'generic');
 assert.deepEqual([...g.files].sort(),['LICENSE','index.html','styles.css','src/core.js','src/examples.js','src/simulation.js','src/reversing.js','src/app.js'].sort());assert.equal(g.entryPage,'index.html');assert.equal(g.available,true);
});
