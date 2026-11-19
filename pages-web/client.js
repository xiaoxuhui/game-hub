const $=id=>document.getElementById(id);let games=[];
function render(){const q=$('search').value.trim().toLocaleLowerCase(),list=games.filter(g=>g.name.toLocaleLowerCase().includes(q)||g.id.includes(q));$('games').replaceChildren();$('empty').hidden=!!list.length;for(const g of list){const button=document.createElement('button');button.className='card';button.setAttribute('aria-label','打开 '+g.name);const img=document.createElement('img'),fallback=document.createElement('span');fallback.className='icon-fallback';fallback.textContent=[...g.name][0];fallback.hidden=true;img.src=`./icons/${g.id}.png`;img.alt='';img.onerror=()=>{img.hidden=true;fallback.hidden=false};const name=document.createElement('strong');name.textContent=g.name;const version=document.createElement('span');version.textContent=`v${g.version} · 资源 #${g.contentCode}`;button.append(img,fallback,name,version);button.onclick=()=>open(g);$('games').append(button);}}
const frame=$('frame'),restart=document.createElement('button'),message=document.createElement('p');
restart.type='button';restart.id='restart-game';restart.textContent='重新开始';restart.title='重新开始当前游戏，保留已保存的数据';$('new-tab').before(restart);
message.id='recovery-status';message.setAttribute('role','status');message.hidden=true;Object.assign(message.style,{position:'absolute',top:'54px',left:'0',right:'0',margin:'0',padding:'10px 16px',background:'#23364b',color:'#fff',zIndex:'3'});$('player').append(message);
const LIMIT=30000;let current=null,lastBeat=0,retried=false,failed=false;
function notice(text){message.textContent=text;message.hidden=!text;}
function reload(text){lastBeat=Date.now();failed=false;notice(text);frame.src=current.url;}
function open(g){const url=new URL(`./games/${g.id}/${g.entry}`,location.href);url.searchParams.set('hub','recovery-20261119');current={id:g.id,url:url.href};retried=false;$('lobby').hidden=true;$('player').hidden=false;$('title').textContent=g.name;$('new-tab').href=current.url;reload('');}
function close(){current=null;frame.src='about:blank';notice('');$('player').hidden=true;$('lobby').hidden=false;}
restart.onclick=()=>{if(current){retried=false;reload('正在重新开始，已保存的数据会保留。');}};
window.addEventListener('message',event=>{if(!current||event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='game-hub-heartbeat'||event.data.game!==current.id)return;lastBeat=Date.now();failed=false;notice('');});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&current)lastBeat=Date.now();});
setInterval(()=>{if(!current||document.hidden||failed||Date.now()-lastBeat<LIMIT)return;if(!retried){retried=true;reload('游戏暂时没有响应，正在重新开始。');}else{failed=true;notice('游戏仍无响应。请点击“重新开始”重试；已保存的数据不会删除。');}},1000);
$('back').onclick=close;$('search').addEventListener('input',render);
try{const r=await fetch('./games.json',{cache:'no-store'});if(!r.ok)throw Error('游戏目录不可用');games=(await r.json()).games;$('count').textContent=`${games.length} 款游戏`;$('status').textContent='已加载在线游戏';render();}catch(e){$('status').textContent='无法读取游戏：'+e.message;}
