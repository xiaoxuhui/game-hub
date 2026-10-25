import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256} from './resource-protocol.mjs';
export const HEX_REVISION='5040dde0521e9e38a5b640c80993a567f18a25c0';
export const HEX_FILES=['index.html','styles/main.css','src/core.js','src/app.js','src/expression.js','src/presets.js','vendor/jsep-1.4.0/dist/iife/jsep.iife.js','vendor/jsep-1.4.0/LICENSE'];
const root=fileURLToPath(new URL('../',import.meta.url)),repository='https://github.com/xiaoxuhui/hex-cell-lab.git';
export function hexSource(checkout){
  const git=args=>execFileSync('git',args,{cwd:checkout,encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}}).trim();
  if(git(['rev-parse','HEAD'])!==HEX_REVISION||git(['remote','get-url','origin'])!==repository||git(['status','--porcelain=v1','--untracked-files=all']))throw Error('Hex immutable clean remote source required');
  const read=path=>execFileSync('git',['show',HEX_REVISION+':'+path],{cwd:checkout,maxBuffer:8*1024*1024});
  if(JSON.parse(read('package.json')).version!=='1.4.0')throw Error('Hex source version mismatch');
  const licenseRevision='11f1dbe51f9fd764d91fffac878c602bfc61a0ee',license=execFileSync('git',['show',licenseRevision+':LICENSE'],{cwd:root});if(!/^MIT License\r?\n/.test(license.toString())||!license.toString().includes('Copyright (c) 2026 xiaoxuhui'))throw Error('Author license identity mismatch');
  const entries=HEX_FILES.map(path=>({path,data:read(path)}));
  const inputs=[...HEX_FILES,'package.json','scripts/build.cjs'].map(path=>{const data=read(path);return {path,bytes:data.length,sha256:sha256(data)};});
  const proof={schemaVersion:1,id:'hex-cell-lab',repository,revision:HEX_REVISION,version:'1.4.0',buildKind:'static-copy',entryPage:'index.html',inputs,license:{spdx:'MIT',copyright:'2026 xiaoxuhui',authorization:'Author explicitly approved MIT resource publication in conversation on 2026-10-25',sourceRepository:'https://github.com/xiaoxuhui/game-hub.git',sourceRevision:licenseRevision,path:'LICENSE',bytes:license.length,sha256:sha256(license),thirdParty:'vendor/jsep-1.4.0/LICENSE preserved byte-for-byte'},adaptations:[],outputs:[...entries,{path:'LICENSE',data:license}].map(e=>({path:e.path,bytes:e.data.length,sha256:sha256(e.data)}))};
  return [...entries,{path:'LICENSE',data:license},{path:'upstream-source.json',data:Buffer.from(JSON.stringify(proof,null,2)+'\n')}];
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const args=process.argv.slice(2);if(![2,3].includes(args.length)||args[0]!=='--source'||args[2]&&args[2]!=='--verify')throw Error('Usage: hex-cell-lab-source.mjs --source <independent-checkout> [--verify]');
    const entries=hexSource(resolve(args[1])),output=join(root,'examples/hex-cell-lab');
    for(const e of entries){const path=join(output,e.path);if(args[2]){if(!readFileSync(path).equals(e.data))throw Error('Hex production differs: '+e.path);}else{if(existsSync(path)&&e.path!=='upstream-source.json'&&!readFileSync(path).equals(e.data))throw Error('Refuse overwriting different hex source: '+e.path);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,e.data);}}
    console.log(`Hex ${entries.length} files ${args[2]?'verified':'produced'} from ${HEX_REVISION}; third-party license retained`);
  }catch(error){console.error(error.message);process.exitCode=1;}
}
