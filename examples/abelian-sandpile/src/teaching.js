(function(root){
 'use strict';
 const $=id=>document.getElementById(id),L=root.SandpileLesson,R=root.SandpileRenderer;
 const labels={quiet:'没有崩塌',single:'崩塌 1 次',cascade:'连锁崩塌至少 2 次'};
 class View{
   constructor(level){
     this.level=level;this.clear();
     document.querySelectorAll('[data-prediction]').forEach(b=>b.onclick=()=>{this.prediction=b.dataset.prediction;this.render(this.level,true);});
     $('hint-button').onclick=()=>{this.hintCount=Math.min(3,this.hintCount+1);this.render(this.level,true);};
     $('replay-prev').onclick=()=>this.seek(this.index-1);$('replay-next').onclick=()=>this.seek(this.index+1);
     $('replay-range').oninput=()=>this.seek(Number($('replay-range').value));
   }
   clear(){this.trace=null;this.index=0;this.prediction=null;this.hintCount=0;this.feedback='先选一个预测，再向虚线格投沙；也可以直接尝试。';}
   record(before,p){
     try{
       const trace=L.trace(before,p.x,p.y),guess=this.prediction;this.trace=trace;this.index=0;
       this.feedback=`${guess?guess===trace.category?'预测正确。':'预测不同，看看哪一波超出预期。':'观察结果：'}稳定后${labels[trace.category]}，共 ${trace.topplings} 次基础崩塌、流失 ${trace.lost} 粒。`;
       this.prediction=null;
     }catch(e){this.trace=null;this.feedback=`投沙已受理，观察未生成：${e.message}`;}
   }
   seek(index){if(!this.trace)return;this.index=Math.max(0,Math.min(this.trace.frames.length-1,index));this.render(this.level,true);}
   render(level,active){
     if(this.level.id!==level.id){this.clear();this.level=level;}
     $('lesson-panel').hidden=!active;$('lesson-concept').textContent=level.teaching?.concept||'观察本步连锁';
     document.querySelectorAll('[data-prediction]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.prediction===this.prediction)));
     $('prediction-feedback').textContent=this.feedback;
     $('hint-button').textContent=`展开提示 ${this.hintCount} / 3`;$('hint-button').disabled=this.hintCount>=3;
     $('lesson-hints').textContent='';for(const text of (level.teaching?.hints||[]).slice(0,this.hintCount)){const li=document.createElement('li');li.textContent=text;$('lesson-hints').append(li);}
     $('lesson-empty').hidden=Boolean(this.trace);$('lesson-replay').hidden=!this.trace;if(!this.trace||!active)return;
     const t=this.trace,f=t.frames[this.index],last=t.frames.length-1;
     R.draw($('lesson-board'),f.state,null,[],f);
     $('replay-prev').disabled=this.index===0;$('replay-next').disabled=this.index===last;
     $('replay-range').max=last;$('replay-range').value=this.index;$('replay-range').disabled=last===0;
     $('replay-position').textContent=`第 ${this.index} / ${last} 波`;
     const positions=values=>values.slice(0,6).map(i=>`(${i%f.state.width},${Math.floor(i/f.state.width)})`).join('、')+(values.length>6?` 等 ${values.length} 格`:'');
     $('wave-explanation').textContent=this.index===0?last?'刚投下一粒，还没有处理崩塌。向后一步，看达到四粒的格子如何传递。':'没有达到四粒；本步没有崩塌，沙留在落点。':`第 ${this.index} 波：${positions(f.sources)} 崩塌，${f.receivers.length} 格收到沙；本波流失 ${f.lost} 粒。${f.newlyUnstable.length?`新触发 ${positions(f.newlyUnstable)}，留到下一波。`:'没有新增达到阈值的格子。'}`;
     $('replay-summary').textContent=`本步共 ${last} 波 / ${t.topplings} 次基础崩塌 / 流失 ${t.lost} 粒。回放只读，不扣步、不改变主棋盘。`;
   }
   get summary(){return this.trace?{index:this.index,waves:this.trace.frames.length-1,topplings:this.trace.topplings,lost:this.trace.lost}:null;}
 }
 root.SandpileTeaching=Object.freeze({View});
})(globalThis);
