import {TYPES,block} from './blocks.js';
export function migrateEventScripts(project){
  if(project.eventScripts===true)return project;
  const loose=b=>!TYPES[b.type]?.event&&!TYPES[b.type]?.definition,actions=project.blocks.filter(loose);
  const hat=actions.length?block('whenFlag',{children:actions}):null;let inserted=false;
  const blocks=project.blocks.flatMap(b=>{if(!loose(b))return [b];if(inserted)return [];inserted=true;return [hat];});
  return {...project,eventScripts:true,blocks};
}
export function matchesEvent(project,kind,value){return project.blocks.some(b=>kind==='key'?b.type==='whenKey'&&b.key===value:kind==='click'?b.type==='whenClick':kind==='flag'?b.type==='whenFlag':false);}
