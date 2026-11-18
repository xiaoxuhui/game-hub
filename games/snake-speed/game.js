'use strict';
const $ = id => document.getElementById(id);
const canvas = $('board');
const ctx = canvas.getContext('2d');
const SIZE = 24, CELL = 24, WIDTH = SIZE * CELL;
const DIRECTIONS = {up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
let snake, direction, turns, food, score, state, timer, best = 0;
let tool = 'play', guides = [], guideHistory = [], draft = null, pointerStart = null;
let pythonControl = null;
let stepInterval = Number($('speed').value);
try { const stored = Number(localStorage.getItem('snake-speed-best')); if (Number.isFinite(stored) && stored >= 0) best = Math.floor(stored); } catch {}
$('best').textContent = best;
function spawnFood() {
  const occupied = new Set(snake.map(p => p.y * SIZE + p.x));
  const empty = [];
  for (let i=0;i<SIZE*SIZE;i++) if (!occupied.has(i)) empty.push(i);
  if (!empty.length) return null;
  const index = empty[Math.floor(Math.random()*empty.length)];
  return {x:index%SIZE,y:Math.floor(index/SIZE)};
}
function reset() {
  clearTimeout(timer);timer=null;
  snake = [{x:0,y:0}];
  direction = DIRECTIONS.right; turns = []; score = 0; state = 'ready';
  food = spawnFood();
  $('score').textContent = score;
  updateUI(); draw();
}
function schedule() {
  clearTimeout(timer);timer=null;
  if(pythonControl){schedulePythonStep();return;}
  if(state==='running')timer=setTimeout(tick,stepInterval);
}
function togglePlay() {
  if (tool !== 'play') setTool('play');
  if (state === 'over' || state === 'won') { restartGame(); return; }
  state = state === 'running' ? 'paused' : 'running';
  if (pythonControl) pythonControl.manualPaused = state === 'paused';
  updateUI(); schedule();
}
function finish(won = false) {
  state = won ? 'won' : 'over'; clearTimeout(timer);timer=null;updateUI();
}
function tick() {
  timer=null;
  if (state !== 'running') return;
  if (turns.length) direction = turns.shift();
  const head = {x:snake[0].x+direction.x,y:snake[0].y+direction.y};
  const eating = food && head.x === food.x && head.y === food.y;
  // The tail moves away on a normal step, so its current square is safe.
  const body = eating ? snake : snake.slice(0,-1);
  if (head.x<0 || head.x>=SIZE || head.y<0 || head.y>=SIZE || body.some(p=>p.x===head.x && p.y===head.y)) { finish(); return; }
  snake.unshift(head);
  if (eating) {
    score += 10; $('score').textContent = score;
    if (score > best) { best = score; $('best').textContent = best; try { localStorage.setItem('snake-speed-best',String(best)); } catch {} }
    food = spawnFood();
    if (!food) { draw(); finish(true); return; }
  } else snake.pop();
  draw(); if(!pythonControl)schedule();
}
function turn(name) {
  if (pythonControl) return;
  if (tool !== 'play') return;
  if (state === 'ready') togglePlay();
  if (state !== 'running' || turns.length >= 2) return;
  const next = DIRECTIONS[name], previous = turns.length ? turns[turns.length-1] : direction;
  if (next.x === previous.x && next.y === previous.y) return;
  if (snake.length > 1 && next.x === -previous.x && next.y === -previous.y) return;
  turns.push(next);
}
function updateUI() {
  const running = state === 'running';
  $('overlay').hidden = running || tool !== 'play';
  $('status-dot').classList.toggle('active',running);
  $('status-text').textContent = {ready:'等待开始',running:'正在游戏',paused:'已暂停',over:'游戏结束',won:'挑战完成'}[state];
  $('play').textContent = {ready:'开始游戏 ↗',running:'Ⅱ 暂停游戏',paused:'继续游戏 ↗',over:'重置棋盘 ↻',won:'重置棋盘 ↻'}[state];
  const messages = {
    ready:['✦','从左上角的一格出发','点击「运行 Python」\n程序会自动控制，无需按方向键。'],
    paused:['Ⅱ','休息一下','点击「继续游戏」或按空格键继续。'],
    over:['↻','再来一局？',`本局得分 ${score} 分\n调整一下速度，再出发。`],
    won:['✦','你填满了整个棋盘！',`本局得分 ${score} 分，太棒了！`]
  };
  if (messages[state]) {
    const [icon,title,message] = messages[state];
    $('overlay-icon').textContent=icon; $('overlay-title').textContent=title;
    $('overlay-text').textContent=message; $('overlay-text').style.whiteSpace='pre-line';
  }
}
function rounded(x,y,w,h,r,color) { ctx.fillStyle=color; ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill(); }
function draw() {
  ctx.clearRect(0,0,WIDTH,WIDTH);
  ctx.fillStyle='#edf1e5'; ctx.fillRect(0,0,WIDTH,WIDTH);
  ctx.strokeStyle='#e1e8d7'; ctx.lineWidth=.7;
  ctx.beginPath();
  for (let i=1;i<SIZE;i++) { ctx.moveTo(i*CELL,0);ctx.lineTo(i*CELL,WIDTH);ctx.moveTo(0,i*CELL);ctx.lineTo(WIDTH,i*CELL); }
  ctx.stroke();
  drawGuides();
  if (food) {
    const x=food.x*CELL+CELL/2,y=food.y*CELL+CELL/2;
    ctx.fillStyle='#db805b';ctx.beginPath();ctx.arc(x,y+1,8,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#6b854b';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x,y-6);ctx.quadraticCurveTo(x+1,y-12,x+6,y-10);ctx.stroke();
    ctx.fillStyle='#edb79a';ctx.beginPath();ctx.arc(x-3,y-2,2,0,Math.PI*2);ctx.fill();
  }
  snake.forEach((p,i)=>rounded(p.x*CELL+1.5,p.y*CELL+1.5,CELL-3,CELL-3,i===0?7:5,i===0?'#326947':i%2?'#89a65d':'#94af68'));
  const h=snake[0],cx=h.x*CELL+CELL/2,cy=h.y*CELL+CELL/2;
  const px=-direction.y,py=direction.x;
  for (const side of [-1,1]) {
    const ex=cx+direction.x*5+px*side*4,ey=cy+direction.y*5+py*side*4;
    ctx.fillStyle='#fffef5';ctx.beginPath();ctx.arc(ex,ey,2.6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#263d2e';ctx.beginPath();ctx.arc(ex+direction.x*.8,ey+direction.y*.8,1.2,0,Math.PI*2);ctx.fill();
  }
}
function fitCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1,3);
  const pixels = Math.max(1,Math.round(canvas.getBoundingClientRect().width*ratio));
  canvas.width=pixels;canvas.height=pixels;ctx.setTransform(pixels/WIDTH,0,0,pixels/WIDTH,0,0);draw();
}
$('play').addEventListener('click',togglePlay);
function restartGame() {
  window.stopPythonProgram?.();endPythonControl(true);setTool('play');reset();
}
$('restart').addEventListener('click',restartGame);
$('speed').addEventListener('input',event=>{
  stepInterval = Number(event.target.value);
  $('speed-value').innerHTML = `${(stepInterval / 1000).toFixed(2)}<small>秒 / 格</small>`;
  const pending = pythonControl?.pending;
  if (pending) pausePythonDelay(pending);
  schedule();
});
document.querySelectorAll('[data-dir]').forEach(button=>button.addEventListener('click',()=>turn(button.dataset.dir)));
document.addEventListener('keydown',event=>{
  if (event.ctrlKey || event.metaKey || event.altKey || event.target.matches('input,textarea,select,[contenteditable=true]')) return;
  const key=event.key.toLowerCase();
  const map={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'};
  if (map[key]) { event.preventDefault();turn(map[key]); }
  else if (key===' ' && !event.target.closest('button')) { event.preventDefault();if(!event.repeat) togglePlay(); }
  else if (key==='r' && !event.repeat) { event.preventDefault();restartGame(); }
});
function setTool(next) {
  pointerStart = null; draft = null;
  if (next !== 'play' && state === 'running') { state = 'paused'; clearTimeout(timer); }
  if (next !== 'play' && pythonControl) pythonControl.manualPaused=true;
  if (pythonControl) schedulePythonStep();
  tool = next;
  document.querySelector('.board-wrap').dataset.tool = tool;
  document.querySelectorAll('button[data-tool]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tool===tool)));
  updateGuideUI(); updateUI(); draw();
}
function updateGuideUI() {
  $('undo-guide').disabled = !guideHistory.length;
  $('clear-guides').disabled = !guides.length;
  $('guide-hint').textContent = {
    play:'辅助线会保留；选「直线」或「画笔」可继续绘制。',
    line:'拖动起点到终点画直线。点击开始 / 继续游戏后保留辅助线。',
    pen:'按住鼠标或手指自由画线。点击开始 / 继续游戏后保留辅助线。',
    erase:'拖动擦除经过的辅助线；误删可以撤销。'
  }[tool];
}
function rememberGuides() {
  guideHistory.push(guides.slice());
  if (guideHistory.length>40) guideHistory.shift();
}
function drawGuides() {
  ctx.save();ctx.strokeStyle='#428aa3';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';ctx.globalAlpha=.8;
  for (const stroke of draft ? [...guides,draft] : guides) {
    ctx.setLineDash(stroke.type==='line'?[8,5]:[]);
    ctx.beginPath();stroke.points.forEach((p,i)=>i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));ctx.stroke();
  }
  ctx.restore();
}
function boardPoint(event) {
  const rect=canvas.getBoundingClientRect();
  return {x:Math.max(0,Math.min(WIDTH,(event.clientX-rect.left)*WIDTH/rect.width)),y:Math.max(0,Math.min(WIDTH,(event.clientY-rect.top)*WIDTH/rect.height))};
}
function pointDistance(p,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const t=length ? Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)) : 0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
function segmentsNear(a,b,c,d) {
  const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  if (cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0) return true;
  return Math.min(pointDistance(a,c,d),pointDistance(b,c,d),pointDistance(c,a,b),pointDistance(d,a,b))<=10;
}
function eraseGuides(from,to) {
  const remaining=guides.filter(stroke=>!stroke.points.some((p,i)=>i>0 && segmentsNear(from,to,stroke.points[i-1],p)));
  if (remaining.length===guides.length) return;
  if (!pointerStart.erased) { rememberGuides(); pointerStart.erased=true; }
  guides=remaining;updateGuideUI();draw();
}
function moveDrawing(event) {
  const point=boardPoint(event);
  if (tool==='line') draft.points[1]=point;
  else if (tool==='pen') {
    const last=draft.points[draft.points.length-1];
    if (Math.hypot(point.x-last.x,point.y-last.y)>1.5 && draft.points.length<2048) draft.points.push(point);
  } else if (tool==='erase') eraseGuides(pointerStart.last,point);
  pointerStart.last=point;draw();
}
document.querySelectorAll('button[data-tool]').forEach(button=>button.addEventListener('click',()=>setTool(button.dataset.tool)));
$('undo-guide').addEventListener('click',()=>{
  if (!guideHistory.length) return;
  pointerStart=null;draft=null;guides=guideHistory.pop();updateGuideUI();draw();
});
$('clear-guides').addEventListener('click',()=>{
  if (!guides.length) return;
  rememberGuides();pointerStart=null;draft=null;guides=[];updateGuideUI();draw();
});
canvas.addEventListener('pointerdown',event=>{
  if (pointerStart || event.button!==0) return;
  const point=boardPoint(event);
  pointerStart={x:event.clientX,y:event.clientY,id:event.pointerId,last:point,erased:false};
  canvas.setPointerCapture(event.pointerId);
  if (tool==='line' || tool==='pen') draft={type:tool,points:[point,point]};
  else if (tool==='erase') eraseGuides(point,point);
  draw();
});
canvas.addEventListener('pointermove',event=>{
  if (!pointerStart || event.pointerId!==pointerStart.id || tool==='play') return;
  moveDrawing(event);
});
canvas.addEventListener('pointerup',event=>{
  if (!pointerStart || event.pointerId!==pointerStart.id) return;
  if (tool==='play') {
    const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;
    if (Math.max(Math.abs(dx),Math.abs(dy))>=15) turn(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));
  } else {
    moveDrawing(event);
    if (draft && draft.points.some(p=>Math.hypot(p.x-draft.points[0].x,p.y-draft.points[0].y)>2)) {
      rememberGuides();guides=[...guides,draft];
    }
  }
  pointerStart=null;draft=null;updateGuideUI();draw();
});
function cancelDrawing() { pointerStart=null;draft=null;draw(); }
canvas.addEventListener('pointercancel',cancelDrawing);
canvas.addEventListener('lostpointercapture',cancelDrawing);
function gameSnapshot() {
  return {size:SIZE,head:[snake[0].x,snake[0].y],snake:snake.map(p=>[p.x,p.y]),food:food?[food.x,food.y]:null,
    direction:Object.keys(DIRECTIONS).find(k=>DIRECTIONS[k].x===direction.x&&DIRECTIONS[k].y===direction.y),
    score,speed:1000/stepInterval,status:state};
}
function settlePythonStep(error=null) {
  if (!pythonControl?.pending) return;
  const pending=pythonControl.pending;pythonControl.pending=null;
  clearTimeout(pending.timeout);
  if(error) pending.reject(error);else pending.resolve(gameSnapshot());
}
function pausePythonDelay(pending) {
  if (pending.timeout === null) return;
  clearTimeout(pending.timeout);
  pending.timeout = null;
  pending.elapsed += performance.now() - pending.started;
}
function schedulePythonStep() {
  const control=pythonControl,pending=control?.pending;
  if(!pending)return;
  if(control.manualPaused){
    pausePythonDelay(pending);
    return;
  }
  if(pending.timeout!==null)return;
  if(!pending.executed){
    pending.executed=true;
    if(state==='over'||state==='won'){
      pending.notice=state==='won'?'棋盘已填满，Python 程序继续执行。输出 R 可重置。':'小蛇已撞墙或碰到自身，游戏结束；Python 程序继续执行。输出 R 可重置。';
    }else if(snake.length>1&&pending.direction.x===-direction.x&&pending.direction.y===-direction.y){
      pending.notice='小蛇不能直接反向，本条移动已忽略；Python 程序继续执行。';
    }else{
      direction=pending.direction;turns=[];state='running';updateUI();tick();
      if(state==='over')pending.notice='小蛇已撞墙或碰到自身，游戏结束；Python 程序继续执行。输出 R 可重置。';
      if(state==='won')pending.notice='棋盘已填满，Python 程序继续执行。输出 R 可重置。';
    }
  }
  pending.started=performance.now();
  pending.timeout=setTimeout(()=>{
    if(pythonControl!==control||control.pending!==pending)return;
    control.pending=null;pending.timeout=null;
    pending.resolve({...gameSnapshot(),notice:pending.notice||null});
  },Math.max(0, stepInterval - pending.elapsed));
}
function endPythonControl(pause=true) {
  settlePythonStep(new Error('程序已停止。'));pythonControl=null;
  if(pause&&state==='running')state='paused';
  schedule();updateUI();
}
function beginPythonControl() {
  endPythonControl(true);setTool('play');reset();
  pythonControl={pending:null,manualPaused:false};return gameSnapshot();
}
function pythonCommand(command) {
  if (!pythonControl) return Promise.reject(new Error('程序已经停止。'));
  if (command==='R') {reset();pythonControl.manualPaused=false;return Promise.resolve(gameSnapshot());}
  if (command==='T') {
    if(state==='over'||state==='won')return Promise.resolve({...gameSnapshot(),notice:'本局已结束，输出 R 可重置；Python 程序继续执行。'});
    pythonControl.manualPaused=false;setTool('play');state='running';updateUI();schedule();return Promise.resolve(gameSnapshot());
  }
  const name={W:'up',A:'left',S:'down',D:'right'}[command];
  if(!name)return Promise.reject(new Error('未知指令。'));
  const next=DIRECTIONS[name];
  return new Promise((resolve,reject)=>{
    pythonControl.pending={direction:next,resolve,reject,elapsed:0,timeout:null,executed:false};
    if(!pythonControl.manualPaused&&state!=='over'&&state!=='won'){state='running';updateUI();}
    schedulePythonStep();
  });
}
window.snakeGame={snapshot:gameSnapshot,begin:beginPythonControl,command:pythonCommand,end:endPythonControl};
document.addEventListener('visibilitychange',()=>{if (document.hidden && state==='running') togglePlay();});
reset();
new ResizeObserver(fitCanvas).observe(canvas);
