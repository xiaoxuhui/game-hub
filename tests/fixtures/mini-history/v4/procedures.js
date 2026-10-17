import {TYPES,uid,isExpression} from './blocks.js';
export const parameterDefault=type=>type==='boolean'?false:type==='string'?'':0;
export const parameterTypeNames={number:'数字',string:'字符串',boolean:'布尔'};
export function signature(def){return def?.parameters||[{id:'legacy',name:def?.parameter||'参数',type:'number'}];}
export function fieldsFor(b,project){
  if(b.type==='define'&&b.parameters)return {name:TYPES.define.fields.name};
  if(b.type!=='call'||!b.arguments)return TYPES[b.type].fields;
  const def=project.blocks.find(x=>x.type==='define'&&x.name===b.name),fields={name:TYPES.call.fields.name};
  for(const p of def?signature(def):[])fields['arg:'+p.id]={kind:'value',label:p.name,default:parameterDefault(p.type),expression:true,valueType:p.type};return fields;
}
export const readField=(b,key)=>key.startsWith('arg:')?b.arguments?.find(a=>a.parameterId===key.slice(4))?.value:b[key];
export function writeField(b,key,value){if(!key.startsWith('arg:'))return {...b,[key]:value};const id=key.slice(4);return {...b,arguments:[...(b.arguments||[]).filter(a=>a.parameterId!==id),{parameterId:id,value}]};}
export function parameterInfo(value,project){return project.blocks.find(b=>b.id===value.definitionId)?.parameters?.find(p=>p.id===value.parameterId);}
export function valueLabel(value,project){if(value.type==='parameter')return parameterInfo(value,project)?.name||'已删除参数';return TYPES[value.type]?.label||'未知返回值';}
export function isBoolean(value,project){return typeof value==='boolean'||isExpression(value)&&(TYPES[value.type]?.valueType==='boolean'||value.type==='parameter'&&parameterInfo(value,project)?.type==='boolean');}
export function migrateProcedures(project){
  const out=structuredClone(project),defs=out.blocks.filter(b=>b.type==='define');
  for(const def of defs)if(!def.parameters){def.parameters=[{id:uid(),name:def.parameter,type:'number',legacy:true}];delete def.parameter;}
  function values(value,def){if(!isExpression(value))return value;if(value.type==='argument'&&def)return {type:'parameter',definitionId:def.id,parameterId:def.parameters[0]?.id||'legacy'};return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,values(v,def)]));}
  function walk(items,scope){for(const b of items){const def=b.type==='define'?b:scope;if(b.type==='call'&&!b.arguments){const target=defs.find(d=>d.name===b.name);b.arguments=signature(target).map((p,i)=>({parameterId:p.id,value:i===0?values(b.value,def):parameterDefault(p.type)}));delete b.value;}for(const key of Object.keys(b))if(!['children','otherwise','arguments','parameters'].includes(key))b[key]=values(b[key],def);if(b.arguments)for(const arg of b.arguments)arg.value=values(arg.value,def);if(b.children)walk(b.children,def);if(b.otherwise)walk(b.otherwise,def);}}walk(out.blocks);return out;
}
export function updateSignature(project,definitionId,parameters){
  const out=migrateProcedures(project),def=out.blocks.find(b=>b.id===definitionId);if(!def)throw new Error('定义不存在');const old=def.parameters;def.parameters=parameters;
  const removed=old.filter(p=>!parameters.some(n=>n.id===p.id));
  function value(v){if(!isExpression(v))return v;if(v.type==='parameter'&&v.definitionId===definitionId){const p=removed.find(x=>x.id===v.parameterId);if(p)return parameterDefault(p.type);}return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,value(x)]));}
  function walk(items){for(const b of items){for(const key of Object.keys(b))if(!['children','otherwise','arguments','parameters'].includes(key))b[key]=value(b[key]);if(b.arguments)for(const arg of b.arguments)arg.value=value(arg.value);if(b.type==='call'&&b.name===def.name)b.arguments=parameters.map(p=>({parameterId:p.id,value:b.arguments?.find(a=>a.parameterId===p.id)?.value??parameterDefault(p.type)}));if(b.children)walk(b.children);if(b.otherwise)walk(b.otherwise);}}walk(out.blocks);return out;
}
