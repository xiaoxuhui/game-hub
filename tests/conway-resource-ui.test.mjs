import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {sha256} from '../scripts/resource-protocol.mjs';
import {CONWAY_INTEGRATION,CONWAY_REVISION} from '../scripts/conway-compatibility.mjs';
import {adaptConwayUI,integrateConwayResource,CONWAY_UI_INPUTS} from '../scripts/conway-resource-integration.mjs';
const inputs=Object.fromEntries(Object.entries({'scripts/app.js':'app','index.html':'index','styles/main.css':'css'}).map(([path,name])=>[path,readFileSync(new URL(`fixtures/conway-a531-${name}.txt`,import.meta.url))]));
test('Conway exact upstream UI is transformed only into resource controls with valid JavaScript and relative dependency closure',()=>{
 for(const [path,bytes]of Object.entries(inputs))assert.equal(sha256(bytes),CONWAY_UI_INPUTS[path]);
 const out=adaptConwayUI(inputs);
 for(const [path,bytes]of Object.entries(out))if(path.endsWith('.js'))assert.doesNotThrow(()=>new Function(bytes.toString()));
 assert.match(out['scripts/app.js'].toString(),/hubWorldController.importText/);
 assert.match(out['scripts/app.js'].toString(),/elements.export.disabled = false;/);
 assert.ok(out['index.html'].indexOf('hub-world-archive.js')<out['index.html'].indexOf('scripts/app.js'));
 assert.match(out['scripts/hub-world-archive-ui.js'].toString(),/previewClear\(\)/);
 assert.match(out['scripts/hub-world-archive-ui.js'].toString(),/clear\(true, preview.expectedRaw\)/);
 assert.equal(inputs['scripts/app.js'].includes(Buffer.from('hubWorldController')),false);
 for(const path of Object.keys(inputs)){const bad={...inputs,[path]:Buffer.concat([inputs[path],Buffer.from('\n')])};assert.throws(()=>adaptConwayUI(bad),/Unreviewed/);}
});
test('Conway resource integration rejects unknown identity before writes and binds all input, output, and adapter bytes',()=>{
 const directory=mkdtempSync(join(tmpdir(),'conway-ui-'));
 try {
  for(const [path,bytes]of Object.entries(inputs)){mkdirSync(dirname(join(directory,path)),{recursive:true});writeFileSync(join(directory,path),bytes);}
  writeFileSync(join(directory,'scripts/life-engine.js'),readFileSync(new URL('fixtures/conway-reader-a531.cjs',import.meta.url)));
  const source={id:'conway',revision:CONWAY_REVISION,resourceIntegration:CONWAY_INTEGRATION,repository:'https://github.com/xiaoxuhui/conway-life-game.git'};
  assert.throws(()=>integrateConwayResource({...source,revision:'0'.repeat(40)},directory),/Unreviewed/);
  assert.deepEqual(readFileSync(join(directory,'scripts/app.js')),inputs['scripts/app.js']);
  const proof=integrateConwayResource(source,directory);
  assert.equal(proof.revision,CONWAY_REVISION);assert.equal(Object.keys(proof.inputs).length,4);assert.equal(Object.keys(proof.outputs).length,6);
  for(const [path,hash]of Object.entries(proof.outputs))assert.equal(sha256(readFileSync(join(directory,path))),hash);
  assert.equal(proof.adapters['conway-resource-integration.mjs'],sha256(readFileSync(new URL('../scripts/conway-resource-integration.mjs',import.meta.url))));
 }finally{rmSync(directory,{recursive:true,force:true});}
});
