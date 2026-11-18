(function(root) {
  'use strict';
  // Integer Bresenham: fast pointer motion still visits every crossed row/column.
  function line(from,to,visit) {
    let [x,y]=from; const [tx,ty]=to;
    const dx=Math.abs(tx-x),dy=-Math.abs(ty-y),sx=x<tx?1:-1,sy=y<ty?1:-1;
    let error=dx+dy;
    for(;;) {
      visit(x,y); if(x===tx && y===ty) break;
      const twice=2*error;
      if(twice>=dy) {error+=dy; x+=sx;}
      if(twice<=dx) {error+=dx; y+=sy;}
    }
  }
  const api={line};
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.AntInteraction=api;
})(globalThis);
