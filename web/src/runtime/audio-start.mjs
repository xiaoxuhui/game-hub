export async function resumeAudio(context,timeout=2000){
  let timer;
  try{return await Promise.race([context.resume(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('声音设备启动超时，请重新打开游戏或检查声音设置')),timeout);})]);}
  finally{clearTimeout(timer);}
}
