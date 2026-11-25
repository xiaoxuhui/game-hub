import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const ids=['hex-cell-lab','langtons-ant','turbowarp-neural-network','turbowarp-logic-lab','lights-out-matrix','learning-machine','compass-polygon-studio','fourier-drawing-studio','ai-racing-lab','turbowarp-life-lab','turbowarp-turing-lab','snake-speed','turbowarp-graph-lab','fixed-point-workshop','sokoban-ai-lab','tape-language-lab','pixel-frame','territory-conquest','cube-step-solver'];
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root));
const old=JSON.parse(execFileSync('git',['show','d496201:dynamic-sources.lock.json'],{cwd:root}));
const current=JSON.parse(read('dynamic-sources.lock.json'));
test('19 icons are valid, distinct PNGs with exact icon-only source lock increments',()=>{
  assert.equal(new Set(ids).size,19);const hashes=new Set();
  assert.ok(current.sources.length>=old.sources.length);
  for(const game of current.sources.filter(g=>g.id!=='lambda-diagram-game' && old.sources.some(o=>o.id===g.id))){
    const previous=old.sources.find(g=>g.id===game.id);assert.ok(previous);
    if(!ids.includes(game.id)){assert.deepEqual(game,previous);continue;}
    const expected=structuredClone(previous);expected.contentCode++;expected.releaseNotes+='；大厅图标更新为游戏主题图案。';assert.deepEqual(game,expected);
    const icon=read(game.hubIcon);assert.equal(icon.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(icon.readUInt32BE(16),256);assert.equal(icon.readUInt32BE(20),256);assert.ok(icon.length<512*1024);
    const digest=createHash('sha256').update(icon).digest('hex');assert.ok(!hashes.has(digest));hashes.add(digest);
    const oldIcon=execFileSync('git',['show',`d496201:${game.hubIcon}`],{cwd:root});assert.notDeepEqual(icon,oldIcon);
  }
  for(const game of old.sources) assert.equal(current.sources.filter(g=>g.id===game.id).length,1);
  assert.equal(hashes.size,19);
});
