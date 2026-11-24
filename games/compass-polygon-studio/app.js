import {construct,classify,distance} from './geometry.js';
import {desmosExpressions, desmosClipboard, copyDesmos} from './desmos.js';
import {constructionPrinciple} from './principles.js';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
let model=null,index=2,playing=false,timer=null,camera={x:0,y:0,scale:1},userView=false,previousPhase='',drag=null;
const els={svg:$('drawing'),group:$('geometry'),wrap:$('canvasWrap'),list:$('stepsList')};
function node(tag,attrs,parent=els.group){const n=document.createElementNS(NS,tag);for(const [key,val] of Object.entries(attrs))n.setAttribute(key,String(val));parent.appendChild(n);return n;}
function updatePrinciple() {
  const panel = $('constructionPrinciple');
  panel.hidden = !model;
  if (!model) return;
  const reason = constructionPrinciple(model, index);
  $('stepReasonTitle').textContent = reason.stepTitle;
  $('stepReason').textContent = reason.operation;
  $('phaseReasonTitle').textContent = reason.phase.title;
  $('phaseReason').textContent = reason.phase.text;
  $('reasonFormula').textContent = reason.phase.formula;
}
function stop(){playing=false;clearTimeout(timer);$('play').textContent='▶';$('play').setAttribute('aria-label','播放作图');}
function schedule(){clearTimeout(timer);if(!playing)return;const step=model.steps[index];const delay=(step.tool==='compass'?1150:step.tool==='ruler'?800:1050)/Number($('speed').value);timer=setTimeout(()=>{if(index>=model.steps.length-1){stop();return;}setIndex(index+1,true);schedule();},delay);}
function togglePlay(){if(!model)return;if(playing){stop();return;}if(index===model.steps.length-1)setIndex(0);playing=true;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','暂停作图');schedule();}
function visible(){if(!model)return {shapes:[],points:[],activeShapes:new Set(),activePoints:new Set()};const step=model.steps[index],mode=$('helpers').value;const shapes=model.shapes.filter(s=>s.born<=index&&(s.role==='base'||s.role==='polygon'||mode==='all'||mode==='phase'&&s.phase===step.phase));const referenced=new Set(shapes.flatMap(s=>s.type==='circle'?[s.c.id]:[s.a.id,s.b.id]));const points=model.points.filter(p=>p.born<=index&&(p.base||p.vertex||mode==='all'||mode==='phase'&&p.phase===step.phase||referenced.has(p.id)));return {shapes,points,activeShapes:new Set(step.shapes),activePoints:new Set(step.points)};}
function fitCamera(v){const W=els.wrap.clientWidth,H=els.wrap.clientHeight;let minX=-1.22,maxX=1.22,minY=-1.22,maxY=1.22;for(const s of v.shapes){if(s.type==='circle'){minX=Math.min(minX,s.c.x-s.r);maxX=Math.max(maxX,s.c.x+s.r);minY=Math.min(minY,s.c.y-s.r);maxY=Math.max(maxY,s.c.y+s.r);}else for(const p of [s.a,s.b]){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}}for(const p of v.points){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}const margin=Math.min(65,W*.15);camera={x:(minX+maxX)/2,y:(minY+maxY)/2,scale:Math.max(.1,Math.min((W-margin*2)/(maxX-minX),(H-margin*2)/(maxY-minY)))};}
const screen=p=>({x:els.wrap.clientWidth/2+(p.x-camera.x)*camera.scale,y:els.wrap.clientHeight/2-(p.y-camera.y)*camera.scale});
function render(animate=false,forceFit=false){const W=els.wrap.clientWidth,H=els.wrap.clientHeight;els.svg.setAttribute('viewBox',`0 0 ${W} ${H}`);$('gridBackground').setAttribute('width',W);$('gridBackground').setAttribute('height',H);$('gridBackground').setAttribute('opacity',$('grid').checked?1:0);els.group.replaceChildren();const v=visible();if(forceFit||!userView)fitCamera(v);if(!model)return;const step=model.steps[index];for(const s of v.shapes){const active=v.activeShapes.has(s.id),color=active?'#c77852':s.role==='polygon'?'#315f4c':s.role==='base'?'#73927a':'#b2bfa4',width=active?1.9:s.role==='polygon'?2.1:s.role==='base'?1.35:.85;let el;if(s.type==='circle'){const c=screen(s.c);el=node('circle',{cx:c.x,cy:c.y,r:s.r*camera.scale,fill:'none',stroke:color,'stroke-width':width,'data-shape':s.id});}else{let a=screen(s.a),b=screen(s.b);if(s.type==='line'){const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy),reach=Math.max(W,H)*2;if(L<.001)continue;const ux=dx/L,uy=dy/L;a={x:a.x-ux*reach,y:a.y-uy*reach};b={x:b.x+ux*reach,y:b.y+uy*reach};}el=node('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:color,'stroke-width':width,'data-shape':s.id});}if(active&&animate&&step.tool!=='point'&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const length=el.getTotalLength();el.style.strokeDasharray=String(length);el.style.strokeDashoffset=String(length);el.animate([{strokeDashoffset:length},{strokeDashoffset:0}],{duration:Math.min(900,900/Number($('speed').value)),easing:'ease-in-out',fill:'forwards'});}}
 for(const p of v.points){const q=screen(p),active=v.activePoints.has(p.id);if(q.x< -20||q.x>W+20||q.y< -20||q.y>H+20)continue;if(active)node('circle',{cx:q.x,cy:q.y,r:7,fill:'#c7785214',stroke:'#c7785255','stroke-width':1});const dot=node('circle',{cx:q.x,cy:q.y,r:p.base||p.vertex?2.6:1.8,fill:active?'#c77852':p.base||p.vertex?'#3e6650':'#9bad8a',stroke:'#fffef9','stroke-width':1,'data-point':p.id});const title=document.createElementNS(NS,'title');title.textContent=`${p.label} · ${p.base?'给定点':p.vertex?'多边形顶点':'交点'}`;dot.appendChild(title);if($('labels').checked){let dx=8,dy=-9,anchor='start';if(p.vertex&&distance(model.O,p)>.95){const d=Math.hypot(p.x,p.y)||1;dx=p.x/d*15;dy=-p.y/d*15+4;anchor=p.x<-.15?'end':p.x>.15?'start':'middle';if(model.n>32){const parity=model.vertices.indexOf(p)%2;dx*=1+parity*.6;dy*=1+parity*.6;}}const t=node('text',{x:q.x+dx,y:q.y+dy,'font-size':p.base||p.vertex?14:11,fill:active?'#b76e4b':p.base||p.vertex?'#365d47':'#99a78a','text-anchor':anchor});t.textContent=p.label;}}
 // A radius label explains OA without measuring it.
 if(model.shapes.some(s=>s.role==='base'&&s.type==='segment'&&s.born<=index)){const a=screen(model.O),b=screen(model.A);if(Math.abs(b.x-a.x)>60){const t=node('text',{x:(a.x+b.x)/2,y:a.y+18,'font-size':11,fill:'#9aab8f','text-anchor':'middle'});t.textContent='r = OA';}}
 previousPhase=step.phase;
}
function setIndex(value,animate=false){if(!model)return;index=Math.max(0,Math.min(model.steps.length-1,value));const step=model.steps[index];if(previousPhase!==step.phase)userView=false;$('progress').value=index;$('stepCounter').textContent=`${String(index+1).padStart(2,'0')} / ${model.steps.length}`;$('progressTitle').textContent=step.title;$('currentPhase').textContent=step.phase;$('explanation').textContent=step.desc;$('toolIcon').textContent={compass:'◉',ruler:'╱',point:'⊙',given:'◎',done:'✓'}[step.tool]||'◎';$('boardStatus').textContent=step.tool==='done'?'作图完成':step.phase;$('canvasBadge').innerHTML=`<span>${step.tool==='done'?'完成':'给定'}</span> 圆心 O，半径 OA`;$('prev').disabled=index===0;$('next').disabled=index===model.steps.length-1;$('progress').setAttribute('aria-valuetext',`第 ${index+1} 步，${step.title}`);for(const row of els.list.querySelectorAll('.step-item')){const i=Number(row.dataset.index);row.classList.toggle('past',i<index);row.classList.toggle('current',i===index);row.setAttribute('aria-current',i===index?'step':'false');row.querySelector('.step-num').textContent=i<index?'✓':String(i+1).padStart(2,'0');}const current=els.list.querySelector('.current');if(current){const top=current.offsetTop-els.list.offsetTop;if(top<els.list.scrollTop||top+current.offsetHeight>els.list.scrollTop+els.list.clientHeight)els.list.scrollTop=Math.max(0,top-40);}updatePrinciple();render(animate);}
function fillSteps(){els.list.replaceChildren();let phase='';model.steps.forEach((step,i)=>{if(phase!==step.phase){phase=step.phase;const heading=document.createElement('div');heading.className='step-group';heading.textContent=phase;els.list.append(heading);}const button=document.createElement('button');button.className='step-item';button.dataset.index=i;button.innerHTML=`<span class="step-num">${String(i+1).padStart(2,'0')}</span><span class="step-copy"><strong></strong><small></small></span>`;button.querySelector('strong').textContent=step.title;button.querySelector('small').textContent=step.desc;button.addEventListener('click',()=>{stop();setIndex(i);});els.list.append(button);});}
function generate(n,autoplay=false){stop();$('emptyMessage').hidden=true;const result=classify(n);$('feasibility').className='feasibility'+(result.ok?'':' error');for(const button of document.querySelectorAll('[data-n]'))button.classList.toggle('selected',Number(button.dataset.n)===n);$('boardTitle').textContent=Number.isSafeInteger(n)?`正 ${n} 边形`:'尺规作图';if(!result.ok){model=null;updatePrinciple();$('feasibility').textContent=result.message;const empty=$('emptyMessage');empty.replaceChildren();const title=document.createElement('strong');title.textContent=result.kind==='impossible'?'这个边数，无法精确尺规作出。':result.kind==='range'?'数学上可作，动画尚未覆盖。':'从一个整数开始。';empty.append(title,document.createTextNode(result.message));empty.hidden=false;els.list.replaceChildren();$('totalSteps').textContent='没有生成近似作图';$('boardStatus').textContent=result.kind==='impossible'?'不可精确构造':'等待输入';$('explanation').textContent=result.message;$('currentPhase').textContent='边数判定';$('progressTitle').textContent='等待可用边数';$('stepCounter').textContent='—';for(const id of ['play','prev','next','restart','download','copyDesmos','progress'])$(id).disabled=true;render();return;}
 try{model=construct(n);}catch(err){$('feasibility').textContent=`构造未完成：${err.message}`;return;}for(const p of model.points)p.born=Infinity;for(const s of model.shapes)s.born=Infinity;model.steps.forEach((s,i)=>{for(const id of s.points)model.points[id].born=Math.min(model.points[id].born,i);for(const id of s.shapes)model.shapes[id].born=Math.min(model.shapes[id].born,i);});$('feasibility').innerHTML=`<strong>✓ 可以精确尺规构造</strong><span>${n} = ${result.formula}，满足可作条件。</span>`;$('totalSteps').textContent=`${model.steps.length} 步 · 点击可跳转`;$('progress').max=model.steps.length-1;for(const id of ['play','prev','next','restart','download','copyDesmos','progress'])$(id).disabled=false;fillSteps();userView=false;previousPhase='';setIndex(autoplay?0:2);if(autoplay)togglePlay();}
$('polygonForm').addEventListener('submit',e=>{e.preventDefault();generate(Number($('sides').value),true);});
for(const b of document.querySelectorAll('[data-n]'))b.addEventListener('click',()=>{$('sides').value=b.dataset.n;generate(Number(b.dataset.n));});
$('minus').addEventListener('click',()=>{$('sides').value=Math.max(3,(Number($('sides').value)||3)-1);generate(Number($('sides').value));});
$('plus').addEventListener('click',()=>{$('sides').value=Math.min(1000000,(Number($('sides').value)||2)+1);generate(Number($('sides').value));});
$('play').addEventListener('click',togglePlay);$('prev').addEventListener('click',()=>{stop();setIndex(index-1);});$('next').addEventListener('click',()=>{stop();setIndex(index+1,true);});$('restart').addEventListener('click',()=>{stop();userView=false;setIndex(0);});$('progress').addEventListener('input',()=>{stop();setIndex(Number($('progress').value));});$('speed').addEventListener('change',schedule);
for(const id of ['labels','grid','helpers'])$(id).addEventListener('change',()=>{userView=false;render();});
function zoom(factor,anchor){const W=els.wrap.clientWidth,H=els.wrap.clientHeight,a=anchor||{x:W/2,y:H/2},old=camera.scale;camera.scale=Math.min(15000,Math.max(3,old*factor));camera.x+=(a.x-W/2)*(1/old-1/camera.scale);camera.y-=(a.y-H/2)*(1/old-1/camera.scale);userView=true;render();}
$('zoomIn').addEventListener('click',()=>zoom(1.3));$('zoomOut').addEventListener('click',()=>zoom(1/1.3));$('fit').addEventListener('click',()=>{userView=false;render(false,true);});
els.svg.addEventListener('wheel',e=>{e.preventDefault();const r=els.svg.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.001),{x:e.clientX-r.left,y:e.clientY-r.top});},{passive:false});
els.svg.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,cx:camera.x,cy:camera.y};els.svg.setPointerCapture(e.pointerId);});
els.svg.addEventListener('pointermove',e=>{if(!drag)return;camera.x=drag.cx-(e.clientX-drag.x)/camera.scale;camera.y=drag.cy+(e.clientY-drag.y)/camera.scale;userView=true;render();});
els.svg.addEventListener('pointerup',()=>drag=null);els.svg.addEventListener('pointercancel',()=>drag=null);
new ResizeObserver(()=>{userView=false;render();}).observe(els.wrap);
for(const id of ['principleBtn','proofBtn'])$(id).addEventListener('click',()=>{stop();$('principle').showModal();});$('closeDialog').addEventListener('click',()=>$('principle').close());$('principle').addEventListener('click',e=>{if(e.target===$('principle')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('download').addEventListener('click',()=>{if(!model)return;const clone=els.svg.cloneNode(true);clone.setAttribute('width',els.wrap.clientWidth);clone.setAttribute('height',els.wrap.clientHeight);const style=document.createElementNS(NS,'style');style.textContent='text{font-family:Georgia,serif;font-style:italic;paint-order:stroke;stroke:#fffef9;stroke-width:4px;stroke-linejoin:round}';clone.prepend(style);const bg=document.createElementNS(NS,'rect');bg.setAttribute('width','100%');bg.setAttribute('height','100%');bg.setAttribute('fill','#fffef9');clone.insertBefore(bg,clone.firstChild);for(const el of clone.querySelectorAll('[style]'))el.removeAttribute('style');const title=document.createElementNS(NS,'title');title.textContent=`正 ${model.n} 边形 · 第 ${index+1} 步 · ${model.steps[index].title}`;clone.prepend(title);const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`尺规作图-${model.n}边形-第${index+1}步.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
const desmosDialog = $('desmosDialog');
let desmosData;
async function copyCurrentExport() {
  const data = desmosData;
  $('desmosStatus').textContent = '正在复制…';
  const copied = await copyDesmos(data);
  if (!desmosDialog.open || data !== desmosData) return;
  $('desmosStatus').textContent = copied
    ? '当前步骤的图形已复制。'
    : '浏览器未能自动复制。请选中整个表达式文本框并手动复制。';
  if (!copied) {
    $('desmosDetails').open = true;
    $('desmosCode').focus();
    $('desmosCode').select();
  }
}

$('copyDesmos').addEventListener('click', () => {
  if (!model) return;
  stop();
  const title = `正 ${model.n} 边形 · 第 ${index + 1} 步`;
  desmosData = desmosClipboard(desmosExpressions(model, index, visible(), $('labels').checked), title);
  $('desmosCode').value = desmosData['text/plain'];
  $('desmosDetails').open = false;
  desmosDialog.showModal();
  copyCurrentExport();
});
$('copyDesmosAgain').addEventListener('click', copyCurrentExport);
$('closeDesmos').addEventListener('click', () => desmosDialog.close());
$('desmosCode').addEventListener('copy', event => {
  const field = event.currentTarget;
  if (!event.clipboardData || field.selectionStart !== 0 || field.selectionEnd !== field.value.length) return;
  event.preventDefault();
  for (const [type, value] of Object.entries(desmosData)) event.clipboardData.setData(type, value);
  $('desmosStatus').textContent = '当前步骤的图形已复制。';
});

document.addEventListener('keydown',e=>{if(['INPUT','SELECT','BUTTON','TEXTAREA','SUMMARY'].includes(e.target.tagName)||$('principle').open||desmosDialog.open)return;if(e.code==='Space'){e.preventDefault();togglePlay();}if(e.code==='ArrowRight'){e.preventDefault();stop();setIndex(index+1,true);}if(e.code==='ArrowLeft'){e.preventDefault();stop();setIndex(index-1);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
generate(5);
