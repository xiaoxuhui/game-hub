  // 网页大厅适配：只保存最近一次棋盘；不自动导入历史备份。
  {
    const key='game-hub-web-autosave-v1';let writable=true,restoring=true;
    const warn=text=>{let node=document.getElementById('hub-save-warning');if(!node){node=document.createElement('p');node.id='hub-save-warning';node.setAttribute('role','alert');document.querySelector('main').prepend(node)}node.textContent=text};
    try{
      const text=localStorage.getItem(key);
      if(text!==null){const saved=JSON.parse(text);if(saved.version!==1||!Number.isInteger(saved.n)||saved.n<1||saved.n>20||!Array.isArray(saved.board)||saved.board.length!==saved.n*saved.n||saved.board.some(x=>x!==0&&x!==1)||!['both','matrix','result','none'].includes(saved.display))throw Error('invalid');generate(saved.n);$('size').value=String(saved.n);state.board=Uint8Array.from(saved.board);$('display-mode').value=saved.display;solve();setDisplay()}
    }catch{writable=false;warn('本地存档无法读取，已保留原数据，请先从大厅导出备份。')}
    restoring=false;
    const save=()=>{if(!writable||restoring)return;try{localStorage.setItem(key,JSON.stringify({version:1,n:state.n,board:Array.from(state.board),display:$('display-mode').value}))}catch{writable=false;warn('无法保存进度，请检查浏览器存储空间并导出备份。')}};
    for(const name of ['click','input','change','submit'])document.addEventListener(name,save);
    window.addEventListener('pagehide',save);
  }
