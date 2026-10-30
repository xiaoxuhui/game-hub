import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {adaptDynamicResource} from '../scripts/dynamic-resource-adapters.mjs';
import {packDynamic,verifyPackedDynamic,dynamicSources} from '../scripts/dynamic-resources.mjs';

const entry=(path,text)=>({path,data:Buffer.from(text)});
const langtonSource={id:'langtons-ant',resourceIntegration:'langtons-ant-file-io-v1',files:['index.html','src/app.js']};
const langton=[
 entry('index.html','<button id="reset" type="button">重置</button><script src="src/app.js"></script>'),
 entry('src/app.js','  sync();resize();requestAnimationFrame(animate);')
];
const turboSource={id:'turbowarp-neural-network',resourceIntegration:'turbowarp-file-io-v1',files:['LICENSE','index.html']};
const turbo=[entry('LICENSE','MIT License\\n'),entry('index.html','banner.append(status,restart);\n  window.addEventListener(\'pagehide\',save);')];

test('Langton adapter adds explicit bounded JSON import/export without changing source file set',()=>{
 const copy=langton.map(x=>({path:x.path,data:Buffer.from(x.data)}));
 const out=adaptDynamicResource(langtonSource,langton);
 assert.deepEqual(out.map(x=>x.path).sort(),[...langtonSource.files].sort());
 assert.deepEqual(langton.map(x=>x.data),copy.map(x=>x.data));
 const html=out.find(x=>x.path==='index.html').data.toString();
 const app=out.find(x=>x.path==='src/app.js').data.toString();
 for(const text of ['导出存档','导入存档','file.size>4*1024*1024','blob.size>4*1024*1024','AntStorage.decode','langtons-ant-import','confirm('])assert.ok(html.includes(text),text);
 assert.match(app,/window\.langtonsAntExport/);assert.match(app,/pause\(\);state=candidate\.state/);
});

test('TurboWarp adapter validates and backs up before apply, with bounded file size and rollback',()=>{
 const out=adaptDynamicResource(turboSource,turbo),html=out.find(x=>x.path==='index.html').data.toString();
 for(const text of ['导出存档','导入存档','file.size>100000','blob.size>100000','codec.parse','recoveryKey','JSON.stringify(previous)','await apply(candidate)','await apply(previous)','现有本机存档保留'])assert.ok(html.includes(text),text);
});

test('adapters fail closed on source drift, unknown mappings, and changed locked file sets',()=>{
 assert.throws(()=>adaptDynamicResource(langtonSource,[entry('index.html','drift'),langton[1]]),/anchor mismatch/);
 assert.throws(()=>adaptDynamicResource({...turboSource,id:'unreviewed'},turbo),/Unreviewed/);
 assert.throws(()=>adaptDynamicResource(langtonSource,[...langton,entry('extra.js','x')]),/file set/);
 const lock=Buffer.from(JSON.stringify({schemaVersion:1,sources:[{id:'not-a-game',repository:'https://github.com/xiaoxuhui/example.git',revision:'a'.repeat(40),directory:'dist',files:['LICENSE','index.html'],entryPage:'index.html',resourceIntegration:'turbowarp-file-io-v1'}]}));
 assert.throws(()=>dynamicSources(lock),/Unreviewed/);
});

test('pack and deterministic verification retain adaptation exactly once',()=>{
 const source={...turboSource,displayName:'神经网络',iconKind:'simulation',available:true,version:'0.1.0',contentCode:2,repository:'https://github.com/xiaoxuhui/turbowarp-neural-network.git',revision:'a'.repeat(40),storageContract:'turbowarp-neural-network-dynamic-v1',entryPage:'index.html',releaseNotes:'file I/O'};
 const packed=packDynamic(source,turbo);
 assert.equal(packed.game.files[0].sha256, createHash('sha256').update(adaptDynamicResource(source,turbo)[0].data).digest('hex'));
 verifyPackedDynamic(source,turbo,packed.game,packed.archive);
 assert.throws(()=>verifyPackedDynamic(source,turbo,{...packed.game,contentCode:99},packed.archive),/differs/);
});
