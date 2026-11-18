export const LIST_LIMIT=1000;
export const LIST_TOTAL_LIMIT=5000;
export function listValue(value){if(typeof value==='string')return value.slice(0,80);if(typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;throw new Error('列表项必须是文字、有限数字或布尔值');}
export function validateLists(raw){
  if(!Array.isArray(raw)||raw.length>30)throw new Error('列表最多 30 个');const names=new Set();let total=0;
  return raw.map(list=>{const name=list?.name;if(typeof name!=='string'||!name.trim()||name.trim().length>20||/[\u0000-\u001f]/.test(name))throw new Error('列表名称需要 1–20 个字符');const trimmed=name.trim();if(names.has(trimmed))throw new Error('列表名称不能重复');names.add(trimmed);if(!Array.isArray(list.items)||list.items.length>LIST_LIMIT)throw new Error('每个列表最多 1000 项');total+=list.items.length;if(total>LIST_TOTAL_LIMIT)throw new Error('列表合计最多 5000 项');return {name:trimmed,items:list.items.map(listValue)};});
}
export function getList(state,name){if(!state.lists?.has(name))throw new Error('列表不存在：'+name);return state.lists.get(name);}
export function listIndex(value,length,insert=false){const index=typeof value==='boolean'||value==null||String(value).trim()===''?NaN:Number(value);if(!Number.isInteger(index)||index<1||index>length+(insert?1:0))throw new Error('列表序号从 1 开始，需为有效整数'+(insert?'（插入允许长度 + 1）':''));return index-1;}
export function mutateList(state,b,read){
  const items=getList(state,b.name);if(b.type==='listClear'){items.length=0;return;}
  if(b.type==='listDelete'){const index=listIndex(read('index'),items.length);items.splice(index,1);return;}
  const value=listValue(read('value'));
  if(b.type==='listReplace'){const index=listIndex(read('index'),items.length);items[index]=value;return;}
  if(items.length>=LIST_LIMIT)throw new Error('每个列表最多 1000 项');if([...state.lists.values()].reduce((n,list)=>n+list.length,0)>=LIST_TOTAL_LIMIT)throw new Error('列表合计最多 5000 项');
  if(b.type==='listAdd'){items.push(value);return;}if(b.type==='listInsert'){const index=listIndex(read('index'),items.length,true);items.splice(index,0,value);return;}
  throw new Error('未知列表操作');
}
