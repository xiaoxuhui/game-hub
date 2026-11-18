import {TYPES,block} from './blocks.js';
export function migrateEventScripts(project){
  if(project.eventScripts===true)return project;
  const loose=b=>!TYPES[b.type]?.event&&!TYPES[b.type]?.definition,actions=project.blocks.filter(loose);
  // Legacy start queued the loose script before every explicit green-flag hat.
  const hat=actions.length?block('whenFlag',{children:actions}):null;
  const blocks=[...(hat?[hat]:[]),...project.blocks.filter(b=>!loose(b))];
  return {...project,eventScripts:true,blocks};
}
export function matchesEvent(project,kind,value){return project.blocks.some(b=>kind==='key'?b.type==='whenKey'&&b.key===value:kind==='click'?b.type==='whenClick':kind==='flag'?b.type==='whenFlag':false);}
