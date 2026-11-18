export function createAudio(onChange=()=>{}){
  let context=null,generation=0;const active=new Set();
  async function unlock(){const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)throw new Error('当前浏览器不支持声音合成');if(!context)context=new Audio();if(context.state==='suspended')await context.resume();if(context.state!=='running')throw new Error('声音尚未启用，请再次点击绿旗');}
  function stop(){generation++;for(const oscillator of [...active]){try{oscillator.stop();}catch{/* Source may already have ended. */}oscillator.onended?.();}active.clear();onChange();}
  async function decode(data){const bytes=Uint8Array.from(atob(data.slice(data.indexOf(',')+1)),x=>x.charCodeAt(0));return context.decodeAudioData(bytes.buffer);}
  async function recording(event){const token=generation,buffer=await decode(event.data);if(token!==generation)throw new DOMException('已停止','AbortError');if(!Number.isFinite(buffer.duration)||buffer.duration<=0||buffer.duration>30.1)throw new Error('声音需要在 30 秒以内');const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=event.volume/100;source.connect(gain);gain.connect(context.destination);active.add(source);source.onended=()=>{if(!active.delete(source))return;source.disconnect();gain.disconnect();onChange();};source.start();onChange();return buffer.duration;}
  function play(event){
    if(event.kind==='stop'){stop();return;}
    if(!context||context.state!=='running')throw new Error('声音尚未启用，请点击绿旗重试');
    if(event.kind==='recording')return recording(event);
    const oscillator=context.createOscillator(),gain=context.createGain(),now=context.currentTime;
    oscillator.type='sine';oscillator.frequency.value=event.frequency;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(event.volume/100*0.18,now+0.01);gain.gain.setValueAtTime(event.volume/100*0.18,now+Math.max(0.01,event.seconds-0.02));gain.gain.linearRampToValueAtTime(0,now+event.seconds);
    oscillator.connect(gain);gain.connect(context.destination);active.add(oscillator);
    oscillator.onended=()=>{if(!active.delete(oscillator))return;oscillator.disconnect();gain.disconnect();onChange();};oscillator.start();oscillator.stop(now+event.seconds);onChange();
  }
  return {unlock,play,stop,async inspect(data){await unlock();const buffer=await decode(data);if(!Number.isFinite(buffer.duration)||buffer.duration<=0||buffer.duration>30.1)throw new Error('每段声音最长 30 秒');return Math.min(30,buffer.duration);},get activeCount(){return active.size;},get status(){return context?.state||'未启用';}};
}
