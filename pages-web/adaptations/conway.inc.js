  {
    const key='game-hub-web-latest-world-v1';let writable=true,last=null,timer=null;
    const warn=text=>showToast(text,{duration:10000});
    try{const text=localStorage.getItem(key);if(text!==null){if(text.length>8*1024*1024)throw Error('存档过大');const restored=Life.deserialize(text);stop();state.world.rule=restored.rule;cancelLogicForRuleChange();syncRuleDraft();state.dialogs.placement=null;state.world.cells=restored.world;state.world.generation=restored.generation;state.world.logicOutputs=[];state.world.camera=RendererModule.createCamera(restored.view);state.world.undoSnapshot=null;last=text;render()}}catch{writable=false;warn('最近世界无法读取，原数据已保留；请先从大厅导出备份。')}
    const save=()=>{clearTimeout(timer);timer=null;if(!writable)return;try{const text=JSON.stringify(Life.serialize(state.world.cells,state.world.generation,state.world.camera,state.world.rule));if(text.length>8*1024*1024)throw Error('存档过大');if(text!==last){localStorage.setItem(key,text);last=text}}catch{writable=false;warn('世界自动保存失败，请检查空间并导出备份。')}};
    const schedule=()=>{if(timer===null)timer=setTimeout(save,300)};
    for(const type of ['click','change','input','keyup','pointerup','wheel'])document.addEventListener(type,schedule);
    window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save()});setInterval(()=>{if(state.world.running)save()},2000);
  }
