{
  const key='game-hub-web-autosave-v1';let writable=true,restoring=true;
  const warn=text=>{let node=document.getElementById('hub-save-warning');if(!node){node=document.createElement('p');node.id='hub-save-warning';node.setAttribute('role','alert');document.querySelector('.settings').prepend(node)}node.textContent=text};
  try{const text=localStorage.getItem(key);if(text!==null){const s=JSON.parse(text);if(s.version!==1||!Number.isSafeInteger(s.n)||s.n<3||s.n>1000000||!Number.isSafeInteger(s.index)||s.index<0||(s.draft!==undefined&&(typeof s.draft!=='string'||s.draft.length>32))||typeof s.labels!=='boolean'||typeof s.grid!=='boolean'||!['all','phase','none'].includes(s.helpers)||!['0.5','1','2','4'].includes(s.speed))throw Error('invalid');$('sides').value=String(s.n);$('labels').checked=s.labels;$('grid').checked=s.grid;$('helpers').value=s.helpers;$('speed').value=s.speed;generate(s.n);if(model)setIndex(s.index);if(s.draft!==undefined)$('sides').value=s.draft}}catch{writable=false;warn('本地存档无法读取，已保留原数据，请先从大厅导出备份。')}
  restoring=false;
  hubSaveState=()=>{if(!writable||restoring)return;const draft=$('sides').value,n=model?.n??Number(draft);if(!Number.isSafeInteger(n)||n<3||n>1000000||draft.length>32)return;try{localStorage.setItem(key,JSON.stringify({version:1,n,draft,index,labels:$('labels').checked,grid:$('grid').checked,helpers:$('helpers').value,speed:$('speed').value}))}catch{writable=false;warn('无法保存进度，请检查浏览器存储空间并导出备份。')}};
  for(const name of ['click','change','submit','input'])document.addEventListener(name,hubSaveState);
  window.addEventListener('pagehide',hubSaveState);
}
