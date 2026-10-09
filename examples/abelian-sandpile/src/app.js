(function () {
'use strict';
const C=window.SandpileCore,H=window.SandpileChallenge,P=window.SandpileStorage,R=window.SandpileRenderer;
const levels=window.SandpileLevels,$=id=>document.getElementById(id),board=$('main-board');
let point={x:1,y:1},action=null,timer=null,storage=null,saveError=false;
const ctrl=new window.SandpileController.Controller(levels,{onChange:()=>{render();queueSave();}});
const teaching=new window.SandpileTeaching.View(levels[0]);
ctrl.onError=e=>message(e.message,true);
document.querySelector('[data-version]').textContent=window.AbelianSandpileProject.version;
const groups={};for(const [key,label]of [['intro','入门 · 六堂小课'],['advanced','进阶 · 连锁推理']]){const group=document.createElement('optgroup');group.label=label;groups[key]=group;$('level').append(group);}
for(const level of levels){const option=document.createElement('option');option.value=level.id;option.textContent=level.title;groups[level.teaching?.tier||'intro'].append(option);}
function message(text,error=false){$('message').textContent=text;$('message').dataset.error=String(error);}
function safely(fn){try{fn();}catch(e){message(e.message,true);}}
function saveNow(){if(timer!==null){clearTimeout(timer);timer=null;}try{if(!storage)throw new Error('浏览器未允许本地存储');P.save(storage,ctrl.snapshot(),levels);saveError=false;$('save-status').textContent='已自动保存在本机；恢复后保持暂停。';}catch(e){saveError=true;$('save-status').textContent=`尚未保存：${e.message}。请导出 JSON。`;}}
function queueSave(){if(timer===null)timer=setTimeout(saveNow,400);}
function selected(){return ctrl.settings.mode==='explore'?ctrl.selected:point;}
function render(){
const challenge=ctrl.settings.mode==='challenge',s=ctrl.state,p=selected();
document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===ctrl.settings.mode)));
$('explore-tools').hidden=challenge;$('challenge-tools').hidden=!challenge;$('undo').hidden=!challenge;
$('board-heading').textContent=challenge?ctrl.session.level.title:'自由探索';
$('state-label').textContent=`${s.stable?'稳定':'雪崩中'} · ${ctrl.pouring?'循环投沙':ctrl.running?ctrl.fast?'快速计算':'运行中':'已暂停'}`;
$('repeat-drop').textContent=ctrl.pouring?'停止循环投沙':'开始循环投沙';$('repeat-drop').setAttribute('aria-pressed',String(Boolean(ctrl.pouring)));
$('pour-status').textContent=ctrl.pouring?`向 (${ctrl.pouring.x}, ${ctrl.pouring.y}) 每 ${ctrl.pouring.interval}ms 投 ${ctrl.pouring.amount} 粒；等待稳定后继续。`:'开始时锁定坐标和粒数；停止或暂停可修改。自动快速稳定化，刷新后停止。';
for(const id of ['amount','coord-x','coord-y','pour-interval'])$(id).disabled=Boolean(ctrl.pouring);
document.querySelectorAll('[data-amount]').forEach(b=>b.disabled=Boolean(ctrl.pouring));
$('run').textContent=ctrl.running?'暂停':'运行';$('reset').textContent=challenge?'重置关卡':'清空棋盘';$('undo').disabled=!ctrl.session.history.length;
$('run').disabled=!ctrl.running&&s.stable&&(challenge||!ctrl.queue.length);
$('step').disabled=s.stable&&(challenge||!ctrl.queue.length);$('stabilize').disabled=$('step').disabled;
R.draw(board,s,p,challenge?ctrl.session.level.allowedDropCells:[]);
board.setAttribute('aria-label',`${s.width}×${s.height} 沙堆棋盘，方向键选择，Enter 或空格投沙`);
$('selected-cell').textContent=`选中 (${p.x}, ${p.y}) · ${s.cells[p.y*s.width+p.x]} 粒`;
$('queue-count').textContent=challenge?`已完成 ${Object.keys(ctrl.progress).length} / ${levels.length} 关`:`等待投入 ${ctrl.queue.length} 项`;
for(const key of ['total','added','lost','topplings'])$('stat-'+key).textContent=String(s[key]);
$('ledger').textContent=`账本：${s.total} + ${s.lost} = ${s.initialTotal} + ${s.added}`;
$('avalanche').textContent=s.avalancheActive?`本次雪崩已崩塌 ${s.currentAvalanche} 次`:`最近一次雪崩：${s.lastAvalanche} 次基础崩塌`;
$('size').value=String(ctrl.experiment.width);$('speed').value=String(ctrl.settings.speed);$('speed-label').textContent=`${ctrl.settings.speed} 波/秒`;
if(document.activeElement!==$('amount'))$('amount').value=String(ctrl.settings.amount);
for(const axis of ['x','y']){if(document.activeElement!==$('coord-'+axis))$('coord-'+axis).value=String(ctrl.selected[axis]);$('coord-'+axis).max=ctrl.experiment.width-1;}
$('level').value=ctrl.settings.levelId;
for(const option of $('level').options){const l=levels.find(x=>x.id===option.value);option.textContent=l.title+(ctrl.progress[l.id]?' ✓':'');}
if(challenge){const l=ctrl.session.level,status=H.status(ctrl.session),best=ctrl.progress[l.id];R.draw($('target-board'),{width:l.board.width,height:l.board.height,cells:l.board.target});$('level-description').textContent=l.description;$('challenge-progress').textContent=`已用 ${ctrl.session.moves} / ${l.maxMoves} 步 · 最少 ${l.maxMoves} 步${best?' · 个人最好 '+best.best:''}`;$('challenge-result').textContent=status==='won'?'图案完全匹配，挑战完成！':status==='failed'?'次数已用完，本次未达成。试试撤销或重置。':status==='busy'?'雪崩尚未稳定，请等待或单步观察。':'点击虚线格，每次投一粒。';$('next-level').hidden=status!=='won'||l.id===levels[levels.length-1].id;}
teaching.render(ctrl.session.level,challenge);
}
function confirmAction(text,fn){ctrl.pause();action=fn;$('confirm-message').textContent=text;$('confirm-dialog').showModal();$('cancel-action').focus();}
$('cancel-action').onclick=()=>{action=null;$('confirm-dialog').close();render();};
$('confirm-action').onclick=()=>{const fn=action;action=null;$('confirm-dialog').close();if(fn)safely(fn);};
$('confirm-dialog').addEventListener('cancel',()=>{action=null;render();});
function replace(size,preset){const fn=()=>{ctrl.resetExperiment(size,preset);message('新实验已载入，当前暂停。');};if(ctrl.experiment.total||ctrl.queue.length)confirmAction('替换当前实验与待处理投入，关卡记录保留。',fn);else safely(fn);}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>safely(()=>{teaching.clear();ctrl.mode(b.dataset.mode);point={...ctrl.session.level.allowedDropCells[0]};message(ctrl.settings.mode==='explore'?'点击或按键投沙；已有实验已保留。':'先预测，再试落点。可投后暂停，用下方回放拆解每一波。');}));
function amount(){const n=Number($('amount').value);C.integer(n,1,C.LIMITS.input,'投沙量');ctrl.settings.amount=n;return n;}
function drop(p){safely(()=>{if(ctrl.settings.mode==='explore'){ctrl.selected=p;ctrl.drop(p.x,p.y,amount());}else{const before=C.clone(ctrl.state);point=p;ctrl.drop(p.x,p.y);teaching.record(before,p);if($('step-observe').checked)ctrl.pause();}message(ctrl.queue.length?'投入已排队，请运行或稳定化。':'已投沙。');});render();}
board.onclick=e=>{const p=R.hit(board,ctrl.state,e.clientX,e.clientY);if(p){board.focus({preventScroll:true});drop(p);}};
board.onkeydown=e=>{const p=selected(),keys={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(keys[e.key]){e.preventDefault();p.x=Math.max(0,Math.min(ctrl.state.width-1,p.x+keys[e.key][0]));p.y=Math.max(0,Math.min(ctrl.state.height-1,p.y+keys[e.key][1]));ctrl.changed();}else if(e.key==='Enter'||e.key===' '){e.preventDefault();drop({...p});}};
function coordinates(){const x=Number($('coord-x').value),y=Number($('coord-y').value);C.integer(x,0,ctrl.experiment.width-1,'横坐标');C.integer(y,0,ctrl.experiment.height-1,'纵坐标');return{x,y};}
$('drop-selected').onclick=()=>safely(()=>drop(coordinates()));
$('repeat-drop').onclick=()=>safely(()=>{if(ctrl.pouring){ctrl.pause();message('循环投沙已停止，当前暂停。');}else{const p=coordinates(),n=amount(),interval=Number($('pour-interval').value);ctrl.startPour(p.x,p.y,n,interval);ctrl.selected=p;ctrl.changed();message('循环已开始，点击停止循环投沙或暂停即可停止。');}});
$('amount').onchange=()=>safely(()=>{amount();ctrl.changed();});
for(const axis of ['x','y'])$('coord-'+axis).onchange=()=>safely(()=>{const n=Number($('coord-'+axis).value);C.integer(n,0,ctrl.experiment.width-1,'坐标');ctrl.selected[axis]=n;ctrl.changed();});
document.querySelectorAll('[data-amount]').forEach(b=>b.onclick=()=>{ctrl.settings.amount=Number(b.dataset.amount);$('amount').value=String(ctrl.settings.amount);ctrl.changed();});
$('size').onchange=()=>replace(Number($('size').value),'empty');$('load-preset').onclick=()=>replace(ctrl.experiment.width,$('preset').value);
$('run').onclick=()=>safely(()=>ctrl.running?ctrl.pause():ctrl.run());$('step').onclick=()=>safely(()=>ctrl.step());$('stabilize').onclick=()=>safely(()=>ctrl.run(true));
$('speed').oninput=()=>{ctrl.settings.speed=Number($('speed').value);ctrl.changed();};
$('reset').onclick=()=>ctrl.settings.mode==='explore'?replace(ctrl.experiment.width,'empty'):confirmAction('重置当前关卡，保留历史完成记录。',()=>choose(ctrl.settings.levelId));
$('undo').onclick=()=>safely(()=>{teaching.clear();ctrl.undo();});
function choose(id){teaching.clear();ctrl.chooseLevel(id);point={...ctrl.session.level.allowedDropCells[0]};render();}
$('level').onchange=()=>safely(()=>choose($('level').value));$('next-level').onclick=()=>safely(()=>choose(levels[levels.findIndex(x=>x.id===ctrl.settings.levelId)+1].id));
$('export').onclick=()=>safely(()=>{const text=P.encode(ctrl.snapshot(),levels),name='abelian-sandpile-save-v1.json';if(window.AbelianAndroid&&typeof window.AbelianAndroid.saveFile==='function'){ctrl.pause();saveNow();window.AbelianAndroid.saveFile(name,text);message('请选择存档保存位置。');return;}const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);message('已请求导出，请查看浏览器下载位置。');});
window.addEventListener('abelian-export-result',e=>{if(e.detail&&typeof e.detail.message==='string')message(e.detail.message,e.detail.ok===false);});
$('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>P.MAX_BYTES)throw new Error('存档超过 2MiB');const bundle=P.decode(await file.text(),levels);confirmAction('导入会替换当前实验、关卡现场与完成记录。取消保留原数据。',()=>{teaching.clear();ctrl.restore(bundle);point={...ctrl.session.level.allowedDropCells[0]};render();saveNow();message('导入完成，已暂停。');});}catch(error){message(error.message,true);}finally{e.target.value='';}};
$('clear-data').onclick=()=>confirmAction('仅清除阿贝尔沙滩数据，其他游戏存档保留。',()=>{teaching.clear();ctrl.stop();if(timer!==null){clearTimeout(timer);timer=null;}if(storage)P.clear(storage);ctrl.progress={};ctrl.queue=[];ctrl.experiment=C.preset(65,'empty');ctrl.selected={x:32,y:32};ctrl.settings={mode:'explore',speed:20,amount:1,levelId:levels[0].id};ctrl.session=H.create(levels[0]);render();message('本游戏存档已清除。');$('save-status').textContent='存档已清除，下一次修改会自动保存。';});
try{storage=window.localStorage;const saved=P.load(storage,levels);if(saved){ctrl.restore(saved);point={...ctrl.session.level.allowedDropCells[0]};message('已恢复本机存档，当前暂停。');}}catch(e){saveError=true;message(`未恢复存档：${e.message}。原文件未删除。`,true);$('save-status').textContent='存档不可用，请导出重要实验。';}
document.addEventListener('visibilitychange',()=>{if(document.hidden){ctrl.pause();saveNow();}});window.addEventListener('pagehide',()=>{ctrl.pause();saveNow();});
new ResizeObserver(()=>render()).observe(board);render();document.documentElement.dataset.ready='true';
window.SandpileApp=Object.freeze({snapshot:()=>ctrl.snapshot(),get board(){return C.clone(ctrl.state);},get running(){return ctrl.running;},get pouring(){return ctrl.pouring?{...ctrl.pouring}:null;},get lesson(){return teaching.summary;},get saveError(){return saveError;}});
})();
