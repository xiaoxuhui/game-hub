import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dynamicSources,packDynamic} from '../scripts/dynamic-resources.mjs';
test('hex admission keeps all seven published source descriptors and exact complete licensed closure',()=>{
  const current=dynamicSources(readFileSync(new URL('../dynamic-sources.lock.json',import.meta.url))).sources,previous=dynamicSources(execFileSync('git',['show','11f1dbe51f9fd764d91fffac878c602bfc61a0ee:dynamic-sources.lock.json'],{cwd:new URL('../',import.meta.url)})).sources;
  for(const old of previous)assert.deepEqual(current.find(g=>g.id===old.id),old);
  const game=current.find(g=>g.id==='hex-cell-lab');assert.equal(current.length,previous.length+1);assert.equal(game.contentCode,1);assert.equal(game.version,'1.4.0');assert.equal(game.storageContract,'hex-cell-lab-dynamic-v1');
  const entries=game.files.map(path=>({path,data:readFileSync(new URL('../examples/hex-cell-lab/'+path,import.meta.url))})),one=packDynamic(game,entries),two=packDynamic(game,[...entries].reverse());assert.deepEqual(one.archive,two.archive);assert.equal(one.game.resourceProtocol,2);assert.equal(one.game.bridgeProtocol,1);assert.equal(one.game.minHostVersionCode,4);
  assert.deepEqual(one.game.files.map(f=>f.path).sort(),game.files.slice().sort());
});
