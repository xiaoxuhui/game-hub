import {startSaveSession} from './save-session.mjs';
import {mountRestore} from './restore-ui.mjs';
import {validateNativeSave} from './native-save.mjs';
import {downloadSnapshot} from './backup-download.mjs';
import {nativeFileReader} from './native-file.mjs';
const contextURL=new URL('./context.json',import.meta.url),gameRoot=new URL('../',import.meta.url);
const bar=document.createElement('aside');bar.id='game-hub-toolbar';bar.setAttribute('aria-label','游戏大厅工具栏');
const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./toolbar.css',import.meta.url);document.head.append(style);
const back=document.createElement('a');back.textContent='← 大厅';back.id='game-hub-return';
const status=document.createElement('span');status.id='game-hub-status';status.setAttribute('role','status');
bar.append(back,status);document.body.append(bar);
try{
  const response=await fetch(contextURL);if(!response.ok)throw Error('游戏配置无法读取');const context=await response.json();
  back.href=context.basePath;
  document.documentElement.dataset.hubGameId=context.id;
  status.textContent=`${context.name} · 在线`;
  const saves=await startSaveSession({gameId:context.id,scope:context.storage,basePath:context.basePath,onStatus:state=>{status.textContent=state.message;status.title=state.message;status.dataset.saveMode=state.mode;}});
  Object.defineProperty(window,'localStorage',{configurable:false,get:()=>saves.storage});
  Object.defineProperty(window,'GameHubReadNativeFile',{configurable:false,writable:false,value:nativeFileReader({context,gameRoot,saves,onError:error=>{status.textContent='导入已拒绝：'+error.message;},onValidated:()=>{status.textContent='文件已校验，等待游戏导入';}})});
  const exportButton=document.createElement('button');exportButton.id='game-hub-backup';exportButton.type='button';exportButton.textContent=saves.snapshot().canonicalRead?'备份':'应急导出';exportButton.title=saves.snapshot().canonicalRead?'导出本页当前游戏全部存档键值':'未能读取正式存档，仅导出旧档或本页草稿';bar.append(exportButton);
  exportButton.addEventListener('click',()=>{
    downloadSnapshot(context,saves.snapshot());
  });
  mountRestore({bar,saves,context,gameRoot});
  window.addEventListener('pageshow',()=>{void saves.checkWriter();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)void saves.checkWriter();});
  back.addEventListener('click',event=>{if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();void saves.flush().finally(()=>location.assign(back.href));});
  let page=location.pathname.slice(gameRoot.pathname.length);if(!page||page.endsWith('/'))page+='index.html';const scripts=context.pages[page];
  if(!scripts)throw Error('页面不在固定清单');
  if(!Object.hasOwn(context.preflightAfter??{},page))throw Error('页面缺少已审存档保护边界');
  async function protectNative(){
    try{await validateNativeSave(context,saves.snapshot().entries,gameRoot);}
    catch(error){saves.protectWrites('当前存档仅只读，原档已保留：'+error.message);}
  }
  if(context.preflightAfter[page]===null)await protectNative();
  for(const item of scripts){
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');if(item.type==='module')script.type='module';script.async=false;
      script.src=new URL(item.path,gameRoot);script.onload=resolve;script.onerror=()=>reject(Error('游戏脚本加载失败'));
      document.body.append(script);
    });
    if(item.path===context.preflightAfter[page])await protectNative();
  }
  document.documentElement.dataset.hubGameReady='true';
}catch(error){status.textContent=error.message;status.dataset.error='true';back.href=gameRoot.pathname.split('/games/')[0]+'/';}
