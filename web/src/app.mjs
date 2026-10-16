const status=document.querySelector('#status');
try{
  const response=await fetch(new URL('./catalog.json',import.meta.url),{cache:'no-cache'});if(!response.ok)throw Error('目录暂不可用');
  const catalog=await response.json();
  for(const game of catalog.games){const link=document.createElement('a');link.textContent=game.displayName;link.href=game.entryUrl;document.querySelector('#games').append(link);}
  status.textContent=`${catalog.games.length} 个游戏 · 在线工程预览`;
}catch(error){status.textContent=error.message;}
