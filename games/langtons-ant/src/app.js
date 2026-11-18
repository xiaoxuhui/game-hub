(() => {
  'use strict';
  const C=LangtonsAnt,S=AntStorage,$=id=>document.getElementById(id),canvas=$('world');
  let state=C.create(),settings=S.defaults(),running=false,origin={x:0,y:0};
  let dirty=false,needsDraw=true,carry=0,lastTime=performance.now(),lastSave=performance.now(),saveTimer=null,gesture=null;
  let storage,saveBlocked=false;
  const status=text=>{$('saveStatus').textContent=text;};
  try {storage=window.localStorage;} catch {status('无法访问本地存储，本次修改不会保存');}
  if(storage) {
    const loaded=S.load(storage);
    if(loaded.status==='restored') {state=loaded.state;settings=loaded.settings;status('已恢复上次存档 · 当前暂停');}
    else if(loaded.status==='error') {saveBlocked=true;status('存档无法读取，已保留原数据。点重置可重新开始并保存。');}
  }
  function sync() {
    $('steps').textContent=state.steps.toLocaleString('zh-CN');$('blackCells').textContent=state.black.size.toLocaleString('zh-CN');
    $('position').textContent=`${state.ant.x}, ${state.ant.y}`;$('direction').textContent=C.dirs[state.ant.dir].name;
    $('play').textContent=running?'暂停':'开始';$('speedLabel').textContent=settings.speed.toLocaleString('zh-CN');$('zoomLabel').textContent=settings.cellSize;
    for(const id of ['speed','cellSize','seedCount']) $(id).value=settings[id];
    for(const id of ['follow','grid']) $(id).checked=settings[id];
    canvas.dataset.mode=settings.mode;
    document.querySelectorAll('[data-mode]').forEach(button=>{if(button.tagName==='BUTTON') button.setAttribute('aria-pressed',String(button.dataset.mode===settings.mode));});
  }
  // Touch browsers may suppress compatibility clicks immediately after a canvas drag.
  // Activate touch buttons on pointerup, and ignore the matching compatibility click.
  function onActivate(button,action) {
    button.addEventListener('pointerup',event=>{if(event.pointerType==='touch'&&event.isPrimary) {event.preventDefault();action();}});
    button.addEventListener('click',event=>{if(event.pointerType!=='touch') action();});
  }
  function updateView() {
    const rect=canvas.getBoundingClientRect();settings.view={x:(rect.width/2-origin.x)/settings.cellSize,y:(rect.height/2-origin.y)/settings.cellSize};
  }
  function applyView() {
    const rect=canvas.getBoundingClientRect();origin={x:rect.width/2-settings.view.x*settings.cellSize,y:rect.height/2-settings.view.y*settings.cellSize};needsDraw=true;
  }
  function center() {settings.view={x:state.ant.x,y:state.ant.y};applyView();}
  function save() {
    clearTimeout(saveTimer);saveTimer=null;
    if(!dirty||saveBlocked) return;
    if(!storage) {status('无法访问本地存储，本次修改不会保存');return;}
    updateView();const result=S.save(storage,state,settings);lastSave=performance.now();
    if(result.status==='saved') {dirty=false;status('已自动保存到本机');}
    else status('自动保存失败（存储空间或权限不足），本次修改尚未保存');
  }
  function changed() {
    dirty=true;needsDraw=true;
    if(!running && !saveTimer) saveTimer=setTimeout(save,500);
    sync();
  }
  function pause() {running=false;carry=0;lastTime=performance.now();sync();}
  function run(count) {C.run(state,count);if(settings.follow) center();dirty=true;needsDraw=true;sync();}
  function resetWith(action) {endGesture();pause();action();saveBlocked=false;carry=0;changed();save();}
  onActivate($('play'),()=>{endGesture();running=!running;carry=0;lastTime=performance.now();sync();if(!running) save();});
  onActivate($('step'),()=>{endGesture();pause();run(1);save();});
  onActivate($('reset'),()=>resetWith(()=>{C.reset(state);center();}));
  onActivate($('clear'),()=>resetWith(()=>C.clear(state)));
  onActivate($('randomize'),()=>resetWith(()=>{settings.seedCount=C.seedCount($('seedCount').value);C.randomize(state,settings.seedCount);center();}));
  onActivate($('center'),()=>{center();changed();});
  $('speed').addEventListener('input',()=>{settings.speed=Number($('speed').value);changed();});
  $('cellSize').addEventListener('input',()=>{endGesture();updateView();settings.cellSize=Number($('cellSize').value);applyView();changed();});
  $('seedCount').addEventListener('change',()=>{settings.seedCount=C.seedCount($('seedCount').value);changed();});
  $('grid').addEventListener('change',()=>{settings.grid=$('grid').checked;changed();});
  $('follow').addEventListener('change',()=>{settings.follow=$('follow').checked;if(settings.follow) center();changed();});
  document.querySelectorAll('button[data-mode]').forEach(button=>onActivate(button,()=>{endGesture();settings.mode=button.dataset.mode;changed();}));
  function cell(event) {const rect=canvas.getBoundingClientRect();return [Math.floor((event.clientX-rect.left-origin.x)/settings.cellSize),Math.floor((event.clientY-rect.top-origin.y)/settings.cellSize)];}
  function paint(from,to,mode) {AntInteraction.line(from,to,(x,y)=>{const k=C.key(x,y);if(mode==='paint') state.black.add(k);else state.black.delete(k);});changed();}
  function endGesture(event) {
    if(!gesture || (event && event.pointerId!==gesture.id)) return;
    const id=gesture.id;gesture=null;canvas.classList.remove('dragging');
    if(canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    save();
  }
  canvas.addEventListener('pointerdown',event=>{
    if(gesture || !event.isPrimary || event.button>2) return;
    event.preventDefault();pause();
    const mode=event.button===1||(event.button===0&&event.shiftKey)?'pan':event.button===2?'erase':settings.mode;
    canvas.setPointerCapture(event.pointerId);
    gesture={id:event.pointerId,mode,last:cell(event),x:event.clientX,y:event.clientY,ox:origin.x,oy:origin.y};
    if(mode==='pan') {settings.follow=false;canvas.classList.add('dragging');changed();}
    else paint(gesture.last,gesture.last,mode);
  });
  canvas.addEventListener('pointermove',event=>{
    if(!gesture||event.pointerId!==gesture.id) return;
    event.preventDefault();
    if(gesture.mode==='pan') {origin.x=gesture.ox+event.clientX-gesture.x;origin.y=gesture.oy+event.clientY-gesture.y;updateView();changed();}
    else {const next=cell(event);paint(gesture.last,next,gesture.mode);gesture.last=next;}
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(name,endGesture);
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  canvas.addEventListener('wheel',event=>{
    event.preventDefault();endGesture();const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    const wx=(x-origin.x)/settings.cellSize,wy=(y-origin.y)/settings.cellSize;
    settings.cellSize=Math.max(3,Math.min(28,settings.cellSize+(event.deltaY<0?1:-1)));settings.follow=false;
    origin={x:x-wx*settings.cellSize,y:y-wy*settings.cellSize};updateView();changed();
  },{passive:false});
  function resize() {
    endGesture();const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    canvas.width=Math.max(1,Math.floor(rect.width*dpr));canvas.height=Math.max(1,Math.floor(rect.height*dpr));
    canvas.getContext('2d').setTransform(dpr,0,0,dpr,0,0);applyView();
  }
  new ResizeObserver(resize).observe(canvas);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{needsDraw=true;});
  window.addEventListener('blur',()=>{endGesture();pause();save();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden) {endGesture();pause();save();}});
  window.addEventListener('pagehide',()=>{pause();save();});
  function animate(now) {
    const elapsed=Math.min(0.25,Math.max(0,(now-lastTime)/1000));lastTime=now;
    if(running) {carry+=elapsed*settings.speed;const batch=Math.floor(carry);if(batch) {carry-=batch;run(batch);}}
    if(dirty&&now-lastSave>=2000) save();
    if(needsDraw) {AntRenderer.draw(canvas,state,settings,origin);needsDraw=false;}
    requestAnimationFrame(animate);
  }
  sync();resize();requestAnimationFrame(animate);
})();
