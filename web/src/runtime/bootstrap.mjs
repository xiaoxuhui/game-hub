const contextURL=new URL('./context.json',import.meta.url),gameRoot=new URL('../',import.meta.url);
const bar=document.createElement('aside');bar.id='game-hub-toolbar';bar.setAttribute('aria-label','游戏大厅工具栏');
const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./toolbar.css',import.meta.url);document.head.append(style);
const back=document.createElement('a');back.textContent='← 大厅';back.id='game-hub-return';
const status=document.createElement('span');status.id='game-hub-status';status.setAttribute('role','status');
bar.append(back,status);document.body.append(bar);
try{
  const response=await fetch(contextURL);if(!response.ok)throw Error('游戏配置无法读取');const context=await response.json();
  back.href=context.basePath;
  status.textContent=`${context.name} · 在线`;
  let page=location.pathname.slice(gameRoot.pathname.length);if(!page||page.endsWith('/'))page+='index.html';const scripts=context.pages[page];
  if(!scripts)throw Error('页面不在固定清单');
  for(const item of scripts){
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');if(item.type==='module')script.type='module';script.async=false;
      script.src=new URL(item.path,gameRoot);script.onload=resolve;script.onerror=()=>reject(Error('游戏脚本加载失败'));
      document.body.append(script);
    });
  }
  document.documentElement.dataset.hubGameReady='true';
}catch(error){status.textContent=error.message;status.dataset.error='true';back.href=gameRoot.pathname.split('/games/')[0]+'/';}
