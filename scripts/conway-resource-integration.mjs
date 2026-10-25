import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {sha256} from './resource-protocol.mjs';
import {adaptConwayCore,CONWAY_REVISION,CONWAY_INTEGRATION} from './conway-compatibility.mjs';
import {conwayArchiveRuntime} from './conway-world-archive.mjs';
import {conwayUIRuntime,conwayArchiveCSS} from './conway-archive-ui.mjs';

export const CONWAY_UI_INPUTS = Object.freeze({
 'scripts/app.js':'5691d4b2e962cf90f96157a753d1c64f7c6748a38bb4862a2e043ac8d099ab38',
 'index.html':'abd84b572705574e6249012a1a07e07da32caf640b96d1223990b26d9bfbd36d',
 'styles/main.css':'30610f528ebfc04f4ec9ef681cf78f530d0415744b44d6b0d7130ec0c87d4d76',
});
function once(text,before,after) {
 if(text.split(before).length!==2)throw Error('Conway reviewed UI marker changed');
 return text.replace(before,after);
}
export function adaptConwayUI(inputs) {
 for(const [path,expected] of Object.entries(CONWAY_UI_INPUTS)) if(sha256(inputs[path])!==expected)throw Error(`Unreviewed Conway UI bytes: ${path}`);
 let app=inputs['scripts/app.js'].toString('utf8');
 app=once(app,'elements.export.disabled = alive === 0;', 'elements.export.disabled = false; // Empty worlds still contain rule, generation and view.');
 app=once(app,'return ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName);',
  'return Boolean(document.querySelector(".hub-world-backups[open]")) || ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName);');
 app=once(app,'  function handleKeyUp(event) {',
  '  function handleKeyUp(event) {\n    if (document.querySelector(".hub-world-backups[open]")) { state.pointer.spaceDown = false; state.pointer.spaceDragged = false; return; }');
 const start=app.indexOf('  function exportWorld() {'), end=app.indexOf('  function rememberStrokeCell(');
 if(start<0||end<=start)throw Error('Conway reviewed import/export block changed');
 app=app.slice(0,start)+`  const hubWorldController = window.installConwayArchiveUI({
    pause: () => stop(),
    capture: () => JSON.stringify(Life.serialize(state.world.cells, state.world.generation, state.world.camera, state.world.rule), null, 2),
    toast: message => showToast(message, {duration: 8000}),
    apply: restored => {
      stop(); state.world.rule = restored.rule; cancelLogicForRuleChange(); syncRuleDraft();
      state.dialogs.placement = null; state.world.cells = restored.world;
      state.world.generation = restored.generation; state.world.logicOutputs = [];
      state.world.camera = RendererModule.createCamera(restored.view); state.world.undoSnapshot = null; render();
    }
  }, Life, window.ConwayHubArchives.create((() => {
    try { return window.localStorage; } catch (error) {
      return {getItem(){throw error;},setItem(){throw error;},removeItem(){throw error;}};
    }
  })(), Life));
  function exportWorld() { return hubWorldController.exportWorld(); }
  async function importWorld(file) {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) { showToast('导入失败：文件不能超过 1 MB'); return; }
    try { await hubWorldController.importText(await file.text()); }
    catch (error) { showToast('导入失败：' + error.message); }
  }

`+app.slice(end);
 const index=once(inputs['index.html'].toString('utf8'),'<script defer src="scripts/app.js?v=0.17.0"></script>',
  '<script defer src="scripts/hub-world-archive.js"></script>\n    <script defer src="scripts/hub-world-archive-ui.js"></script>\n    <script defer src="scripts/app.js?v=0.17.0"></script>');
 return {'scripts/app.js':Buffer.from(app),'index.html':Buffer.from(index),'styles/main.css':Buffer.from(inputs['styles/main.css'].toString('utf8')+conwayArchiveCSS),
  'scripts/hub-world-archive.js':conwayArchiveRuntime(),'scripts/hub-world-archive-ui.js':conwayUIRuntime()};
}
export function integrateConwayResource(source,directory) {
 if(source.id!=='conway'||source.revision!==CONWAY_REVISION||source.resourceIntegration!==CONWAY_INTEGRATION)throw Error('Unreviewed Conway integration');
 const inputs=Object.fromEntries(Object.keys(CONWAY_UI_INPUTS).map(path=>[path,readFileSync(join(directory,path))]));
 inputs['scripts/life-engine.js']=readFileSync(join(directory,'scripts/life-engine.js'));
 const outputs={...adaptConwayUI(inputs),'scripts/life-engine.js':adaptConwayCore(inputs['scripts/life-engine.js'])};
 const adapters=['conway-resource-integration.mjs','conway-compatibility.mjs','conway-world-archive.mjs','conway-archive-ui.mjs','resource-protocol.mjs'];
 const proof={schemaVersion:1,integration:CONWAY_INTEGRATION,repository:source.repository,revision:CONWAY_REVISION,
  inputs:Object.fromEntries(Object.entries(inputs).map(([path,data])=>[path,sha256(data)])),
  outputs:Object.fromEntries(Object.entries(outputs).map(([path,data])=>[path,sha256(data)])),
  adapters:Object.fromEntries(adapters.map(path=>[path,sha256(readFileSync(new URL(path,import.meta.url)))]))};
 for(const [path,data]of Object.entries(outputs))writeFileSync(join(directory,path),data);
 writeFileSync(join(directory,'hub-source-proof.json'),JSON.stringify(proof,null,2)+'\n');
 return proof;
}
