import{readFileSync,writeFileSync,mkdirSync,lstatSync,readdirSync}from'node:fs';import{join,dirname}from'node:path';import{execFileSync}from'node:child_process';import{sha256}from'./resource-protocol.mjs';import{TURING_REVISION,TURING_INTEGRATION,turingLegacyRuntime,turingReaderProof}from'./turing-legacy-reader.mjs';import{turingFormatRuntime}from'./turing-compatibility.mjs';import{turingPreservationRuntime}from'./turing-preservation.mjs';import{turingUIRuntime,turingCompatibilityCSS}from'./turing-compatibility-ui.mjs';
export const TURING_UI_INPUTS=Object.freeze({'index.html':'033ad43dfff25e047d695e7eca290f8409a1f212f16fa288143404c0fc4045ea','src/main.ts':'638f863dae9613c822e686f9a212afb1e177b9af6cc57b4c9113269738f0fbb9','src/campaign-main.ts':'b28d58467b37630d9eb30abc035859b0f6e6320e4405b7b74321df3c0cd3a5ee','src/styles.css':'173b1325b8faf5292e9bd309cc25d9f525d6fc655a4303af67c00369e9a7fff0'});
export function turingBuildInputs(){const bytes=readFileSync(new URL('../tests/fixtures/turing/ui/build-inputs.json',import.meta.url));if(sha256(bytes)!=='d87f8df35acea6e090f831a3f9f90908379426dd8db088141488ea26a592b62a')throw Error('Frozen Turing build inputs changed');return JSON.parse(bytes);}
export const TURING_REVIEWED_OUTPUTS_SHA='abdc3cbc3f1f0f2905cc05741ca30682bff08dca4022ee60a348849862f457ca';
export function turingReviewedOutputs(){const bytes=readFileSync(new URL('../tests/fixtures/turing/ui/reviewed-outputs.json',import.meta.url));if(sha256(bytes)!==TURING_REVIEWED_OUTPUTS_SHA)throw Error('Reviewed Turing outputs changed');return JSON.parse(bytes);}
const once=(text,before,after)=>{if(text.split(before).length!==2)throw Error('Reviewed Turing UI marker changed');return text.replace(before,after);};
export function adaptTuringTexts(inputs){
 for(const[path,hash]of Object.entries(TURING_UI_INPUTS))if(sha256(inputs[path])!==hash)throw Error('Unreviewed Turing UI input: '+path);
 let main=inputs['src/main.ts'].toString('utf8');
 main=once(main,'import { loadProject, parseProjectJson, saveProject, type ProjectData } from "./project-codec";','import { validateProjectData, type ProjectData } from "./project-codec";');
 main=once(main,'const STORAGE_KEY = "turing-machine-simulator.project.v1";\n','');
 main=once(main,'const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;','const hubCompatibility = (globalThis as any).installTuringCompatibility(globalThis, { validateProjectData }, defaultProject);\nconst byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;');
 main=once(main,'function collectProject(): ProjectData {\n  return {','function collectProject(): ProjectData {\n  return hubCompatibility.collect({');
 main=once(main,'    speed: Number(value("speed")) || 5,\n  };\n}','    speed: Number(value("speed")) || 5,\n  });\n}');
 main=once(main,'function fillProject(project: ProjectData | ExampleProject): void {','function fillProject(project: ProjectData | ExampleProject): boolean {\n  if (!hubCompatibility.beforeReplace(project)) return false;');
 main=once(main,'  persistTargetSpeed(Number(value("speed")));\n}','  persistTargetSpeed(Number(value("speed")));\n  return true;\n}');
 main=once(main,'saveProject(localStorage, STORAGE_KEY, project)','hubCompatibility.save(project)');
 if(main.split('saveProject(localStorage, STORAGE_KEY, collectProject())').length!==3)throw Error('Reviewed Turing step-limit save markers changed');
 main=main.replaceAll('saveProject(localStorage, STORAGE_KEY, collectProject())','hubCompatibility.save(collectProject())');
 main=once(main,'saveSpeedPreference(localStorage, speed)','hubCompatibility.speedSave(() => saveSpeedPreference(hubCompatibility.storage, speed))');
 main=once(main,'    fillProject({ ...project, speed: Number(value("speed")) });','    if (!fillProject({ ...project, speed: Number(value("speed")) })) return;');
 main=once(main,'  fillProject(example);','  if (!fillProject(example)) return;');
 main=once(main,'byId("clear").addEventListener("click", () => { pause(); byId<HTMLTextAreaElement>("rules").value = ""; });','byId("clear").addEventListener("click", () => { if (!hubCompatibility.protectDraftReplacement()) return; pause(); byId<HTMLTextAreaElement>("rules").value = ""; });');
 main=once(main,'byId("exportProject").addEventListener("click", () => download("turing-machine-project.json", JSON.stringify(collectProject(), null, 2), "application/json"));','byId("exportProject").addEventListener("click", () => hubCompatibility.compatibleExport());');
 const start=main.indexOf('byId("fileInput").addEventListener("change", async () => {'),end=main.indexOf('byId("exportLog").addEventListener',start);if(start<0||end<=start)throw Error('Reviewed Turing file handler changed');
 main=main.slice(0,start)+`byId("fileInput").addEventListener("change", async () => {
  const input = byId<HTMLInputElement>("fileInput"), file = input.files?.[0]; input.value = "";
  await hubCompatibility.importFile(file);
});
`+main.slice(end);
 const tail='const savedProject = loadProject(localStorage, STORAGE_KEY) ?? defaultProject;\nfillProject({ ...savedProject, speed: loadSpeedPreference(localStorage) ?? savedProject.speed });\nbyId("exampleNote").textContent = examples.unary.description;\ncreateMachine();\nrenderRuleTable();';
 main=once(main,tail,`hubCompatibility.mount({ getProject: collectProject, applyProject: (project: ProjectData) => { if (!fillProject(project)) return false; createMachine(); return true; }, pause, download });
void hubCompatibility.start((savedProject: ProjectData) => {
  fillProject({ ...savedProject, speed: loadSpeedPreference(hubCompatibility.storage) ?? savedProject.speed });
  byId("exampleNote").textContent = examples.unary.description;
  createMachine();
  renderRuleTable();
});`);
 if(/\b(?:localStorage|loadProject|parseProjectJson|saveProject|STORAGE_KEY)\b/.test(main))throw Error('Unwrapped Turing project persistence entry remains');
 const runtimes={'hub/turing-legacy.js':turingLegacyRuntime(),'hub/turing-format.js':turingFormatRuntime(),'hub/turing-preservation.js':turingPreservationRuntime(),'hub/turing-ui.js':turingUIRuntime()},scripts=Object.keys(runtimes).map(path=>`    <script src="./${path}"></script>`).join('\n');
 const html=once(inputs['index.html'].toString('utf8'),'    <script type="module" src="/src/main.ts"></script>',scripts+'\n    <script type="module" src="/src/main.ts"></script>');
 const campaign=once(inputs['src/campaign-main.ts'].toString('utf8'),'已下载关卡备份文件。请妥善保存，恢复时可导入此文件。','已请求导出关卡备份，请在系统保存界面确认完成。');
 return{sources:{'src/main.ts':Buffer.from(main),'src/campaign-main.ts':Buffer.from(campaign),'src/styles.css':Buffer.from(inputs['src/styles.css'].toString('utf8')+turingCompatibilityCSS),'index.html':Buffer.from(html)},runtimes};
}
const TURING_ADAPTERS=['turing-resource-integration.mjs','turing-legacy-reader.mjs','turing-compatibility.mjs','turing-preservation.mjs','turing-compatibility-ui.mjs'];
const TURING_PROOF_FIELDS=['schemaVersion','integration','repository','revision','inputs','legacyReader','reviewedOutputsSha256','adaptedSources','runtimeFiles','adapters'];
const sortedRecord=value=>Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
const fixtureSources=()=>Object.fromEntries(Object.keys(TURING_UI_INPUTS).map(path=>[path,readFileSync(new URL('../tests/fixtures/turing/ui/'+path.split('/').at(-1)+'.txt',import.meta.url))]));
export function turingSourceProof(source){
 if(source.id!=='turing'||source.repository!=='https://github.com/xiaoxuhui/turing-machine-simulator.git'||source.revision!==TURING_REVISION||source.resourceIntegration!==TURING_INTEGRATION)throw Error('Unreviewed Turing integration');
 const adapted=adaptTuringTexts(fixtureSources());
 return{schemaVersion:1,integration:TURING_INTEGRATION,repository:source.repository,revision:TURING_REVISION,inputs:turingBuildInputs(),legacyReader:turingReaderProof(),reviewedOutputsSha256:TURING_REVIEWED_OUTPUTS_SHA,adaptedSources:sortedRecord(Object.fromEntries(Object.entries(adapted.sources).map(([path,bytes])=>[path,sha256(bytes)]))),runtimeFiles:sortedRecord(Object.fromEntries(Object.entries(adapted.runtimes).map(([path,bytes])=>[path,sha256(bytes)]))),adapters:sortedRecord(Object.fromEntries(TURING_ADAPTERS.map(path=>[path,sha256(readFileSync(new URL(path,import.meta.url)))])))};
}
export function validateTuringSourceProof(proof,source,expectedOutputs){
 const hasOutputs=!!proof&&typeof proof==='object'&&!Array.isArray(proof)&&Object.hasOwn(proof,'outputs'),allowedFields=hasOutputs?[...TURING_PROOF_FIELDS,'outputs']:TURING_PROOF_FIELDS;
 if(!proof||typeof proof!=='object'||Array.isArray(proof)||JSON.stringify(Object.keys(proof).sort())!==JSON.stringify([...allowedFields].sort()))throw Error('Turing source proof fields changed');
 if(hasOutputs&&(!expectedOutputs||JSON.stringify(proof.outputs)!==JSON.stringify(expectedOutputs)))throw Error('Turing output proof changed');
 const expected=turingSourceProof(source);
 for(const field of TURING_PROOF_FIELDS)if(JSON.stringify(field==='adaptedSources'||field==='runtimeFiles'||field==='adapters'?sortedRecord(proof[field]):proof[field])!==JSON.stringify(expected[field]))throw Error('Turing source proof changed: '+field);
 return expected;
}
export function finalizeTuringSourceProof(proofPath,source,outputs){
 const proof=JSON.parse(readFileSync(proofPath));validateTuringSourceProof(proof,source,outputs);
 if(!Object.hasOwn(proof,'outputs')){proof.outputs=outputs;writeFileSync(proofPath,JSON.stringify(proof,null,2)+'\n');}
 return proof;
}
export function prepareTuringUI(source,directory){
 if(source.id!=='turing'||source.repository!=='https://github.com/xiaoxuhui/turing-machine-simulator.git'||source.revision!==TURING_REVISION||source.resourceIntegration!==TURING_INTEGRATION)throw Error('Unreviewed Turing integration');
 const git=(args,encoding)=>execFileSync('git',args,{cwd:directory,encoding,maxBuffer:8*1048576,env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});if(git(['rev-parse','HEAD'],'utf8').trim()!==TURING_REVISION)throw Error('Turing checkout identity changed');
 const paths=git(['ls-tree','-r','--name-only',TURING_REVISION,'src','public','LICENSE','index.html','campaign.html','package.json','pnpm-lock.yaml','tsconfig.json','vite.config.ts'],'utf8').trim().split('\n').sort(),inputs=[];
 for(const path of paths){if(!path||path.includes('..')||path.includes('\\')||!lstatSync(join(directory,path)).isFile())throw Error('Invalid Turing build input');const bytes=readFileSync(join(directory,path));if(!bytes.equals(git(['show',TURING_REVISION+':'+path])))throw Error('Turing build input differs from frozen Git blob: '+path);inputs.push({path,bytes:bytes.length,sha256:sha256(bytes)});}
 if(JSON.stringify(inputs)!==JSON.stringify(turingBuildInputs()))throw Error('Turing complete build input set changed');
 const sourceInputs=Object.fromEntries(Object.keys(TURING_UI_INPUTS).map(path=>[path,readFileSync(join(directory,path))])),adapted=adaptTuringTexts(sourceInputs),proof=turingSourceProof(source);
 if(JSON.stringify(inputs)!==JSON.stringify(proof.inputs))throw Error('Turing complete build input set changed');
 for(const[path,bytes]of Object.entries(adapted.sources))if(proof.adaptedSources[path]!==sha256(bytes))throw Error('Turing adapted source differs from frozen source proof: '+path);
 for(const[path,bytes]of Object.entries(adapted.sources))writeFileSync(join(directory,path),bytes);
 for(const[path,bytes]of Object.entries(adapted.runtimes)){const full=join(directory,'public',path);mkdirSync(dirname(full),{recursive:true});writeFileSync(full,bytes);}
 writeFileSync(join(directory,'public/hub-source-proof.json'),JSON.stringify(proof,null,2)+'\n');return proof;
}
export function finalizeTuringResource(source,directory){
 if(source.id!=='turing'||source.repository!=='https://github.com/xiaoxuhui/turing-machine-simulator.git'||source.revision!==TURING_REVISION||source.resourceIntegration!==TURING_INTEGRATION)throw Error('Unreviewed Turing integration');
 const outputs=turingReviewedOutputs(),walk=(directory,prefix='')=>readdirSync(directory).sort().flatMap(name=>{const path=join(directory,name),stat=lstatSync(path);if(stat.isSymbolicLink())throw Error('Turing output link');if(stat.isDirectory())return walk(path,prefix+name+'/');if(!stat.isFile())throw Error('Turing special output');return[prefix+name];}),files=walk(directory).sort(),expected=[...outputs.map(item=>item.path),'LICENSE','hub-source-proof.json'].sort();if(JSON.stringify(files)!==JSON.stringify(expected))throw Error('Turing complete output file set differs');
 for(const output of outputs){const bytes=readFileSync(join(directory,output.path));if(bytes.length!==output.bytes||sha256(bytes)!==output.sha256)throw Error('Turing output differs from reviewed real UI: '+output.path);}
 const proofPath=join(directory,'hub-source-proof.json'),finalizedOutputs=files.filter(path=>path!=='hub-source-proof.json').map(path=>{const bytes=readFileSync(join(directory,path));return{path,bytes:bytes.length,sha256:sha256(bytes)}}),proof=JSON.parse(readFileSync(proofPath));validateTuringSourceProof(proof,source,finalizedOutputs);
 const runtime=outputs.filter(item=>item.path.startsWith('hub/'));if(Object.keys(proof.runtimeFiles).sort().join()!==runtime.map(item=>item.path).sort().join())throw Error('Turing runtime identities changed');for(const item of runtime)if(proof.runtimeFiles[item.path]!==item.sha256)throw Error('Turing runtime proof changed');
 if(sha256(readFileSync(join(directory,'LICENSE')))!==turingBuildInputs().find(item=>item.path==='LICENSE').sha256)throw Error('Turing source license changed');
 return finalizeTuringSourceProof(proofPath,source,finalizedOutputs);
}
