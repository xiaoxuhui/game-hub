import{readFileSync,writeFileSync,mkdirSync,lstatSync}from'node:fs';import{join,dirname}from'node:path';import{execFileSync}from'node:child_process';
import{sha256}from'./resource-protocol.mjs';import{EML_REVISION,EML_LEGACY_REVISION,EML_OLD_HASHES,EML_INTEGRATION,emlLegacyRuntime}from'./eml-legacy-reader.mjs';import{emlFormatRuntime}from'./eml-compatibility.mjs';import{emlPreservationRuntime}from'./eml-preservation.mjs';import{emlUIRuntime,emlCompatibilityCSS}from'./eml-compatibility-ui.mjs';
import{emlBuildInputs,stageEMLLicenses,finalizeEMLAssets}from'./eml-katex-assets.mjs';
export const EML_UI_INPUTS=Object.freeze({
 'src/app.js':'16313a1f0d1936cc7b2939c41fb93c6238367db6ae5dc426485113102dbb9c4d',
 'src/template.html':'9869438937e1b7015407c438d2a1b52b40edb534885d391ae7bd2e89fb4e21ca',
 'src/styles.css':'7fd33f9ecc7ab100657e6332ddf3411267de2321bd61340695301e9d3f91eb7f',
 'scripts/build.mjs':'ea20b11c982141b14d82b777bb2b2f4e9b0ea689daab844eee4d7740e80540ec',
});
const once=(text,before,after)=>{if(text.split(before).length!==2)throw Error('Reviewed EML UI marker changed');return text.replace(before,after);};
export function adaptEMLTexts(inputs){
 for(const[path,hash]of Object.entries(EML_UI_INPUTS))if(sha256(inputs[path])!==hash)throw Error('Unreviewed EML UI input: '+path);
 let app=inputs['src/app.js'].toString('utf8');
 app=once(app,'(function (root) {','(async function (root) {');
 app=once(app,'  const Persistence = root.EMLPersistence;','  const hubCompatibility = root.installEMLCompatibility(root, root.EMLPersistence, Store);\n  const Persistence = hubCompatibility.persistence;');
 app=once(app,'  let state = restoreState();','  let state = await restoreState();');
 app=once(app,'  function restoreState() {','  async function restoreState() {');
 app=once(app,'const restored = Persistence.loadFromCache(localStorage);','const restored = await Persistence.loadFromCache(hubCompatibility.storage);');
 app=once(app,'Persistence.saveToCache(localStorage, state);','Persistence.saveToCache(hubCompatibility.storage, state);');
 const from=app.indexOf('  elements.save.addEventListener("click", () => {'),to=app.indexOf('  document.addEventListener("keydown",');
 if(from<0||to<=from)throw Error('Reviewed EML file-control block changed');
 app=app.slice(0,from)+`  elements.save.addEventListener("click", event => { event.preventDefault(); hubCompatibility.exportCompatible(state); });
  elements.import.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", async () => {
    const file = elements.importFile.files && elements.importFile.files[0]; elements.importFile.value = "";
    await hubCompatibility.importFile(file);
  });
  elements.clear.addEventListener("click", () => hubCompatibility.clear());

`+app.slice(to);
 app=once(app,'  root.EMLApp = {','  hubCompatibility.mount({ getState: () => state, apply: next => { commitState(next); render(); } });\n  root.EMLApp = {');
 const runtimes={'hub/eml-legacy-reader.js':emlLegacyRuntime(),'hub/eml-format.js':emlFormatRuntime(),'hub/eml-preservation.js':emlPreservationRuntime(),'hub/eml-ui.js':emlUIRuntime()};
 const scripts=Object.keys(runtimes).map(path=>`  <script src="${path}"></script>`).join('\n');
 const template=once(inputs['src/template.html'].toString('utf8'),'  <script>\n/*__SCRIPTS__*/',scripts+'\n  <script>\n/*__SCRIPTS__*/');
 return {sources:{'src/app.js':Buffer.from(app),'src/template.html':Buffer.from(template),'src/styles.css':Buffer.from(inputs['src/styles.css'].toString('utf8')+emlCompatibilityCSS)},runtimes};
}
export function prepareEMLResource(source,directory){
 if(source.id!=='eml'||source.repository!=='https://github.com/xiaoxuhui/EML.git'||source.revision!==EML_REVISION||source.resourceIntegration!==EML_INTEGRATION)throw Error('Unreviewed EML resource integration');
 const git=(args,encoding)=>execFileSync('git',args,{cwd:directory,encoding,maxBuffer:16*1048576,env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});
 if(git(['rev-parse','HEAD'],'utf8').trim()!==EML_REVISION)throw Error('EML checkout identity changed');
 const paths=git(['ls-tree','-r','--name-only',EML_REVISION,'src','scripts/build.mjs','LICENSE'],'utf8').trim().split('\n');
 const sourceInputs=[];
 for(const path of paths){if(!path||path.includes('..')||path.includes('\\')||!lstatSync(join(directory,path)).isFile())throw Error('Invalid EML source input');const bytes=readFileSync(join(directory,path));if(!bytes.equals(git(['show',EML_REVISION+':'+path])))throw Error('EML input differs from immutable Git blob: '+path);sourceInputs.push({path,bytes:bytes.length,sha256:sha256(bytes)});}
 if(JSON.stringify(sourceInputs)!==JSON.stringify(emlBuildInputs()))throw Error('EML immutable full build-input set changed');
 const inputs=Object.fromEntries(Object.keys(EML_UI_INPUTS).map(path=>[path,readFileSync(join(directory,path))])),adapted=adaptEMLTexts(inputs);
 const adapters=['eml-resource-integration.mjs','eml-legacy-reader.mjs','eml-compatibility.mjs','eml-preservation.mjs','eml-compatibility-ui.mjs','eml-katex-assets.mjs'];
 const scriptFiles=['expression.js','expression-properties.js','rules-transcendental.js','rules-algebra.js','formula-rules.js','evaluator.js','eml-composition.js','value-store.js','persistence.js','tree-viewport.js','tree-controller.js','derivation-trace.js','app.js'];
 const inlineScripts=scriptFiles.map(file=>`/* ${file} */\n`+(adapted.sources['src/'+file]??readFileSync(join(directory,'src',file))).toString('utf8')).join('\n\n');
 const expectedHTML=Buffer.from(adapted.sources['src/template.html'].toString('utf8').replace('/*__STYLES__*/',adapted.sources['src/styles.css'].toString('utf8')).replace('/*__SCRIPTS__*/',inlineScripts));
 const thirdParty=stageEMLLicenses(join(directory,'dist'));
 const legacySource={repository:'https://github.com/xiaoxuhui/EML.git',revision:EML_LEGACY_REVISION,inputs:Object.entries(EML_OLD_HASHES).map(([name,hash])=>({path:'src/'+name,sha256:hash})),licenseSha256:sha256(readFileSync(new URL('../tests/fixtures/eml/old/LICENSE',import.meta.url)))};
 const proof={schemaVersion:1,integration:EML_INTEGRATION,repository:source.repository,revision:EML_REVISION,inputs:sourceInputs,legacySource,thirdParty,expectedHTML:{bytes:expectedHTML.length,sha256:sha256(expectedHTML)},adaptedSources:Object.fromEntries(Object.entries(adapted.sources).map(([path,bytes])=>[path,sha256(bytes)])),runtimeFiles:Object.fromEntries(Object.entries(adapted.runtimes).map(([path,bytes])=>[path,sha256(bytes)])),adapters:Object.fromEntries(adapters.map(path=>[path,sha256(readFileSync(new URL(path,import.meta.url)))]))};
 for(const[path,bytes]of Object.entries(adapted.sources))writeFileSync(join(directory,path),bytes);
 for(const[path,bytes]of Object.entries(adapted.runtimes)){const full=join(directory,'dist',path);mkdirSync(dirname(full),{recursive:true});writeFileSync(full,bytes);}
 writeFileSync(join(directory,'dist/hub-source-proof.json'),JSON.stringify(proof,null,2)+'\n');return proof;
}
export function finalizeEMLResource(source,directory){if(source.id!=='eml'||source.repository!=='https://github.com/xiaoxuhui/EML.git'||source.revision!==EML_REVISION||source.resourceIntegration!==EML_INTEGRATION)throw Error('Unreviewed EML resource integration');return finalizeEMLAssets(directory);}
