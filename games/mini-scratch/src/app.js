import {TYPES,validateProject,example,initialState,createRuntime} from './core.js';
import {createEditor} from './editor.js';
import {createAudio} from './audio.js';
import {SPRITES} from './sprites.js';
import {loadProject,saveProject} from './persistence.js';
import {createAssetEditor} from './asset-editor.js';
import {migrateProcedures} from './procedures.js';
import {PROJECT_BUDGET} from './assets.js';
import {migrateEventScripts,matchesEvent} from './events.js';
import {createListUI} from './list-ui.js';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const names={fox:'小狐狸',rabbit:'小兔子',robot:'小机器人'},backdrops={meadow:'青草地',space:'星空',paper:'方格纸'};
const history=[],audio=createAudio(()=>{if(state)renderStage();}),senses={mouseX:0,mouseY:0,mouseDown:false,keys:new Set()};
let project=example(),state,controller=null,runtime=null,toastTimer,bootMessage='',audioProblem='';
try{project=loadProject(localStorage)||project;}catch{bootMessage='存档无法读取，已载入示例；原存档保留，编辑后才会保存。';}
project=migrateEventScripts(migrateProcedures(project));state=initialState(project);
function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
function save(){try{saveProject(localStorage,project);$('saveStatus').textContent='● 已保存到本机';}catch{$('saveStatus').textContent='保存失败，请导出备份';}}
function change(next,{render:shouldRender=true,record=true,quiet=false}={}){
  if(controller)return false;
  try{const valid=validateProject(migrateEventScripts(migrateProcedures(validateProject(next))));if(JSON.stringify(valid)===JSON.stringify(project))return true;if(record){history.push(JSON.stringify(project));if(history.length>30)history.shift();}if(valid.sprite!==project.sprite)state.costume=valid.sprite;if(valid.backdrop!==project.backdrop)state.backdrop=valid.backdrop;if(JSON.stringify(valid.variables)!==JSON.stringify(project.variables))state.variables=new Map((valid.variables||[]).map(v=>[v.name,v.value]));if(JSON.stringify(valid.lists)!==JSON.stringify(project.lists))state.lists=initialState(valid).lists;project=valid;save();if(shouldRender)render();else $('undoButton').disabled=!history.length;return true;}
  catch(error){if(!quiet)toast(error.message);return false;}
}
const assets=createAssetEditor({getProject:()=>project,isRunning:()=>!!controller,onChange:change,notice:toast,audio});
const listUI=createListUI({getProject:()=>project,isRunning:()=>!!controller,onChange:change,notice:toast});
const editor=createEditor({getProject:()=>project,isRunning:()=>!!controller,onChange:change,notice:toast,getState:()=>state,getSensing:()=>senses,onAssets:kind=>assets.open(kind),renderListTools:listUI.renderTools});
function renderMonitor(){
  const values=state.variables;
  $('variableMonitor').replaceChildren();for(const [name,value] of values){const row=element('div','variable-watch');row.append(element('span','',name),element('strong','',String(value)));$('variableMonitor').append(row);}
  listUI.renderMonitor($('listMonitor'),state.lists);
}
function renderStage(){
  const backdrop=state.backdrop||project.backdrop,costume=state.costume||project.sprite;
  const background=project.assets?.backdrops.find(x=>x.id===backdrop),character=project.assets?.sprites.find(x=>x.id===costume);
  $('stage').className='stage '+(background?'custom-backdrop':backdrop);$('stageBadge').textContent=background?.name||backdrops[backdrop];
  $('customBackdrop').setAttribute('href',background?.data||'');$('customBackdrop').style.display=background?'':'none';
  if(character){const image=document.createElementNS(NS,'image');image.setAttribute('href',character.data);const scale=80/Math.max(character.width,character.height);image.setAttribute('width',character.width*scale);image.setAttribute('height',character.height*scale);image.setAttribute('x',-character.width*scale/2);image.setAttribute('y',-character.height*scale/2);$('sprite').replaceChildren(image);const thumbnail=element('img');thumbnail.src=character.data;thumbnail.alt=character.name;$('spriteThumbnail').replaceChildren(thumbnail);}else{$('sprite').innerHTML=SPRITES[costume]||SPRITES.fox;$('spriteThumbnail').innerHTML=`<svg viewBox="-45 -50 90 100" aria-hidden="true">${SPRITES[costume]||SPRITES.fox}</svg>`;}
  $('sprite').setAttribute('transform',`translate(${240+state.x} ${180-state.y}) rotate(${state.angle}) scale(${state.size/100})`);$('sprite').style.display=state.visible?'':'none';
  $('drawing').replaceChildren(...state.lines.map(line=>{const node=document.createElementNS(NS,'line');for(const key of ['x1','x2'])node.setAttribute(key,240+line[key]);for(const key of ['y1','y2'])node.setAttribute(key,180-line[key]);return node;}));
  $('speech').hidden=!state.speech;$('speech').textContent=(state.thought?'💭 ':'')+state.speech;$('speech').style.left=`${Math.max(7,Math.min(67,(240+state.x)/480*100))}%`;$('speech').style.top=`${Math.max(27,Math.min(88,(180-state.y)/360*100-14))}%`;
  $('xValue').textContent=Math.round(state.x);$('yValue').textContent=Math.round(state.y);$('angleValue').textContent=Math.round(state.angle)+'°';$('spriteName').textContent=character?.name||names[costume];$('sizeValue').textContent=Math.round(state.size)+'%';$('audioStatus').textContent='音量 '+Math.round(state.volume)+'%'+(audio.activeCount?' · ♫ 播放中':'')+(audioProblem?' · '+audioProblem:'');renderMonitor();
}
function render(){
  $('projectName').value=project.name;for(const [id,kind,builtin] of [['spriteSelect','sprites',names],['backdropSelect','backdrops',backdrops]]){const select=$(id);select.replaceChildren();for(const [value,label] of [...Object.entries(builtin),...(project.assets?.[kind]||[]).map(x=>[x.id,x.name])]){const option=element('option','',label);option.value=value;select.append(option);}}$('spriteSelect').value=project.sprite;$('backdropSelect').value=project.backdrop;document.body.classList.toggle('running',!!controller);
  for(const id of ['runButton','newButton','clearButton','importButton','spriteSelect','backdropSelect','projectName','spriteAssets','backdropAssets'])$(id).disabled=!!controller;
  document.querySelectorAll('[data-example]').forEach(btn=>btn.disabled=!!controller);$('stopButton').disabled=!controller;$('undoButton').disabled=!!controller||!history.length;editor.render();renderStage();
}
function cancel(){controller?.abort();runtime?.stop();audio.stop();assets.cancel();}
function usesSound(items){return items.some(b=>TYPES[b.type].category==='sound'||usesSound(b.children||[])||usesSound(b.otherwise||[]));}
async function run(kind='flag',value){
  if(controller)return;if(!project.blocks.some(b=>TYPES[b.type].event)){if(kind==='flag')toast('先添加一种事件，把动作放到事件里面；游离积木不会自动运行');return;}
  const current=new AbortController();controller=current;audioProblem='';state=initialState(project);render();$('runStatus').textContent='正在执行你的创意…';$('stageMessage').textContent=(kind==='flag'?'绿旗':kind==='key'?'按键':'角色点击')+'事件已启动，按 Escape 或停止结束';
  let sessionError=null;
  try{
    if(usesSound(project.blocks)){try{await audio.unlock();}catch(error){audioProblem='声音不可用';throw error;}}
    const session=createRuntime(project,{signal:current.signal,sensing:()=>senses,onSound:event=>audio.play(event),onError:error=>{sessionError=error;toast(error.message);},onStep:(next,id)=>{state=next;renderStage();document.querySelectorAll('.executing').forEach(el=>el.classList.remove('executing'));document.querySelector(`[data-id="${CSS.escape(id)}"]`)?.classList.add('executing');}});
    runtime=session;state=session.state;await session.start({triggerFlag:kind==='flag'});if(kind==='key')await session.triggerKey(value);if(kind==='click')await session.triggerClick();await session.drain();
    if(session.hasListeners){$('runStatus').textContent='等待事件：按键或点击角色';$('stageMessage').textContent='事件监听中 · 点角色、按键触发，红方块结束';await new Promise(resolve=>{if(session.signal.aborted)resolve();else session.signal.addEventListener('abort',resolve,{once:true});});if(sessionError)throw sessionError;$('runStatus').textContent='已停止，可以继续编辑';}
    else{$('runStatus').textContent='运行完成，做得不错！';$('stageMessage').textContent='又一个想法，变成了现实 ✦';}
  }catch(error){$('runStatus').textContent=error.name==='AbortError'?'已停止，可以继续编辑':'执行结束：'+error.message;$('stageMessage').textContent=error.name==='AbortError'?'准备好了，随时再试一次':error.message;if(error.name!=='AbortError')toast(error.message);}
  finally{if(controller===current){runtime?.stop();runtime=null;controller=null;audio.stop();senses.keys.clear();senses.mouseDown=false;render();}}
}
function trigger(kind,value){if(!matchesEvent(project,kind,value))return false;if(!controller){run(kind,value);return true;}if(!runtime)return true;try{const result=kind==='key'?runtime.triggerKey(value):runtime.triggerClick();result.catch(error=>{if(error.name!=='AbortError')toast(error.message);});}catch(error){if(error.name!=='AbortError')toast(error.message);}return true;}
$('runButton').addEventListener('click',()=>run());$('stopButton').addEventListener('click',cancel);
$('resetButton').addEventListener('click',()=>{cancel();state=initialState(project);renderStage();$('stageMessage').textContent='舞台已复位';});
$('clearButton').addEventListener('click',()=>change({...project,blocks:[]}));
$('newButton').addEventListener('click',()=>{editor.resetTarget();change({version:1,eventScripts:true,name:'我的新作品',sprite:'fox',backdrop:'meadow',blocks:[]});state=initialState(project);renderStage();$('runStatus').textContent='先选择一种事件，再添加动作';});
$('undoButton').addEventListener('click',()=>{if(controller||!history.length)return;project=validateProject(JSON.parse(history.pop()));state=initialState(project);save();render();toast('已撤销上一次编辑');});
$('projectName').addEventListener('input',()=>{const name=$('projectName').value.trim();if(name)change({...project,name},{render:false});});
for(const [id,key] of [['spriteSelect','sprite'],['backdropSelect','backdrop']])$(id).addEventListener('change',()=>change({...project,[key]:$(id).value}));
document.querySelectorAll('[data-example]').forEach(btn=>btn.addEventListener('click',()=>{editor.resetTarget();change(example(btn.dataset.example));state=initialState(project);renderStage();$('runStatus').textContent='示例已就绪，点击绿旗运行';toast('已载入示例，可撤销恢复之前的作品');}));
$('exportButton').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(project,null,2)],{type:'application/json'})),link=element('a');link.href=url;link.download=(project.name.replace(/[<>:"/\\|?*]/g,'_')||'作品')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已发起导出，请在下载或保存对话框确认');});
$('importButton').addEventListener('click',()=>$('fileInput').click());
$('fileInput').addEventListener('change',async()=>{const file=$('fileInput').files[0];if(!file)return;try{if(file.size>PROJECT_BUDGET)throw new Error('请选择 4 MB 以内的作品');const imported=migrateProcedures(validateProject(JSON.parse(await file.text())));if(controller)throw new Error('请先停止执行再导入');editor.resetTarget();if(change(imported)){state=initialState(project);renderStage();toast('已导入作品，点击绿旗试试看');}}catch(error){toast(error instanceof SyntaxError?'文件不是有效的 JSON，原作品已保留':error.message);}finally{$('fileInput').value='';}});
$('spriteAssets').addEventListener('click',()=>assets.open('sprites'));$('backdropAssets').addEventListener('click',()=>assets.open('backdrops'));
window.addEventListener('pagehide',cancel);
$('helpButton').addEventListener('click',()=>$('helpDialog').showModal());for(const id of ['closeHelp','startCreating'])$(id).addEventListener('click',()=>$('helpDialog').close());
const normalizedKey=key=>key===' '?'space':key.length===1?key.toLowerCase():key;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&controller){cancel();return;}if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)||e.target.closest('dialog,[contenteditable="true"]')||e.target.closest('button,a')&&[' ','Enter'].includes(e.key))return;const key=normalizedKey(e.key);senses.keys.add(key);if((controller||matchesEvent(project,'key',key))&&['space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key))e.preventDefault();if(!e.repeat)trigger('key',key);});
document.addEventListener('keyup',e=>senses.keys.delete(normalizedKey(e.key)));window.addEventListener('blur',()=>{senses.keys.clear();senses.mouseDown=false;});
$('stage').addEventListener('pointermove',e=>{const rect=$('stageSvg').getBoundingClientRect();senses.mouseX=Math.round(Math.max(-240,Math.min(240,(e.clientX-rect.left)/rect.width*480-240)));senses.mouseY=Math.round(Math.max(-180,Math.min(180,180-(e.clientY-rect.top)/rect.height*360)));});
$('stage').addEventListener('pointerdown',()=>senses.mouseDown=true);window.addEventListener('pointerup',()=>senses.mouseDown=false);window.addEventListener('pointercancel',()=>senses.mouseDown=false);
$('sprite').addEventListener('click',()=>trigger('click'));$('sprite').addEventListener('keydown',e=>{if(e.key==='Enter'){e.stopPropagation();trigger('click');}});
render();if(bootMessage)toast(bootMessage);else save();
