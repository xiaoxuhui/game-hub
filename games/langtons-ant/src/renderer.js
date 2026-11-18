(function(root) {
  'use strict';
  function draw(canvas,state,settings,origin) {
    const ctx=canvas.getContext('2d'),rect=canvas.getBoundingClientRect(),size=settings.cellSize;
    const styles=getComputedStyle(document.documentElement),color=name=>styles.getPropertyValue(name).trim();
    ctx.fillStyle=color('--white-cell'); ctx.fillRect(0,0,rect.width,rect.height);
    const minX=Math.floor(-origin.x/size)-1,maxX=Math.ceil((rect.width-origin.x)/size)+1;
    const minY=Math.floor(-origin.y/size)-1,maxY=Math.ceil((rect.height-origin.y)/size)+1;
    if(settings.grid && size>=6) {
      ctx.strokeStyle=color('--grid');ctx.lineWidth=1;ctx.beginPath();
      for(let x=minX;x<=maxX;x++) {const px=Math.round(origin.x+x*size)+0.5;ctx.moveTo(px,0);ctx.lineTo(px,rect.height);}
      for(let y=minY;y<=maxY;y++) {const py=Math.round(origin.y+y*size)+0.5;ctx.moveTo(0,py);ctx.lineTo(rect.width,py);}
      ctx.stroke();
    }
    ctx.fillStyle=color('--cell');
    const fill=(x,y)=>ctx.fillRect(Math.floor(origin.x+x*size),Math.floor(origin.y+y*size),Math.ceil(size),Math.ceil(size));
    // Bound rendering by the visible area once the sparse world grows large.
    if(state.black.size>(maxX-minX+1)*(maxY-minY+1)) {
      for(let y=minY;y<=maxY;y++) for(let x=minX;x<=maxX;x++) if(state.black.has(`${x},${y}`)) fill(x,y);
    } else {
      for(const item of state.black) {const [x,y]=item.split(',').map(Number);if(x>=minX&&x<=maxX&&y>=minY&&y<=maxY) fill(x,y);}
    }
    const {ant}=state,arrow=Math.max(6,size*0.82);
    ctx.save();ctx.translate(origin.x+(ant.x+0.5)*size,origin.y+(ant.y+0.5)*size);
    ctx.rotate(ant.dir*Math.PI/2-Math.PI/2);ctx.fillStyle=color('--ant');ctx.strokeStyle=color('--white-cell');ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(arrow*0.5,0);ctx.lineTo(-arrow*0.35,-arrow*0.36);ctx.lineTo(-arrow*0.2,0);ctx.lineTo(-arrow*0.35,arrow*0.36);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  root.AntRenderer={draw};
})(globalThis);
