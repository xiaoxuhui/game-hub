import {TYPES,block,uid,isExpression,expression} from './blocks.js';
const named=value=>{if(typeof value!=='string'||!value.trim()||value.trim().length>20||/[\u0000-\u001f]/.test(value))throw new Error('名称需要 1–20 个字符');return value.trim();};
export function primitive(value){if(typeof value==='string')return value.slice(0,80);if(typeof value==='boolean')return value;if(typeof value==='number'&&Number.isFinite(value))return value;throw new Error('参数必须是文字、有限数值或返回值积木');}
export function validateProject(raw){
  if(!raw||raw.version!==1||!Array.isArray(raw.blocks))throw new Error('项目格式不正确，请选择灵感积木 JSON 文件');
  const ids=new Set();let total=0,values=0;
  const field=(value,spec,depth=0)=>{
    if(++values>2000)throw new Error('参数节点过多');
    if(isExpression(value)){
      if(!spec.expression||depth>=8||!Object.hasOwn(TYPES,value.type)||!TYPES[value.type].reporter)throw new Error('返回值类型不正确或嵌套超过 8 层');
      const d=TYPES[value.type];return {type:value.type,...Object.fromEntries(Object.entries(d.fields).map(([key,s])=>[key,field(value[key],s,depth+1)]))};
    }
    if(spec.kind==='number'){
      if(value===''||value==null||typeof value==='boolean'||!['number','string'].includes(typeof value)||!Number.isFinite(Number(value)))throw new Error('积木参数必须是有效数字');
      return Math.max(spec.min,Math.min(spec.max,Number(value)));
    }
    if(spec.kind==='value')return primitive(value);
    if(spec.kind==='choice'){if(!spec.options.includes(value))throw new Error('积木选项无效');return value;}
    return named(value);
  };
  const parse=(items,depth)=>{
    if(!Array.isArray(items)||depth>8)throw new Error('积木嵌套最多 8 层');
    return items.map(item=>{
      if(++total>300)throw new Error('最多使用 300 块积木');
      if(!item||!Object.hasOwn(TYPES,item.type)||TYPES[item.type].reporter)throw new Error('包含未知积木或返回值放在了程序区');
      const d=TYPES[item.type];if((d.event||d.definition)&&depth!==0)throw new Error('事件与定义积木必须放在程序最外层');
      const id=typeof item.id==='string'&&item.id.length<100&&!ids.has(item.id)?item.id:uid();ids.add(id);
      const b={id,type:item.type,...Object.fromEntries(Object.entries(d.fields).map(([key,s])=>[key,field(item[key],s)]))};
      if(b.type==='repeat'&&!isExpression(b.value))b.value=Math.floor(b.value);
      if(d.container)b.children=parse(item.children,depth+1);
      if(d.otherwise)b.otherwise=parse(item.otherwise,depth+1);
      return b;
    });
  };
  const result={version:1,name:String(raw.name||'我的新作品').slice(0,40),sprite:['fox','rabbit','robot'].includes(raw.sprite)?raw.sprite:'fox',backdrop:['meadow','space','paper'].includes(raw.backdrop)?raw.backdrop:'meadow',blocks:parse(raw.blocks,0)};
  const definitions=result.blocks.filter(b=>b.type==='define').map(b=>b.name);
  if(new Set(definitions).size!==definitions.length)throw new Error('自制积木名称不能重复');
  if(raw.variables!==undefined){
    if(!Array.isArray(raw.variables)||raw.variables.length>30)throw new Error('变量最多 30 个');
    result.variables=raw.variables.map(item=>({name:named(item?.name),value:primitive(item?.value)}));
    if(new Set(result.variables.map(x=>x.name)).size!==result.variables.length)throw new Error('变量名称不能重复');
  }
  return result;
}
export function editTree(blocks,id,action){return blocks.flatMap((b,i)=>b.id===id?(action(b,i)??[]):({...b,...(b.children?{children:editTree(b.children,id,action)}:{}),...(b.otherwise?{otherwise:editTree(b.otherwise,id,action)}:{})}));}
export function moveInTree(blocks,id,direction){const out=[...blocks],i=out.findIndex(b=>b.id===id);if(i>=0){const j=i+direction;if(j>=0&&j<out.length)[out[i],out[j]]=[out[j],out[i]];return out;}return out.map(b=>({...b,...(b.children?{children:moveInTree(b.children,id,direction)}:{}),...(b.otherwise?{otherwise:moveInTree(b.otherwise,id,direction)}:{})}));}
export function findBlock(blocks,id){for(const b of blocks){if(b.id===id)return b;const found=findBlock(b.children||[],id)||findBlock(b.otherwise||[],id);if(found)return found;}}
export function countBlocks(blocks){return blocks.reduce((n,b)=>n+1+countBlocks(b.children||[])+countBlocks(b.otherwise||[]),0);}
export function isLegacyProject(project){const old=new Set(['move','turn','goto','say','wait','repeat','penDown','penUp','clear']);return !project.variables?.length && (function legacy(items){return items.every(b=>old.has(b.type)&&Object.values(b).every(v=>!isExpression(v))&&(!b.children||legacy(b.children)));})(project.blocks);}
export function example(key='square'){
  const square=[block('say',{value:'一起画一个正方形吧！'}),block('penDown'),block('repeat',{value:4,children:[block('move',{value:100}),block('turn',{value:90})]}),block('penUp'),block('say',{value:'完成啦！你也来试试 ✨'})];
  const flower=[block('penDown'),block('repeat',{value:12,children:[block('repeat',{value:4,children:[block('move',{value:70}),block('turn',{value:90})]}),block('turn',{value:30})]}),block('penUp'),block('say',{value:'送你一朵几何花！'})];
  const hello=[block('say',{value:'嗨！我是小狐狸 🦊'}),block('wait'),block('move',{value:80}),block('turn',{value:180}),block('move',{value:160}),block('say',{value:'积木让想法动起来！'})];
  const dance=[block('define',{name:'小舞步',parameter:'步数',children:[block('move',{value:expression('argument')}),block('turn',{value:45}),block('note',{value:60,seconds:0.15})]}),block('whenKey',{key:'space',children:[block('changeVar',{name:'分数',value:1}),block('call',{name:'小舞步',value:expression('add',{a:20,b:expression('variable',{name:'分数'})})}),block('say',{value:expression('join',{a:'按空格跳舞，分数：',b:expression('variable',{name:'分数'})})})]}),block('whenClick',{children:[block('broadcast',{name:'欢呼'})]}),block('whenMessage',{name:'欢呼',children:[block('say',{value:'点击和广播都成功啦！'}),block('note',{value:72,seconds:0.2})]}),block('say',{value:'按空格键跳舞，或点击我试试！'})];
  const names={square:'小狐狸画方形',flower:'绽放的几何花',hello:'小狐狸打招呼',dance:'积木音乐派对'};
  return {version:1,name:names[key]||names.square,sprite:'fox',backdrop:'meadow',blocks:({square,flower,hello,dance}[key]||square),...(key==='dance'?{variables:[{name:'分数',value:0}]}:{})};
}
