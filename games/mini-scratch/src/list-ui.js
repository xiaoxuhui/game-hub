import {validateLists} from './lists.js';
const pageSize=25;
const types={string:'文字',number:'数字',boolean:'布尔'};
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const option=(value,label)=>{const node=el('option','',label);node.value=value;return node;};
export function createListUI({getProject,onChange,isRunning,notice}){
  const dialog=el('dialog','list-dialog');dialog.setAttribute('aria-label','编辑列表初始项');dialog.id='listDialog';document.body.append(dialog);
  const close=el('button','dialog-close','×');close.setAttribute('aria-label','关闭列表编辑');close.addEventListener('click',()=>dialog.close());
  const title=el('h2'),rows=el('div','initial-list-rows'),status=el('p','list-edit-status');status.setAttribute('role','status');
  const controls=el('div','list-edit-controls'),add=el('button','button secondary','＋ 添加初始项'),clear=el('button','button secondary','清空初始项'),save=el('button','button primary','保存初始列表');controls.append(add,clear,save);
  const pages=el('div','list-pages'),prev=el('button','button secondary','上一页'),next=el('button','button secondary','下一页'),pageLabel=el('span');prev.setAttribute('aria-label','初始项上一页');next.setAttribute('aria-label','初始项下一页');pages.append(prev,pageLabel,next);
  dialog.append(close,el('div','eyebrow','YOUR COLLECTION'),title,el('p','tool-note','每项可选文字、数字或布尔。序号从 1 开始；运行时操作不会改写这里的初始内容。'),rows,pages,status,controls);
  let editing='',draft=[],page=0;
  function draw(){
    const count=Math.max(1,Math.ceil(draft.length/pageSize));page=Math.min(page,count-1);rows.replaceChildren();pageLabel.textContent=`第 ${page+1} / ${count} 页 · ${draft.length} 项`;prev.disabled=page===0;next.disabled=page===count-1;add.disabled=draft.length>=1000;
    if(!draft.length)rows.append(el('p','empty-list','空列表，点击“添加初始项”。'));
    for(let i=page*pageSize;i<Math.min(draft.length,(page+1)*pageSize);i++){
      const row=el('div','initial-list-row'),type=el('select');type.setAttribute('aria-label',`第${i+1}项类型`);for(const [value,label] of Object.entries(types))type.append(option(value,label));type.value=typeof draft[i];type.addEventListener('change',()=>{draft[i]=type.value==='number'?0:type.value==='boolean'?false:'';draw();});
      const input=typeof draft[i]==='boolean'?el('select'):el('input');input.setAttribute('aria-label',`第${i+1}项初始值`);if(typeof draft[i]==='boolean'){input.append(option('true','真'),option('false','假'));input.value=String(draft[i]);input.addEventListener('change',()=>draft[i]=input.value==='true');}else{input.type=typeof draft[i]==='number'?'number':'text';input.step='any';input.maxLength=80;input.value=draft[i];input.addEventListener('input',()=>{draft[i]=type.value==='number'?(input.value.trim()===''?NaN:Number(input.value)):input.value;});}
      const remove=el('button','text-button','×');remove.setAttribute('aria-label',`删除第${i+1}个初始项`);remove.addEventListener('click',()=>{draft.splice(i,1);draw();});row.append(el('span','list-index',String(i+1)),type,input,remove);rows.append(row);
    }
  }
  add.addEventListener('click',()=>{if(draft.length>=1000)return;draft.push('');page=Math.floor((draft.length-1)/pageSize);draw();});clear.addEventListener('click',()=>{draft=[];page=0;draw();});prev.addEventListener('click',()=>{page--;draw();});next.addEventListener('click',()=>{page++;draw();});
  save.addEventListener('click',()=>{if(isRunning())return;try{const project=getProject();if(!project.lists?.some(l=>l.name===editing))throw new Error('列表已删除');const lists=validateLists(project.lists.map(l=>l.name===editing?{...l,items:draft}:l));if(onChange({...project,lists})){dialog.close();notice('已保存列表初始项');}else status.textContent='保存未完成，请检查作品大小和参数';}catch(error){status.textContent=error.message;}});
  function open(name){if(isRunning())return;const list=getProject().lists?.find(l=>l.name===name);if(!list)return;editing=name;draft=[...list.items];page=0;status.textContent='';title.textContent='编辑初始列表：'+name;draw();dialog.showModal();}
  function renderTools(tools){
    tools.classList.add('list-tools');const heading=el('div','list-tools-heading','列表'),name=el('input');name.placeholder='列表名';name.maxLength=20;name.setAttribute('aria-label','新列表名称');const make=el('button','button primary','＋ 新建列表');name.disabled=isRunning();make.disabled=isRunning();
    function create(){let value=name.value.trim();if(!value){value='清单';let i=2;const used=new Set((getProject().lists||[]).map(l=>l.name));while(used.has(value))value='清单'+i++;}onChange({...getProject(),lists:[...(getProject().lists||[]),{name:value,items:[]}]});}make.addEventListener('click',create);name.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();create();}});tools.append(heading,name,make);
    for(const list of getProject().lists||[]){const row=el('div','list-declaration'),edit=el('button','text-button',list.name+' · '+list.items.length+' 项');edit.setAttribute('aria-label','编辑列表'+list.name+'初始项');edit.disabled=isRunning();edit.addEventListener('click',()=>open(list.name));const remove=el('button','text-button','×');remove.setAttribute('aria-label','删除列表'+list.name);remove.disabled=isRunning();remove.addEventListener('click',()=>onChange({...getProject(),lists:getProject().lists.filter(l=>l.name!==list.name)}));row.append(edit,remove);tools.append(row);}
    tools.append(el('p','tool-note','序号从 1 开始。插入位置为长度 + 1 时，放到末尾。'));
  }
  const watches=new Map();
  function drawWatch(watch){
    const {items,name,details,summary,body}=watch;summary.textContent=name+' · '+items.length+' 项';body.replaceChildren();if(!details.open)return;
    const count=Math.max(1,Math.ceil(items.length/pageSize));watch.page=Math.min(watch.page,count-1);const list=el('ol','list-watch-items');list.start=watch.page*pageSize+1;
    for(const value of items.slice(watch.page*pageSize,(watch.page+1)*pageSize)){const row=el('li');row.append(el('span','',String(value)),el('small','',types[typeof value]));list.append(row);}if(!items.length)body.append(el('p','empty-list','空列表'));else body.append(list);
    if(count>1){const pages=el('div','list-pages'),previous=el('button','text-button','上一页'),next=el('button','text-button','下一页');previous.setAttribute('aria-label',name+'运行值上一页');next.setAttribute('aria-label',name+'运行值下一页');previous.disabled=watch.page===0;next.disabled=watch.page===count-1;previous.addEventListener('click',()=>{watch.page--;drawWatch(watch);});next.addEventListener('click',()=>{watch.page++;drawWatch(watch);});pages.append(previous,el('span','',`${watch.page+1}/${count}`),next);body.append(pages);}
  }
  function renderMonitor(container,lists){
    for(const [name,watch] of watches)if(!lists.has(name)){watch.details.remove();watches.delete(name);}
    for(const [name,items] of lists){let watch=watches.get(name);if(!watch){const details=el('details','list-watch'),summary=el('summary'),body=el('div','list-watch-body');details.append(summary,body);container.append(details);watch={name,details,summary,body,page:0,signature:null,items};watches.set(name,watch);details.addEventListener('toggle',()=>drawWatch(watch));}watch.items=items;const signature=JSON.stringify(items);if(signature!==watch.signature){watch.signature=signature;drawWatch(watch);}}
  }
  return {renderTools,renderMonitor};
}
