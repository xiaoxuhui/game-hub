(function(root) {
  'use strict';
  const KEY='langtons-ant.save.v1', MAX_CELLS=100000, MAX_BYTES=4*1024*1024;
  const defaults=()=>({speed:60,cellSize:10,follow:true,grid:true,seedCount:120,mode:'paint',view:{x:0,y:0}});
  const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
  const coord=n=>integer(n,-1e9,1e9);
  function validate(data) {
    if(!data || data.schemaVersion!==1) throw Error('未知存档版本');
    const {ant,steps,black,settings:s}=data;
    if(!ant || !coord(ant.x)||!coord(ant.y)||!integer(ant.dir,0,3)||!integer(steps,0,Number.MAX_SAFE_INTEGER)) throw Error('蚂蚁状态无效');
    if(!Array.isArray(black)||black.length>MAX_CELLS) throw Error('棋盘超出存档上限');
    const keys=new Set();
    for(const cell of black) {
      if(!Array.isArray(cell)||cell.length!==2||!cell.every(coord)) throw Error('格子无效');
      const key=cell.join(','); if(keys.has(key)) throw Error('重复格子'); keys.add(key);
    }
    if(!s||!integer(s.speed,1,5000)||!integer(s.cellSize,3,28)||!integer(s.seedCount,0,2000)||
      typeof s.follow!=='boolean'||typeof s.grid!=='boolean'||!['paint','erase','pan'].includes(s.mode)||
      !s.view||!Number.isFinite(s.view.x)||!Number.isFinite(s.view.y)||Math.abs(s.view.x)>1e9||Math.abs(s.view.y)>1e9) throw Error('设置无效');
    return {state:{ant:{...ant},steps,black:keys},settings:{...s,view:{...s.view}}};
  }
  function encode(state,settings) {
    const data={schemaVersion:1,ant:{...state.ant},steps:state.steps,black:[...state.black].map(k=>k.split(',').map(Number)),settings};
    validate(data); const raw=JSON.stringify(data);
    if(raw.length>MAX_BYTES) throw Error('存档过大'); return raw;
  }
  function decode(raw) {
    if(typeof raw!=='string'||raw.length>MAX_BYTES) throw Error('存档过大');
    return validate(JSON.parse(raw));
  }
  function load(storage) {
    try {const raw=storage.getItem(KEY); return raw===null?{status:'empty'}:{status:'restored',...decode(raw)};}
    catch(error) {return {status:'error',message:error.message};}
  }
  function save(storage,state,settings) {
    try {storage.setItem(KEY,encode(state,settings)); return {status:'saved'};}
    catch(error) {return {status:'error',message:error.message};}
  }
  const api={KEY,MAX_CELLS,MAX_BYTES,defaults,encode,decode,load,save};
  if(typeof module==='object'&&module.exports) module.exports=api; else root.AntStorage=api;
})(globalThis);
