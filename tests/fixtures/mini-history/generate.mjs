// Reproduce fixed historical test vectors from the existing isolated source clone.
// This script reads Git objects, never checks out or modifies an upstream tree.
import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve,dirname,posix} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url)),repo=resolve(root,'../../../.build/dynamic-sources/mini-scratch');
const definitions=[
  {slot:1,version:'0.1.0',revision:'8c3bad2a0a9f71053bc2dfb132f7ca4417a182a4',initial:['core.js']},
  {slot:2,version:'0.2.0',revision:'0a7b8ef2c972112fee92078a3bdf8d878c018e70',initial:['project.js','persistence.js']},
  {slot:3,version:'0.3.0',revision:'1048c3a8542f016900ade867f39a799916a31d2c',initial:['project.js','persistence.js','procedures.js']},
  {slot:4,version:'0.4.0',revision:'edd314948977fcc38009787ff00a5e73f1758c4f',initial:['project.js','persistence.js','procedures.js','events.js']}
];
const digest=data=>createHash('sha256').update(data).digest('hex');
for(const definition of definitions){
  const target=join(root,'v'+definition.slot);mkdirSync(target,{recursive:true});const copied=new Map();
  function copy(name){
    if(!/^[a-z][a-z-]*\.js$/.test(name))throw Error('Unreviewed historical helper path');if(copied.has(name))return;
    const sourcePath='dist/src/'+name,data=execFileSync('git',['-C',repo,'show',definition.revision+':'+sourcePath]);
    copied.set(name,{path:name,sourcePath,bytes:data.length,sha256:digest(data)});writeFileSync(join(target,name),data);
    const text=data.toString('utf8');for(const match of text.matchAll(/(?:import|export)\s+[^;\n]*?\sfrom\s*['"]([^'"]+)['"]/g)){
      if(!match[1].startsWith('./'))throw Error('Nonlocal historical import');copy(posix.normalize(match[1]));
    }
  }
  definition.initial.forEach(copy);
  const license=execFileSync('git',['-C',repo,'show',definition.revision+':LICENSE']);if(!license.toString('utf8').startsWith('MIT License'))throw Error('Missing historical MIT');writeFileSync(join(target,'LICENSE'),license);
  copied.set('LICENSE',{path:'LICENSE',sourcePath:'LICENSE',bytes:license.length,sha256:digest(license)});
  const model=await import(pathToFileURL(join(target,definition.slot===1?'core.js':'project.js')));
  const originalNow=Date.now;let sample;
  try{
    Date.now=()=>0;
    if(definition.slot===1)sample=execFileSync('git',['-C',repo,'show',definition.revision+':tests/fixtures/square.json']);
    else{
      let project=model.example('dance');
      if(definition.slot>=3){const {migrateProcedures}=await import(pathToFileURL(join(target,'procedures.js')));project=migrateProcedures(project);}
      if(definition.slot>=4){const {migrateEventScripts}=await import(pathToFileURL(join(target,'events.js')));project=migrateEventScripts(project);}
      sample=Buffer.from(JSON.stringify(model.validateProject(project),null,2)+'\n');
    }
  }finally{Date.now=originalNow;}
  model.validateProject(JSON.parse(sample));writeFileSync(join(target,'sample.json'),sample);
  const provenance={repository:'https://github.com/xiaoxuhui/mini-scratch.git',revision:definition.revision,version:definition.version,slot:definition.slot,files:[...copied.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0),sample:{path:'sample.json',bytes:sample.length,sha256:digest(sample),generation:definition.slot===1?'Verbatim tests/fixtures/square.json':'Native example(dance), native startup migrations for this version, validateProject and JSON.stringify; Date.now fixed to 0 for stable IDs'}};
  writeFileSync(join(target,'provenance.json'),JSON.stringify(provenance,null,2)+'\n');
  console.log(`Historical v${definition.slot}: ${copied.size} licensed source files, ${sample.length} sample bytes`);
}
