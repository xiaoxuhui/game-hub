import {TYPES,CATEGORIES,block,expression,isExpression,findBlock,editTree,moveInTree,countBlocks,evaluate,truth} from './core.js';
import {fieldsFor,readField,writeField,signature,migrateProcedures,updateSignature,parameterDefault,parameterTypeNames,valueLabel,isBoolean} from './procedures.js';
const $=id=>document.getElementById(id);
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
const option=(value,label)=>{const node=el('option','',label);node.value=value;return node;};
const keyNames={space:'空格',ArrowLeft:'← 左',ArrowRight:'右 →',ArrowUp:'↑ 上',ArrowDown:'↓ 下',meadow:'青草地',spaceBackdrop:'星空',paper:'方格纸'};
function labelOption(value,field){return field.label==='背景'&&value==='space'?'星空':keyNames[value]||value;}
export function createEditor({getProject,isRunning,onChange,notice,getState,getSensing,onAssets,renderListTools}){
  let category='events',target={id:'root',branch:'children'},activeSlot=null;
  const fieldLabel=(b,key)=>`${TYPES[b.type].label} · ${fieldsFor(b,getProject())[key].label}`;
  const defaults=type=>{const b=block(type),project=getProject();for(const [key,f] of Object.entries(TYPES[type].fields)){if(f.kind==='variable')b[key]=project.variables?.[0]?.name||'分数';if(f.kind==='list')b[key]=project.lists?.[0]?.name||'清单';if(f.kind==='procedure')b[key]=project.blocks.find(x=>x.type==='define')?.name||'小舞步';if(f.kind==='sound')b[key]=project.assets?.sounds[0]?.id||'';}if(type==='define'){b.parameters=[];delete b.parameter;}if(type==='call'){const def=project.blocks.find(x=>x.type==='define'&&x.name===b.name);b.arguments=(def?signature(def):[]).map(p=>({parameterId:p.id,value:parameterDefault(p.type)}));delete b.value;}return b;};
  const reporter=type=>{const {id,...value}=defaults(type);return value;};
  function changedField(id,key,value,options={}){const p=getProject(),old=findBlock(p.blocks,id);let next=writeField(old,key,value);if(old.type==='call'&&key==='name'&&old.arguments){const def=p.blocks.find(x=>x.type==='define'&&x.name===value);next.arguments=(def?signature(def):[]).map(p=>({parameterId:p.id,value:parameterDefault(p.type)}));options={...options,render:true};}let blocks=editTree(p.blocks,id,()=>next);if(old.type==='define'&&key==='name'){const rename=items=>items.map(b=>({...b,...(b.type==='call'&&b.name===old.name?{name:value}:{}),...(b.children?{children:rename(b.children)}:{}),...(b.otherwise?{otherwise:rename(b.otherwise)}:{})}));blocks=rename(blocks);}return onChange({...p,blocks},options);}
  function add(type){
    if(isRunning())return;
    const d=TYPES[type];if(type.startsWith('list')&&!getProject().lists?.length){notice('先在变量分类点击“新建列表”');return;}if(d.reporter){openExpression(null,null,reporter(type));return;}
    let p=getProject();const added=defaults(type);
    if(type==='define'){const used=new Set(p.blocks.filter(b=>b.type==='define').map(b=>b.name));let i=2;while(used.has(added.name))added.name='小舞步'+i++;}
    if((type==='setVar'||type==='changeVar')&&!p.variables?.length)p={...p,variables:[{name:'分数',value:0}]};
    const dest=d.event||d.definition?{id:'root',branch:'children'}:target;
    const blocks=dest.id==='root'?[...p.blocks,added]:editTree(p.blocks,dest.id,b=>({...b,[dest.branch]:[...b[dest.branch],added]}));
    if(onChange({...p,blocks})){if(d.event){target={id:added.id,branch:'children'};renderScript();}notice('已添加'+d.label+'积木'+(d.event?'，接下来添加的动作放在这个事件里':''));}
  }
  function choices(field,value){const p=getProject();let entries=field.options||[];if(field.kind==='variable')entries=(p.variables||[]).map(v=>v.name);if(field.kind==='list')entries=(p.lists||[]).map(l=>l.name);if(field.kind==='procedure')entries=p.blocks.filter(b=>b.type==='define').map(b=>b.name);if(field.kind==='sound')entries=(p.assets?.sounds||[]).map(x=>x.id);if(field.label==='背景')entries=[...entries,...(p.assets?.backdrops||[]).map(x=>x.id)];if(!entries.includes(value))entries=[value,...entries];return entries;}
  function choiceLabel(value,spec){return (getProject().assets?.sounds||[]).concat(getProject().assets?.backdrops||[]).find(x=>x.id===value)?.name||(spec.kind==='sound'&&value===''?'请先录入声音':labelOption(value,spec));}
  function fieldControl(b,key,spec){
    const value=readField(b,key),boolean=spec.valueType==='boolean'||isBoolean(value,getProject()),slot=el('span','parameter-slot'+(boolean?' boolean-slot':''));slot.dataset.id=b.id;slot.dataset.field=key;
    let input;
    if(isExpression(value)){
      input=el('button',`expression-chip ${TYPES[value.type].category}${isBoolean(value,getProject())?' boolean-value':''}`,valueLabel(value,getProject()));input.type='button';input.setAttribute('aria-label','编辑'+fieldLabel(b,key)+'返回值');input.addEventListener('click',()=>openExpression(b.id,key));
    }else if(boolean){input=el('select');input.append(option('true','真'),option('false','假'));input.value=String(truth(value));input.addEventListener('change',()=>changedField(b.id,key,input.value==='true'));
    }else if(['choice','variable','procedure','sound','list'].includes(spec.kind)){
      input=el('select');for(const item of choices(spec,value))input.append(option(item,choiceLabel(item,spec)));input.value=value;input.addEventListener('change',()=>changedField(b.id,key,input.value));
    }else{
      input=el('input');input.type=spec.kind==='number'?'number':'text';input.value=value;input.maxLength=spec.kind==='name'?20:80;
      if(input.type==='number'){input.min=spec.min;input.max=spec.max;input.step=b.type==='repeat'?'1':'any';}
      let recorded=false;
      const commit=()=>{if(input.value===''&&input.type==='number')return false;const next=input.type==='number'?Number(input.value):input.value;const same=JSON.stringify(readField(findBlock(getProject().blocks,b.id),key))===JSON.stringify(next);if(same)return true;const ok=changedField(b.id,key,next,{render:false,record:!recorded,quiet:true});if(ok)recorded=true;return ok;};
      input.addEventListener('input',commit);input.addEventListener('blur',()=>{if(!commit())notice('请输入有效参数');input.value=readField(findBlock(getProject().blocks,b.id),key)??value;recorded=false;});
    }
    input.disabled=isRunning();input.setAttribute('aria-label',isExpression(value)?'编辑'+fieldLabel(b,key)+'返回值':fieldLabel(b,key));input.addEventListener('dragstart',e=>e.preventDefault());slot.append(input);
    if(spec.expression){const edit=el('button','value-button','◇');edit.type='button';edit.disabled=isRunning();edit.title='插入或编辑返回值';edit.setAttribute('aria-label','设置'+fieldLabel(b,key)+'返回值');edit.addEventListener('click',()=>openExpression(b.id,key));slot.append(edit);slot.classList.add('accepts-expression');}
    return slot;
  }
  function signatureEditor(b){
    const box=el('div','signature-editor'),params=signature(b);
    box.append(el('p','signature-hint','参数名可直接拖入定义内的白色参数，也可点击放入。'));
    for(const p of params){
      const row=el('div','signature-row'),value=expression('parameter',{definitionId:b.id,parameterId:p.id}),chip=el('button','parameter-name custom'+(p.type==='boolean'?' boolean-value':''),p.name);chip.draggable=!isRunning();chip.disabled=isRunning();chip.setAttribute('aria-label','使用参数'+p.name);chip.addEventListener('dragstart',e=>{e.stopPropagation();e.dataTransfer.setData('application/x-block',JSON.stringify({expression:value}));e.dataTransfer.effectAllowed='copy';});chip.addEventListener('click',()=>openExpression(null,null,value));
      const name=el('input');name.value=p.name;name.maxLength=20;name.disabled=isRunning();name.setAttribute('aria-label','参数名称 '+p.name);let recorded=false;const rename=quiet=>{const current=getProject().blocks.find(x=>x.id===b.id);const ok=onChange(updateSignature(getProject(),b.id,signature(current).map(x=>x.id===p.id?{...x,name:name.value}:x)),{render:false,record:!recorded,quiet});if(ok)recorded=true;return ok;};name.addEventListener('input',()=>rename(true));name.addEventListener('blur',()=>{rename(false);renderScript();renderPalette();});
      const type=el('select');type.disabled=isRunning();type.setAttribute('aria-label','参数类型 '+p.name);for(const [key,label] of Object.entries(parameterTypeNames))type.append(option(key,label));if(p.legacy)type.append(option('legacy','旧值'));type.value=p.legacy?'legacy':p.type;if(p.legacy)type.title='旧参数保留原值；选择类型后启用转换';type.addEventListener('change',()=>onChange(updateSignature(getProject(),b.id,params.map(x=>x.id===p.id?{id:x.id,name:x.name,type:type.value}:x))));
      const remove=el('button','text-button','×');remove.disabled=isRunning();remove.setAttribute('aria-label','删除参数'+p.name);remove.addEventListener('click',()=>onChange(updateSignature(getProject(),b.id,params.filter(x=>x.id!==p.id))));row.append(chip,name,type,remove);box.append(row);
    }
    const add=el('button','add-parameter','＋ 添加参数');add.disabled=isRunning();add.addEventListener('click',()=>{const used=new Set(params.map(p=>p.name));let i=params.length+1;while(used.has('参数'+i))i++;const id=block('move').id;onChange(updateSignature(getProject(),b.id,[...params,{id,name:'参数'+i,type:'number'}]));});box.append(add);return box;
  }
  function buildList(blocks,id='root',branch='children'){
    const list=el('div','block-list');list.dataset.target=id;list.dataset.branch=branch;
    for(const b of blocks){
      const d=TYPES[b.type],controlFrame=d.category==='control'&&d.container,wrapper=el('div',`code-block ${d.category}${controlFrame?' control-frame':''}${d.event?' event-hat event-script':''}${d.definition?' definition-block':''}${id==='root'&&!d.event&&!d.definition?' unattached-block':''}`);wrapper.dataset.id=b.id;
      const row=el('div','block-row');row.draggable=!isRunning();row.append(el('span','grip','⠿'),el('span','block-label',d.label));
      if(id==='root'&&(d.event||d.definition))wrapper.append(el('div','script-group-label',d.definition?'自制积木定义':'独立事件脚本'));
      const fields=fieldsFor(b,getProject());for(const [key,spec] of Object.entries(fields)){if(Object.keys(fields).length>1)row.append(el('span','field-label',spec.label));row.append(fieldControl(b,key,spec));}
      if(d.unit)row.append(document.createTextNode(d.unit));
      const actions=el('span','block-actions');for(const [text,label,dir] of [['↑','上移',-1],['↓','下移',1],['×','删除',0]]){const btn=el('button','',text);btn.disabled=isRunning();btn.setAttribute('aria-label',label+d.label+'积木');btn.addEventListener('click',()=>onChange({...getProject(),blocks:dir?moveInTree(getProject().blocks,b.id,dir):editTree(getProject().blocks,b.id,()=>[])}));actions.append(btn);}row.append(actions);wrapper.append(row);
      row.addEventListener('dragstart',e=>{if(isRunning()){e.preventDefault();return;}e.stopPropagation();e.dataTransfer.setData('application/x-block',JSON.stringify({id:b.id}));e.dataTransfer.effectAllowed='move';});
      if(d.definition)wrapper.append(signatureEditor(b));
      for(const branchKey of ['children','otherwise'])if(b[branchKey]){
        const body=el('div','repeat-body');if(branchKey==='otherwise')body.append(el('div','branch-title','否则'));
        body.append(buildList(b[branchKey],b.id,branchKey));const selected=target.id===b.id&&target.branch===branchKey;
        const addHere=el('button','add-here',selected?'✓ 积木将添加在这里':'＋ 向此处添加积木');addHere.disabled=isRunning();addHere.setAttribute('aria-label',`向${d.label}${branchKey==='otherwise'?'否则':'执行'}分支添加积木`);addHere.addEventListener('click',()=>{target={id:b.id,branch:branchKey};renderScript();notice('现在点击积木盒中的积木，就会加入此分支');});body.append(addHere);wrapper.append(body);
      }
      if(controlFrame)wrapper.append(el('div','control-end'));
      list.append(wrapper);
    }
    if(!blocks.length&&id!=='root')list.append(el('div','empty-drop','拖入积木，或点下方添加'));
    return list;
  }
  function renderScript(){
    const p=getProject();if(target.id!=='root'&&!findBlock(p.blocks,target.id))target={id:'root',branch:'children'};
    const next=buildList(p.blocks);next.id='script';next.classList.add('root-list');
    if(!p.blocks.length)next.append(el('p','empty-event-tip','从“事件”选择一种启动方式，再添加动作。没有固定主程序。'));
    if(p.blocks.some(b=>!TYPES[b.type].event&&!TYPES[b.type].definition))next.prepend(el('p','unattached-note','未连接事件的积木不会自动运行，请放入一个事件脚本。'));
    const addRoot=el('button','add-root',target.id==='root'?'＋ 在外层添加事件或游离积木':'＋ 改为在外层添加独立脚本');addRoot.id='addRootButton';addRoot.disabled=isRunning();addRoot.addEventListener('click',()=>{target={id:'root',branch:'children'};renderScript();notice('接下来添加到外层；动作需要连接事件才会执行');});next.append(addRoot);$('script').replaceWith(next);$('blockCount').textContent=`${countBlocks(p.blocks)} 块积木 · ${p.blocks.filter(b=>TYPES[b.type].event).length} 个事件`;
  }
  function renderTools(){
    const tools=$('categoryTools');tools.replaceChildren();tools.classList.remove('list-tools');const p=getProject();
    if(category==='variables'){
      const name=el('input');name.placeholder='变量名';name.maxLength=20;name.setAttribute('aria-label','新变量名称');
      const addVar=el('button','button primary','＋ 新建变量');addVar.disabled=isRunning();addVar.addEventListener('click',()=>onChange({...getProject(),variables:[...(getProject().variables||[]),{name:name.value.trim()||'分数',value:0}]}));tools.append(name,addVar);
      for(const variable of p.variables||[]){const row=el('div','variable-declaration');row.append(el('span','',variable.name));const value=el('input');value.value=variable.value;value.setAttribute('aria-label',variable.name+'初始值');value.disabled=isRunning();value.addEventListener('change',()=>{const n=Number(value.value),initial=value.value.trim()!==''&&Number.isFinite(n)?n:value.value;onChange({...getProject(),variables:getProject().variables.map(v=>v.name===variable.name?{...v,value:initial}:v)});});const remove=el('button','text-button','×');remove.disabled=isRunning();remove.setAttribute('aria-label','删除变量'+variable.name);remove.addEventListener('click',()=>onChange({...getProject(),variables:getProject().variables.filter(v=>v.name!==variable.name)}));row.append(value,remove);tools.append(row);}
      renderListTools(tools);
    }
    if(category==='custom'){tools.append(el('p','tool-note','定义内添加数字、文字或布尔参数，直接拖动参数名使用。'));}
    if(category==='sound'){const record=el('button','button primary','● 录入 / 管理声音');record.disabled=isRunning();record.addEventListener('click',()=>onAssets('sounds'));tools.append(record);}
    if(['sensing','operators','motion','looks'].includes(category))tools.append(el('p','tool-note','取值积木可拖进参数，也可点击选择位置。数字/文字为圆角，真假为六边形。'));
  }
  function renderPalette(){
    $('palette').replaceChildren();$('categoryName').textContent=CATEGORIES[category]+'积木';document.querySelectorAll('[data-category]').forEach(btn=>btn.classList.toggle('active',btn.dataset.category===category));renderTools();
    for(const [type,d] of Object.entries(TYPES)){
      if(d.category!==category||d.hidden||type==='argument')continue;const controlFrame=category==='control'&&d.container,btn=el('button',`palette-block ${category}${controlFrame?' control-frame':''}${d.reporter?' reporter':''}${d.valueType==='boolean'?' boolean-value':''}`);btn.draggable=!isRunning();btn.disabled=isRunning();btn.dataset.type=type;btn.setAttribute('aria-label',`添加${d.label}${d.reporter?'返回值':'积木'}`);const head=controlFrame?el('span','palette-head'):btn;head.append(document.createTextNode(d.label+' '));
      const paletteFields=type==='define'?{name:d.fields.name}:type==='call'?fieldsFor(defaults(type),getProject()):d.fields;for(const [key,spec] of Object.entries(paletteFields)){const sample=key.startsWith('arg:')?spec.label:spec.kind==='list'?(getProject().lists?.[0]?.name||spec.default):isExpression(spec.default)?TYPES[spec.default.type].label:labelOption(spec.default,spec);head.append(el('span','sample-value'+(spec.valueType==='boolean'||isBoolean(spec.default,getProject())?' boolean-value':''),String(sample)));}
      if(controlFrame){btn.append(head,el('span','palette-cavity'));if(d.otherwise)btn.append(el('span','palette-else','否则'),el('span','palette-cavity'));btn.append(el('span','control-end'));}
      btn.addEventListener('click',()=>add(type));btn.addEventListener('dragstart',e=>{e.dataTransfer.setData('application/x-block',JSON.stringify({type}));e.dataTransfer.effectAllowed='copy';});$('palette').append(btn);
    }
  }
  function listSlots(){const out=[];const walk=(items,definitionId)=>{for(const b of items){const owner=b.type==='define'?b.id:definitionId;for(const [field,spec] of Object.entries(fieldsFor(b,getProject())))if(spec.expression)out.push({id:b.id,field,definitionId:owner,label:fieldLabel(b,field)+` (${out.length+1})`});walk(b.children||[],owner);walk(b.otherwise||[],owner);}};walk(getProject().blocks);return out;}
  function openExpression(id,field,replacement){
    if(isRunning())return;const slots=listSlots().filter(s=>replacement?.type!=='parameter'||s.definitionId===replacement.definitionId);if(!slots.length){notice(replacement?.type==='parameter'?'先在这个定义内部添加一块带参数的积木':'先添加一块带参数的积木，再把返回值放入参数');return;}
    const dialog=$('expressionDialog'),targetSelect=$('expressionTarget');targetSelect.replaceChildren(...slots.map((s,i)=>option(String(i),s.label)));
    let chosen=slots.findIndex(s=>s.id===(id||activeSlot?.id)&&s.field===(field||activeSlot?.field));if(chosen<0)chosen=0;targetSelect.value=String(chosen);
    let draft=structuredClone(replacement??readField(findBlock(getProject().blocks,slots[chosen].id),slots[chosen].field));
    function choose(){const index=Number(targetSelect.value);return slots[index];}
    function preview(){try{$('expressionPreview').textContent='当前预览：'+String(evaluate(draft,{state:getState(),sensing:getSensing,clock:()=>performance.now()/1000}));}catch(error){$('expressionPreview').textContent='运行时取值 · '+error.message;}}
    function node(value,setValue,depth=0){
      const wrapper=el('div','expression-node'),type=el('select');type.setAttribute('aria-label',depth===0?'返回值类型':`第${depth}层返回值类型`);type.append(option('literal','直接输入值'));
      const def=getProject().blocks.find(b=>b.id===choose().definitionId),parameters=new Map((def?.parameters||[]).map(p=>['param:'+p.id,expression('parameter',{definitionId:def.id,parameterId:p.id})]));
      if(depth<8)for(const [categoryId,name] of Object.entries(CATEGORIES)){const group=el('optgroup');group.label=name;for(const [key,d] of Object.entries(TYPES))if(d.category===categoryId&&d.reporter&&!d.hidden&&key!=='argument')group.append(option(key,d.label));if(categoryId==='custom')for(const [key,v] of parameters)group.append(option(key,valueLabel(v,getProject())));if(group.children.length)type.append(group);}
      type.value=isExpression(value)?value.type==='parameter'?'param:'+value.parameterId:value.type:'literal';type.addEventListener('change',()=>{setValue(type.value==='literal'?0:parameters.get(type.value)||reporter(type.value));draw();});wrapper.append(type);
      if(!isExpression(value)){
        const kind=el('select');kind.setAttribute('aria-label','输入值类型');kind.append(option('number','数值'),option('string','文字'),option('boolean','布尔'));kind.value=typeof value;
        const input=typeof value==='boolean'?el('select'):el('input');input.setAttribute('aria-label','直接输入值');if(typeof value==='boolean')input.append(option('true','真'),option('false','假'));input.value=String(value);input.maxLength=80;const update=()=>{setValue(kind.value==='number'?Number(input.value):kind.value==='boolean'?input.value==='true':input.value);preview();};input.addEventListener('input',update);kind.addEventListener('change',()=>{setValue(parameterDefault(kind.value));draw();});wrapper.append(kind,input);if(typeof value==='boolean')wrapper.append(el('span','boolean-example boolean-value','真 / 假'));
      }else{
        wrapper.classList.add(TYPES[value.type].category+'-value');if(isBoolean(value,getProject()))wrapper.append(el('span','boolean-example boolean-value',valueLabel(value,getProject())));if(value.type==='parameter')wrapper.append(el('p','tool-note','参数：'+valueLabel(value,getProject())));else for(const [key,spec] of Object.entries(TYPES[value.type].fields)){const group=el('div','expression-field');group.append(el('label','',spec.label));if(spec.expression)group.append(node(value[key],next=>{value[key]=next;},depth+1));else{const input=el('select');input.setAttribute('aria-label','返回值'+spec.label);for(const item of choices(spec,value[key]))input.append(option(item,choiceLabel(item,spec)));input.value=value[key];input.addEventListener('change',()=>{value[key]=input.value;preview();});group.append(input);}wrapper.append(group);}
      }
      return wrapper;
    }
    function draw(){$('expressionTree').replaceChildren(node(draft,value=>{draft=value;}));preview();}
    targetSelect.onchange=()=>{const s=choose();draft=structuredClone(replacement??readField(findBlock(getProject().blocks,s.id),s.field));draw();};
    $('applyExpression').onclick=()=>{const s=choose();if(changedField(s.id,s.field,draft)){activeSlot=s;dialog.close();}};
    $('clearExpression').onclick=()=>{const s=choose(),b=findBlock(getProject().blocks,s.id);draft=structuredClone(fieldsFor(b,getProject())[s.field].default);if(isExpression(draft))draft=true;draw();};
    draw();dialog.showModal();
  }
  document.querySelectorAll('[data-category]').forEach(btn=>btn.addEventListener('click',()=>{category=btn.dataset.category;renderPalette();}));
  $('closeExpression').addEventListener('click',()=>$('expressionDialog').close());
  document.addEventListener('dragover',e=>{if(isRunning()||!Array.from(e.dataTransfer.types).includes('application/x-block'))return;const dest=e.target.closest('.accepts-expression')||e.target.closest('.block-list');if(!dest)return;e.preventDefault();document.querySelectorAll('.drag-over').forEach(n=>n.classList.remove('drag-over'));dest.classList.add('drag-over');});
  document.addEventListener('dragend',()=>document.querySelectorAll('.drag-over').forEach(n=>n.classList.remove('drag-over')));
  document.addEventListener('drop',e=>{
    document.querySelectorAll('.drag-over').forEach(n=>n.classList.remove('drag-over'));if(isRunning())return;
    try{const raw=e.dataTransfer.getData('application/x-block');if(!raw)return;const data=JSON.parse(raw),d=data.type&&TYPES[data.type],slot=e.target.closest('.accepts-expression');
      if(d?.reporter||data.expression){e.preventDefault();if(!slot){notice('返回值积木要放进白色参数中');return;}const value=data.expression||reporter(data.type);if(value.type==='parameter'&&!listSlots().some(s=>s.id===slot.dataset.id&&s.field===slot.dataset.field&&s.definitionId===value.definitionId)){notice('参数只能放在所属定义内部');return;}changedField(slot.dataset.id,slot.dataset.field,value);return;}
      const list=e.target.closest('.block-list');if(!list)return;e.preventDefault();const p=getProject(),moving=data.id?findBlock(p.blocks,data.id):defaults(data.type);if(!moving)return;
      const parent=list.dataset.target,branch=list.dataset.branch;if(parent===moving.id||findBlock(moving.children||[],parent)||findBlock(moving.otherwise||[],parent)){notice('不能放进自己的分支');return;}
      const row=e.target.closest('.block-row'),before=row?.parentElement.parentElement===list?row.parentElement.dataset.id:null;if(before===moving.id)return;
      let blocks=data.id?editTree(p.blocks,data.id,()=>[]):p.blocks;
      const insert=items=>{const copy=[...items],i=copy.findIndex(b=>b.id===before);copy.splice(i<0?copy.length:i,0,moving);return copy;};blocks=parent==='root'?insert(blocks):editTree(blocks,parent,b=>({...b,[branch]:insert(b[branch])}));
      onChange({...p,blocks,...((moving.type==='setVar'||moving.type==='changeVar')&&!p.variables?.length?{variables:[{name:'分数',value:0}]}:{})});
    }catch(error){notice(error.message);}
  });
  return {render(){renderPalette();renderScript();},renderScript,resetTarget(){target={id:'root',branch:'children'};category='events';activeSlot=null;},add};
}
