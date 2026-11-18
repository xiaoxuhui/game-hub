export const MEDIA_BUDGET=2*1024*1024;
export const PROJECT_BUDGET=4*1024*1024;
export const SOUND_MIMES=['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-wav'];
export function assetName(value){if(typeof value!=='string'||!value.trim()||value.trim().length>40||/[\u0000-\u001f]/.test(value))throw new Error('素材名称需要 1–40 个字符');return value.trim();}
export function validateAssets(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('素材格式无效');
  let budget=0;const ids=new Set(),out={};
  for(const kind of ['sprites','backdrops','sounds']){
    const items=raw[kind]||[];if(!Array.isArray(items)||items.length>100)throw new Error('每类素材最多 100 个');
    out[kind]=items.map(item=>{
      if(!item||typeof item.id!=='string'||!/^asset-[a-zA-Z0-9-]{1,90}$/.test(item.id)||ids.has(item.id))throw new Error('素材 ID 无效或重复');ids.add(item.id);
      const name=assetName(item.name),data=item.data;if(typeof data!=='string'||(budget+=data.length)>MEDIA_BUDGET)throw new Error('素材合计不能超过 2 MB，请缩小图片或缩短声音');
      if(kind!=='sounds'){
        if(!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(data))throw new Error('图片需要标准 PNG 数据');
        const width=Number(item.width),height=Number(item.height);if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>960||height>960)throw new Error('图片尺寸无效');
        return {id:item.id,name,data,width,height};
      }
      const match=/^data:(audio\/[a-z0-9-]+)(?:;codecs=[a-z0-9.,-]+)?;base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
      if(!match||!SOUND_MIMES.includes(match[1]))throw new Error('声音格式不支持');
      const seconds=Number(item.seconds);if(!Number.isFinite(seconds)||seconds<=0||seconds>30)throw new Error('每段声音最长 30 秒');return {id:item.id,name,data,seconds};
    });
  }
  return out;
}
export const assetList=(project,kind)=>project.assets?.[kind]||[];
export function putAsset(project,kind,asset){const assets={sprites:[],backdrops:[],sounds:[],...project.assets};return {...project,assets:{...assets,[kind]:[...assets[kind].filter(x=>x.id!==asset.id),asset]}};}
export function removeAsset(project,kind,id){
  const assets={sprites:[],backdrops:[],sounds:[],...project.assets},out={...project,assets:{...assets,[kind]:assets[kind].filter(x=>x.id!==id)}};
  if(kind==='sprites'&&out.sprite===id)out.sprite='fox';if(kind==='backdrops'&&out.backdrop===id)out.backdrop='meadow';
  const clean=items=>items.map(b=>({...b,...(b.type==='backdrop'&&b.value===id?{value:'meadow'}:{}),...(b.type==='playSound'&&b.sound===id?{sound:''}:{}),...(b.children?{children:clean(b.children)}:{}),...(b.otherwise?{otherwise:clean(b.otherwise)}:{})}));out.blocks=clean(out.blocks);return out;
}
