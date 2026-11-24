import {Game,LEVELS,UNREST_LIMIT,ATTITUDES,columnLabel,playerLimit,formatArmy} from './engine.js';
import {MapEditor} from './map-editor.js';
const $=id=>document.getElementById(id);
const formatTime=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const COUNTRY_VIEWS={
  largest:{title:'最大的国家',label:'最大国家',metric:'land',direction:1},
  smallest:{title:'最小的国家',label:'最小国家',metric:'land',direction:-1},
  strongest:{title:'最强国家',label:'最强国家',metric:'army',direction:1},
  weakest:{title:'最弱国家',label:'最弱国家',metric:'army',direction:-1},
  newest:{title:'最新国家',label:'最新国家',metric:'id',direction:1},
  oldest:{title:'最旧国家',label:'最旧国家',metric:'id',direction:-1}
};
let wins=[];
try{const saved=JSON.parse(localStorage.getItem('territory-wins')||'[]');if(Array.isArray(saved))wins=saved.filter(n=>Number.isInteger(n)&&n>=0&&n<6);}catch{}
let config={mode:'campaign',level:0,difficulty:'normal',humans:1,ai:3,w:10,h:10,observerMode:'continuous',observerSpeed:1,growthMode:'one',terrainMap:null,worldMode:'flat',initialSpawns:null,initialRelations:null,secessionMode:'repeat',peaceSupport:false,multiFront:false};
let savedCustomMap=null;
try{const saved=JSON.parse(localStorage.getItem('territory-custom-map')||'null');if(saved&&[10,30,100].includes(saved.w)&&saved.h===saved.w&&Array.isArray(saved.cells)&&saved.cells.length===saved.w*saved.h&&saved.cells.every(t=>t==='land'||t==='sea')&&saved.cells.includes('land')){new Game({w:saved.w,h:saved.h,humans:1,ai:0,terrainMap:saved.cells,initialSpawns:saved.starts??null,initialRelations:saved.relations??null});savedCustomMap=saved;if(saved.active!==false){assignMapSetup(saved,true);const capacity=Math.min(64,saved.cells.filter(t=>t==='land').length);config.humans=Math.min(config.humans,capacity);config.ai=Math.min(config.ai,capacity-config.humans);}}}catch{}
function mapPlayers(map){return Number.isInteger(map.humans)&&map.humans>=0&&Number.isInteger(map.ai)&&map.ai>=0&&map.humans+map.ai>=1&&map.humans+map.ai<=Math.min(64,map.cells.filter(t=>t==='land').length)?{humans:map.humans,ai:map.ai}:null;}
function assignMapSetup(map,restorePlayers=false){config.w=map.w;config.h=map.h;config.terrainMap=[...map.cells];config.initialSpawns=map.starts?[...map.starts]:null;config.initialRelations=map.relations?map.relations.map(row=>[...row]):null;if(restorePlayers){const players=mapPlayers(map);if(players){config.humans=players.humans;config.ai=players.ai;}}}
function clearMapSetup(){config.terrainMap=null;config.initialSpawns=null;config.initialRelations=null;}
function customPlayerLimit(){return Math.min(playerLimit(config.w,config.h,config.worldMode),config.terrainMap?config.terrainMap.filter(t=>t==='land').length:Infinity);}
function persistCustomMap(active){if(!savedCustomMap)return;savedCustomMap.active=active;try{localStorage.setItem('territory-custom-map',JSON.stringify(savedCustomMap));}catch{}}
let game,selected=null,hovered=null,ratio=.5,sound=false,spectating=false,resultShown=false,pausedByHelp=false,pendingReset=null,resetWasPaused=false,toastTimer,audioCtx;
let tiles=[],factionEls=[],lastLog='',lastFrame=performance.now(),renderTimer=0,resolutionAt=0,lastBattle=null,lastController=0,playbackTime=0,mapView='fit',outlineEnabled=false,outlineKey='',chartMetric='land',lastControlRevision=0;
const flashes=new Map();
function factionColumn(f,id){
  const el=document.createElement('div');el.className='faction-column';el.dataset.factionId=id;el.setAttribute('role','listitem');el.style.setProperty('--faction',f.color);
  el.innerHTML=`<div class="faction-bar-track"><div class="faction-bar"><strong class="faction-bar-value">1</strong></div></div><span class="faction-bar-name">${f.name}</span><span class="faction-bar-controller">${game.isHuman(id)?'P'+(id+1):f.rebel?'新国 · 电脑':'电脑'}</span>`;return el;
}
function currentOptions(){const l=LEVELS[config.level];return {w:config.mode==='campaign'?l.w:config.w,h:config.mode==='campaign'?l.h:config.h,humans:config.mode==='campaign'?1:config.humans,ai:config.mode==='campaign'?l.ai:config.ai,difficulty:config.difficulty,observerMode:config.observerMode,growthMode:config.growthMode,secessionMode:config.secessionMode,peaceSupport:config.peaceSupport,multiFront:config.multiFront,worldMode:config.worldMode,ocean:true,terrainMap:config.mode==='custom'?config.terrainMap:null,initialSpawns:config.mode==='custom'?config.initialSpawns:null,initialRelations:config.mode==='custom'?config.initialRelations:null,seed:20261121+config.level*71+(config.mode==='custom'?31:0)};}
function updateMapView(){
  const area=$('board').closest('.map-area'),large=game.w>20||game.h>20,fitted=large&&mapView==='fit';
  $('mapViewControls').hidden=!large;area.classList.toggle('fit-map',fitted);
  if(large){
    const css=getComputedStyle(area),px=name=>parseFloat(css[name])||0;
    const width=Math.max(40,area.clientWidth-px('paddingLeft')-px('paddingRight')-34);
    const availableHeight=innerHeight-Math.max(0,area.getBoundingClientRect().top)-px('paddingTop')-24-35;
    const height=Math.max(40,Math.min(Math.min(innerHeight*.6,640)-px('paddingTop')-px('paddingBottom')-24,availableHeight));
    const cell=Math.min(width/game.w,height/game.h);
    area.style.setProperty('--fit-width',Math.floor(cell*game.w)+'px');area.style.setProperty('--fit-height',Math.floor(cell*game.h)+'px');
    area.classList.toggle('tiny-cells',fitted&&cell<14);
  }else area.classList.remove('tiny-cells');
  $('fitMapBtn').setAttribute('aria-pressed',mapView==='fit');$('zoomMapBtn').setAttribute('aria-pressed',mapView==='detail');
  renderCountryOutline();
}
function setMapView(view){
  mapView=view;const area=$('board').closest('.map-area');area.scrollTop=0;area.scrollLeft=0;updateMapView();
  if(view==='detail'&&selected!==null)tiles[selected].scrollIntoView({block:'nearest',inline:'nearest'});
}
function setupGame(){
  clearToast();
  game=new Game(currentOptions());selected=null;hovered=null;spectating=game.humans===0;lastController=game.currentHuman;resultShown=false;flashes.clear();lastLog='';lastBattle=null;resolutionAt=0;playbackTime=0;
  lastControlRevision=game.controlRevision;
  $('diplomacyFrom').replaceChildren();
  $('resultDialog').close();$('pauseOverlay').hidden=true;
  const l=LEVELS[config.level];
  $('mapTitle').innerHTML=config.mode==='campaign'?`${l.name}<span>${String(config.level+1).padStart(2,'0')}</span>`:'自由征途<span>∞</span>';
  $('mapSubtitle').textContent=config.mode==='campaign'?l.subtitle+(game.worldMode==='earth'?' · 地球式':''):game.worldMode==='earth'?'地球式地图 · 上下互通，左右互通':'平面式地图 · 四周为墙';
  $('modeLabel').textContent=config.mode==='campaign'?'关卡挑战':'自定义对战';
  $('mapInfo').textContent=`${game.w} × ${game.h} ${config.mode==='custom'&&config.terrainMap?'手绘地图':'陆海'}`;$('factionInfo').textContent=`${game.humans} 人类 · ${game.ai} 电脑`;
  $('board').style.setProperty('--cols',game.w);$('board').style.setProperty('--rows',game.h);
  $('board').classList.toggle('earth-map',game.worldMode==='earth');$('board').setAttribute('aria-label',game.worldMode==='earth'?'地球式地图，上下和左右边缘相连':'平面式地图，四周为墙');
  mapView='fit';const mapArea=$('board').closest('.map-area');mapArea.classList.toggle('large-map',game.w>20||game.h>20);mapArea.style.setProperty('--cols',game.w);mapArea.style.setProperty('--rows',game.h);mapArea.scrollTop=0;mapArea.scrollLeft=0;
  $('colCoords').style.setProperty('--cols',game.w);$('rowCoords').style.setProperty('--rows',game.h);
  $('colCoords').innerHTML=Array.from({length:game.w},(_,x)=>`<span>${columnLabel(x)}</span>`).join('');
  $('rowCoords').innerHTML=Array.from({length:game.h},(_,y)=>`<span>${String(y+1).padStart(2,'0')}</span>`).join('');
  const frag=document.createDocumentFragment();tiles=game.cells.map(c=>{
    const el=document.createElement('button');el.className='cell';el.dataset.id=c.id;el.setAttribute('aria-keyshortcuts','ArrowUp ArrowDown ArrowLeft ArrowRight');
    el.style.setProperty('--tile',`hsl(${86+(c.id*13%15)} ${17+c.id%7}% ${17+c.id*7%4}%)`);
    el.addEventListener('click',()=>clickTile(c.id));el.addEventListener('mouseenter',()=>{hovered=c.id;renderIntel();});el.addEventListener('mouseleave',()=>{hovered=null;renderIntel();});el.addEventListener('focus',()=>{hovered=c.id;renderIntel();});el.addEventListener('blur',()=>{hovered=null;renderIntel();});
    frag.append(el);return el;
  });$('board').replaceChildren(frag);
  const outline=document.createElementNS('http://www.w3.org/2000/svg','svg');outline.id='countryOutline';outline.classList.add('country-outline');outline.setAttribute('aria-hidden','true');outline.setAttribute('focusable','false');$('board').append(outline);outlineKey='';
  factionEls=game.factions.map(factionColumn);$('factionList').replaceChildren(...factionEls);renderSettings();render();updateMapView();
}
function renderSettings(){
  $('campaignTab').classList.toggle('active',config.mode==='campaign');$('campaignTab').setAttribute('aria-selected',config.mode==='campaign');
  $('customTab').classList.toggle('active',config.mode==='custom');$('customTab').setAttribute('aria-selected',config.mode==='custom');
  $('campaignSettings').hidden=config.mode!=='campaign';$('customSettings').hidden=config.mode!=='custom';
  $('completedLabel').textContent=`${wins.length} / 6 完成`;
  $('levelList').innerHTML=LEVELS.map((l,i)=>`<button class="level ${config.level===i?'active':''}" data-level="${i}" aria-pressed="${config.level===i}"><span class="level-num">${String(i+1).padStart(2,'0')}</span><span><span class="level-title">${l.name}</span><span class="level-details">${l.w} × ${l.h} · ${l.ai} 位电脑</span></span>${wins.includes(i)?'<span class="level-check" aria-label="已通关">✓</span>':''}</button>`).join('');
  document.querySelectorAll('[data-diff]').forEach(el=>{el.classList.toggle('active',el.dataset.diff===config.difficulty);el.setAttribute('aria-pressed',el.dataset.diff===config.difficulty);});
  const copy={easy:['基础扩张','电脑优先扩张并简单集结，较少判断反击风险。'],normal:['集中推进','先补齐空地，再集结兵力，从能守住的突破口推进。'],hard:['稳健进攻','更谨慎估算反击风险，持续向突破口集结兵力。']}[config.difficulty];
  $('difficultyTag').textContent=copy[0];$('difficultyDesc').textContent=copy[1];
  $('humanCount').value=config.humans;$('aiCount').value=config.ai;
  const total=config.humans+config.ai,limit=customPlayerLimit();
  $('humanCount').min=config.ai===0?1:0;$('humanCount').max=limit-config.ai;
  $('aiCount').min=config.humans===0?1:0;$('aiCount').max=limit-config.humans;
  $('minusAI').disabled=config.ai===0||total===1;$('plusAI').disabled=total>=limit;
  $('minusHuman').disabled=config.humans===0||total===1;$('plusHuman').disabled=total>=limit;
  $('playerSetupNote').textContent=`${config.humans} 位人类 + ${config.ai} 位电脑，共 ${total}/${limit} 个阵营。可直接输入人数。${config.humans===0?(config.observerMode==='step'?'走一步停一步，每次点击推进一回合。':'一直走，开始后自动连续运行。'):config.ai===0?(config.humans===1?'单人练习，全程手动操作。':'全程由你手动轮流控制各位玩家。'):'人类依次行动，再结算电脑回合。'}`;
  $('mapSize').value=`${config.w},${config.h}`;
  $('customMapNote').textContent=config.terrainMap?`正在使用手绘地图，${config.terrainMap.filter(t=>t==='land').length} 格陆地。可重新绘制，地图保存在此浏览器。`:'当前使用随机海陆地图。点击绘制地图，自由涂出大陆和海洋。';
  $('randomMapBtn').disabled=!config.terrainMap;$('loadMapBtn').hidden=!savedCustomMap||!!config.terrainMap;
  $('growthMode').value=game.growthMode;
  $('secessionMode').value=game.secessionMode;
  $('peaceSupport').value=game.peaceSupport?'on':'off';
  $('secessionModeNote').textContent=game.secessionMode==='repeat'?'新国进攻无关第三国、后方大量调兵可累计动荡；即使没有敌国也能再次分裂。仅直接进攻祖国或此次分裂的交战对手才豁免，与新国自身是否普通／永久敌对无关。':'仅战争动荡：无敌对战争时，后方调兵不新增动荡。任何模式都不能仅凭普通或永久敌对获得战争豁免。';
  $('secessionModeNote').textContent+=' 可在对局中切换；切换本身不清除已有动荡。';
  $('worldMode').value=game.worldMode;$('worldModeNote').textContent=game.worldMode==='earth'?'上下边缘相连，左右边缘相连。可点击对边格子或用方向键跨边进攻、调兵。切换模式会开启新对局。':'四周是墙，不能跨出边界。切换模式会开启新对局。';
  $('growthModeNote').textContent=`目标：新国领土数超过分裂前所属国家。${game.growthMode==='one'?'到目标后，普通格每轮 +1、首都 +3。':'到目标后，仍保留出格普通 ×1、首都 ×3 的增兵规则，新占普通格也按建国基数增兵。'}可在对局中切换。`;
  $('difficulty').querySelectorAll('button').forEach(b=>b.disabled=game.ai===0);
  if(game.ai===0){$('difficultyTag').textContent='无电脑';$('difficultyDesc').textContent='当前没有电脑对手，难度设置不影响人类玩家。';}
  else if(game.humans===0)$('difficultyDesc').textContent=game.observerMode==='step'?'电脑先扩张、再集结推进；每次结算一回合，然后停下。':'电脑先扩张、再集结推进，每轮各行动一次，可随时暂停。';
}
function requestReset(fn){
  if(game.running&&game.winner===null&&!resultShown){resetWasPaused=game.paused;game.paused=true;pendingReset=fn;$('confirmDialog').showModal();render();}
  else{fn();setupGame();}
}
function cancelReset(){pendingReset=null;$('confirmDialog').close();game.paused=resetWasPaused;renderSettings();render();}
function start(){game.running=true;game.paused=false;game.addEvent(game.humans===0?(game.observerMode==='step'?'单步观战开始。点击「推进一回合」，结算后停下。':'自动对战开始。电脑将连续行动，可随时暂停。'):game.humans>1?'人类玩家依次行动；全部行动后，电脑各行动一次，再统一增兵。':'轮到你了。你行动一次，各电脑最多行动一次。');tone(370);render();}
function togglePause(){if(!game.running)return;game.paused=!game.paused;render();}
function toast(msg){$('toast').textContent=msg;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2600);}
function clearToast(){clearTimeout(toastTimer);$('toast').hidden=true;}
function tone(freq=500){if(!sound)return;try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.045,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.12);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.13);}catch{}}
function clickTile(id){
  if(game.winner!==null||spectating){selected=id;render();return;}
  if(game.resolving){toast('正在显示本回合行动，结算结束后轮到你');return;}
  if(game.paused){toast('战局已暂停，继续战斗后即可出兵');return;}
  if(!game.running){if(game.cells[id].owner===lastController){selected=id;render();}toast('点击「开始征战」，开启你的征途');return;}
  if(id===selected){selected=null;render();return;}
  const cell=game.cells[id];
  if(selected!==null&&game.sourceBlockReason(selected,lastController)&&cell.owner===lastController){selected=id;render();return;}
  if(selected!==null&&game.cells[selected].owner===lastController&&game.neighbors(selected).includes(id)){
    const result=game.playTurn(selected,id,ratio,{defer:true});
    if(!result.ok){toast(result.reason);render();return;}
    clearToast();flashActions(result.actions);
    lastBattle={action:result,reinforced:0,grew:0};resolutionAt=playbackTime+550;
    tone(result.captured?680:300);
    if(cell.owner===lastController)selected=game.canUseSource(id,lastController)?id:null;
    else if(result.amount>0)toast(`派出 ${formatArmy(result.amount)}，守军 ${formatArmy(result.toBefore)} → ${formatArmy(result.toAfter)}；未攻占`);
    if(result.captured&&result.oldOwner===-1&&game.captures===1)game.addEvent('首块领土已占领！领土越多，兵力增长越快。','system',0);
    if(selected!==null&&game.cells[selected].owner!==lastController)selected=null;
    checkResult();render();return;
  }
  if(cell.owner===lastController){selected=id;render();}
  else toast(selected===null?`当前由${game.factions[lastController].name}玩家行动，请选择该阵营领土`:'只能进攻上下左右相邻的格子');
}
function coord(id){return `${columnLabel(id%game.w)}${Math.floor(id/game.w)+1}`;}
function flashActions(actions){for(const a of actions||[])if(a.ok)flashes.set(a.toId,{until:performance.now()+350,captured:a.captured});}
function waitTurn(){if(game.continuous)return;const result=game.waitTurn({defer:true});if(!result.ok)return;clearToast();lastBattle=null;resolutionAt=playbackTime+180;flashActions(result.actions);if(selected!==null&&game.cells[selected].owner!==lastController)selected=null;checkResult();render();}
function moveCapital(){
  if(selected===null)return;
  const result=game.moveCapital(selected,{defer:true,fromId:Number($('capitalSource').value)});if(!result.ok){toast(result.reason);return;}
  lastBattle=null;resolutionAt=playbackTime+350;flashActions(result.actions);
  toast(`首都已迁至 ${coord(result.toId)}`);checkResult();render();
}
function buildCapital(){
  if(selected===null)return;
  const result=game.buildCapital(selected,{defer:true});if(!result.ok){toast(result.reason);return;}
  lastBattle=null;resolutionAt=playbackTime+350;flashActions(result.actions);
  toast(`已在 ${coord(result.toId)} 建设新首都`);checkResult();render();
}
function declareWar(target){
  const result=game.declareWar(target,{defer:true});if(!result.ok){toast(result.reason);return;}
  lastBattle=null;resolutionAt=playbackTime+350;
  toast(`已对${game.factions[target].name}宣战，消耗一次行动`);checkResult();render();
}
function advanceResolution(now){
  if(!game.resolving||game.paused||now<resolutionAt)return;
  const phase=game.stepTurn();if(!phase)return;
  if(phase.action?.ok){
    flashActions([phase.action]);
    if(lastBattle&&phase.action.toId===lastBattle.action.toId&&['reinforce','support'].includes(phase.action.kind))lastBattle.reinforced+=phase.action.amount;
  }
  if(lastBattle&&phase.kind==='growth')lastBattle.grew=phase.changes.find(c=>c.id===lastBattle.action.toId)?.amount||0;
  if(phase.secessions?.length){
    lastBattle=null;for(const country of phase.secessions)for(const id of country.cells)flashes.set(id,{until:performance.now()+700,captured:true});
    toast(`${phase.secessions.map(c=>game.factions[c.owner].name).join('、')}因地区动荡宣布独立`);
  }
  resolutionAt=now+(phase.action?.ok?420:100);
  checkResult();render();
}
function renderBattleResult(){
  $('combatResult').hidden=!lastBattle;if(!lastBattle)return;
  const {action:a,reinforced,grew}=lastBattle;
  $('combatResult').textContent=a.kind==='reinforce'
    ? `己方增援 ${coord(a.toId)}：${formatArmy(a.toBefore)} + ${formatArmy(a.amount)} = ${formatArmy(a.toAfter)}`
    : `${game.factions[a.owner].name}派出 ${formatArmy(a.amount)} · 守军 ${formatArmy(a.toBefore)} − ${formatArmy(Math.min(a.amount,a.toBefore))} = ${formatArmy(Math.max(0,a.toBefore-a.amount))}${a.captured?` · 已攻占，驻军 ${formatArmy(a.toAfter)}`:' · 未攻占'}${reinforced?` · 随后增援 +${formatArmy(reinforced)}`:''}${grew?` · 回合增兵 +${formatArmy(grew)}`:''}${a.oldOwner>=0?' · 交战格本回合不自动增兵':''}`;
  if(a.peaceSupport)$('combatResult').textContent+=` · 支援${game.factions[a.defenseFor].name}，外交关系不下降`;
}
function render(){
  if(lastControlRevision!==game.controlRevision){lastControlRevision=game.controlRevision;spectating=game.automatic;lastController=game.currentHuman;selected=null;hovered=null;lastBattle=null;resultShown=false;$('resultDialog').close();renderSettings();}
  if(game.currentHuman!==null&&game.currentHuman!==lastController){lastController=game.currentHuman;selected=null;hovered=null;if(!outlineEnabled&&!Object.hasOwn(COUNTRY_VIEWS,$('diplomacyFrom').value))$('diplomacyFrom').value=String(lastController);}
  const faction=lastController!==null?game.factions[lastController]:null;
  $('factionInfo').textContent=`${game.humans} 人类 · ${game.ai} 电脑${game.secessions?` · ${game.secessions} 个新国`:''}`;
  const observationName=game.observerMode==='step'?'走一步停一步':'一直走';
  $('observerControls').hidden=!game.automatic;
  document.querySelectorAll('[data-observer-mode]').forEach(b=>{const active=b.dataset.observerMode===game.observerMode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);b.disabled=game.winner!==null;});
  document.querySelectorAll('[data-observer-speed]').forEach(b=>{const active=+b.dataset.observerSpeed===config.observerSpeed;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);b.disabled=game.winner!==null;});
  $('observerModeNote').textContent=game.observerMode==='step'?`当前 ${config.observerSpeed}×：只加快回合内动画，每次仍只走一回合。切换模式时会完成当前回合。`:`当前 ${config.observerSpeed}×：加快电脑行动和回合间隔，可随时调速或暂停。`;
  document.documentElement.style.setProperty('--accent',faction?.color||game.factions[0].color);
  $('currentPlayer').textContent=game.humans===0?`纯电脑观战 · ${observationName} · ${config.observerSpeed}×`:spectating&&game.automatic?`电脑观战 · ${observationName} · ${config.observerSpeed}×`:`当前控制：玩家 ${lastController+1} · ${faction.name}${game.humans>1?'（同机轮流）':''}${game.ai===0?' · 全程手动':''}`;
  if(lastController!==null&&!game.automatic&&game.capitalLost[lastController])$('currentPlayer').textContent+=' · 首都已失守，可建设新首都';
  $('currentPlayer').style.setProperty('--player-color',faction?.color||game.factions[0].color);
  $('yourLandLabel').textContent=faction?`${faction.name}领土`:'阵营领土';
  $('yourLandSquare').style.background=faction?`rgba(${faction.rgb},.3)`:'#46523a';$('yourLandSquare').style.borderColor=faction?.color||'#72846b';
  const neighbors=selected!==null&&game.canUseSource(selected,lastController)&&game.running&&!game.paused&&!game.resolving&&!spectating?game.neighbors(selected).filter(id=>!game.seaBlocked(lastController,game.cells[id])&&game.canAttack(lastController,game.cells[id].owner)):[];
  $('board').setAttribute('aria-busy',game.resolving);
  const now=performance.now();
  game.cells.forEach((c,i)=>{
    const el=tiles[i],f=c.owner>=0?game.factions[c.owner]:null,flash=flashes.get(i);
    const unrest=f?game.unrest(c):0,capital=game.isCapital(c),isSelected=i===selected,reachable=neighbors.includes(i),flashClass=flash&&flash.until>now?(flash.captured?'flash':'attacked'):'';
    const sourceReason=game.multiFront&&c.owner===lastController?game.sourceBlockReason(i,lastController):'';
    const renderKey=`${c.terrain}|${c.owner}|${c.army}|${capital}|${isSelected}|${reachable}|${unrest}|${flashClass}|${c.owner>=0&&c.owner===lastController}|${sourceReason}`;
    if(el._renderKey===renderKey)return;el._renderKey=renderKey;
    const cls=`cell ${c.terrain==='sea'?'sea':'land'} ${f?'owned':'empty'} ${c.army>=10000?'large-army':''} ${capital?'capital':''} ${unrest>=2?'unstable':''} ${isSelected?'selected':''} ${reachable?'reachable':''} ${game.w>=16?'small':''} ${flashClass} ${sourceReason?'source-spent':''}`;
    if(el.className!==cls)el.className=cls;
    const label=`${coord(i)}，${c.terrain==='sea'?'海洋，':'陆地，'}${f?(c.owner===lastController?'你的领土':f.name+'领土')+'，'+c.army+' 兵力'+(game.isCapital(c)?'，首都':'')+`，动荡 ${unrest}/${UNREST_LIMIT}`:'未占领'}`;
    el.title=label+(sourceReason?'，'+sourceReason:'');
    if(el.getAttribute('aria-label')!==el.title)el.setAttribute('aria-label',el.title);
    el.setAttribute('aria-pressed',i===selected);
    el.style.setProperty('--faction',f?.color||'#aac56f');
    const html=f?`${c.terrain==='sea'?'<span class="cell-sea-mark" aria-hidden="true">≈</span>':''}${game.isCapital(c)?'<svg class="cell-flag"><use href="#i-flag"/></svg>':''}<span class="cell-army">${formatArmy(c.army,'map')}</span><span class="cell-faction">${f.symbol}</span>`:'';
    if(el.innerHTML!==html)el.innerHTML=html;
  });
  $('timer').textContent=formatTime(game.time);
  $('turnLabel').textContent=`第 ${game.turn} 回合`;
  $('waitBtn').hidden=!game.running||game.continuous;$('waitBtn').disabled=game.paused||game.resolving;
  $('waitBtn').textContent=game.automatic?'推进一回合':game.multiFront?'结束本国行动':'蓄兵一回合';
  const requestedMultiFront=game.pendingMultiFront??game.multiFront;
  $('multiFrontBtn').setAttribute('aria-pressed',String(requestedMultiFront));
  $('multiFrontBtn').textContent=`多线作战：${requestedMultiFront?'开启':'关闭'}${game.pendingMultiFront!==null?'（下轮生效）':''}`;
  $('multiFrontNote').textContent=game.multiFront?'向外出兵不消耗本国这一步，同一来源格每轮只能出兵一次；内部调兵消耗一步，结束本国行动。新占或收复的格子下轮才能出兵。玩家和电脑规则相同。':'开启后，向外出兵不消耗一步，内部调兵消耗一步；同一来源格每轮只出兵一次，新占格子下轮才能出兵。';
  const capitals=lastController===null?[]:game.capitals(lastController),hasCapital=capitals.length>0;
  const capitalSource=$('capitalSource'),previousSource=capitalSource.value;
  const sourceOptions=capitals.map(c=>`<option value="${c.id}">迁出 ${coord(c.id)}</option>`).join('');
  if(capitalSource.innerHTML!==sourceOptions){capitalSource.innerHTML=sourceOptions;if(capitals.some(c=>String(c.id)===previousSource))capitalSource.value=previousSource;}
  capitalSource.hidden=!game.running||game.automatic||spectating||capitals.length<2;
  capitalSource.disabled=game.paused||game.resolving;
  $('moveCapitalBtn').hidden=!game.running||game.automatic||spectating||!hasCapital;
  $('buildCapitalBtn').hidden=!game.running||game.automatic||spectating;
  $('buildCapitalBtn').textContent=`建设首都 ${capitals.length}/2`;
  const capitalTarget=selected===null?null:game.cells[selected];
  const capitalLost=game.currentHuman!==null&&game.capitalLost[game.currentHuman];
  $('moveCapitalBtn').disabled=game.paused||game.resolving||capitalLost||!capitalTarget||capitalTarget.owner!==game.currentHuman||game.isCapital(capitalTarget);
  $('moveCapitalBtn').title=capitalLost?'当前没有首都，请先建设新首都':'选中己方普通领土后迁都，消耗本次行动';
  $('buildCapitalBtn').disabled=game.paused||game.resolving||!capitalTarget||capitalTarget.owner!==game.currentHuman||game.isCapital(capitalTarget)||capitals.length>=2;
  $('buildCapitalBtn').title=capitals.length>=2?'已有两座首都，可以选择一座迁都':'选中己方普通领土建设，消耗一次行动';
  const ended=game.winner!==null;
  $('gameState').textContent=ended?'战斗结束':game.paused?'战局暂停':game.resolving?'回合结算中':game.running?(game.automatic?(game.continuous?'自动对战中':'等待下一步'):game.humans>1?`${faction.name}的回合`:'轮到你了'):'准备就绪';
  $('gameState').classList.toggle('running',game.running&&!game.paused);
  $('pauseBtn').disabled=!game.running;$('pauseBtn').setAttribute('aria-label',game.paused?'继续游戏':'暂停游戏');$('pauseBtn').innerHTML=`<svg><use href="#i-${game.paused?'play':'pause'}"/></svg>`;
  $('pauseOverlay').hidden=!game.paused||!game.running||$('helpDialog').open||$('confirmDialog').open||$('resultDialog').open;
  $('startBtn').hidden=game.running||game.time>0||ended;$('troopControl').hidden=!game.running||spectating||game.automatic;
  $('startBtn').innerHTML=`<svg><use href="#i-cross"/></svg>${game.humans===0?'开始观战':'开始征战'}`;
  if(ended){$('hintTitle').textContent=game.isHuman(game.winner)?(game.humans===1?'全境归你，征途完成！':`玩家 ${game.winner+1} · ${game.factions[game.winner].name}获胜`):`${game.factions[game.winner].name}统一了全境`;$('hintText').textContent='选择新关卡，或者点击重开再战一局。';}
  else if(game.paused){$('hintTitle').textContent='战局已暂停';$('hintText').textContent='点击继续，或按空格键返回战斗。';}
  else if(game.resolving){$('hintTitle').textContent='正在结算本回合';$('hintText').textContent='先显示战斗扣兵，再显示电脑行动和增兵。';}
  else if(game.automatic){$('hintTitle').textContent=game.observerMode==='step'?'走一步停一步':game.running?'自动运行中':'纯电脑自动对战';$('hintText').textContent=game.observerMode==='step'?(game.running?'点击「推进一回合」或按 E，完成一轮后停下。':'点击「开始观战」后，可逐回合推进电脑对战。'):game.running?'电脑会自行出兵和增兵，无需点击，可随时暂停。':'点击「开始观战」后，电脑会自动连续对战。';}
  else if(!game.running){$('hintTitle').textContent=game.humans===0?'观看电脑之间的领土争夺':'从你的第一块领土开始';$('hintText').textContent=game.humans>1?'各位玩家在同一台设备上轮流操作。':'回合制对战，你思考时电脑不动。';}
  else if(selected!==null&&game.cells[selected].owner===lastController){const c=game.cells[selected],blocked=game.sourceBlockReason(selected,lastController);$('hintTitle').textContent=blocked?`${coord(selected)} · 本轮不能出兵`:`${coord(selected)} 已选中 · 可派出 ${formatArmy(game.sent(c,ratio))} 兵力`;$('hintText').textContent=blocked|| (game.multiFront?'向外出兵不消耗一步；内部调兵消耗一步，结束本国行动。每个来源格只可出兵一次。':'出兵才推进回合；可以慢慢思考，不必抢点。');}
  else{$('hintTitle').textContent=game.humans>1?`轮到玩家 ${lastController+1} · ${faction.name}`:'轮到你了，慢慢规划';$('hintText').textContent=game.multiFront?`本国还有 ${game.readySources(lastController).length} 个格子可出兵；也可结束本国行动。`:'选中己方领土出兵，或蓄兵一回合。';}
  const stats=game.stats(),mine=lastController===null?stats.reduce((a,b)=>a.land>=b.land?a:b):stats[lastController],total=game.cells.length;
  const living=stats.filter(s=>s.land>0),nationCount=living.length,ownedLand=living.reduce((sum,s)=>sum+s.land,0),totalArmy=living.reduce((sum,s)=>sum+s.army,0);
  const averageLand=nationCount?ownedLand/nationCount:0,averageArmy=nationCount?totalArmy/nationCount:0;
  $('battleNationCount').textContent=String(nationCount);
  for(const [id,value,unit]of [['battleAverageLand',averageLand,'格'],['battleAverageArmy',averageArmy,'人']]){
    const exact=value.toLocaleString('zh-CN',{maximumFractionDigits:2}),el=$(id);
    el.textContent=id==='battleAverageArmy'&&value>=10000?formatArmy(value,'compact'):exact;el.dataset.value=String(value);el.title=`每个存活国家平均 ${exact} ${unit}`;el.setAttribute('aria-label',el.title);
  }
  $('occupationLabel').textContent=lastController===null?'领先阵营占领率':`${faction.name}占领率`;
  const chartMax=Math.max(2,...stats.map(s=>s[chartMetric]));
  const chartLabel=chartMetric==='army'?'兵力数量':'领土数量';
  $('chartMetricLabel').textContent=chartLabel+(chartMetric==='army'?' / 人':' / 格');
  $('factionList').dataset.metric=chartMetric;$('factionList').setAttribute('aria-label',`各阵营${chartLabel}，从左到右由低到高`);
  document.querySelectorAll('[data-chart-metric]').forEach(b=>{const active=b.dataset.chartMetric===chartMetric;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});
  while(factionEls.length<stats.length){const id=factionEls.length;factionEls.push(factionColumn(game.factions[id],id));}
  $('factionList').style.setProperty('--faction-count',stats.length);
  $('factionList').classList.toggle('many-factions',stats.length>8);
  stats.forEach((s,id)=>{const column=factionEls[id],value=s[chartMetric];column.dataset.land=s.land;column.dataset.army=s.army;column.dataset.value=value;column.classList.toggle('dead',s.land===0);column.classList.toggle('current-faction',id===game.currentHuman);column.querySelector('.faction-bar').style.height=`${value/chartMax*100}%`;column.querySelector('.faction-bar-value').textContent=chartMetric==='army'?formatArmy(value,'compact'):value;column.querySelector('.faction-bar-controller').textContent=s.land?(s.human?'P'+(id+1):s.rebel?'新国 · 电脑':'电脑'):'出局';column.title=`${s.name}：${s.land} 格领土，${s.army} 总兵力`;column.setAttribute('aria-label',column.title);});
  const ranked=[...stats].sort((a,b)=>a[chartMetric]-b[chartMetric]||a.id-b.id);
  const ordered=ranked.map(s=>factionEls[s.id]);
  if(ordered.some((el,i)=>$('factionList').children[i]!==el))$('factionList').replaceChildren(...ordered);
  $('aliveCount').textContent=`${stats.filter(s=>s.land).length} 方存活`;
  $('occupation').innerHTML=`${(mine.land/total*100).toFixed(1)}<small>%</small>`;$('occupationBar').style.width=`${mine.land/total*100}%`;
  const neutral=total-stats.reduce((s,f)=>s+f.land,0);$('neutralCount').textContent=`${neutral} 格`;
  $('territoryShare').innerHTML=stats.filter(s=>s.land).map(s=>`<i style="width:${s.land/total*100}%;background:${s.color}"></i>`).join('')+`<i style="width:${neutral/total*100}%;background:#46523a"></i>`;
  const logKey=game.events.map(e=>e.text+e.time).join('|');
  if(logKey!==lastLog){lastLog=logKey;$('battleLog').innerHTML=game.events.slice(0,5).map(e=>`<div class="log-item" ${e.owner>=0?`style="border-color:${game.factions[e.owner].color}66"`:''}><time>${formatTime(e.time)}</time><p>${e.text}</p></div>`).join('');}
  renderDiplomacy(stats);renderCountryOutline();renderIntel();renderBattleResult();
}
function renderCountryOutline(){
  const svg=$('countryOutline');if(!svg||!game)return;
  const owner=Number($('diplomacyFrom').dataset.countryId),nation=game.factions[owner],cells=game.cells.filter(c=>c.owner===owner),visible=outlineEnabled&&!!nation&&cells.length>0;
  svg.hidden=!visible;svg.style.display=visible?'block':'none';
  $('countryOutlineStatus').hidden=!visible;
  $('showCountryOutline').setAttribute('aria-pressed',visible);
  $('showCountryOutline').textContent=visible?'隐藏轮廓':'查看轮廓';
  if(!visible)return;
  $('countryOutlineName').textContent=`轮廓：${nation.name} · ${cells.length} 格`;
  $('countryOutlineStatus').style.setProperty('--outline-color',nation.color);
  const board=$('board'),{width,height}=board.getBoundingClientRect(),style=getComputedStyle(board),gapX=parseFloat(style.columnGap)||0,gapY=parseFloat(style.rowGap)||0;
  const key=`${game.w},${game.h},${owner},${width},${height},${gapX},${gapY}:`+cells.map(c=>c.id).join(',');
  if(key===outlineKey)return;outlineKey=key;
  const stepX=(width+gapX)/game.w,stepY=(height+gapY)/game.h,segments=[];
  for(const c of cells){
    const x=c.id%game.w,y=Math.floor(c.id/game.w),left=x?x*stepX-gapX/2:0,right=x===game.w-1?width:(x+1)*stepX-gapX/2,top=y?y*stepY-gapY/2:0,bottom=y===game.h-1?height:(y+1)*stepY-gapY/2;
    // The displayed map has cut edges even when the world wraps across them.
    if(y===0||game.cells[c.id-game.w].owner!==owner)segments.push(`M${left},${top}H${right}`);
    if(x===game.w-1||game.cells[c.id+1].owner!==owner)segments.push(`M${right},${top}V${bottom}`);
    if(y===game.h-1||game.cells[c.id+game.w].owner!==owner)segments.push(`M${left},${bottom}H${right}`);
    if(x===0||game.cells[c.id-1].owner!==owner)segments.push(`M${left},${top}V${bottom}`);
  }
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.style.setProperty('--outline-color',nation.color);
  const d=segments.join('');svg.replaceChildren(...['country-outline-shadow','country-outline-line'].map(cls=>{const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);path.setAttribute('class',cls);return path;}));
}
function toggleCountryOutline(enabled=!outlineEnabled){
  outlineEnabled=enabled;renderCountryOutline();updateMapView();
  if(enabled&&innerWidth<=1000)$('board').closest('.map-shell').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderDiplomacy(stats=game.stats()){
  const select=$('diplomacyFrom'),alive=stats.filter(s=>s.land),previous=select.value;
  const options=Object.entries(COUNTRY_VIEWS).map(([value,view])=>`<option value="${value}">${view.title} · 自动跟随</option>`).join('')+alive.map(s=>`<option value="${s.id}">${s.name}${s.human?' · 玩家 '+(s.id+1):''}</option>`).join('');
  if(select.innerHTML!==options){select.innerHTML=options;select.value=Object.hasOwn(COUNTRY_VIEWS,previous)||alive.some(s=>String(s.id)===previous)?previous:String(alive.find(s=>s.id===game.currentHuman)?.id??alive[0]?.id??0);}
  // Faction ids are assigned in founding order and never reused after elimination.
  const mode=select.value,view=COUNTRY_VIEWS[mode],viewed=view?alive.reduce((best,s)=>!best||(s[view.metric]-best[view.metric])*view.direction>0?s:best,null):alive.find(s=>s.id===Number(mode));
  const from=viewed?.id??0,nation=game.factions[from];select.dataset.countryId=String(from);
  const pendingControl=game.pendingHumanControl;
  $('takeCountryControl').textContent=game.isHuman(from)?'交还电脑控制':'接管国家 · 手动操作';
  $('takeCountryControl').disabled=game.winner!==null||!viewed||!!pendingControl;
  $('countryControlNote').textContent=pendingControl?`本轮结束后，${game.factions[pendingControl.owner].name}${pendingControl.human?'交给玩家操作':'交还电脑控制'}。${game.paused?'请继续游戏以完成当前回合。':''}`:game.isHuman(from)?(game.currentHuman===from?'当前由玩家操作，点击己方领土，再点相邻格子出兵。':'由人类玩家控制，按回合顺序轮流行动。'):'可接管此国手动出兵；回合结算中会等本轮结束再切换。';
  const army=viewed?.army??0,exactArmy=army.toLocaleString('zh-CN',{maximumFractionDigits:0});
  $('mapCountrySummary').dataset.countryId=String(from);$('mapCountrySummary').style.setProperty('--viewed-country-color',nation.color);
  $('mapViewedNation').textContent=nation.name;
  $('mapViewedArmy').textContent=formatArmy(army);$('mapViewedArmy').dataset.value=String(army);
  $('mapViewedArmy').title=`${nation.name}总兵力：${exactArmy}`;$('mapViewedArmy').setAttribute('aria-label',`${nation.name}总兵力 ${exactArmy}`);
  $('viewCountryNote').textContent=`${view?'自动跟随'+view.label:'当前查看'}：${nation.name} · ${view?.metric==='army'?formatArmy(viewed?.army??0)+' 总兵力 · ':''}${viewed?.land??0} 格${view?(view.metric==='id'?'（按成立顺序，忽略已出局国家；同批国家按国家顺序）':`（按${view.metric==='army'?'兵力总数':'领土格数'}，忽略已出局国家；并列按国家顺序）`):''}`;
  $('diplomacyList').classList.toggle('many-factions',alive.length>8);
  const chance=game.globalDiplomacyChances(),percent=n=>(n*100).toFixed(4).replace(/0+$/,'').replace(/\.$/,'');
  const last=game.lastGlobalDiplomacy,outcome=last?.kind==='global-up'?'本轮：全局上升一级':last?.kind==='global-down'?'本轮：全局下降一级':last?.kind==='global-cancel'?'本轮：上升与下降同时命中，抵消':last?'本轮：未命中全局变化':'每个完整回合统一判定';
  $('globalDiplomacy').innerHTML='<div><span>全局上升 <b>'+percent(chance.up)+'%</b></span><span>全局下降 <b>'+percent(chance.down)+'%</b></span></div><p>和平加成 '+game.globalPeaceLevel+' 次 · 敌对加成 '+game.globalHostilityLevel+' 次</p><small>'+outcome+'</small>';
  const rows=alive.filter(s=>s.id!==from).map(s=>{
    const contact=game.sharesBorder(from,s.id),fixedOut=game.isPersistentRelation(from,s.id);
    return '<div class="diplomacy-row" data-relation-target="'+s.id+'" data-contact="'+contact+'"><strong style="color:'+s.color+'">'+s.name+'</strong><span>'+nation.name+'对'+s.name+'<b class="attitude attitude-'+game.attitude(from,s.id)+'" data-direction="out">'+game.relationLabel(from,s.id)+'</b></span><span>'+s.name+'对'+nation.name+'<b class="attitude attitude-'+game.attitude(s.id,from)+'" data-direction="in">'+game.relationLabel(s.id,from)+'</b></span><p class="diplomacy-note">'+(contact?'已接触，可依态度行动':'未接触，双方关系保持不变')+'。'+(game.isPermanentRelation(from,s.id)?nation.name+'对'+s.name+'的建国关系永久固定，全局升降及受击均不能解除。':'只有已接触且未永久固定的关系参与全局升降。')+(game.isPermanentRelation(s.id,from)?s.name+'对'+nation.name+'的建国关系也永久固定。':'')+(nation.rebel?' 进攻免动荡：'+(game.secessionExempt(from,s.id)?(nation.origin===s.id?'目标是祖国':'目标是此次分裂的交战对手'):'无，普通或永久敌对本身不豁免')+'。':'')+'</p>'+(contact&&!fixedOut&&game.isHuman(from)&&from===lastController&&game.attitude(from,s.id)!==2?'<button class="secondary declare-war-btn" data-declare-war="'+s.id+'" '+(!game.running||game.paused||game.resolving||game.currentHuman!==from||spectating?'disabled':'')+'>对'+s.name+'宣战 · 一次行动</button>':'')+'</div>';
  }).join('')||'<p class="diplomacy-empty">当前没有其他存活国家。</p>';
  if($('diplomacyList').innerHTML!==rows)$('diplomacyList').innerHTML=rows;
  $('diplomacyOrigin').textContent=nation.rebel?`因${nation.cause==='drain'?'内部矛盾（反复调走驻军）':'战乱'}独立，原属国：${game.factions[nation.origin].name}。${nation.warOpponent==null?'无额外交战敌国':'此次分裂的交战对手只有：'+game.factions[nation.warOpponent].name}。建国关系永久固定，全局升降及受击均不能解除；只有直接进攻祖国及此次分裂的交战对手才豁免该次战斗，后方调兵不沿用战争豁免。对无关国家默认中立，远方关系保持不变。`:'初始国家，各方向态度独立变化。';
  const defenseOrders=game.activeDefenseOrders(from);$('peaceSupportStatus').hidden=!defenseOrders.length;
  if(defenseOrders.length){const order=defenseOrders[0],blocked=game.defenseBlockade(from,order.beneficiary).blocked;$('peaceSupportStatus').textContent=`和平支援：保护${game.factions[order.beneficiary].name}，反击${game.factions[order.enemy].name}。${blocked?'到友国的所有通路均被和平国家挡住，允许支援突破。':'有可绕行通路，不进攻沿途的和平国家。'}支援照常扣兵，支援进攻不降低外交关系。`;}
  if(nation.rebel)$('diplomacyOrigin').textContent+=game.secessionMode==='repeat'?' 当前允许再次分裂。':' 当前使用仅战争动荡规则。';
  if(nation.peaceLevel||nation.hostilityLevel)$('diplomacyOrigin').textContent+=' 本国累计提供和平加成 '+(nation.peaceLevel??0)+' 次、敌对加成 '+(nation.hostilityLevel??0)+' 次（每种整局最多一次）。';
  if(nation.growthLimited)$('diplomacyOrigin').textContent+=` 领土曾超过原国家${game.factions[nation.parent??nation.origin].name}，${game.flatGrowth(from)?'按到目标加一，普通格每轮 +1、首都 +3':'按到目标持续，保留出格增兵倍率，新占普通格同样按建国基数增兵'}。`;
}
function renderIntel(){
  const id=hovered??selected;if(id===null){$('tileIntel').innerHTML='<div class="intel-placeholder">◇</div><p>选择一块领土<br><span>查看兵力与进攻信息</span></p>';return;}
  const c=game.cells[id],f=c.owner>=0?game.factions[c.owner]:null;
  let note=c.owner===-1?'未占领 · 没有守军':`${game.isCapital(c)?'首都':'普通领土'} · 每轮 +${formatArmy(game.growthAmount(c))} 兵力`;
  if(selected!==null&&selected!==id&&game.cells[selected].owner===lastController&&game.neighbors(selected).includes(id)){
    const sent=game.sent(game.cells[selected],ratio);note=c.owner===lastController?`调兵：可增援 ${formatArmy(sent)} 兵力`:sent>c.army?`可攻占 · 出兵后剩余 ${formatArmy(sent-c.army)}`:`守军 ${formatArmy(c.army)} · 可出兵 ${formatArmy(sent)}`;
    if(!game.canAttack(lastController,c.owner))note=game.attitude(lastController,c.owner)===0?'和平国家 · 宣战后才能进攻':'中立国家 · 仅能反击或先宣战';
  }
  if(c.terrain==='sea')note+=c.owner===lastController?' · 己方海洋领地，可正常调兵':game.seaBlocked(lastController,c)?' · 本回合入海已失败，只能改攻陆地':' · 海洋：进入前需通过 10% 判定，失败不扣兵，仍可攻打陆地';
  if(c.owner>=0&&game.flatGrowth(c.owner))note+=' · 领土已超过原国家，普通格每轮 +1、首都 +3';
  else if(c.owner>=0&&c.birthArmy!==undefined)note+=` · 出格基数 ${formatArmy(c.birthArmy)}，${game.isCapital(c)?'首都 ×3':'普通格 ×1'}`;
  else if(c.owner>=0&&f.birthArmy!==undefined)note+=` · 新国建国基数 ${formatArmy(f.birthArmy)}，${game.isCapital(c)?'首都 ×3':'普通格 ×1'}`;
  if(c.owner>=0)note+=game.turn<c.stableUntil?` · 新国稳定期 ${c.stableUntil-game.turn} 回合`:` · 动荡 ${game.unrest(c)}/${UNREST_LIMIT}${game.unrest(c)>=2?'，注意分裂风险':''}`;
  if(c.owner>=0&&lastController!==null&&c.owner!==lastController)note+=` · 对${game.factions[lastController].name}${ATTITUDES[game.attitude(c.owner,lastController)]}，反向${ATTITUDES[game.attitude(lastController,c.owner)]}`;
  if(c.owner>=0&&lastController!==null&&c.owner!==lastController){const defense=game.peaceSupportContext(lastController,c.owner);if(defense)note+=` · 可支援${game.factions[defense.beneficiary].name}进攻此国，正常扣兵，外交关系不下降`;}
  $('tileIntel').innerHTML=`<div class="tile-preview ${c.army>=10000?'large-army':''}" style="${f?`color:${f.color};border-color:${f.color}77;background:rgba(${f.rgb},.15)`:'background:#2e3d27;border-color:#596d48;color:#a3b68c'}">${c.owner>=0?formatArmy(c.army):'◇'}</div><div class="tile-detail"><div class="coordinate">${coord(id)}<span>${f?f.symbol:''}</span></div><strong>${f?(c.owner===lastController?'你的领土':f.name+'阵营'):(c.terrain==='sea'?'未占领的海洋':'未占领的土地')}</strong><p class="intel-note">${note}</p></div>`;
}
function checkResult(){
  if(resultShown||game.resolving)return;
  const lost=game.humans>0&&game.aliveHumans().length===0;
  if(game.winner===null&&(!lost||spectating))return;
  resultShown=true;const won=game.isHuman(game.winner);
  if(won&&config.mode==='campaign'&&!wins.includes(config.level)){wins.push(config.level);try{localStorage.setItem('territory-wins',JSON.stringify(wins));}catch{}renderSettings();}
  if(game.winner===null)game.paused=true;
  $('resultEyebrow').textContent=won?'TERRITORY CONQUERED':game.winner!==null?'BATTLE COMPLETE':'THE NEXT EXPEDITION AWAITS';
  $('resultTitle').textContent=won?(game.humans===1?'全境归你':`玩家 ${game.winner+1} · ${game.factions[game.winner].name}获胜`):game.winner!==null?`${game.factions[game.winner].name}赢得胜利`:'暂别这一片疆土';
  $('resultDesc').textContent=won?'从一格领土，到整片大陆。这一战，你做到了。':game.winner!==null?'全图已被统一。再出发，下一场胜利或许属于你。':'你的领土已全部失守。调整策略，再出发。';
  $('resultStats').innerHTML=`<div><strong>${game.turn}</strong><span>征战回合</span></div><div><strong>${game.captures}</strong><span>累计攻占</span></div><div><strong>${game.moves}</strong><span>出兵次数</span></div>`;
  $('nextBtn').hidden=!won||config.mode!=='campaign'||config.level===LEVELS.length-1;$('watchBtn').hidden=game.winner!==null;
  $('resultDialog').showModal();tone(won?880:220);
}
$('startBtn').onclick=start;$('pauseBtn').onclick=togglePause;$('resumeBtn').onclick=togglePause;
$('restartBtn').onclick=()=>requestReset(()=>{});
$('waitBtn').onclick=waitTurn;
$('moveCapitalBtn').onclick=moveCapital;
$('buildCapitalBtn').onclick=buildCapital;
$('fitMapBtn').onclick=()=>setMapView('fit');$('zoomMapBtn').onclick=()=>setMapView('detail');
window.addEventListener('resize',updateMapView);
let observedMapWidth=0;
new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width!==observedMapWidth){observedMapWidth=width;requestAnimationFrame(updateMapView);}}).observe($('board').closest('.map-area'));
$('diplomacyFrom').onchange=()=>{renderDiplomacy();renderCountryOutline();};
$('takeCountryControl').onclick=()=>{const owner=Number($('diplomacyFrom').dataset.countryId),result=game.setHumanControl(owner,!game.isHuman(owner));if(!result.ok){toast(result.reason);return;}clearToast();toast(result.queued?'将在本轮结束后切换控制':result.human?'已接管，选中这个国家的领土即可手动出兵':'已交还电脑控制');render();};
$('factionChartMetric').onclick=e=>{const button=e.target.closest('[data-chart-metric]');if(button&&['land','army'].includes(button.dataset.chartMetric)){chartMetric=button.dataset.chartMetric;render();}};
$('showCountryOutline').onclick=()=>toggleCountryOutline();
$('hideCountryOutline').onclick=()=>toggleCountryOutline(false);
$('diplomacyList').onclick=e=>{const button=e.target.closest('[data-declare-war]');if(button&&!button.disabled)declareWar(Number(button.dataset.declareWar));};
$('observerModes').onclick=e=>{const mode=e.target.dataset.observerMode;if(!mode||!game.automatic||game.winner!==null)return;config.observerMode=mode;game.setObserverMode(mode);renderSettings();render();};
$('observerSpeeds').onclick=e=>{const speed=Number(e.target.dataset.observerSpeed);if(!game.automatic||game.winner!==null||![1,2,4,8].includes(speed))return;config.observerSpeed=speed;render();};
$('levelList').onclick=e=>{const b=e.target.closest('[data-level]');if(b&&+b.dataset.level!==config.level)requestReset(()=>config.level=+b.dataset.level);};
$('campaignTab').onclick=()=>{if(config.mode!=='campaign')requestReset(()=>config.mode='campaign');};
$('customTab').onclick=()=>{if(config.mode!=='custom')requestReset(()=>config.mode='custom');};
$('difficulty').onclick=e=>{const diff=e.target.dataset.diff;if(diff&&diff!==config.difficulty)requestReset(()=>config.difficulty=diff);};
$('minusAI').onclick=()=>{if(config.ai>0&&config.humans+config.ai>1)requestReset(()=>config.ai--);};
$('plusAI').onclick=()=>{if(config.humans+config.ai<customPlayerLimit())requestReset(()=>config.ai++);};
$('minusHuman').onclick=()=>{if(config.humans>0&&config.humans+config.ai>1)requestReset(()=>config.humans--);};
$('plusHuman').onclick=()=>{if(config.humans+config.ai<customPlayerLimit())requestReset(()=>config.humans++);};
function setPlayerCount(key,input){
  const value=Number(input.value),other=key==='humans'?config.ai:config.humans,limit=customPlayerLimit();
  if(input.value.trim()===''||!Number.isInteger(value)||value<0||value+other<1||value+other>limit){renderSettings();toast(`人类与电脑合计需为 1–${limit} 位`);return;}
  if(value!==config[key])requestReset(()=>config[key]=value);
}
$('humanCount').onchange=e=>setPlayerCount('humans',e.target);
$('aiCount').onchange=e=>setPlayerCount('ai',e.target);
$('mapSize').onchange=e=>{const [w,h]=e.target.value.split(',').map(Number);requestReset(()=>{config.w=w;config.h=h;clearMapSetup();persistCustomMap(false);});};
let editorWasPaused=false;
const mapEditor=new MapEditor({getPlayers:()=>config.humans+config.ai,getCountries:()=>game.factions.slice(0,config.humans+config.ai),onClose:()=>{game.paused=editorWasPaused;render();},onApply:map=>requestReset(()=>{assignMapSetup(map);savedCustomMap={...map,humans:config.humans,ai:config.ai,cells:[...map.cells],starts:[...map.starts],relations:map.relations.map(row=>[...row])};persistCustomMap(true);})});
$('mapEditorBtn').onclick=()=>{editorWasPaused=game.paused;game.paused=true;render();mapEditor.open({w:config.w,h:config.h,cells:config.terrainMap??game.cells.map(c=>c.terrain),starts:config.initialSpawns,relations:config.initialRelations});};
$('randomMapBtn').onclick=()=>requestReset(()=>{clearMapSetup();persistCustomMap(false);});
$('loadMapBtn').onclick=()=>{if(!savedCustomMap)return;const land=savedCustomMap.cells.filter(t=>t==='land').length;if(!mapPlayers(savedCustomMap)&&land<config.humans+config.ai){toast(`已存地图只有 ${land} 格陆地，请先把总人数调至 ${land} 位以内`);return;}requestReset(()=>{assignMapSetup(savedCustomMap,true);persistCustomMap(true);});};
$('growthMode').onchange=e=>{config.growthMode=e.target.value;game.setGrowthMode(config.growthMode);renderSettings();render();};
$('secessionMode').onchange=e=>{config.secessionMode=e.target.value;game.setSecessionMode(config.secessionMode);renderSettings();render();};
$('peaceSupport').onchange=e=>{config.peaceSupport=e.target.value==='on';game.setPeaceSupport(config.peaceSupport);renderSettings();render();};
$('multiFrontBtn').onclick=()=>{config.multiFront=!(game.pendingMultiFront??game.multiFront);game.setMultiFront(config.multiFront);render();};
$('worldMode').onchange=e=>{const mode=e.target.value;if(mode!==config.worldMode)requestReset(()=>config.worldMode=mode);};
$('troopControl').onclick=e=>{if(e.target.dataset.ratio){ratio=+e.target.dataset.ratio;document.querySelectorAll('[data-ratio]').forEach(b=>{b.classList.toggle('active',+b.dataset.ratio===ratio);b.setAttribute('aria-pressed',+b.dataset.ratio===ratio);});render();}};
$('helpBtn').onclick=()=>{pausedByHelp=game.running&&!game.paused;if(pausedByHelp)game.paused=true;$('helpDialog').showModal();render();};
$('helpDialog').addEventListener('close',()=>{if(pausedByHelp)game.paused=false;pausedByHelp=false;render();});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('cancelReset').onclick=cancelReset;$('confirmDialog').addEventListener('cancel',e=>{e.preventDefault();cancelReset();});
$('confirmReset').onclick=()=>{const fn=pendingReset;pendingReset=null;$('confirmDialog').close();if(fn){fn();setupGame();}};
$('replayBtn').onclick=setupGame;
$('nextBtn').onclick=()=>{if(config.level<LEVELS.length-1){config.level++;setupGame();}};
$('watchBtn').onclick=()=>{spectating=true;resultShown=false;game.paused=false;$('resultDialog').close();selected=null;render();};
$('soundBtn').onclick=()=>{sound=!sound;$('soundBtn').classList.toggle('muted',!sound);$('soundBtn').setAttribute('aria-label',sound?'关闭音效':'开启音效');$('soundBtn').setAttribute('aria-pressed',sound);tone();toast(sound?'音效已开启':'音效已关闭');};
$('fullBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前窗口暂不支持全屏，请使用浏览器全屏功能');}};
$('mobileSetup').onclick=()=>{const open=$('setup').classList.toggle('mobile-open');$('mobileSetup').setAttribute('aria-expanded',open);if(open)$('setup').scrollIntoView({behavior:'smooth',block:'start'});};
document.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]')||['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName))return;
  if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();if(game.running)togglePause();else if(game.time===0)start();}
  if(e.key.toLowerCase()==='e'&&game.running&&!game.continuous){e.preventDefault();waitTurn();}
  if(e.key==='Escape'){selected=null;render();}
  if(e.key.startsWith('Arrow')&&selected!==null&&game.running&&!game.paused&&!spectating){
    e.preventDefault();const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},[dx,dy]=directions[e.key]??[0,0];const to=game.neighborAt(selected,dx,dy);
    if(to!==null)clickTile(to);
  }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.running&&!game.paused){game.paused=true;render();}});
setupGame();
function frame(now){
  const dt=Math.min((now-lastFrame)/1000,.1);lastFrame=now;
  // One shared playback clock scales both round scheduling and action display.
  // Human turns always use real time, even after an accelerated observation.
  const rate=game.automatic?config.observerSpeed:1;
  const elapsed=dt*rate;
  if(game.running&&!game.paused&&game.winner===null)playbackTime+=elapsed*1000;
  let remaining=elapsed;
  while(remaining>0){const step=Math.min(.25,remaining);game.update(step);remaining-=step;}
  advanceResolution(playbackTime);
  if(selected!==null&&game.running&&!spectating&&game.cells[selected].owner!==game.currentHuman&&!game.resolving)selected=null;
  checkResult();renderTimer+=dt;
  if(renderTimer>.1){render();renderTimer=0;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
