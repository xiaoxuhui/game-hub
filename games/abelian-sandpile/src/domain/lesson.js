(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./sandpile.js'):root.SandpileCore);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.SandpileLesson=api;
})(globalThis,function(C){
 'use strict';
 function category(topplings){C.integer(topplings,0,C.LIMITS.counter,'崩塌次数');return topplings===0?'quiet':topplings===1?'single':'cascade';}
 function trace(before,x,y,amount=1,maxWaves=256){
   C.integer(before.width,1,9,'观察棋盘宽度');C.integer(before.height,1,9,'观察棋盘高度');
   const state=C.validateSnapshot(before);if(!state.stable)throw new Error('观察必须从稳定动作前状态开始');
   C.integer(amount,1,1,'教学投沙量');C.integer(maxWaves,1,256,'观察波次上限');C.drop(state,x,y,amount);
   const frames=[{state:C.clone(state),sources:[],receivers:[],newlyUnstable:[],topplings:0,lost:0}];
   while(!state.stable){
     if(frames.length>maxWaves)throw new Error('观察波次超过预算');
     const previous=state.cells.slice(),sources=previous.flatMap((v,i)=>v>=4?[i]:[]),received=new Set();
     for(const i of sources)for(const n of C.neighbours(state,i))if(n>=0)received.add(n);
     const oldLost=state.lost,topplings=C.wave(state);
     frames.push({state:C.clone(state),sources,receivers:[...received].sort((a,b)=>a-b),
       newlyUnstable:state.cells.flatMap((v,i)=>v>=4&&previous[i]<4?[i]:[]),topplings,lost:state.lost-oldLost});
   }
   return {frames,topplings:state.topplings-before.topplings,lost:state.lost-before.lost,category:category(state.topplings-before.topplings)};
 }
 return Object.freeze({trace,category});
});
