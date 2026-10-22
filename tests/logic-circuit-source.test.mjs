import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dynamicSources} from '../scripts/dynamic-resources.mjs';
test('logic workshop source is an immutable licensed dynamic resource',()=>{const lock=dynamicSources(readFileSync(new URL('../dynamic-sources.lock.json',import.meta.url))),g=lock.sources.find(s=>s.id==='logic-circuit');assert.ok(g);assert.equal(g.repository,'https://github.com/xiaoxuhui/logic-circuit.git');assert.match(g.revision,/^[a-f0-9]{40}$/);assert.equal(g.directory,'dist');assert.equal(g.version,'0.3.13');assert.equal(g.contentCode,23);assert.equal(g.storageContract,'logic-circuit-dynamic-v1');assert.equal(g.iconKind,'logic');assert.equal(g.files.length,12);assert.ok(g.files.includes('LICENSE'));assert.ok(g.files.includes(g.entryPage));});
