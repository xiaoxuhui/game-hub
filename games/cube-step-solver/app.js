(() => {
  const {faces,names,describe,validatePattern}=CubeCore;
  const {CuboidModel}=Cuboid;
  const colors={w:{name:'白',hex:'#f3f4ef'},r:{name:'红',hex:'#ef5966'},g:{name:'绿',hex:'#43c99a'},y:{name:'黄',hex:'#f3d358'},o:{name:'橙',hex:'#f6984c'},b:{name:'蓝',hex:'#508aeb'},k:{name:'黑',hex:'#07090e'}};
  let model=new CuboidModel(),centers=['w','r','g','y','o','b'],stickers=[],selected='w',history=[],scrambleCount=null;
  let moves=[],cursor=0,hasPlan=false,busy=false,animating=false,worker=null,job=0,timer=null;
  let playing=false,playEpoch=0,planStart=null,resetPending=false,solveStart=null;
  const largeView=new LargeCubeView();
  const netMotion=new NetMotion.NetTurnView();
  const isLarge=()=>Math.max(...model.dims)>12;
  let view={x:-25,y:-35,z:0,scale:1};
  const $=id=>document.getElementById(id),cubeEl=$('cube'),net=$('net');
  let activeTurn=null;
  let faceDraftDirty=false;
  $('animation-enabled').checked=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const status=(text,kind='')=>{$('status').textContent=text;$('status').className='status '+kind;};
  const faceColor=face=>centers[faces.indexOf(face)];
  function encoded(){return stickers.map(c=>c==='k'?'*':faces[centers.indexOf(c)]||'?').join('');}
  function fromPattern(text){stickers=[...text].map(c=>c==='*'?'k':faceColor(c));}
  fromPattern(model.solved);
  function save(){try{localStorage.setItem('cube-step-v1',JSON.stringify({centers,stickers,dimensions:model.dims,history,scrambleCount,animationEnabled:$('animation-enabled').checked,speed:Number($('run-speed').value),blackPercent:Number($('black-percent').value)}));}catch{}}
  try{
    const v=JSON.parse(localStorage.getItem('cube-step-v1'));
    if(v){const candidate=new CuboidModel(v.dimensions||[3,3,3]);
      if(v.centers?.length===6&&new Set(v.centers).size===6&&v.centers.every(c=>colors[c]&&c!=='k')&&v.stickers?.length===candidate.cells.length&&v.stickers.every(c=>c===null||colors[c])&&candidate.cells.every((c,i)=>!c.locked||v.stickers[i]===v.centers[faces.indexOf(c.face)])){
        model=candidate;centers=v.centers;stickers=v.stickers;history=null;
        if(Array.isArray(v.history)&&model.knownSolution(encoded(),v.history)!==null)history=v.history;
        if(Number.isInteger(v.scrambleCount)&&v.scrambleCount>=0&&v.scrambleCount<=10000)scrambleCount=v.scrambleCount;
        if(Number.isInteger(v.blackPercent)&&v.blackPercent>=0&&v.blackPercent<=100)$('black-percent').value=v.blackPercent;
        if(Number.isFinite(v.speed)&&v.speed>=.5&&v.speed<=120)$('run-speed').value=v.speed;
        if(typeof v.animationEnabled==='boolean')$('animation-enabled').checked=v.animationEnabled;
      }
    }
  }catch{}
  function snapshot(){return {stickers:[...stickers],history:history?history.map(m=>({...m})):null};}
  function invalidate(){playing=false;playEpoch++;planStart=null;resetPending=false;moves=[];cursor=0;hasPlan=false;$('solver-method').textContent='';updateSteps();}
  function retainHistory(){if(history&&model.knownSolution(encoded(),history)===null)history=null;}
  function appendHistory(move){
    if(!history)return;
    const m=model.normalize(move),last=history[history.length-1];
    if(last&&last.axis===m.axis&&last.layer===m.layer){const turns=(last.turns+m.turns+8)%4;history.pop();if(turns)history.push({...m,turns:turns===3?-1:turns});}
    else history.push(m);
    if(history.length>10000)history=null;
  }
  function renderPalette(){
    $('palette').replaceChildren();
    for(const [key,color]of Object.entries(colors)){
      const count=stickers.filter(c=>c===key).length,b=document.createElement('button');
      const face=faces[centers.indexOf(key)],limit=face?model.shapes[face][0]*model.shapes[face][1]:0;
      const stacked=limit>=1000||(key==='k'&&count>=1000);
      const countText=stacked?`<span>${count}</span><span>${key==='k'?'忽略':'/ '+limit}</span>`:key==='k'?count+' 忽略':count+' / '+limit;
      b.className='paint';b.setAttribute('aria-pressed',String(selected===key));b.setAttribute('aria-label',`${color.name}色，已填 ${count} 格`);
      b.innerHTML=`<span class="paint-swatch" style="background:${color.hex}"></span><span>${color.name}</span><span class="paint-count ${stacked?'stack':''} ${key!=='k'&&count>limit?'over':''}">${countText}</span>`;
      b.disabled=busy||animating||playing;b.onclick=()=>{selected=key;renderPalette();};$('palette').append(b);
    }
  }
  function renderNet(){
    if(isLarge()){
      largeView.renderNet({net,model,stickers,colors,disabled:busy||animating||playing,onPaint:i=>{stickers[i]=selected;if(selected!=='k')retainHistory();invalidate();status('填色已更新，完成后可以重新计算。');renderAll();}});return;
    }
    net.className='net';net.style.display='grid';
    net.replaceChildren();const [X,,Z]=model.dims;
    net.style.gridTemplateColumns=`${Z}fr ${X}fr ${Z}fr ${X}fr`;
    net.style.minWidth=Math.max(288,2*(X+Z)*20+36)+'px';net.style.maxWidth=Math.max(510,2*(X+Z)*20+36)+'px';
    faces.forEach(face=>{
      const wrap=document.createElement('div');wrap.className='face';wrap.dataset.face=face;
      const title=document.createElement('div');title.className='face-title';title.textContent=`${names[face]} ${face}`;
      const grid=document.createElement('div');grid.className='face-grid';const [rows,cols]=model.shapes[face];grid.style.gridTemplateColumns=`repeat(${cols},minmax(0,1fr))`;
      for(let j=0;j<rows*cols;j++){
        const i=model.offsets[face]+j,g=model.cells[i],c=stickers[i],b=document.createElement('button');
        b.className='sticker'+(g.locked?' center':'');b.style.background=colors[c]?.hex||'#323d50';b.dataset.cell=i;
        b.setAttribute('aria-label',`${names[face]}面 ${g.row+1}行 ${g.col+1}列，${colors[c]?.name||'未填'}${g.locked?'，中心固定':''}`);
        b.disabled=g.locked||busy||animating||playing;if(g.locked)b.textContent=face;
        b.onclick=()=>{stickers[i]=selected;if(selected!=='k')retainHistory();invalidate();status('填色已更新，完成后可以重新计算。');renderAll();};grid.append(b);
      }
      wrap.append(title,grid);net.append(wrap);
    });
  }
  function renderCube(){
    if(isLarge()){cubeEl.replaceChildren();largeView.renderScene({scene:$('scene'),cube:cubeEl,model,stickers,colors,view});return;}
    cubeEl.hidden=false;$('scene').querySelector('#large-preview')?.remove();
    cubeEl.replaceChildren();const size=180/Math.max(...model.dims);
    model.cells.forEach((g,i)=>{
      const p=g.p.map((v,a)=>(v+g.n[a])*size/2),el=document.createElement('div');el.className='tile';
      el.style.cssText=`width:${size*.95}px;height:${size*.95}px;left:${-size*.475}px;top:${-size*.475}px;font-size:${Math.max(10,size*.32)}px;background:${colors[stickers[i]]?.hex||'#323d50'};transform:translate3d(${p[0]}px,${-p[1]}px,${p[2]}px) ${g.rot}`;
      el.dataset.cell=i;el.dataset.face=g.face;el.dataset.index=g.index;
      const [rows,cols]=model.shapes[g.face];if(g.row===Math.floor(rows/2)&&g.col===Math.floor(cols/2)){el.textContent=g.face;if(stickers[i]==='k')el.style.color='#c7d0e5';}
      cubeEl.append(el);
    });applyView();
  }
  function applyView(){if(isLarge()){largeView.renderScene({scene:$('scene'),cube:cubeEl,model,stickers,colors,view,rotation:activeTurn});return;}cubeEl.style.transform=`rotateX(${view.x}deg) rotateY(${view.y}deg) rotateZ(${view.z}deg) scale(${view.scale})`;}
  function moveInfo(move){return typeof move==='string'?{...describe(move),token:move}:model.describe(move);}
  function updateSteps(){
    if(!animating){$('net-process-label').textContent=hasPlan?`展开图运行：已执行 ${cursor} / ${moves.length} 步`:'展开图与三维视图同步显示每一步。';$('net-process-value').textContent='';$('net-process-fill').style.transform=`scaleX(${hasPlan?(moves.length?cursor/moves.length:1):0})`;}
    $('scramble-info').textContent=scrambleCount===null?'每次随机生成时，转法和打乱步数都会随机。':`最近一次生成：随机打乱 ${scrambleCount} 步。还原步数以计算结果为准。`;
    const complete=hasPlan&&cursor===moves.length;
    $('step-label').textContent=hasPlan?(complete?'还原完成':`下一步 · 第 ${cursor+1} 步`):'等待计算';$('step-count').textContent=`${cursor} / ${moves.length}`;
    const info=hasPlan&&!complete?moveInfo(moves[cursor]):null;$('move-token').textContent=complete?'✓':info?.token||'—';
    $('move-token').style.fontSize=(info?.token?.length||0)>=4?'20px':'28px';
    $('instruction-title').textContent=info?.title||(complete?(stickers.includes('k')?'非黑色格子已归位':'六面已经归位'):'准备好你的魔方');
    $('instruction-detail').textContent=info?.detail||(complete?(stickers.includes('k')?'黑色格子不参与完成判断。你可以返回上一步复习。':'已完成全部步骤。你可以返回上一步复习。'):'填写六面颜色后，点击“计算还原步骤”。');
    const percent=hasPlan?(moves.length?cursor/moves.length*100:100):0;$('progress-fill').style.width=percent+'%';document.querySelector('.progress').setAttribute('aria-valuenow',String(Math.round(percent)));
    $('prev').disabled=!hasPlan||cursor===0||busy||animating||playing;$('next').disabled=!hasPlan||complete||busy||animating||playing;$('next').textContent=complete?'已完成还原':animating?'正在转动…':'执行下一步';
    $('run').textContent=playing?'暂停':'运行';$('run').disabled=busy||!hasPlan||complete||(!playing&&animating);$('reset-run').disabled=!planStart||busy;
    $('net-run').textContent=$('run').textContent;$('net-run').disabled=$('run').disabled;$('net-next').disabled=$('next').disabled;$('net-reset').disabled=$('reset-run').disabled;
    $('speed-value').textContent=$('run-speed').value+' 步/秒';
    if(document.activeElement!==$('run-speed-number'))$('run-speed-number').value=$('run-speed').value;
    for(const id of ['solve','demo','random-black','black-percent','clear','mask-empty','apply-size','size-x','size-y','size-z','manual-apply','manual-axis','manual-layer','manual-turn','input-face','face-input','read-face','apply-face'])$(id).disabled=busy||animating||playing;
    $('solve').textContent=busy?'正在计算…':'计算还原步骤';document.querySelectorAll('#centers select').forEach(el=>el.disabled=busy||animating||playing);
  }
  function renderAll(){renderPalette();renderNet();renderCube();updateSteps();save();}
  function renderCenters(){
    $('centers').replaceChildren();faces.forEach((face,i)=>{
      const label=document.createElement('label');label.textContent=`${names[face]}面 ${face}`;const sel=document.createElement('select');sel.setAttribute('aria-label',`${names[face]}面中心颜色`);
      Object.entries(colors).filter(([k])=>k!=='k').forEach(([k,v])=>{const opt=document.createElement('option');opt.value=k;opt.textContent=v.name;sel.append(opt);});sel.value=centers[i];
      sel.onchange=()=>{const old=centers[i],other=centers.indexOf(sel.value),next=sel.value;centers[i]=next;centers[other]=old;stickers=stickers.map(c=>c===old?next:c===next?old:c);invalidate();renderCenters();renderAll();status('目标配色已调整；请对照实物检查其余方格。');};label.append(sel);$('centers').append(label);
    });
  }
  function renderManual(){
    const axis=$('manual-axis').value,ai=model.axisIndex(axis),layer=$('manual-layer');layer.replaceChildren();
    if(model.classic){for(const [value,text]of [['1','正侧（右 / 上 / 前）'],['-1','负侧（左 / 下 / 后）']]){const o=document.createElement('option');o.value=value;o.textContent=text;layer.append(o);}}
    else for(let i=0;i<model.dims[ai];i++){const o=document.createElement('option');o.value=i;o.textContent=`第 ${i+1} 层（从${['左','下','后'][ai]}数）`;layer.append(o);}
    for(const opt of $('manual-turn').options)opt.disabled=opt.value!=='2'&&!model.square(axis);if(!model.square(axis))$('manual-turn').value='2';
    $('manual-hint').textContent=model.classic?'方向均为正对所转面的视角。X / Y / Z 视角按钮仅改变观看角度。':`正对${['右','上','前'][ai]}侧观察旋转方向。${model.square(axis)?'此轴允许 90° 和 180°。':'此轴的截面不是正方形，仅允许 180°。'}`;
  }
  function renderSize(){
    model.dims.forEach((n,i)=>$('size-'+['x','y','z'][i]).value=n);$('size-tag').textContent=model.dims.join(' × ');
    $('solver-scope').textContent=model.classic||model.pocket?'二阶、三阶支持任意合法填色求解。':'此尺寸使用置换搜索和化简求解；复杂随机状态会使用打乱记录构造可验证的解。复杂自填状态可能超出搜索范围。';
    $('preview-hint').textContent=isLarge()?'拖动查看各面 · 三维预览抽样显示，填色和求解使用全部格子':'拖动查看各面 · 滚轮缩放';
    document.querySelector('.orientation').textContent=isLarge()?'大尺寸按单面填写。先选一个面，行从上向下、列从左向右；可缩放、滚动，或按行列精确填色。':'展开方向：前面居中，上、下分别在前面的上方和下方；背面在右面右侧。按展开图方向填写。';
    $('paint-hint').textContent='先选颜色，再点方格，也可以展开“手动填写颜色”直接输入。黑色表示忽略：只需将非黑色格子还原到对应颜色的面。'+(model.classic?'中心格固定。':'所有方格均可填写，目标配色见下方。');renderManual();readFace();
  }
  function readFace(){
    const face=$('input-face').value,[rows,cols]=model.shapes[face],offset=model.offsets[face];
    $('face-input-shape').textContent=`${names[face]}面：${rows} 行 × ${cols} 列，共 ${rows*cols} 格。`;
    $('face-input').value=ColorInput.formatFace(stickers.slice(offset,offset+rows*cols),cols);$('face-input-status').textContent='';faceDraftDirty=false;
  }
  $('input-face').onchange=readFace;$('read-face').onclick=readFace;
  $('face-input').oninput=()=>faceDraftDirty=true;
  $('manual-colors').ontoggle=()=>{if($('manual-colors').open&&!faceDraftDirty)readFace();};
  $('apply-face').onclick=()=>{
    const face=$('input-face').value,[rows,cols]=model.shapes[face],offset=model.offsets[face];
    let entered;try{
      entered=ColorInput.parseFace($('face-input').value,rows*cols);
      if(model.classic&&entered[4]!==faceColor(face))throw Error(`${names[face]}面中心必须是${colors[faceColor(face)].name}色。`);
    }catch(error){$('face-input-status').textContent=error.message;$('face-input-status').className='error';return;}
    for(let j=0;j<entered.length;j++)stickers[offset+j]=entered[j];
    retainHistory();invalidate();faceDraftDirty=false;if(isLarge())largeView.face=face;renderAll();
    $('face-input-status').textContent=`${names[face]}面已应用 ${entered.length} 格。`;$('face-input-status').className='success';status('手动颜色已应用，可以继续填写其他面或计算还原步骤。');
  };
  $('apply-size').onclick=()=>{
    let next;try{next=new CuboidModel(['x','y','z'].map(a=>Number($('size-'+a).value)));}catch(e){status(e.message,'error');return;}
    model=next;history=[];scrambleCount=null;fromPattern(model.solved);invalidate();renderSize();renderAll();status(`已应用 ${model.dims.join(' × ')}，可以随机打乱或填写颜色。`);
  };
  $('manual-axis').onchange=renderManual;
  function ensureWorker(){
    if(worker)return;
    worker=new Worker('solver-worker.js?v=expand1');worker.onmessage=({data})=>{
      if(data.id!==job)return;if(data.kind==='progress'){status(data.message);return;}if(data.kind==='error'){workerError(data.message);return;}
      if(data.kind==='scramble'){
        fromPattern(data.state);history=data.moves;scrambleCount=data.moves.length;finishSolve();renderAll();status(`本次随机打乱 ${scrambleCount} 步。可以涂黑后计算还原步骤。`);return;
      }
      moves=data.moves;cursor=0;hasPlan=true;planStart=solveStart;finishSolve();
      $('solver-method').textContent=`求解方式：${data.method||'已验证的解'}${data.baseline!==null&&data.baseline!==undefined?`，化简前 ${data.baseline} 步，结果 ${moves.length} 步`:''}。不要求最少步数。`;
      status(`找到 ${moves.length} 步还原方案。可点击“运行”连续执行，或每次只走一步。`,'success');
    };worker.onerror=()=>workerError('求解器加载失败，请刷新后重试。');
  }
  $('demo').onclick=()=>{
    if(isLarge()){
      invalidate();busy=true;renderAll();status('正在后台生成随机魔方…');const id=++job;
      try{ensureWorker();timer=setTimeout(()=>workerError('生成超时，请重试。'),180000);worker.postMessage({id,action:'scramble',dimensions:model.dims});}catch{workerError('无法启动随机生成器，请刷新后重试。');}return;
    }
    if(model.classic){scrambleCount=model.randomScrambleLength();const c=new Cube();let last='';for(let i=0;i<scrambleCount;i++){let f;do{f=faces[Math.floor(Math.random()*6)];}while(f===last);last=f;c.move(f+['',"'",'2'][Math.floor(Math.random()*3)]);}fromPattern(c.asString());history=null;}
    else{const result=model.scramble();fromPattern(result.state);history=result.moves;scrambleCount=result.moves.length;}
    invalidate();renderAll();status(`本次随机打乱 ${scrambleCount} 步。可再点“随机涂黑”，然后计算还原步骤。`);
  };
  $('random-black').onclick=()=>{
    const percent=Number($('black-percent').value);if($('black-percent').value.trim()===''||!Number.isInteger(percent)||percent<0||percent>100){status('涂黑比例必须是 0 到 100 的整数。','error');return;}
    const eligible=model.cells.map((g,i)=>i).filter(i=>!model.cells[i].locked&&stickers[i]!==null),count=Math.round(eligible.length*percent/100);
    for(let i=eligible.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[eligible[i],eligible[j]]=[eligible[j],eligible[i]];}
    let added=0;for(const i of eligible.slice(0,count)){if(stickers[i]!=='k')added++;stickers[i]='k';}
    invalidate();renderAll();status(`随机选取 ${count} 格，本次新增 ${added} 个黑格；其余颜色保留。`);
  };
  $('black-percent').onchange=save;
  $('clear').onclick=()=>{stickers=model.cells.map(g=>g.locked?faceColor(g.face):null);history=null;scrambleCount=null;invalidate();renderAll();status(model.classic?'已保留六个中心。请选择画笔，填写其他 48 格。':'已清空方格。可填写颜色，或将未填格涂黑。');};
  $('mask-empty').onclick=()=>{stickers=stickers.map(c=>c===null?'k':c);invalidate();renderAll();status('未填格已涂黑；计算时只要求非黑色格子归位。');};
  function finishSolve(){clearTimeout(timer);timer=null;busy=false;renderPalette();renderNet();updateSteps();}
  function workerError(message){finishSolve();worker?.terminate();worker=null;status(message,'error');}
  $('solve').onclick=()=>{
    try{model.classic?validatePattern(encoded(),Cube):model.validate(encoded());}catch(e){status(e.message,'error');return;}
    invalidate();solveStart=snapshot();if(model.isSolved(encoded())){hasPlan=true;planStart=solveStart;updateSteps();status(stickers.includes('k')?'非黑色格子已经还原，黑色格子忽略，不需要转动。':'这个魔方已经还原，不需要转动。','success');return;}
    if(location.protocol==='file:'){status('请通过本地启动器或网站打开，浏览器直接打开文件不支持后台求解。','error');return;}
    busy=true;renderPalette();renderNet();updateSteps();status('正在计算还原步骤…');const id=++job;
    try{
      ensureWorker();timer=setTimeout(()=>workerError('计算超时，请重新核对输入后再试。'),180000);worker.postMessage({id,text:encoded(),dimensions:model.dims,history});
    }catch{workerError('浏览器无法启动求解器，请通过现代浏览器打开网站。');}
  };
  async function animateMove(move){
    const text=encoded(),info=model.describe(move),animate=$('animation-enabled').checked;
    if(animate&&isLarge()){
      const affected=NetMotion.planTransfers(model,move).faces;
      if(!affected.has(largeView.face))largeView.face=[...affected][0]||largeView.face;
    }
    animating=true;renderPalette();renderNet();updateSteps();
    const duration=Math.min(650,800/Number($('run-speed').value));
    let group=null;
    if(!isLarge()){
      group=document.createElement('div');group.className='turn-layer';cubeEl.append(group);const ai=model.axisIndex(info.axis);
      for(const el of [...cubeEl.querySelectorAll('.tile')])if(model.cells[Number(el.dataset.cell)].p[ai]===info.coordinate)group.append(el);
    }
    if(animate){
      netMotion.begin({net,model,move,stickers,colors,largeFace:isLarge()?largeView.face:null});
      $('net-process-label').textContent=`展开图运行：${moveInfo(move).title}`;
      try{await new Promise((resolve,reject)=>{
        let started=null;if(isLarge())activeTurn={axis:info.axis,coordinate:info.coordinate,angle:0};
        function frame(now){try{
          if(started===null)started=now;const t=Math.min(1,(now-started)/duration),eased=.5-.5*Math.cos(Math.PI*t);
          if(activeTurn){activeTurn.angle=info.css*eased;applyView();}else group.style.transform=`rotate${info.axis}(${info.css*eased}deg)`;
          netMotion.frame(eased);$('net-process-value').textContent=Math.round(t*100)+'%';$('net-process-fill').style.transform=`scaleX(${t})`;
          if(t<1)requestAnimationFrame(frame);else resolve();
        }catch(error){reject(error);}}
        requestAnimationFrame(frame);
      });}finally{netMotion.finish();activeTurn=null;}
    }
    fromPattern(model.apply(text,move));appendHistory(move);animating=false;
  }
  function pauseRun(){playing=false;playEpoch++;renderPalette();if(!animating)renderNet();updateSteps();}
  function restoreRun(){if(!planStart)return;playing=false;playEpoch++;resetPending=false;stickers=[...planStart.stickers];history=planStart.history?planStart.history.map(m=>({...m})):null;cursor=0;renderAll();status('已重置本次运行，恢复计算前的魔方。');}
  async function stepForward(){
    if(animating||busy||!hasPlan||cursor>=moves.length)return;
    await animateMove(moves[cursor]);cursor++;
    if(resetPending){restoreRun();return;}
    if(cursor===moves.length){playing=false;playEpoch++;status(stickers.includes('k')?'还原完成！所有非黑色格子都已归位，黑色格子忽略。':'还原完成！六个面都已同色。','success');}
    renderAll();
  }
  $('next').onclick=()=>{if(!playing)return stepForward();};
  $('prev').onclick=async()=>{if(animating||busy||playing||!hasPlan||cursor===0)return;await animateMove(model.inverse(moves[cursor-1]));cursor--;if(resetPending){restoreRun();return;}renderAll();status('已返回上一步，可以再次执行。');};
  $('run').onclick=async()=>{
    if(playing){pauseRun();status('已暂停，当前转动完成后停止。');return;}
    if(busy||animating||!hasPlan||cursor>=moves.length)return;
    playing=true;const epoch=++playEpoch;renderAll();status('正在连续运行，可随时暂停或调整速度。');
    let nextStepAt=performance.now();
    while(playing&&epoch===playEpoch&&cursor<moves.length){
      const now=performance.now(),interval=1000/Number($('run-speed').value);
      if(now<nextStepAt){await new Promise(resolve=>setTimeout(resolve,Math.min(16,nextStepAt-now)));continue;}
      if($('animation-enabled').checked){await stepForward();nextStepAt=now+interval;}
      else{
        const count=Math.min(12,moves.length-cursor,Math.floor((now-nextStepAt)/interval)+1);let state=encoded();
        for(let n=0;n<count;n++){const move=moves[cursor++];state=model.apply(state,move);appendHistory(move);}
        fromPattern(state);nextStepAt+=count*interval;if(nextStepAt<now-250)nextStepAt=now-250;
        if(cursor===moves.length){playing=false;playEpoch++;status(stickers.includes('k')?'还原完成！所有非黑色格子都已归位，黑色格子忽略。':'还原完成！六个面都已同色。','success');}
        renderAll();await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    if(epoch===playEpoch){playing=false;renderAll();}
  };
  $('reset-run').onclick=()=>{if(!planStart)return;pauseRun();if(animating){resetPending=true;status('当前转动完成后重置本次运行。');}else restoreRun();};
  $('net-run').onclick=()=>$('run').onclick();$('net-next').onclick=()=>$('next').onclick();$('net-reset').onclick=()=>$('reset-run').onclick();
  $('run-speed').oninput=()=>{$('speed-value').textContent=$('run-speed').value+' 步/秒';$('run-speed-number').value=$('run-speed').value;save();};
  $('run-speed-number').onchange=()=>{
    const value=Number($('run-speed-number').value);
    if(!Number.isFinite(value)||value<.5||value>120){$('run-speed-number').value=$('run-speed').value;status('速度必须是 0.5 到 120 步/秒。','error');return;}
    $('run-speed').value=Math.round(value*2)/2;$('run-speed').dispatchEvent(new Event('input'));
  };
  $('animation-enabled').onchange=save;
  $('manual-apply').onclick=async()=>{
    try{model.classic?validatePattern(encoded(),Cube):model.validate(encoded());}catch(e){status(e.message,'error');return;}
    const axis=$('manual-axis').value,layer=Number($('manual-layer').value),turn=$('manual-turn').value;
    const move=model.classic?({X:layer>0?'R':'L',Y:layer>0?'U':'D',Z:layer>0?'F':'B'}[axis]+turn):{axis,layer,turns:turn==='2'?2:turn==="'"?-1:1};
    invalidate();await animateMove(move);renderAll();status(`已执行 ${moveInfo(move).title}。可以重新计算还原方案。`);
  };
  $('home-view').onclick=()=>{view={x:-25,y:-35,z:0,scale:1};applyView();};document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view[b.dataset.view.toLowerCase()]+=90;applyView();});
  let pointer=null;$('scene').onpointerdown=e=>{pointer={id:e.pointerId,x:e.clientX,y:e.clientY};$('scene').setPointerCapture(e.pointerId);};
  $('scene').onpointermove=e=>{if(!pointer||pointer.id!==e.pointerId)return;view.y+=(e.clientX-pointer.x)*.5;view.x-=(e.clientY-pointer.y)*.5;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};applyView();};
  $('scene').onpointerup=$('scene').onpointercancel=()=>pointer=null;
  $('scene').addEventListener('wheel',e=>{e.preventDefault();view.scale=Math.max(.65,Math.min(1.3,view.scale-e.deltaY*.001));applyView();},{passive:false});
  renderSize();renderCenters();renderAll();
})();
