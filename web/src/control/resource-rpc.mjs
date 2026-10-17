function insist(value,message){if(!value)throw Error(message);}
function exact(value,fields){insist(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===fields.length&&fields.every(k=>Object.hasOwn(value,k)),'Invalid resource command fields');}
const nonce=value=>typeof value==='string'&&/^[a-f0-9-]{16,128}$/.test(value);
export function validateResourceRequest(value,context){
  exact(value,['type','protocol','build','basePath','nonce','action','args']);
  insist(value.type==='hub-resources'&&value.protocol===1&&value.build===context.build&&value.basePath===context.basePath&&nonce(value.nonce),'Resource protocol or build mismatch');
  if(['check','status'].includes(value.action))exact(value.args,[]);
  else if(value.action==='install'){exact(value.args,['id']);insist(typeof value.args.id==='string'&&/^[a-z][a-z0-9-]{0,47}$/.test(value.args.id),'Invalid game id');}
  else if(value.action==='cancel'){exact(value.args,['taskId']);insist(nonce(value.args.taskId),'Invalid task identity');}
  else throw Error('Unknown resource command');return structuredClone(value);
}
export async function readCatalogResponse(response,url,signal){
  const max=8*1024*1024;
  insist(response?.type==='basic'&&response.status===200&&!response.redirected&&response.url===url,'Catalog response type status or URL');
  insist(response.headers.get('content-type')?.split(';')[0].trim()==='application/json','Catalog MIME mismatch');
  const length=response.headers.get('content-length');if(length!==null)insist(/^(?:0|[1-9][0-9]*)$/.test(length)&&Number.isSafeInteger(Number(length))&&Number(length)<=max,'Catalog transport limit');
  insist(response.body,'Catalog body missing');const reader=response.body.getReader(),chunks=[];let size=0;
  const abort=()=>{if(signal?.aborted)throw new DOMException('Catalog request cancelled','AbortError');};
  try{while(true){abort();const {done,value}=await reader.read();abort();if(done)break;insist(value instanceof Uint8Array,'Invalid catalog stream');size+=value.length;insist(size<=max,'Catalog body limit');chunks.push(value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  insist(size>0,'Empty catalog');const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
