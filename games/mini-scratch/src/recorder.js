export function createRecorder({getMedia=()=>navigator.mediaDevices?.getUserMedia({audio:true}),Recorder=globalThis.MediaRecorder,onState=()=>{},onData=()=>{},onError=()=>{},limit=30000,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  let generation=0,stream=null,recorder=null,timer=null,phase='idle';
  const state=value=>{phase=value;onState(value);};
  function release(){clearTimer(timer);timer=null;for(const track of stream?.getTracks()||[])track.stop();stream=null;}
  function cancel(){generation++;const current=recorder;recorder=null;if(current&&current.state!=='inactive')try{current.stop();}catch{/* Stream is still released. */}release();state('idle');}
  async function start(){
    if(phase!=='idle')return;const token=++generation;state('requesting');
    try{
      if(!Recorder)throw new Error('当前浏览器不支持录音，请导入系统录音文件');
      const granted=await getMedia();if(!granted)throw new Error('麦克风不可用，请用 HTTPS / 本机浏览器，或导入系统录音文件');
      if(token!==generation){for(const track of granted.getTracks())track.stop();return;}
      stream=granted;const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(x=>Recorder.isTypeSupported?.(x));
      const current=new Recorder(stream,mime?{mimeType:mime}:undefined),chunks=[];recorder=current;
      current.ondataavailable=e=>{if(token===generation&&e.data?.size)chunks.push(e.data);};
      current.onerror=()=>{if(token!==generation)return;cancel();onError(new Error('录音失败，请重试或导入声音'));};
      current.onstop=()=>{if(token!==generation)return;release();recorder=null;state('idle');const blob=new Blob(chunks,{type:current.mimeType||chunks[0]?.type||'audio/webm'});if(!blob.size){onError(new Error('没有录到声音，请重试'));return;}onData(blob);};
      current.start(250);state('recording');timer=setTimer(stop,limit);
    }catch(error){if(token!==generation)return;cancel();onError(new Error(error.name==='NotAllowedError'?'麦克风权限未开启，请在浏览器允许录音或导入声音':error.message));}
  }
  function stop(){if(phase==='requesting'){cancel();return;}if(recorder?.state==='recording'){state('stopping');clearTimer(timer);recorder.stop();release();}}
  return {start,stop,cancel,get phase(){return phase;}};
}
