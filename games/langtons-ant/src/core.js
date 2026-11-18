(function (root) {
  'use strict';
  const dirs = [{name:'上',dx:0,dy:-1},{name:'右',dx:1,dy:0},{name:'下',dx:0,dy:1},{name:'左',dx:-1,dy:0}];
  const key = (x,y) => `${x},${y}`;
  const parseKey = value => value.split(',').map(Number);
  const create = () => ({black:new Set(),ant:{x:0,y:0,dir:0},steps:0});
  function tick(state) {
    const {ant,black} = state, here = key(ant.x,ant.y);
    if (black.has(here)) { black.delete(here); ant.dir=(ant.dir+3)%4; }
    else { black.add(here); ant.dir=(ant.dir+1)%4; }
    ant.x+=dirs[ant.dir].dx; ant.y+=dirs[ant.dir].dy; state.steps++;
  }
  function run(state,count) { for(let i=0;i<count;i++) tick(state); }
  function reset(state) { state.black.clear(); state.ant={x:0,y:0,dir:0}; state.steps=0; }
  function clear(state) { state.black.clear(); state.steps=0; }
  const seedCount = count => Math.floor(Math.max(0,Math.min(2000,Number(count)||0)));
  function randomize(state,count,rng=Math.random) {
    reset(state); count=seedCount(count);
    const radius=Math.max(8,Math.ceil(Math.sqrt(count)*1.6));
    for(let i=0;i<count;i++) {
      const x=Math.floor((rng()*2-1)*radius), y=Math.floor((rng()*2-1)*radius);
      if(x!==0 || y!==0) state.black.add(key(x,y));
    }
  }
  const api={dirs,key,parseKey,create,tick,run,reset,clear,seedCount,randomize};
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.LangtonsAnt=api;
})(globalThis);
