import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
import {dynamicSources} from '../scripts/dynamic-resources.mjs';import {sha256} from '../scripts/resource-protocol.mjs';
test('Ant admission appends exact released fragment and preserves previous eight source objects',()=>{
  // Keep the completed admission event immutable when later resources advance.
  const current=dynamicSources(execFileSync('git',['show','bd105f3658e578ce6f2f939bd9b39abd7a9fddc7:dynamic-sources.lock.json'],{cwd:new URL('../',import.meta.url)})).sources,previous=dynamicSources(execFileSync('git',['show','314360abd0e8f7eaca09e80e4840908238226ab9:dynamic-sources.lock.json'],{cwd:new URL('../',import.meta.url)})).sources;
  assert.equal(current.length,9);for(const old of previous)assert.deepEqual(current.find(g=>g.id===old.id),old);
  const raw=readFileSync(new URL('../doc/evidence/n29/source-fragment.json',import.meta.url)),manifest=readFileSync(new URL('../doc/evidence/n29/source-manifest.json',import.meta.url)),ant=current.find(g=>g.id==='langtons-ant');
  assert.equal(sha256(raw),'367fbca3890ff569b6a1007b0af5c73985838cbda9d4bbb4a2939f74e4f672fa');assert.equal(sha256(manifest),'36280ca90b5e4728d4356481f6a06ef8d69003d17292e7f0248ce693ce8d8ced');assert.equal(JSON.stringify(ant),JSON.stringify(JSON.parse(raw)));
  const proof=JSON.parse(manifest);assert.equal(ant.revision,proof.sourceRevision);assert.deepEqual(ant.files.toSorted(),proof.files.map(f=>f.path).sort());assert.equal(proof.files.length,8);assert.equal(proof.license,'MIT');assert.equal(ant.contentCode,1);assert.equal(ant.storageContract,'langtons-ant-dynamic-v1');assert.equal(ant.iconKind,'generic');assert.equal(ant.category,undefined);
});
