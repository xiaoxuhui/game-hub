importScripts('vendor/cube.js', 'vendor/solve.js', 'core.js?v=black1');
importScripts('cuboid.js?v=expand1');
let initialized=false;
self.onmessage=event=>{
  const {text,id,dimensions=[3,3,3],history}=event.data;
  try {
    const model=new Cuboid.CuboidModel(dimensions);
    if(event.data.action==='scramble'){
      const result=model.scramble();self.postMessage({id,kind:'scramble',state:result.state,moves:result.moves});return;
    }
    if(!model.classic&&!model.pocket){
      model.validate(text);
      self.postMessage({id,kind:'progress',message:'正在计算此尺寸的非黑色还原步骤…'});
      const result=model.findSolution(text,history);
      if(result===null)throw Error('搜索范围内未找到自填状态的解。此尺寸的随机生成状态可用打乱记录求解；二阶、三阶支持任意合法填色求解。');
      const {moves,method,baseline}=result;
      let state=text;for(const move of moves)state=model.apply(state,move);
      if(!model.isSolved(state))throw Error('未能验证还原方案，请重新计算。');
      self.postMessage({id,kind:'result',moves,method,baseline});return;
    }
    if(model.pocket)model.validate(text);
    const solverText=model.solverPattern(text);
    CubeCore.validatePattern(solverText,Cube);
    if(model.classic&&text.includes('*')){
      self.postMessage({id,kind:'progress',message:'正在寻找只还原非黑色格子的步骤…'});
      const short=CubeCore.shortPatternSolution(text);
      if(short){self.postMessage({id,kind:'result',moves:short,method:'置换搜索'});return;}
    }
    const cube=CubeCore.completePattern(solverText,Cube);
    if(!initialized){self.postMessage({id,kind:'progress',message:'正在准备求解器，首次使用需要几秒钟…'});Cube.initSolver();initialized=true;}
    let moves=cube.isSolved()?[]:cube.solve().trim().split(/\s+/).filter(Boolean);
    let current=text,stop=0;
    while(!model.isSolved(current)&&stop<moves.length)current=model.apply(current,moves[stop++]);
    if(!model.isSolved(current))throw Error('未能得到有效还原方案，请重新计算。');
    moves=moves.slice(0,stop);
    self.postMessage({id,kind:'result',moves,method:'二阶段求解'});
  }catch(error){self.postMessage({id,kind:'error',message:error.message});}
};
