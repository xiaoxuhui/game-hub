import {readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONWAY_ARCHIVE_KEY,CONWAY_INTEGRATION,CONWAY_REVISION} from './conway-compatibility.mjs';
import {EML_INTEGRATION,EML_REVISION} from './eml-legacy-reader.mjs';
import {TURING_INTEGRATION,TURING_REVISION} from './turing-legacy-reader.mjs';

export function expectedStorageKeys({resourceMode=false,integrations={}}={}){
 const expected={conway:['conway-life-game.custom-patterns.v1','conway-life-game.logic-functions.v1'],eml:['eml_workbench_v2'],light:['light-game/save'],turing:['turing-machine-simulator.project.v1','turing-machine-simulator.campaign.v1']};
 for(const [id,marker]of Object.entries(integrations))if(!resourceMode||!((id==='conway'&&marker===CONWAY_INTEGRATION)||(id==='eml'&&marker===EML_INTEGRATION)||(id==='turing'&&marker===TURING_INTEGRATION)))throw Error('Unreviewed storage integration or wrong audit mode');
 if(resourceMode&&integrations.conway===CONWAY_INTEGRATION)expected.conway.push(CONWAY_ARCHIVE_KEY);
 if(resourceMode&&integrations.eml===EML_INTEGRATION)expected.eml.push('eml-hub-preservation-v1');
 if(resourceMode&&integrations.turing===TURING_INTEGRATION)expected.turing.push('turing-machine-simulator.speed.v1','turing-hub-preservation-v1');
 return expected;
}
export function auditStorageText(sources,options={}){
 const expected=expectedStorageKeys(options),keys=new Map();
 if(Object.keys(sources).sort().join()!==Object.keys(expected).sort().join())throw Error('Four audited source owners required');
 if(!expected.conway.includes(CONWAY_ARCHIVE_KEY)&&Object.values(sources).some(text=>text.includes(CONWAY_ARCHIVE_KEY)))throw Error('Resource-only archive key without reviewed resource integration');
 if(!expected.eml.includes('eml-hub-preservation-v1')&&Object.values(sources).some(text=>text.includes('eml-hub-preservation-v1')))throw Error('Resource-only EML key without reviewed resource integration');
 if(!expected.turing.includes('turing-hub-preservation-v1')&&Object.values(sources).some(text=>text.includes('turing-hub-preservation-v1')||text.includes('turing-machine-simulator.speed.v1')))throw Error('Resource-only Turing keys without reviewed resource integration');
 for(const [game,names]of Object.entries(expected)){
  const text=sources[game];
  if(/\b(?:localStorage|sessionStorage)\s*(?:\.\s*clear|\[\s*['"]clear['"]\s*\])\s*\(/.test(text))throw Error(`${game}: broad storage clear found`);
  for(const name of names){
   if(!text.includes(name))throw Error(`${game}: missing storage key ${name}`);
   for(const [owner,other]of Object.entries(sources))if(owner!==game&&other.includes(name))throw Error(`${owner}: foreign storage key ${name} belongs to ${game}`);
   if(keys.has(name))throw Error(`${game}: duplicate storage key ${name}`);keys.set(name,game);
  }
 }
 return keys;
}
function sourceText(directory){return readdirSync(directory,{withFileTypes:true}).map(entry=>{const path=join(directory,entry.name);return entry.isDirectory()?sourceText(path):/\.(?:js|html)$/.test(entry.name)?readFileSync(path,'utf8'):'';}).join('\n');}
export function auditStorageDirectory(directory,options={}){return auditStorageText(Object.fromEntries(Object.keys(expectedStorageKeys(options)).map(id=>[id,sourceText(join(directory,id))])),options);}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2);if(args.length&&(args.length!==1||args[0]!=='--resources'))throw Error('Usage: audit-storage.mjs [--resources]');
  const resourceMode=args.length===1,root=fileURLToPath(new URL('../',import.meta.url)),integrations={};
  if(resourceMode)for(const source of JSON.parse(readFileSync(join(root,'resource-sources.lock.json'))).sources)if(source.resourceIntegration!==undefined){const reviewed=(source.id==='conway'&&source.revision===CONWAY_REVISION&&source.resourceIntegration===CONWAY_INTEGRATION)||(source.id==='eml'&&source.revision===EML_REVISION&&source.resourceIntegration===EML_INTEGRATION)||(source.id==='turing'&&source.revision===TURING_REVISION&&source.resourceIntegration===TURING_INTEGRATION);if(!reviewed)throw Error('Unreviewed resource storage source');integrations[source.id]=source.resourceIntegration;}
  const directory=join(root,resourceMode?'.build/resource-source-assets/games':'android/app/src/main/assets/games'),keys=auditStorageDirectory(directory,{resourceMode,integrations});
  console.log(`Verified ${keys.size} distinct storage keys in four ${resourceMode?'independent resource':'pinned APK'} bundles; no direct broad clear`);
 }catch(error){console.error(error.message);process.exitCode=1;}
}
