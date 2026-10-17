import {readFileSync} from 'node:fs';
const directory=version=>new URL(`./v${version}/`,import.meta.url);
export function historicalSample(version){return readFileSync(new URL('sample.json',directory(version)),'utf8');}
export async function historicalReader(version,entries){
  const map=new Map(entries),root=directory(version);
  if(version===1){const {validateProject}=await import(new URL('core.js',root));return validateProject(JSON.parse(map.get('inspiration-blocks-v1')));}
  const {loadProject}=await import(new URL('persistence.js',root));return loadProject({getItem:key=>map.get(key)??null});
}
