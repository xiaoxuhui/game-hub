import {TYPES} from './blocks.js';
import {evaluate,numeric,truth} from './expressions.js';
import {parameterDefault} from './procedures.js';
import {mutateList,listValue} from './lists.js';
export const initialState=(project={})=>({x:0,y:0,angle:0,speech:'',thought:false,pen:false,lines:[],visible:true,size:100,costume:project.sprite||'fox',backdrop:project.backdrop||'meadow',volume:80,timerStart:0,variables:new Map((project.variables||[]).map(v=>[v.name,v.value])),lists:new Map((project.lists||[]).map(v=>[v.name,v.items.map(listValue)]))});
export function delay(ms,signal){return new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new DOMException('已停止','AbortError'));};const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});});}
class StopScript extends Error {}
export function createRuntime(project,{signal,onStep=()=>{},onSound=()=>{},onError=()=>{},sleep=delay,pace=180,sensing=()=>({}),clock=()=>performance.now()/1000,random=Math.random}={}){
  const controller=new AbortController(),local=controller.signal,state=initialState(project),jobs=new Set(),busyHats=new Set();
  state.timerStart=clock();let steps=0,failure=null,started=false;
  const root=project.blocks||[],definitions=new Map(root.filter(b=>b.type==='define').map(b=>[b.name,b]));
  const hats=root.filter(b=>TYPES[b.type]?.event),hasListeners=hats.some(b=>b.type!=='whenFlag');
  const externalAbort=()=>controller.abort();
  if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',externalAbort,{once:true});
  local.addEventListener('abort',()=>{onSound({kind:'stop'});signal?.removeEventListener('abort',externalAbort);},{once:true});
  const check=()=>{if(local.aborted)throw new DOMException('已停止','AbortError');};
  const tick=()=>{check();if(++steps>10000)throw new Error('执行达到 10000 步，请减少重复次数');};
  const costumes=['fox','rabbit','robot',...(project.assets?.sprites||[]).map(x=>x.id)],backdrops=['meadow','space','paper',...(project.assets?.backdrops||[]).map(x=>x.id)];
  const context=scope=>({state,sensing,clock,random,costumes,backdrops,...scope});
  const val=(b,key,scope)=>evaluate(b[key],context(scope));
  const num=(b,key,scope)=>{const spec=TYPES[b.type].fields[key];return Math.max(spec.min,Math.min(spec.max,numeric(val(b,key,scope))));};
  const notify=b=>onStep(state,b.id);
  function moveTo(x,y){
    const previous={x:state.x,y:state.y};state.x=Math.max(-240,Math.min(240,x));state.y=Math.max(-180,Math.min(180,y));
    if(state.pen&&(previous.x!==state.x||previous.y!==state.y)){
      if(state.lines.length>=10000)throw new Error('画迹达到 10000 条，请先清除画迹');
      state.lines.push({x1:previous.x,y1:previous.y,x2:state.x,y2:state.y});
    }
  }
  const normalize=angle=>((angle%360)+360)%360;
  async function walk(items,scope={inCall:false,depth:0}){
    for(const b of items){
      tick();
      if(b.type==='repeat'||b.type==='forever'||b.type==='until'){
        notify(b);await sleep(pace,local);
        const count=b.type==='repeat'?Math.floor(num(b,'value',scope)):Infinity;
        for(let i=0;i<count;i++){
          tick();if(b.type==='until'&&truth(val(b,'condition',scope)))break;
          await walk(b.children,scope);await sleep(b.type==='repeat'?0:pace,local);
        }
        continue;
      }
      if(b.type==='if'){notify(b);await sleep(pace,local);await walk(truth(val(b,'condition',scope))?b.children:b.otherwise,scope);continue;}
      if(b.type==='call'){
        const def=definitions.get(b.name);if(!def)throw new Error('找不到自制积木：'+b.name);
        if(scope.depth>=32)throw new Error('自制积木调用超过 32 层');
        const parameters=new Map();for(const p of def.parameters||[]){const raw=b.arguments?.find(a=>a.parameterId===p.id)?.value??parameterDefault(p.type),value=evaluate(raw,context(scope));parameters.set(p.id,p.legacy?value:p.type==='number'?numeric(value):p.type==='boolean'?truth(value):String(value).slice(0,80));}
        const argument=def.parameters?parameters.values().next().value:val(b,'value',scope);notify(b);await sleep(pace,local);await walk(def.children,{inCall:true,depth:scope.depth+1,argument,parameters,definitionId:def.id});continue;
      }
      let duration=pace;
      switch(b.type){
        case 'move':{const distance=num(b,'value',scope);moveTo(state.x+Math.cos(state.angle*Math.PI/180)*distance,state.y-Math.sin(state.angle*Math.PI/180)*distance);break;}
        case 'turn':state.angle=normalize(state.angle+num(b,'value',scope));break;
        case 'point':state.angle=normalize(num(b,'value',scope));break;
        case 'goto':moveTo(num(b,'x',scope),num(b,'y',scope));break;
        case 'changeX':moveTo(state.x+num(b,'value',scope),state.y);break;
        case 'changeY':moveTo(state.x,state.y+num(b,'value',scope));break;
        case 'setX':moveTo(num(b,'value',scope),state.y);break;
        case 'setY':moveTo(state.x,num(b,'value',scope));break;
        case 'glide':{const x=num(b,'x',scope),y=num(b,'y',scope),seconds=num(b,'seconds',scope),from={x:state.x,y:state.y};for(let i=1;i<=20;i++){check();moveTo(from.x+(x-from.x)*i/20,from.y+(y-from.y)*i/20);notify(b);await sleep(seconds*1000/20,local);}continue;}
        case 'bounce':if(Math.abs(state.x)>=240)state.angle=normalize(180-state.angle);if(Math.abs(state.y)>=180)state.angle=normalize(-state.angle);break;
        case 'say':case 'think':state.speech=String(val(b,'value',scope)).slice(0,80);state.thought=b.type==='think';break;
        case 'show':state.visible=true;break;case 'hide':state.visible=false;break;
        case 'setSize':state.size=num(b,'value',scope);break;
        case 'changeSize':state.size=Math.max(10,Math.min(300,state.size+num(b,'value',scope)));break;
        case 'nextCostume':state.costume=costumes[(costumes.indexOf(state.costume)+1)%costumes.length];break;
        case 'backdrop':state.backdrop=b.value;break;
        case 'setVolume':state.volume=num(b,'value',scope);break;
        case 'changeVolume':state.volume=Math.max(0,Math.min(100,state.volume+num(b,'value',scope)));break;
        case 'stopSound':onSound({kind:'stop'});break;
        case 'playSound':{const asset=project.assets?.sounds.find(x=>x.id===b.sound);if(!asset)throw new Error('请先录入或选择声音');const seconds=await onSound({kind:'recording',data:asset.data,volume:state.volume});check();duration=(seconds??asset.seconds)*1000;break;}
        case 'note':{const note=num(b,'value',scope),seconds=num(b,'seconds',scope);onSound({kind:'note',frequency:440*2**((note-69)/12),seconds,volume:state.volume});duration=seconds*1000;break;}
        case 'wait':duration=num(b,'value',scope)*1000;break;
        case 'stopScript':throw new StopScript();
        case 'broadcast':dispatch('whenMessage',b.name).catch(()=>{});break;
        case 'resetTimer':state.timerStart=clock();break;
        case 'setVar':case 'changeVar':if(!state.variables.has(b.name))throw new Error('变量不存在：'+b.name);state.variables.set(b.name,b.type==='setVar'?val(b,'value',scope):numeric(state.variables.get(b.name))+num(b,'value',scope));if(typeof state.variables.get(b.name)==='number'&&!Number.isFinite(state.variables.get(b.name)))throw new Error('变量超出有限数值范围');break;
        case 'listAdd':case 'listReplace':case 'listInsert':case 'listDelete':case 'listClear':mutateList(state,b,key=>val(b,key,scope));break;
        case 'penDown':state.pen=true;break;case 'penUp':state.pen=false;break;case 'clear':state.lines=[];break;
        case 'define':case 'whenFlag':case 'whenKey':case 'whenClick':case 'whenMessage':continue;
        default:throw new Error('未知的执行积木：'+b.type);
      }
      notify(b);await sleep(duration,local);
    }
  }
  function launch(items,hatId){
    if(local.aborted||hatId&&busyHats.has(hatId))return Promise.resolve();
    if(jobs.size>=32){const error=new Error('同时运行脚本超过 32 个');failure=error;onError(error);controller.abort();return Promise.resolve();}
    if(hatId)busyHats.add(hatId);
    const job=Promise.resolve().then(()=>walk(items)).catch(error=>{if(error instanceof StopScript)return;if(error.name!=='AbortError'&&!failure){failure=error;onError(error);controller.abort();}throw error;});
    jobs.add(job);
    const cleanup=()=>{jobs.delete(job);if(hatId)busyHats.delete(hatId);};job.then(cleanup,cleanup);
    return job;
  }
  function dispatch(type,value){check();return Promise.all(hats.filter(b=>b.type===type&&(type==='whenKey'?b.key===value:type==='whenMessage'?b.name===value:true)).map(b=>launch(b.children,b.id)));}
  return {
    state,signal:local,hasListeners,
    async start({triggerFlag=true}={}){check();if(started)throw new Error('同一会话只能启动一次');started=true;const legacy=triggerFlag&&project.eventScripts!==true?root.filter(b=>!TYPES[b.type]?.event&&b.type!=='define'):[];try{await Promise.all([...(legacy.length?[launch(legacy)]:[]),...(triggerFlag?[dispatch('whenFlag')]:[])]);}catch(error){throw failure||error;}if(failure)throw failure;},
    triggerKey:key=>dispatch('whenKey',key),triggerClick:()=>dispatch('whenClick'),broadcast:name=>dispatch('whenMessage',name),
    async drain(){while(jobs.size){await Promise.allSettled([...jobs]);}if(failure)throw failure;check();return state;},
    stop(){controller.abort();signal?.removeEventListener('abort',externalAbort);},
    get runningScripts(){return jobs.size;}
  };
}
export async function execute(blocks,options={}){const runtime=createRuntime({blocks},options);try{await runtime.start();return await runtime.drain();}finally{runtime.stop();}}
