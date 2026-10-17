export async function boundedText(response,max,mime){
  if(response.headers.get('content-type')?.split(';')[0].trim()!==mime)throw Error('目录响应格式错误');
  const declared=response.headers.get('content-length');if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>max))throw Error('目录超过限制');
  if(!response.body)throw Error('目录响应为空');
  const reader=response.body.getReader(),chunks=[];let length=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max)throw Error('目录超过限制');chunks.push(value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}
  finally{reader.releaseLock();}
  const data=new Uint8Array(length);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  return new TextDecoder('utf-8',{fatal:true}).decode(data);
}
