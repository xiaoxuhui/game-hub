import {validateOnlineCatalog,validateHistory,snapshot,changes,SHELL_VERSION} from './core/online-catalog.mjs';
import {boundedText} from './core/http.mjs';
const $=id=>document.getElementById(id),base=new URL('./',import.meta.url).pathname,key='game-hub-web.check.'+base;
let catalog=null,category='全部',previous=null,unread=new Set(),lastSuccess=null,busy=false,lastAttempt=0,detailTrigger=null;
try{const stored=JSON.parse(localStorage.getItem(key)||'null');if(stored){previous=validateHistory(stored.snapshot);lastSuccess=Number.isSafeInteger(stored.lastSuccess)?stored.lastSuccess:null;unread=new Set(Array.isArray(stored.unread)?stored.unread:[]);}}catch{previous=null;/* Bad check history never blocks online checking or touches game saves. */}
function persist(){try{localStorage.setItem(key,JSON.stringify({snapshot:previous,lastSuccess,unread:[...unread]}));}catch{$('status').textContent+=' · 检查记录未能保存';}}
function icon(game){return `./assets/${['conway','eml','light','turing'].includes(game.iconKind)?game.iconKind+'.png':['simulation','logic','puzzle','generic'].includes(game.iconKind)?game.iconKind+'.svg':'generic.svg'}`;}
function markRead(id){unread.delete(id);persist();}
function detail(game,trigger){
  detailTrigger=trigger;
  $('detail-title').textContent=game.displayName;$('detail-icon').src=icon(game);$('detail-meta').textContent=`${game.category} · v${game.version} · 网页资源 #${game.contentCode}`;
  $('detail-source').textContent=game.sourceRevision;$('detail-size').textContent=(game.files.reduce((n,f)=>n+f.bytes,0)/1024).toFixed(0)+' KiB';
  $('detail-play').href=game.entryUrl;$('detail-play').onclick=()=>markRead(game.id);$('details').showModal();
}
function render(){
  $('count').textContent=String(catalog.games.length);$('games').replaceChildren();$('filters').replaceChildren();
  for(const name of ['全部',...new Set(catalog.games.map(g=>g.category))]){
    const button=document.createElement('button');button.textContent=name;button.setAttribute('aria-pressed',String(category===name));button.onclick=()=>{category=name;render();};$('filters').append(button);
  }
  const visible=catalog.games.filter(g=>category==='全部'||g.category===category);$('empty').hidden=visible.length!==0;
  for(const game of visible){
    const card=document.createElement('article'),link=document.createElement('a'),image=document.createElement('img'),name=document.createElement('strong'),info=document.createElement('button');
    card.className='game-card';image.src=icon(game);image.alt='';image.width=52;image.height=52;name.textContent=game.displayName;
    link.href=game.entryUrl;link.className='game-link';link.append(image,name);link.onclick=()=>markRead(game.id);
    if(unread.has(game.id)){const badge=document.createElement('span');badge.className='update-dot';badge.textContent='有更新';link.append(badge);}
    info.className='info';info.textContent='· · ·';info.setAttribute('aria-label',game.displayName+'详情');info.onclick=()=>detail(game,info);card.append(link,info);$('games').append(card);
  }
}
async function check(){
  if(busy)return;busy=true;lastAttempt=Date.now();$('check-update').disabled=true;$('status').textContent='正在检查更新…';
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),10000);
  try{
    const response=await fetch(new URL('./catalog.json',import.meta.url),{cache:'no-store',redirect:'error',signal:abort.signal});
    if(!response.ok)throw Error('目录暂不可用');const text=await boundedText(response,4*1024*1024,'application/json');
    const next=validateOnlineCatalog(JSON.parse(text),base),diff=changes(previous,next);
    for(const id of [...diff.added,...diff.updated])unread.add(id);
    catalog=next;previous=snapshot(next);lastSuccess=Date.now();render();
    const messages=[];if(diff.updated.length)messages.push(`${diff.updated.length} 个游戏资源有更新`);if(diff.added.length)messages.push(`新增 ${diff.added.length} 个游戏`);if(diff.shell)messages.push('大厅有新版本');
    $('update-notice').hidden=messages.length===0;$('update-notice').textContent=messages.join(' · ');$('reload-shell').hidden=!diff.shell;
    $('status').textContent=messages.length?'检查成功 · 已发现新入口':'检查成功 · 当前目录无新增更新';persist();
  }catch(error){$('status').textContent='检查失败：'+(error.name==='AbortError'?'网络超时，请稍后重试':error.message);}
  finally{clearTimeout(timer);busy=false;$('check-update').disabled=false;$('last-check').textContent=lastSuccess?'最近成功：'+new Date(lastSuccess).toLocaleString('zh-CN'):'尚未成功检查';}
}
$('check-update').onclick=check;$('reload-shell').onclick=()=>location.reload();
$('details').addEventListener('close',()=>{(detailTrigger?.isConnected?detailTrigger:$('check-update')).focus();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-lastAttempt>=15*60*1000)check();});
document.documentElement.dataset.shellVersion=SHELL_VERSION;await check();
