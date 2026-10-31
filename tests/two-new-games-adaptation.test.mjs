import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {packDynamic} from '../scripts/dynamic-resources.mjs';
const root=new URL('../',import.meta.url);
test('both adapted games retain license, exact source proof and safe deterministic archives',()=>{
  for(const [id,upstream] of [['lights-out-matrix','8640861e87e45d352c963f4b68145e607a15951b'],['learning-machine','45e863784b89c168bef39f9c4c8b9c2645270f0f']]){
    const base=new URL(`../examples/${id}/`,import.meta.url),proof=JSON.parse(readFileSync(new URL('upstream-source.json',base)));assert.equal(proof.revision,upstream);
    const files=['LICENSE','index.html','upstream-source.json',...(id==='learning-machine'?['src/app.js','src/icon.svg','src/model.js','src/styles.css','src/visuals.js']:[])];
    const entries=files.map(path=>({path,data:readFileSync(new URL(path,base))}));assert.match(entries[0].data.toString(),/^MIT License/);
    for(const input of proof.inputs){const rel=input.path.replace(/^dist\//,'');const original=execFileSync('git',['show',`d38d6c632aaf0bb0c736bf404d8ce773e3f3e6b8:examples/${id}/${rel}`],{cwd:root});assert.equal(createHash('sha256').update(original).digest('hex'),input.sha256);if(id!=='learning-machine'||rel!=='index.html')assert.deepEqual(readFileSync(new URL(rel,base)),original);}
    const source={id,displayName:id,iconKind:'logic',available:true,repository:'https://github.com/xiaoxuhui/game-hub.git',revision:'d38d6c632aaf0bb0c736bf404d8ce773e3f3e6b8',directory:`examples/${id}`,version:'1.0.0',contentCode:1,entryPage:'index.html',storageContract:`${id}-dynamic-v1`,files,releaseNotes:'首次接入'};
    assert.deepEqual(packDynamic(source,entries),packDynamic(source,[...entries].reverse()));
  }
});
test('learning warning is the only HTML change and describes exit, close and refresh',()=>{
  const base=execFileSync('git',['show','d38d6c632aaf0bb0c736bf404d8ce773e3f3e6b8:examples/learning-machine/index.html'],{cwd:root,encoding:'utf8'});
  const warning='    <p role="note" style="margin: 0 0 12px; padding: 10px 14px; border: 1px solid #9a6938; border-radius: 8px; background: #fff4de; color: #513514;">学习数据仅保存在当前页面：返回大厅、关闭或刷新后会丢失。</p>\n\n';
  const actual=readFileSync(new URL('../examples/learning-machine/index.html',import.meta.url),'utf8');assert.equal(actual,base.replace('    <main>',warning+'    <main>'));
  const proof=JSON.parse(readFileSync(new URL('../examples/learning-machine/upstream-source.json',import.meta.url)));assert.equal(proof.adaptations[0].sha256,createHash('sha256').update(actual).digest('hex'));
});
