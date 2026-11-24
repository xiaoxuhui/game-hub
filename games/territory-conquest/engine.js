export const FACTIONS = [
  {name:'青岚',color:'#51ddc0',rgb:'81,221,192',symbol:'◆'},
  {name:'赤焰',color:'#f7817d',rgb:'247,129,125',symbol:'▲'},
  {name:'金砂',color:'#eac477',rgb:'234,196,119',symbol:'●'},
  {name:'紫宸',color:'#ad9af1',rgb:'173,154,241',symbol:'✦'},
  {name:'苍蓝',color:'#79b3ef',rgb:'121,179,239',symbol:'■'},
  {name:'桃夭',color:'#e99ec9',rgb:'233,158,201',symbol:'♥'},
  {name:'橙光',color:'#eca269',rgb:'236,162,105',symbol:'⬟'},
  {name:'月白',color:'#c9d5de',rgb:'201,213,222',symbol:'✚'}
];
export const LEVELS = [
  {name:'初始之地',subtitle:'一场属于你的征途',w:10,h:8,ai:1},
  {name:'三方角逐',subtitle:'在交错的边界中突围',w:12,h:9,ai:2},
  {name:'四境纷争',subtitle:'步步为营，逐一击破',w:14,h:10,ai:3},
  {name:'群雄并起',subtitle:'守住后方，打开局面',w:16,h:11,ai:4},
  {name:'烽火大陆',subtitle:'五路强敌，寸土必争',w:18,h:12,ai:5},
  {name:'天下归一',subtitle:'征服最后一片疆土',w:20,h:13,ai:7}
];
export const UNREST_LIMIT=4,UNREST_WINDOW=8,SECESSION_GRACE=12;
export const ATTITUDES=['和平','中立','敌对'];
export const NEUTRAL_ATTACK_CHANCE=.01;
export const DIPLOMACY_IMPROVE_CHANCE=.01,DIPLOMACY_WORSEN_CHANCE=.01,SECESSION_ARMY_MULTIPLIER=10;
export const DIPLOMACY_BONUS_CHANCE=.01;
export const RELATION_LEVELS=['持久和平','和平','中立','敌对','持久敌对'];
export function combinedDiplomacyChance(level=0){return -Math.expm1((1+Math.max(0,level))*Math.log1p(-DIPLOMACY_BONUS_CHANCE));}
export const MARCH_CHANCE=.01,MARCH_MAX_ARMY=5;
export const SEA_ENTRY_CHANCE=.1;
export const MAX_PLAYERS=64;
export function formatArmy(value,style='full'){
  if(!Number.isFinite(value))return Number.isNaN(value)?'—':value<0?'−∞':'∞';
  if(Math.abs(value)<(style==='map'?1000:10000))return String(value);
  const [coefficient,power]=value.toExponential(style==='map'?0:2).split('e'),mantissa=String(Number(coefficient)),exponent=String(Number(power));
  return style==='full'?`${mantissa}×10${exponent.replace(/[-0-9]/g,c=>({'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'})[c])}`:`${mantissa}e${exponent}`;
}
export function playerLimit(w,h,worldMode='flat'){return Math.min(MAX_PLAYERS,Math.max(1,worldMode==='earth'?w*h:(w-2)*(h-2)));}
export function columnLabel(index){let label='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))label=String.fromCharCode(65+(n-1)%26)+label;return label;}
function newCountry(id,number){
  const hue=(id*137.508)%360,s=.58,l=.65,a=s*Math.min(l,1-l);
  const rgb=[0,8,4].map(n=>{const k=(n+hue/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));});
  return {name:`新国${number}`,color:'#'+rgb.map(c=>c.toString(16).padStart(2,'0')).join(''),rgb:rgb.join(','),symbol:'✧',rebel:true};
}
export function seededRandom(seed) { return () => { let t=seed+=0x6D2B79F5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296; }; }
export class Game {
  constructor({w=10,h=8,humans=1,ai=1,difficulty='normal',seed=1,observerMode='continuous',growthMode='one',ocean=false,terrainMap=null,worldMode='flat',initialSpawns=null,initialRelations=null,secessionMode='repeat',peaceSupport=false,multiFront=false}={}) {
    if(typeof multiFront!=='boolean')throw new Error('多线作战需设置为开启或关闭');
    this.multiFront=multiFront;this.pendingMultiFront=null;
    if(typeof peaceSupport!=='boolean')throw new Error('和平支援反击需设置为开启或关闭');
    this.peaceSupport=peaceSupport;
    if(!['repeat','protected'].includes(secessionMode))throw new Error('请选择允许再次分裂或仅战争动荡');
    this.secessionMode=secessionMode;
    if(!['flat','earth'].includes(worldMode))throw new Error('请选择平面式或地球式模式');
    this.worldMode=worldMode;
    if(!['one','continue'].includes(growthMode))throw new Error('请选择到目标加一或到目标持续');
    this.growthMode=growthMode;
    const players=humans+ai;
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<4||h<4||!Number.isInteger(humans)||humans<0||!Number.isInteger(ai)||ai<0||players<1||players>playerLimit(w,h,worldMode)) throw new Error(`人类与电脑合计需为 1–${MAX_PLAYERS} 位，且地图必须能容纳所有玩家`);
    if(terrainMap!==null&&(!Array.isArray(terrainMap)||terrainMap.length!==w*h||Array.from(terrainMap).some(t=>t!=='land'&&t!=='sea')))throw new Error('地图必须为每格指定陆地或海洋');
    if(terrainMap!==null&&terrainMap.filter(t=>t==='land').length<players)throw new Error('陆地格数不足，每个国家至少需要一块陆地开局');
    if(initialSpawns!==null&&(!Array.isArray(initialSpawns)||initialSpawns.length>MAX_PLAYERS))throw new Error('初始首都设置无效');
    const pinned=(initialSpawns??[]).map(id=>id??null),specified=pinned.filter(id=>id!==null);
    if(specified.some(id=>!Number.isInteger(id)||id<0||id>=w*h||(terrainMap!==null&&terrainMap[id]!=='land'))||new Set(specified).size!==specified.length)throw new Error('初始首都必须位于不同的陆地格子');
    if(initialRelations!==null&&(!Array.isArray(initialRelations)||initialRelations.length>MAX_PLAYERS||Array.from(initialRelations).some((row,from)=>!Array.isArray(row)||row.length>MAX_PLAYERS||Array.from(row).some((value,to)=>!Number.isInteger(value)||value<0||value>2||(from===to&&value!==0)))))throw new Error('初始外交关系需设置为和平、中立或敌对');
    this.w=w;this.h=h;this.humans=humans;this.ai=ai;this.players=players;this.currentHuman=humans?0:null;this.difficulty=difficulty;this.rng=seededRandom(seed);
    this.humanOwners=new Set(Array.from({length:humans},(_,id)=>id));this.pendingHumanControl=null;this.controlRevision=0;
    this.factions=Array.from({length:players},(_,id)=>FACTIONS[id]?{...FACTIONS[id]}:{...newCountry(id,0),name:`国家${id+1}`,symbol:FACTIONS[id%FACTIONS.length].symbol,rebel:false});this.secessions=0;
    this.relations=Array.from({length:players},(_,owner)=>Array.from({length:players},(_,other)=>owner===other?0:initialRelations?.[owner]?.[other]??1));
    this.attackedBy=Array.from({length:players},()=>Array(players).fill(false));
    this.neutralInitiative=Array(players).fill(null);
    this.aiMarches=Array(players).fill(null);this.marchDecisionTurn=Array(players).fill(-1);
    this.defenseOrders=Array.from({length:players},()=>[]);
    this.diplomacySettledTurn=-1;this.influenceSettledTurn=-1;this.globalPeaceLevel=0;this.globalHostilityLevel=0;this.lastGlobalDiplomacy=null;this.lastDiplomacyInfluence={peaceful:[],hostile:[]};
    this.cells=Array.from({length:w*h},(_,id)=>({id,owner:-1,homeland:-1,army:0,capital:-1,terrain:terrainMap?.[id]??'land',unrestEvents:[],stableUntil:0}));this.capitalLost=Array(players).fill(false);this.seaAttempts=[];
    this.time=0;this.turn=0;this.running=false;this.paused=false;this.winner=null;this.events=[];this.moves=0;this.captures=0;this.pendingTurn=null;this.roundState=null;this.automaticElapsed=0;this.setObserverMode(observerMode);
    const candidates=this.cells.filter(c=>terrainMap!==null?c.terrain==='land':worldMode==='earth'||(c.id%w>0&&c.id%w<w-1&&Math.floor(c.id/w)>0&&Math.floor(c.id/w)<h-1)).map(c=>c.id);
    const first=terrainMap!==null&&this.cells[w+1].terrain!=='land'?candidates[0]:w+1;
    const places=Array.from({length:players},(_,owner)=>pinned[owner]??null);
    if(places.every(id=>id===null))places[0]=first;
    const occupied=new Set(places.filter(id=>id!==null)),nearest=new Int32Array(w*h).fill(w+h);
    const updateDistances=last=>{for(const id of candidates){const x=id%w,y=Math.floor(id/w),dx=Math.abs(last%w-x),dy=Math.abs(Math.floor(last/w)-y);nearest[id]=Math.min(nearest[id],worldMode==='earth'?Math.min(dx,w-dx)+Math.min(dy,h-dy):dx+dy);}};
    for(const id of occupied)updateDistances(id);
    for(let owner=0;owner<players;owner++){
      if(places[owner]!==null)continue;
      let best=-1,score=-1;
      for(const id of candidates){
        if(occupied.has(id))continue;
        const d=nearest[id]+this.rng()*0.25;
        if(d>score){score=d;best=id;}
      }
      places[owner]=best;occupied.add(best);updateDistances(best);
    }
    this.spawns=places;
    this.aiPlans=Array(players).fill(null);this.aiAnchors=[...places];
    places.forEach((id,owner)=>Object.assign(this.cells[id],{owner,homeland:owner,army:20,capital:owner}));
    if(ocean&&terrainMap===null)this.generateOcean(seed);
    this.addEvent('所有阵营已就位，从一格开始。','system');
  }
  neighborAt(id,dx,dy){
    if(!Number.isInteger(id)||id<0||id>=this.cells.length||!Number.isInteger(dx)||!Number.isInteger(dy)||Math.abs(dx)+Math.abs(dy)!==1)return null;
    const x=id%this.w+dx,y=Math.floor(id/this.w)+dy;
    if(this.worldMode==='earth')return ((y+this.h)%this.h)*this.w+(x+this.w)%this.w;
    return x>=0&&x<this.w&&y>=0&&y<this.h?y*this.w+x:null;
  }
  neighbors(id){return [[-1,0],[1,0],[0,-1],[0,1]].map(([dx,dy])=>this.neighborAt(id,dx,dy)).filter(id=>id!==null);}
  generateOcean(seed){
    const random=seededRandom(seed^0x51EA),scale=Math.max(3,Math.round(Math.min(this.w,this.h)/6));
    const cols=Math.ceil(this.w/scale)+1,rows=Math.ceil(this.h/scale)+1,noise=Array.from({length:cols*rows},()=>random());
    for(const cell of this.cells){
      const x=(cell.id%this.w)/scale,y=Math.floor(cell.id/this.w)/scale,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
      const top=noise[iy*cols+ix]*(1-fx)+noise[iy*cols+ix+1]*fx,bottom=noise[(iy+1)*cols+ix]*(1-fx)+noise[(iy+1)*cols+ix+1]*fx;
      cell.terrain=top*(1-fy)+bottom*fy<.43?'sea':'land';
    }
    // Capitals always start on land, with at least one land neighbor available.
    for(const id of this.spawns)this.cells[id].terrain='land';
    for(const id of this.spawns)if(this.neighbors(id).every(n=>this.cells[n].terrain==='sea'))this.cells[this.neighbors(id)[0]].terrain='land';
    if(!this.cells.some(c=>c.terrain==='sea')){
      const cell=this.cells.find(c=>c.owner<0&&this.neighbors(c.id).every(n=>!this.spawns.includes(n)||this.neighbors(n).some(other=>other!==c.id&&this.cells[other].terrain==='land')));
      if(cell)cell.terrain='sea';
    }
  }
  seaRound(){return this.roundState?this.turn:this.turn+1;}
  seaAttemptFailed(owner){const attempt=this.seaAttempts[owner];return attempt?.round===this.seaRound()&&attempt.allowed===false;}
  seaBlocked(owner,cell){return cell?.terrain==='sea'&&cell.owner!==owner&&this.seaAttemptFailed(owner);}
  trySeaEntry(owner,cell){
    if(cell.terrain!=='sea'||cell.owner===owner)return {ok:true};
    const round=this.seaRound(),previous=this.seaAttempts[owner];
    if(previous?.round===round)return previous.allowed?{ok:true,seaEntry:true}:{ok:false,seaFailed:true,reason:'本回合入海失败，不能再次尝试海洋；仍可进攻陆地或蓄兵'};
    const allowed=this.rng()<SEA_ENTRY_CHANCE;this.seaAttempts[owner]={round,allowed};
    this.addEvent(`${this.factions[owner].name}${allowed?'通过 10% 入海判定，可以进入海洋':'入海尝试失败，本回合不能再次尝试海洋，仍可进攻陆地'}`,'sea-entry',owner);
    return allowed?{ok:true,seaEntry:true}:{ok:false,seaFailed:true,reason:'入海尝试失败（成功率 10%）；没有扣兵，本回合仍可进攻陆地'};
  }
  isHuman(owner){return this.humanOwners.has(owner);}
  setHumanControl(owner,human=true){
    if(this.winner!==null)return {ok:false,reason:'对局已结束，请开始新对局'};
    if(!Number.isInteger(owner)||owner<0||owner>=this.players||!this.cells.some(c=>c.owner===owner))return {ok:false,reason:'请选择一个存活国家'};
    if(typeof human!=='boolean')return {ok:false,reason:'请选择玩家控制或电脑控制'};
    if(this.isHuman(owner)===human&&!this.pendingHumanControl)return {ok:true,owner,human,unchanged:true};
    if(this.resolving||this.roundState){this.pendingHumanControl={owner,human};return {ok:true,owner,human,queued:true};}
    return this.applyHumanControl(owner,human);
  }
  applyHumanControl(owner,human){
    this.pendingHumanControl=null;
    if(!this.cells.some(c=>c.owner===owner)){this.addEvent('控制切换已取消：目标国家已出局','system');return {ok:false,reason:'目标国家已出局'};}
    if(this.isHuman(owner)===human)return {ok:true,owner,human,unchanged:true};
    if(human)this.humanOwners.add(owner);else this.humanOwners.delete(owner);
    this.humans=this.humanOwners.size;this.ai=this.players-this.humans;
    this.currentHuman=human?owner:this.aliveHumans()[0]??null;this.automaticElapsed=0;
    this.aiPlans[owner]=null;this.aiMarches[owner]=null;this.neutralInitiative[owner]=null;this.controlRevision++;
    this.addEvent(`${this.factions[owner].name}${human?'已由玩家接管，可点击领土手动出兵':'已交还电脑控制'}`,'control',owner);
    return {ok:true,owner,human};
  }
  isCapital(cell){return !!cell&&cell.owner>=0&&cell.capital===cell.owner;}
  growthBase(cell){return cell?.birthArmy??this.factions[cell?.owner]?.birthArmy??1;}
  flatGrowth(owner){return this.growthMode==='one'&&this.factions[owner]?.growthLimited===true;}
  growthAmount(cell){return cell?.owner>=0?(this.flatGrowth(cell.owner)?1:this.growthBase(cell))*(this.isCapital(cell)?3:1):0;}
  growthCap(cell){return 999*Math.max(1,this.growthBase(cell));}
  setGrowthMode(mode){
    if(!['one','continue'].includes(mode))throw new Error('请选择到目标加一或到目标持续');
    if(mode===this.growthMode)return;
    this.growthMode=mode;this.resolveGrowthLimits();
    this.addEvent(`新国增兵规则：${mode==='one'?'到目标加一，达到目标的新国普通格每轮 +1、首都 +3':'到目标持续，普通格按建国基数增兵、首都三倍，新占领土同样适用'}`,'system');
  }
  resolveGrowthLimits(){
    const land=Array(this.players).fill(0),changed=[];
    for(const cell of this.cells)if(cell.owner>=0)land[cell.owner]++;
    for(const [owner,faction] of this.factions.entries()){
      const parent=faction.parent??faction.origin;
      if(!faction.rebel||faction.growthLimited||!Number.isInteger(parent)||land[owner]<=land[parent])continue;
      faction.growthLimited=true;changed.push(owner);
      this.addEvent(`${faction.name}领土 ${land[owner]} 格，超过原国家${this.factions[parent].name}的 ${land[parent]} 格；${this.growthMode==='one'?'增兵永久改为普通格每轮 +1、首都 +3（到目标加一）':'按到目标持续，保留出格增兵倍率'}`,'system',owner);
    }
    return changed;
  }
  capitals(owner){return this.cells.filter(c=>c.owner===owner&&this.isCapital(c));}
  aliveHumans(){return [...this.humanOwners].sort((a,b)=>a-b).filter(id=>this.cells.some(c=>c.owner===id));}
  get automatic(){return this.aliveHumans().length===0;}
  get continuous(){return this.automatic&&this.observerMode==='continuous';}
  setObserverMode(mode){
    if(!['step','continuous'].includes(mode))throw new Error('请选择单步或连续观战模式');
    this.observerMode=mode;this.automaticElapsed=0;
  }
  stats(){return this.factions.map((f,id)=>{const cells=this.cells.filter(c=>c.owner===id);return {...f,id,human:this.isHuman(id),land:cells.length,army:cells.reduce((s,c)=>s+c.army,0)};});}
  isPermanentRelation(from,to){return Object.hasOwn(this.factions[from]?.permanentRelations??{},to);}
  isPeaceTreaty(from,to){return this.factions[from]?.persistentPeace?.[to]===true;}
  isPersistentRelation(from,to){return this.isPermanentRelation(from,to)||this.isPeaceTreaty(from,to)||Object.hasOwn(this.factions[from]?.fixedRelations??{},to);}
  isPersistentHostile(from,to){return this.attitude(from,to)===2&&this.isPersistentRelation(from,to);}
  attitude(from,to){return from===to?0:this.isPermanentRelation(from,to)?this.factions[from].permanentRelations[to]:this.isPeaceTreaty(from,to)?0:this.factions[from]?.fixedRelations?.[to]??this.relations[from]?.[to]??1;}
  relationLevel(from,to){
    if(from===to)return 0;
    const attitude=this.attitude(from,to);
    return attitude===0?(this.isPersistentRelation(from,to)?0:1):attitude===1?2:this.isPersistentRelation(from,to)?4:3;
  }
  relationLabel(from,to){return RELATION_LEVELS[this.relationLevel(from,to)];}
  setRelationLevel(from,to,level){
    if(from===to)return;
    if(!Number.isInteger(level)||level<0||level>4)throw new Error('外交等级必须在 0 至 4 之间');
    if(this.isPermanentRelation(from,to))return;
    if(this.factions[from].persistentPeace)delete this.factions[from].persistentPeace[to];
    if(this.factions[from].fixedRelations)delete this.factions[from].fixedRelations[to];
    this.relations[from][to]=level<=1?0:level===2?1:2;
    if(level===0)(this.factions[from].persistentPeace??={})[to]=true;
    if(level===4)(this.factions[from].fixedRelations??={})[to]=2;
  }
  globalDiplomacyChances(){return {up:combinedDiplomacyChance(this.globalPeaceLevel),down:combinedDiplomacyChance(this.globalHostilityLevel)};}
  contactBorders(){
    const borders=Array.from({length:this.players},()=>new Set());
    for(const cell of this.cells)if(cell.owner>=0)for(const id of this.neighbors(cell.id)){
      const other=this.cells[id].owner;if(other>=0&&other!==cell.owner)borders[cell.owner].add(other);
    }
    return borders;
  }
  resolveNeighborhoodInfluence(borders=this.contactBorders()){
    if(!this.running||this.paused||this.winner!==null||this.turn<1)return {peaceful:[],hostile:[]};
    if(this.influenceSettledTurn===this.turn)return this.lastDiplomacyInfluence;
    this.influenceSettledTurn=this.turn;
    const peaceful=[],hostile=[];
    for(let owner=0;owner<this.players;owner++){
      const neighbors=[...borders[owner]],country=this.factions[owner];
      country.peaceNeighborhood=neighbors.length>0&&neighbors.every(id=>this.attitude(owner,id)===0&&this.attitude(id,owner)===0);
      country.hostileNeighborhood=neighbors.length>0&&neighbors.every(id=>this.attitude(owner,id)===2&&this.attitude(id,owner)===2);
      if(country.peaceNeighborhood&&!(country.peaceLevel>0)){peaceful.push(owner);country.peaceLevel=1;}
      if(country.hostileNeighborhood&&!(country.hostilityLevel>0)){hostile.push(owner);country.hostilityLevel=1;}
    }
    this.globalPeaceLevel+=peaceful.length;this.globalHostilityLevel+=hostile.length;
    return this.lastDiplomacyInfluence={peaceful,hostile};
  }
  setSecessionMode(mode){
    if(!['repeat','protected'].includes(mode))throw new Error('请选择允许再次分裂或仅战争动荡');
    if(mode===this.secessionMode)return;this.secessionMode=mode;
    this.addEvent('新国再分裂规则：'+(mode==='repeat'?'允许再次分裂，战争及大量非交战调兵均可累计动荡':'仅战争动荡，保留非战争调兵保护')+'；只有直接进攻祖国或祖国的建国敌国才豁免，切换不清除已有动荡','system');
  }
  secessionExempt(a,b){
    if(a<0||b<0||a===b)return false;
    const nation=this.factions[a];
    return !!nation?.rebel&&(nation.origin===b||(nation.cause==='war'&&nation.warOpponent===b));
  }
  unrestEnemies(owner){return this.factions.map((_,id)=>id).filter(id=>id!==owner&&this.attitude(owner,id)===2&&this.cells.some(c=>c.owner===id));}
  setPeaceSupport(enabled){
    if(typeof enabled!=='boolean')throw new Error('和平支援反击需设置为开启或关闭');
    if(enabled===this.peaceSupport)return;this.peaceSupport=enabled;
    if(!enabled)this.defenseOrders=this.factions.map(()=>[]);
    this.addEvent(`和平支援反击已${enabled?'开启':'关闭'}；支援照常扣兵，支援进攻不降低外交关系`,'system');
  }
  activeDefenseOrders(owner,alive=null){
    if(!this.peaceSupport)return [];
    if(!this.defenseOrders[owner]?.length)return [];
    alive??=new Set(this.cells.filter(c=>c.owner>=0).map(c=>c.owner));
    return this.defenseOrders[owner]=(this.defenseOrders[owner]??[]).filter(o=>o.beneficiary!==owner&&o.enemy!==owner&&alive.has(owner)&&alive.has(o.beneficiary)&&alive.has(o.enemy)&&this.attitude(owner,o.beneficiary)===0);
  }
  notifyPeaceSupport(attacker,defender){
    if(!this.peaceSupport)return;
    const alive=new Set(this.cells.filter(c=>c.owner>=0).map(c=>c.owner));
    for(const owner of alive){
      if(owner===attacker||owner===defender||this.attitude(owner,defender)!==0)continue;
      const orders=this.activeDefenseOrders(owner,alive),existing=orders.find(o=>o.beneficiary===defender);
      if(existing?.enemy===attacker){existing.turn=this.turn;continue;}
      this.defenseOrders[owner]=[{beneficiary:defender,enemy:attacker,turn:this.turn},...orders.filter(o=>o.beneficiary!==defender)];this.aiPlans[owner]=null;this.aiMarches[owner]=null;
      this.addEvent(`${this.factions[owner].name}将支援${this.factions[defender].name}，反击进攻者${this.factions[attacker].name}`,'defense',owner);
    }
  }
  defenseBlockade(owner,beneficiary){
    const visited=new Uint8Array(this.cells.length),queue=[],blockers=new Set();
    for(const c of this.cells)if(c.owner===owner){visited[c.id]=1;queue.push(c.id);}
    for(let q=0;q<queue.length;q++)for(const id of this.neighbors(queue[q])){
      if(visited[id])continue;visited[id]=1;const other=this.cells[id].owner;
      if(other===beneficiary)return {blocked:false,blockers:new Set()};
      if(other>=0&&other!==owner&&this.attitude(owner,other)===0){blockers.add(other);continue;}
      queue.push(id);
    }
    return {blocked:blockers.size>0,blockers};
  }
  peaceSupportContext(owner,target){
    if(target<0||target===owner)return null;
    for(const order of this.activeDefenseOrders(owner)){
      if(target===order.beneficiary)continue;
      if(target===order.enemy)return {...order,breakingBlockade:false};
      if(this.attitude(owner,target)===0){const blockade=this.defenseBlockade(owner,order.beneficiary);if(blockade.blocked&&blockade.blockers.has(target))return {...order,breakingBlockade:true};}
    }
    return null;
  }
  ordinaryCanAttack(from,to){return this.attitude(from,to)===2||(this.attitude(from,to)===1&&(this.isHuman(from)||this.attackedBy[from]?.[to]===true||(this.neutralInitiative[from]?.turn===this.turn&&this.neutralInitiative[from].allowed)));}
  canAttack(from,to){return to<0||from===to||(this.sharesBorder(from,to)&&(!!this.peaceSupportContext(from,to)||this.ordinaryCanAttack(from,to)));}
  prepareNeutralInitiative(owner){
    if(this.neutralInitiative[owner]?.turn!==this.turn)this.neutralInitiative[owner]={turn:this.turn,allowed:this.rng()<NEUTRAL_ATTACK_CHANCE};
  }
  resolveDiplomacy(){
    if(!this.running||this.paused||this.winner!==null||this.turn<1||this.diplomacySettledTurn===this.turn)return [];
    this.diplomacySettledTurn=this.turn;
    const borders=this.contactBorders(),influence=this.resolveNeighborhoodInfluence(borders),probability=this.globalDiplomacyChances();
    const alive=this.stats().filter(country=>country.land).map(country=>country.id);
    if(alive.length<2){this.lastGlobalDiplomacy={turn:this.turn,kind:'none',delta:0,...probability,influence,changes:[]};return [];}
    const upHit=this.rng()<probability.up,downHit=this.rng()<probability.down,delta=Number(downHit)-Number(upHit),changes=[];
    if(delta)for(const from of alive)for(const to of borders[from]){
      if(this.isPermanentRelation(from,to))continue;
      const before=this.relationLevel(from,to),after=Math.min(4,Math.max(0,before+delta));
      if(after!==before){this.setRelationLevel(from,to,after);changes.push({from,to,before,after});}
    }
    const kind=upHit&&downHit?'global-cancel':upHit?'global-up':downHit?'global-down':'none';
    const result={turn:this.turn,kind,delta,upHit,downHit,...probability,influence,changes};this.lastGlobalDiplomacy=result;
    if(changes.length){this.aiPlans.fill(null);this.addEvent('全局关系'+(delta<0?'上升':'下降')+'一级，共改变 '+changes.length+' 个已接触方向；远方关系保持不变','diplomacy-global',-1);}
    else if(kind==='global-cancel')this.addEvent('全局上升与下降同时命中，本回合互相抵消','diplomacy-global',-1);
    return kind==='none'?[]:[result];
  }
  reactToAttack(attacker,defender){
    if(!this.sharesBorder(attacker,defender))return;
    this.attackedBy[defender][attacker]=true;
    if(this.isPersistentRelation(defender,attacker))return;
    const before=this.attitude(defender,attacker),after=Math.min(2,before+1);
    if(after===before)return;
    this.relations[defender][attacker]=after;this.aiPlans[defender]=null;
    this.addEvent(`${this.factions[defender].name}对${this.factions[attacker].name}的态度：${ATTITUDES[before]} → ${ATTITUDES[after]}（遭到进攻）`,'diplomacy',defender);
  }
  declareWar(target,options={}){
    if(!this.running||this.paused||this.winner!==null||this.resolving)return {ok:false,reason:'当前不能宣战'};
    const owner=this.currentHuman;
    if(owner===null||!Number.isInteger(target)||target<0||target>=this.players||target===owner||!this.cells.some(c=>c.owner===target))return {ok:false,reason:'请选择其他存活国家'};
    if(!this.sharesBorder(owner,target))return {ok:false,reason:'当前未接触该国，关系保持原态度'};
    if(this.isPeaceTreaty(owner,target))return {ok:false,reason:'对该国已达成持久和平，不能宣战'};
    if(this.isPersistentRelation(owner,target))return {ok:false,reason:'对分裂参与国的关系持久固定'};
    if(this.attitude(owner,target)===2)return {ok:false,reason:'已经对该国敌对'};
    this.relations[owner][target]=2;this.aiPlans[owner]=null;
    this.addEvent(`${this.factions[owner].name}对${this.factions[target].name}宣战，己方态度变为敌对；对方态度保持${ATTITUDES[this.attitude(target,owner)]}`,'diplomacy',owner);
    const result={ok:true,kind:'diplomacy',owner,oldOwner:owner,fromId:-1,toId:-1,target};
    result.actions=this.finishTurn([{...result}],options);return result;
  }
  activeUnrest(cell){return cell.unrestEvents.filter(e=>(e.kind==='capture'||(e.kind==='drain'&&(e.hostile===true||e.nonCombat===true)))&&this.turn-e.turn<UNREST_WINDOW);}
  unrest(cell){return cell&&this.turn>=cell.stableUntil?this.activeUnrest(cell).length:0;}
  recordUnrest(cell,kind,details={}){
    if((kind!=='capture'&&(kind!=='drain'||(details.hostile!==true&&details.nonCombat!==true)))||this.turn<cell.stableUntil)return;
    cell.unrestEvents=this.activeUnrest(cell);
    const turn=this.roundState?this.turn:this.turn+1;
    if(kind==='drain'&&cell.unrestEvents.some(e=>e.kind==='drain'&&e.turn===turn))return;
    cell.unrestEvents.push({turn,kind,...details});
  }
  resolveSecessions(){
    if(!this.running||this.paused||this.winner!==null)return [];
    const countries=[];
    for(const center of this.cells){
      if(center.owner<0||this.unrest(center)<UNREST_LIMIT)continue;
      const oldOwner=center.owner,region=[center];
      // Only neighboring restless land joins; calm or foreign tiles stay put.
      for(let q=0;q<region.length&&region.length<3;q++)for(const id of this.neighbors(region[q].id)){
        const c=this.cells[id];if(region.length<3&&c.owner===oldOwner&&this.unrest(c)>=2&&!region.includes(c))region.push(c);
      }
      const history=region.flatMap(c=>this.activeUnrest(c)),local=this.activeUnrest(center);
      const cause=local.filter(e=>e.kind==='drain').length>=local.filter(e=>e.kind==='capture').length?'drain':'war';
      const homeland=cause==='drain'?oldOwner:center.homeland>=0?center.homeland:local.find(e=>Number.isInteger(e.victim))?.victim??oldOwner;
      const validOpponent=id=>Number.isInteger(id)&&id>=0&&id<this.players&&id!==homeland;
      const trigger=cause==='war'?[...local].reverse().find(e=>e.kind==='capture'&&(validOpponent(e.actor)||validOpponent(e.victim))):null;
      const warOpponent=cause==='war'?(validOpponent(trigger?.actor)?trigger.actor:validOpponent(trigger?.victim)?trigger.victim:validOpponent(oldOwner)?oldOwner:null):null;
      const homelandEnemies=warOpponent===null?[]:[warOpponent];
      const participants=[...new Set([oldOwner,homeland,...history.flatMap(e=>[e.actor,e.victim,...(e.enemies??[])])].filter(id=>Number.isInteger(id)&&id>=0&&id<this.players))];
      const owner=this.players++;this.ai++;this.factions.push({...newCountry(owner,++this.secessions),parent:oldOwner,origin:homeland,warOpponent,homelandEnemies,cause,participants,fixedRelations:{}});
      this.relations.forEach(row=>row.push(1));this.relations.push(Array(this.players).fill(1));this.relations[owner][owner]=0;
      this.attackedBy.forEach(row=>row.push(false));this.attackedBy.push(Array(this.players).fill(false));
      this.neutralInitiative.push(null);
      this.aiMarches.push(null);this.marchDecisionTurn.push(-1);
      this.defenseOrders.push([]);
      const enemies=new Set(homelandEnemies);
      this.relations[owner][homeland]=cause==='drain'?2:0;
      for(const enemy of enemies)this.relations[owner][enemy]=2;
      for(const participant of new Set([...participants,...enemies]))if(this.relations[owner][participant]!==1)this.factions[owner].fixedRelations[participant]=this.relations[owner][participant];
      this.factions[owner].permanentRelations={...this.factions[owner].fixedRelations};
      this.capitalLost.push(false);this.aiPlans.push(null);this.aiAnchors.push(center.id);this.spawns.push(center.id);
      const armyChanges=region.map(c=>({id:c.id,before:c.army,after:c.army*SECESSION_ARMY_MULTIPLIER}));
      for(const c of region){c.army*=SECESSION_ARMY_MULTIPLIER;c.birthArmy=c.army;c.owner=owner;c.homeland=owner;c.capital=-1;c.unrestEvents=[];c.stableUntil=this.turn+SECESSION_GRACE;}
      center.capital=owner;this.factions[owner].birthArmy=center.birthArmy;this.capitalLost[oldOwner]=this.capitals(oldOwner).length===0;this.aiPlans[oldOwner]=null;
      const location=`${columnLabel(center.id%this.w)}${Math.floor(center.id/this.w)+1}`;
      this.addEvent(`${location}一带因${cause==='drain'?'反复抽调驻军':'反复易手'}发生分裂，脱离${this.factions[oldOwner].name}，成立${this.factions[owner].name}（${region.length} 格出格，原格兵力 ×${SECESSION_ARMY_MULTIPLIER}，电脑控制）`,'secession',owner);
      this.addEvent(`出格固定以建国时兵力增兵：普通格每轮 +1 倍，首都每轮 +3 倍；${location}的基数为 ${formatArmy(center.birthArmy)}`,'system',owner);
      this.addEvent(`${this.factions[owner].name}的建国关系永久固定：${Object.keys(this.factions[owner].permanentRelations).map(id=>`${this.factions[id].name}（${ATTITUDES[this.attitude(owner,Number(id))]}）`).join('、')}；${warOpponent===null?'内部矛盾，无额外交战敌国':'这次分裂的交战对手只有'+this.factions[warOpponent].name}；其他国家默认中立，不继承祖国的其他敌国`,'diplomacy',owner);
      if(!this.cells.some(c=>c.owner===oldOwner))this.addEvent(`${this.factions[oldOwner].name}失去全部领土，已出局`,'eliminated',oldOwner);
      countries.push({owner,oldOwner,homeland,cause,warOpponent,participants,capital:center.id,cells:region.map(c=>c.id),armyChanges});
    }
    this.resolveGrowthLimits();
    return countries;
  }
  addEvent(text,kind='system',owner=-1){this.events.unshift({text,kind,owner,time:this.time});this.events=this.events.slice(0,30);}
  sent(from,ratio=0.5){return Math.max(0,Math.min(from.army-1,Math.floor(from.army*Math.min(1,Math.max(0,ratio)))));}
  setMultiFront(enabled){
    if(typeof enabled!=='boolean')throw new Error('多线作战需设置为开启或关闭');
    if(this.roundState||this.resolving){this.pendingMultiFront=enabled===this.multiFront?null:enabled;return;}
    this.multiFront=enabled;this.pendingMultiFront=null;this.aiPlans.fill(null);
  }
  beginRound(){
    if(!this.roundState){
      this.turn++;
      this.roundState={actions:[],contested:new Set(),actedHumans:new Set(),multiFront:this.multiFront,
        startOwners:this.multiFront?Int32Array.from(this.cells,c=>c.owner):null,usedSources:new Set(),capturedThisRound:new Set()};
    }
    return this.roundState;
  }
  sourceBlockReason(id,owner){
    const round=this.roundState;
    if(!this.multiFront||!round)return '';
    if(round.startOwners[id]!==owner||round.capturedThisRound.has(id))return '本轮新占或收复的格子，要等下一轮才能出兵';
    if(round.usedSources.has(id))return '这个格子本轮已经出兵，请选择其他领土';
    return '';
  }
  canUseSource(id,owner){return this.cells[id]?.owner===owner&&!this.sourceBlockReason(id,owner);}
  readySources(owner){return this.cells.filter(c=>c.army>=2&&this.canUseSource(c.id,owner));}
  freeFrontAction(action){return this.multiFront&&action?.ok&&['attack','support'].includes(action.kind);}
  recordSource(action){
    const round=this.roundState;
    if(!round?.multiFront||!action?.ok||!['attack','reinforce','support'].includes(action.kind))return;
    round.usedSources.add(action.fromId);
    if(action.captured)round.capturedThisRound.add(action.toId);
  }
  attack(fromId,toId,owner,ratio=0.5,{defenseOrder=null}={}){
    if(!this.running||this.paused||this.winner!==null)return {ok:false,reason:'战斗尚未进行'};
    const from=this.cells[fromId],to=this.cells[toId];
    if(!from||!to||from.owner!==owner||!this.neighbors(fromId).includes(toId))return {ok:false,reason:'只能向上下左右相邻的领土出兵'};
    const sourceReason=this.sourceBlockReason(fromId,owner);if(sourceReason)return {ok:false,reason:sourceReason};
    if(!this.canAttack(owner,to.owner))return {ok:false,reason:this.attitude(owner,to.owner)===0?'对该国处于和平，先在外交面板宣战才能进攻':'对该国处于中立，未遭到该国进攻，不能主动攻击；可先宣战'};
    const amount=this.sent(from,ratio);
    if(amount<1)return {ok:false,reason:'兵力不足，至少留守 1 名士兵'};
    const sea=this.trySeaEntry(owner,to);if(!sea.ok)return sea;
    if(this.multiFront)this.beginRound();
    const oldOwner=to.owner,routeDefense=defenseOrder&&oldOwner>=0&&oldOwner!==owner&&oldOwner!==defenseOrder.beneficiary&&this.activeDefenseOrders(owner).includes(defenseOrder)?{...defenseOrder,breakingBlockade:this.attitude(owner,oldOwner)===0&&oldOwner!==defenseOrder.enemy}:null;
    const defense=this.peaceSupportContext(owner,oldOwner)??routeDefense,fromBefore=from.army,toBefore=to.army;from.army-=amount;
    const hostileAttack=oldOwner>=0&&oldOwner!==owner&&this.attitude(owner,oldOwner)===2;
    if(oldOwner>=0&&oldOwner!==owner){
      if(to.homeland<0)to.homeland=oldOwner;
      if(defense)this.attackedBy[oldOwner][owner]=true;else this.reactToAttack(owner,oldOwner);
      this.notifyPeaceSupport(owner,oldOwner);
    }
    const secessionExempt=oldOwner>=0&&oldOwner!==owner&&this.secessionExempt(owner,oldOwner);
    let captured=false;
    if(to.owner===owner)to.army+=amount;
    else if(amount>to.army){to.army=amount-to.army;to.owner=owner;captured=true;if(oldOwner<0)to.homeland=owner;}
    else to.army-=amount;
    if(captured&&oldOwner>=0&&to.capital===oldOwner){
      to.capital=-1;this.capitalLost[oldOwner]=this.capitals(oldOwner).length===0;
      this.addEvent(`${this.factions[oldOwner].name}首都被攻占，原首都失效`,'capital-lost',oldOwner);
    }
    const kind=oldOwner===owner?'reinforce':'attack';
    if(captured&&oldOwner>=0&&!secessionExempt)this.recordUnrest(to,'capture',{actor:owner,victim:oldOwner});
    // Only an actual protected attack gets war immunity. Friendly transfers
    // and empty-land expansion cannot inherit immunity from another opponent.
    const enemies=oldOwner>=0&&oldOwner!==owner?(this.attitude(owner,oldOwner)===2&&!secessionExempt?[oldOwner]:[]):this.unrestEnemies(owner);
    const nonCombat=this.secessionMode==='repeat'&&this.factions[owner]?.rebel&&(oldOwner<0||oldOwner===owner);
    if(amount>=3&&amount/fromBefore>=.75&&!secessionExempt&&(enemies.length||nonCombat))this.recordUnrest(from,'drain',{actor:owner,hostile:enemies.length>0,nonCombat:!!nonCombat,enemies});
    const location=`${columnLabel(toId%this.w)}${Math.floor(toId/this.w)+1}`;
    if(kind==='reinforce')this.addEvent(`${this.factions[owner].name}增援 ${location}：${formatArmy(toBefore)} + ${formatArmy(amount)} = ${formatArmy(to.army)}`,'reinforce',owner);
    else if(oldOwner>=0)this.addEvent(`${this.factions[owner].name}出兵 ${formatArmy(amount)} 进攻 ${location}：守军 ${formatArmy(toBefore)} − ${formatArmy(Math.min(amount,toBefore))} = ${formatArmy(Math.max(0,toBefore-amount))}${defense?'；支援'+this.factions[defense.beneficiary].name+'，外交关系不下降':''}${secessionExempt?'；免动荡：目标是'+(this.factions[owner].origin===oldOwner?'祖国':'此次分裂的交战对手')+'（保留已有动荡）':''}`,'battle',owner);
    if(this.isHuman(owner)){this.moves++;if(captured)this.captures++;}
    if(captured&&oldOwner>=0){
      this.addEvent(`${this.factions[owner].name}攻占了${this.factions[oldOwner].name}的领土`,'battle',owner);
      if(!this.cells.some(c=>c.owner===oldOwner))this.addEvent(`${this.factions[oldOwner].name}失去全部领土，已出局`,'eliminated',oldOwner);
    }
    this.recordSource({ok:true,kind,fromId,toId,captured});
    if(captured)this.resolveGrowthLimits();
    this.checkWinner();
    return {ok:true,amount,captured,oldOwner,owner,toId,fromId,kind,hostileAttack,secessionExempt,peaceSupport:!!defense,defenseFor:defense?.beneficiary,breakingBlockade:defense?.breakingBlockade??false,seaEntry:!!sea.seaEntry,fromBefore,fromAfter:from.army,toBefore,toAfter:to.army};
  }
  checkWinner(){const owner=this.cells[0].owner;if(owner>=0&&this.cells.every(c=>c.owner===owner)){this.winner=owner;this.running=false;this.pendingHumanControl=null;this.addEvent(`${this.factions[owner].name}占领全图，获得胜利！`,'victory',owner);}}
  get resolving(){return this.pendingTurn!==null;}
  constructCapital(toId,owner){
    if(!this.running||this.paused||this.winner!==null)return {ok:false,reason:'当前不能建设首都'};
    const target=this.cells[toId];
    if(!target||target.owner!==owner)return {ok:false,reason:'首都只能建设在己方领土'};
    if(this.isCapital(target))return {ok:false,reason:'这里已经是首都，请选择己方普通领土'};
    if(this.capitals(owner).length>=2)return {ok:false,reason:'已有两座首都，请使用迁都'};
    this.capitalLost[owner]=false;target.capital=owner;this.aiPlans[owner]=null;
    const location=`${columnLabel(toId%this.w)}${Math.floor(toId/this.w)+1}`;
    this.addEvent(`${this.factions[owner].name}在 ${location} 建设了新首都`,'capital-build',owner);
    return {ok:true,kind:'capital-build',owner,oldOwner:owner,fromId:-1,toId,amount:0,captured:false};
  }
  buildCapital(toId,options={}){
    if(this.resolving)return {ok:false,reason:'当前回合正在结算'};
    if(this.currentHuman===null)return {ok:false,reason:'当前没有轮到人类玩家'};
    const result=this.constructCapital(toId,this.currentHuman);
    if(result.ok)result.actions=this.finishTurn([{...result}],options);
    return result;
  }
  relocateCapital(toId,owner,sourceId){
    if(!this.running||this.paused||this.winner!==null)return {ok:false,reason:'当前不能迁都'};
    if(this.capitalLost[owner])return {ok:false,reason:'当前没有首都，请先建设新首都'};
    const target=this.cells[toId];
    if(!target||target.owner!==owner)return {ok:false,reason:'首都只能迁到己方领土'};
    if(this.isCapital(target))return {ok:false,reason:'这里已经是你的首都'};
    const previous=sourceId===undefined?this.capitals(owner)[0]:this.cells[sourceId];
    if(!previous||previous.owner!==owner||!this.isCapital(previous))return {ok:false,reason:'请选择要迁移的己方首都'};
    const fromId=previous.id;
    previous.capital=-1;target.capital=owner;
    this.aiPlans[owner]=null;
    const location=`${columnLabel(toId%this.w)}${Math.floor(toId/this.w)+1}`;
    this.addEvent(`${this.factions[owner].name}迁都至 ${location}`,'capital',owner);
    return {ok:true,kind:'capital',owner,oldOwner:owner,fromId,toId,amount:0,captured:false};
  }
  moveCapital(toId,options={}){
    if(this.resolving)return {ok:false,reason:'当前回合正在结算'};
    if(this.currentHuman===null)return {ok:false,reason:'当前没有轮到人类玩家'};
    const result=this.relocateCapital(toId,this.currentHuman,options.fromId);
    if(result.ok)result.actions=this.finishTurn([{...result}],options);
    return result;
  }
  playTurn(fromId,toId,ratio=0.5,options={}){
    if(this.resolving)return {ok:false,reason:'当前回合正在结算'};
    if(this.currentHuman===null)return {ok:false,reason:'当前没有轮到人类玩家'};
    const result=this.attack(fromId,toId,this.currentHuman,ratio);
    if(result.ok)result.actions=this.finishTurn([{...result}],options);
    return result;
  }
  waitTurn(options={}){
    if(!this.running||this.paused||this.winner!==null)return {ok:false,reason:'战斗尚未进行'};
    if(this.resolving)return {ok:false,reason:'当前回合正在结算'};
    return {ok:true,actions:this.finishTurn([],options)};
  }
  finishTurn(actions,{defer=false}={}){
    const round=this.beginRound();
    round.actions.push(...actions);actions.forEach(a=>this.recordCombat(a));
    if(round.multiFront&&this.currentHuman!==null&&actions.length&&actions.every(a=>this.freeFrontAction(a))&&this.readySources(this.currentHuman).length&&this.winner===null)return actions;
    if(this.currentHuman!==null)round.actedHumans.add(this.currentHuman);
    if(this.winner!==null)return actions;
    // Each local human gets one action before any computer or growth phase.
    const nextHuman=this.aliveHumans().find(id=>!round.actedHumans.has(id));
    if(nextHuman!==undefined){this.currentHuman=nextHuman;return actions;}
    this.currentHuman=null;
    const computers=this.factions.map((_,id)=>id).filter(id=>!this.isHuman(id)),offset=computers.length?(this.turn-1)%computers.length:0;
    this.pendingTurn={actions:round.actions,index:0,owners:computers.slice(offset).concat(computers.slice(0,offset)),contested:round.contested};
    if(!defer)while(this.resolving)this.stepTurn();
    return this.pendingTurn?actions:round.actions;
  }
  recordCombat(action){
    this.recordSource(action);
    if(action?.ok&&action.oldOwner>=0&&action.oldOwner!==action.owner){
      this.roundState.contested.add(action.fromId);this.roundState.contested.add(action.toId);
    }
  }
  stepTurn(){
    const pending=this.pendingTurn;
    if(!pending||this.paused)return null;
    if(this.winner!==null){this.pendingTurn=null;return null;}
    if(pending.index<pending.owners.length){
      const owner=pending.owners[pending.index];
      const action=this.aiMove(owner);
      if(action?.ok){pending.actions.push(action);this.recordCombat(action);}
      if(!this.freeFrontAction(action)||!this.readySources(owner).length)pending.index++;
      if(this.winner!==null)this.pendingTurn=null;
      return {kind:'action',owner,action};
    }
    this.resolveGrowthLimits();
    const changes=[];
    this.cells.forEach(c=>{
      // Fighting suppresses passive growth for both sides, including capitals.
      // Friendly reinforcements remain valid and are separate, recorded actions.
      const amount=this.growthAmount(c),cap=this.growthCap(c);
      if(c.owner>=0&&amount>0&&c.army<cap&&!pending.contested.has(c.id)){
        const before=c.army;c.army=Math.min(cap,c.army+amount);
        changes.push({id:c.id,owner:c.owner,before,after:c.army,amount:c.army-before});
      }
    });
    const diplomacy=this.resolveDiplomacy(),secessions=this.resolveSecessions();
    this.pendingTurn=null;this.roundState=null;this.currentHuman=this.aliveHumans()[0]??null;
    if(this.pendingMultiFront!==null)this.setMultiFront(this.pendingMultiFront);
    if(this.pendingHumanControl){const {owner,human}=this.pendingHumanControl;this.applyHumanControl(owner,human);}
    this.checkWinner();return {kind:'growth',changes,secessions,diplomacy};
  }
  update(dt){
    if(!this.running||this.paused||this.winner!==null)return [];
    dt=Math.max(0,Math.min(dt,0.25));this.time+=dt;
    // Human-controlled games, including zero-computer games, remain manual.
    // An observer-only game schedules its own rounds and uses the same staged
    // resolution as a human turn, preserving action counts and combat rules.
    if(!this.continuous){this.automaticElapsed=0;return [];}
    if(this.resolving)return [];
    this.automaticElapsed+=dt;
    if(this.automaticElapsed>=0.8){this.automaticElapsed=0;this.waitTurn({defer:true});}
    return [];
  }
  sharesBorder(a,b){return this.cells.some(c=>c.owner===a&&this.neighbors(c.id).some(id=>this.cells[id].owner===b));}
  marchPath(owner,target,head){
    const previous=new Int16Array(this.cells.length).fill(-1),queue=[head];previous[head]=head;
    for(let q=0;q<queue.length;q++)for(const id of this.neighbors(queue[q])){
      if(previous[id]>=0)continue;
      const c=this.cells[id];if(this.seaBlocked(owner,c)||(c.owner!==owner&&c.owner!==-1&&c.owner!==target))continue;
      previous[id]=queue[q];
      if(c.owner===target){const path=[id];while(path.at(-1)!==head)path.push(previous[path.at(-1)]);return path.reverse();}
      queue.push(id);
    }
    return null;
  }
  supportNeighbor(fromId,toId,owner,amount){
    const from=this.cells[fromId],to=this.cells[toId];
    if(!this.running||this.paused||this.winner!==null||!from||!to||from.owner!==owner||to.owner<0||to.owner===owner||this.attitude(owner,to.owner)!==0||!this.neighbors(fromId).includes(toId))return {ok:false,reason:'援军只能送往相邻的和平国家'};
    if(!Number.isInteger(amount)||amount<1||amount>MARCH_MAX_ARMY||amount>=from.army)return {ok:false,reason:'援军需保留驻军，每次最多 5 人'};
    const sourceReason=this.sourceBlockReason(fromId,owner);if(sourceReason)return {ok:false,reason:sourceReason};
    if(this.multiFront)this.beginRound();
    const fromBefore=from.army,toBefore=to.army;from.army-=amount;to.army+=amount;
    this.addEvent(`${this.factions[owner].name}送出 ${formatArmy(amount)} 人支援${this.factions[to.owner].name}：守军 ${formatArmy(toBefore)} + ${formatArmy(amount)} = ${formatArmy(to.army)}`,'support',owner);
    this.recordSource({ok:true,kind:'support',fromId,toId});
    return {ok:true,kind:'support',owner,oldOwner:owner,recipient:to.owner,fromId,toId,amount,captured:false,fromBefore,fromAfter:from.army,toBefore,toAfter:to.army};
  }
  advanceMarch(owner){
    const march=this.aiMarches[owner];if(!march)return null;
    const attitude=this.attitude(owner,march.target),head=this.cells[march.head];
    if(!head||head.owner!==owner||attitude!==(march.kind==='support'?0:2)||!this.cells.some(c=>c.owner===march.target)){
      this.aiMarches[owner]=null;return null;
    }
    if(!this.canUseSource(head.id,owner))return null;
    const path=this.marchPath(owner,march.target,march.head);
    if(!path){this.aiMarches[owner]=null;return null;}
    const amount=Math.min(MARCH_MAX_ARMY,head.army-1,Math.max(1,Math.floor(head.army*.1)));
    if(amount<1)return null;
    const toId=path[1],arrival=this.cells[toId].owner===march.target;
    const result=arrival&&march.kind==='support'?this.supportNeighbor(head.id,toId,owner,amount):this.attack(head.id,toId,owner,Math.min(1,(amount+.0001)/head.army));
    if(!result.ok){this.aiMarches[owner]=null;return result.seaFailed?result:null;}
    if(arrival)this.aiMarches[owner]=null;
    else {
      march.head=toId;result.marching=true;
      const coord=id=>`${columnLabel(id%this.w)}${Math.floor(id/this.w)+1}`;
      this.addEvent(`${this.factions[owner].name}小队向${this.factions[march.target].name}逐格行军：${coord(head.id)} 至 ${coord(toId)}，${formatArmy(amount)} 人`,'march',owner);
    }
    return result;
  }
  tryStartMarch(owner,owned){
    if(this.marchDecisionTurn[owner]===this.turn)return null;
    this.marchDecisionTurn[owner]=this.turn;
    const targets=this.factions.map((_,id)=>id).filter(id=>id!==owner&&this.cells.some(c=>c.owner===id)&&(this.attitude(owner,id)===0||(this.attitude(owner,id)===2&&!this.sharesBorder(owner,id))));
    if(!targets.length||!owned.some(c=>c.army>=2)||this.rng()>=MARCH_CHANCE)return null;
    targets.sort((a,b)=>this.attitude(owner,b)-this.attitude(owner,a)||a-b);
    for(const target of targets)for(const source of [...owned].sort((a,b)=>b.army-a.army)){
      if(source.army<2||!this.marchPath(owner,target,source.id))continue;
      this.aiMarches[owner]={target,kind:this.attitude(owner,target)===0?'support':'attack',head:source.id};
      return this.advanceMarch(owner);
    }
    return null;
  }
  peaceSupportDistances(owner,order,target,allowPeace){
    const distance=new Int32Array(this.cells.length).fill(-1),queue=[];
    for(const c of this.cells)if(c.owner===target&&!this.seaBlocked(owner,c)){distance[c.id]=0;queue.push(c.id);}
    for(let q=0;q<queue.length;q++)for(const id of this.neighbors(queue[q])){
      if(distance[id]>=0||this.seaBlocked(owner,this.cells[id]))continue;
      const other=this.cells[id].owner;
      if(other===order.beneficiary&&other!==target)continue;
      if(other>=0&&other!==owner&&other!==target&&other!==order.enemy&&this.attitude(owner,other)===0&&!allowPeace)continue;
      distance[id]=distance[queue[q]]+1;queue.push(id);
    }
    return distance;
  }
  peaceSupportMove(owner,owned){
    const contexts=new Map(),contextFor=target=>{if(!contexts.has(target))contexts.set(target,this.peaceSupportContext(owner,target));return contexts.get(target);};
    for(const order of this.activeDefenseOrders(owner)){
      const blockade=this.defenseBlockade(owner,order.beneficiary);
      for(const target of [order.enemy,order.beneficiary]){
        const distance=this.peaceSupportDistances(owner,order,target,blockade.blocked);let best=null,bestScore=-Infinity;
        for(const from of owned){
          if(from.army<2||distance[from.id]<1)continue;
          for(const id of this.neighbors(from.id)){
            if(distance[id]!==distance[from.id]-1)continue;
            const to=this.cells[id],recipient=to.owner===order.beneficiary;let ratio=1,amount=this.sent(from,1);
            if(recipient)amount=Math.min(MARCH_MAX_ARMY,from.army-1,Math.max(1,Math.floor(from.army*.1)));
            else if(to.owner>=0&&to.owner!==owner){
              const context=contextFor(to.owner);
              if(!context&&this.attitude(owner,to.owner)===1&&!this.isHuman(owner))this.prepareNeutralInitiative(owner);
              if(!context&&!this.ordinaryCanAttack(owner,to.owner))continue;
              if(this.sent(from,.5)>to.army){ratio=.5;amount=this.sent(from,.5);}else if(amount<=to.army)continue;
            }
            const score=amount/(distance[from.id]+.75);
            if(score>bestScore){bestScore=score;best={from,to,recipient,ratio,amount};}
          }
        }
        if(!best)continue;
        const action=best.recipient?this.supportNeighbor(best.from.id,best.to.id,owner,best.amount):this.attack(best.from.id,best.to.id,owner,best.ratio,{defenseOrder:order});
        if(action.ok){action.defenseFor=order.beneficiary;action.defenseEnemy=order.enemy;if(best.to.owner===owner&&action.oldOwner===owner)this.addEvent(`${this.factions[owner].name}正集结兵力，支援${this.factions[order.beneficiary].name}反击${this.factions[order.enemy].name}`,'defense',owner);}
        return action;
      }
    }
    return null;
  }
  aiMove(owner){
    const action=this.aiAction(owner);
    // A failed sea attempt is free; use the country's one action on land.
    return action?.seaFailed?this.aiAction(owner):action;
  }
  aiAction(owner){
    if(!this.running||this.paused||this.winner!==null)return null;
    const territory=this.cells.filter(c=>c.owner===owner);if(!territory.length)return null;
    const owned=this.multiFront?territory.filter(c=>c.army>=2&&this.canUseSource(c.id,owner)):territory;
    if(this.capitalLost[owner]){
      // Rebuilding is this round's action, not a passive restoration on recapture.
      const site=[...territory].sort((a,b)=>(Math.min(b.army,999)-this.aiThreat(b.id,owner)*4)-(Math.min(a.army,999)-this.aiThreat(a.id,owner)*4))[0];
      return this.constructCapital(site.id,owner);
    }
    if(!owned.length)return null;
    if(this.activeDefenseOrders(owner).length)return this.peaceSupportMove(owner,owned);
    const nearbyEnemy=owned.some(c=>this.neighbors(c.id).some(id=>this.cells[id].owner>=0&&this.cells[id].owner!==owner&&this.attitude(owner,this.cells[id].owner)===2));
    if(this.aiMarches[owner]?.kind==='support'&&nearbyEnemy)this.aiMarches[owner]=null;
    if(this.aiMarches[owner]&&!this.sourceBlockReason(this.aiMarches[owner].head,owner)){const action=this.advanceMarch(owner);if(action||this.aiMarches[owner])return action;}
    if(!nearbyEnemy){const action=this.tryStartMarch(owner,owned);if(action)return action;}
    if(owned.some(c=>this.neighbors(c.id).some(id=>this.cells[id].owner>=0&&this.cells[id].owner!==owner&&this.attitude(owner,this.cells[id].owner)===1&&!this.attackedBy[owner][this.cells[id].owner])))this.prepareNeutralInitiative(owner);
    const counts=Array(this.players).fill(0);this.cells.forEach(c=>{if(c.owner>=0)counts[c.owner]++;});
    const fronts=[];
    for(const c of owned){
      for(const n of this.neighbors(c.id)){
        if(this.cells[n].owner!==owner&&!this.seaBlocked(owner,this.cells[n])&&this.canAttack(owner,this.cells[n].owner))fronts.push({rally:c.id,target:n});
      }
    }
    if(!fronts.length)return null;
    const neutral=fronts.filter(f=>this.cells[f.target].owner===-1);
    const hostile=fronts.filter(f=>this.cells[f.target].owner>=0&&this.attitude(owner,this.cells[f.target].owner)===2);
    const retaliation=fronts.filter(f=>this.cells[f.target].owner>=0&&this.attitude(owner,this.cells[f.target].owner)===1);
    const candidates=hostile.length?hostile:retaliation.length?retaliation:neutral;
    if(!neutral.length&&this.capitals(owner).length===1&&territory.length>=4){
      const site=owned.filter(c=>!this.isCapital(c)&&!this.neighbors(c.id).some(id=>this.cells[id].owner>=0&&this.cells[id].owner!==owner))
        .sort((a,b)=>b.army-a.army)[0];
      if(site)return this.constructCapital(site.id,owner);
    }
    let plan=this.aiPlans[owner];
    const invalid=!plan||!this.canUseSource(plan.rally,owner)||!candidates.some(f=>f.target===plan.target);
    if(invalid||plan.age>=Math.max(128,this.cells.length)){
      let best=null,bestScore=-Infinity;
      for(const f of candidates){
        const from=this.cells[f.rally],to=this.cells[f.target];
        const adjacent=this.neighbors(to.id),threat=this.aiThreat(to.id,owner);
        let score;
        if(to.owner===-1){
          // Complete reachable expansion, including the final isolated blank.
          score=(from.army>=2?100:0)+adjacent.filter(n=>this.cells[n].owner===-1).length*3+Math.min(from.army,30)*.1;
        }else{
          const required=to.army+threat+2;
          score=100+(from.army-1>=required?80:0)+(from.id===this.aiAnchors[owner]?60:0)
            +30/Math.max(1,counts[to.owner])+(this.isCapital(to)?8:0)
            +this.attitude(owner,to.owner)*18
            -Math.log1p(required)*8+Math.log1p(from.army)*6;
        }
        score+=this.rng()*(this.difficulty==='easy'?16:this.difficulty==='hard'?1:4);
        if(score>bestScore){bestScore=score;best=f;}
      }
      plan={...best,age:0};this.aiPlans[owner]=plan;
    }
    plan.age++;
    // Keep the target, but use a substantially stronger adjacent launch tile.
    for(const n of this.neighbors(plan.target))if(this.canUseSource(n,owner)&&this.cells[n].army>this.cells[plan.rally].army*1.5+4)plan.rally=n;
    const from=this.cells[plan.rally],to=this.cells[plan.target];
    const safety=this.difficulty==='easy'?.6:this.difficulty==='hard'?1.1:1;
    const reserve=to.owner===-1?0:Math.max(1,Math.ceil(this.aiThreat(to.id,owner)*safety));
    const required=to.army+reserve+1;
    let ratio=null;
    if(to.owner===-1&&this.sent(from,.5)>0)ratio=.5;
    else if(this.sent(from,.5)>=required)ratio=.5;
    else if(this.sent(from,1)>=required)ratio=1;
    if(ratio!==null){
      const result=this.attack(from.id,to.id,owner,ratio);
      if(result.ok&&result.captured){this.aiAnchors[owner]=to.id;this.aiPlans[owner]=null;}
      return result;
    }
    // Rally on one front. Every transfer strictly reduces distance to that
    // rally, so interior armies cannot circulate between unrelated borders.
    const dist=new Int16Array(this.cells.length).fill(-1),queue=[plan.rally];dist[plan.rally]=0;
    for(let q=0;q<queue.length;q++)for(const n of this.neighbors(queue[q]))if(this.cells[n].owner===owner&&dist[n]===-1){dist[n]=dist[queue[q]]+1;queue.push(n);}
    let transfer=null,transferScore=-Infinity;
    for(const c of owned){
      if(c.id===plan.rally||c.army<4||dist[c.id]<1)continue;
      const next=this.neighbors(c.id).filter(n=>this.cells[n].owner===owner&&dist[n]===dist[c.id]-1)
        .sort((a,b)=>this.cells[b].army-this.cells[a].army)[0];
      if(next===undefined)continue;
      const danger=this.aiThreat(c.id,owner);
      const sendRatio=danger>0&&c.army-this.sent(c,.5)>danger?.5:1;
      const amount=this.sent(c,sendRatio),score=amount/(dist[c.id]+.75);
      if(score>transferScore){transferScore=score;transfer={from:c.id,to:next,ratio:sendRatio};}
    }
    return transfer?this.attack(transfer.from,transfer.to,owner,transfer.ratio):null;
  }
  aiThreat(id,owner){
    let threat=0;
    for(const n of this.neighbors(id)){
      const c=this.cells[n];if(c.owner>=0&&c.owner!==owner&&this.attitude(c.owner,owner)!==0)threat=Math.max(threat,c.army-1);
    }
    return threat;
  }
}
