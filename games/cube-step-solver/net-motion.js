(function(root){
  function planTransfers(model,move){
    const m=model.normalize(move),p=model.sparsePermutation(m),transfers=[];
    for(let i=0;i<p.from.length;i++)transfers.push({from:p.from[i],to:p.to[i]});
    return {move:m,transfers,faces:new Set(transfers.flatMap(t=>[model.cells[t.from].face,model.cells[t.to].face]))};
  }
  function pointAt(path,t){
    if(t<=0)return path.start;if(t>=1)return path.end;
    if(path.arc){const {cx,cy,angle}=path.arc,dx=path.start.x-cx,dy=path.start.y-cy,a=angle*t;return {x:cx+dx*Math.cos(a)-dy*Math.sin(a),y:cy+dx*Math.sin(a)+dy*Math.cos(a)};}
    const k=1-t;return {x:k*k*path.start.x+2*k*t*path.control.x+t*t*path.end.x,y:k*k*path.start.y+2*k*t*path.control.y+t*t*path.end.y};
  }
  class NetTurnView {
    begin({net,model,move,stickers,colors,largeFace=null}){
      this.finish();const plan=planTransfers(model,move);this.session={net,model,plan,stickers,colors,oldOpacity:[],marked:[]};const s=this.session;
      net.classList.add('net-turning');
      for(const el of net.querySelectorAll('.face,.face-tabs button'))if(plan.faces.has(el.dataset.face)){el.classList.add('is-affected');s.marked.push(el);}
      if(largeFace){
        s.face=largeFace;s.canvas=net.querySelector('#large-face-canvas');if(!s.canvas)return;
        s.base=document.createElement('canvas');s.base.width=s.canvas.width;s.base.height=s.canvas.height;s.base.getContext('2d').drawImage(s.canvas,0,0);
        s.ctx=s.canvas.getContext('2d');s.visible=plan.transfers.filter(t=>model.cells[t.to].face===largeFace);
        const normal=model.cells[model.offsets[largeFace]].n,ai=model.axisIndex(plan.move.axis);s.faceTurn=normal[ai]!==0&&s.visible.length>0;s.angle=plan.move.turns*normal[ai]*Math.PI/2;
        return;
      }
      const rect=net.getBoundingClientRect(),buttons=[...net.querySelectorAll('.sticker')],positions=buttons.map(el=>{const r=el.getBoundingClientRect();return {x:r.left-rect.left+r.width/2,y:r.top-rect.top+r.height/2,w:r.width,h:r.height};});
      const canvas=document.createElement('canvas');canvas.className='net-motion-canvas';canvas.width=Math.ceil(rect.width);canvas.height=Math.ceil(rect.height);canvas.setAttribute('aria-hidden','true');net.append(canvas);s.canvas=canvas;s.ctx=canvas.getContext('2d');
      const affected=new Set(plan.transfers.flatMap(t=>[t.from,t.to]));for(const index of affected){const el=buttons[index];if(el){s.oldOpacity.push([el,el.style.opacity]);el.style.opacity='.16';}}
      s.paths=plan.transfers.map(transfer=>{
        const start=positions[transfer.from],end=positions[transfer.to],from=model.cells[transfer.from],to=model.cells[transfer.to],path={...transfer,start,end};
        if(from.face===to.face){
          const grid=buttons[transfer.from].parentElement.getBoundingClientRect(),normal=from.n[model.axisIndex(plan.move.axis)];
          path.arc={cx:grid.left-rect.left+grid.width/2,cy:grid.top-rect.top+grid.height/2,angle:plan.move.turns*normal*Math.PI/2};
        }else{
          const dx=end.x-start.x,dy=end.y-start.y,distance=Math.hypot(dx,dy)||1,bend=Math.min(35,distance*.15);
          path.control={x:Math.max(0,Math.min(rect.width,(start.x+end.x)/2-dy/distance*bend)),y:Math.max(0,Math.min(rect.height,(start.y+end.y)/2+dx/distance*bend))};
        }
        return path;
      });
    }
    frame(progress){
      const s=this.session;if(!s?.ctx)return;const {ctx,canvas,colors,stickers}=s,t=Math.max(0,Math.min(1,progress));
      ctx.clearRect(0,0,canvas.width,canvas.height);
      if(s.base){
        ctx.drawImage(s.base,0,0);
        if(s.faceTurn){
          ctx.fillStyle='#090c12';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(s.angle*t);ctx.drawImage(s.base,-canvas.width/2,-canvas.height/2);ctx.restore();
          ctx.strokeStyle='#b4a0ff';ctx.lineWidth=2;ctx.strokeRect(1,1,canvas.width-2,canvas.height-2);
        }else for(const transfer of s.visible){
          const cell=s.model.cells[transfer.to],x=cell.col*12+1,y=cell.row*12+1;
          ctx.save();ctx.beginPath();ctx.rect(x,y,11,11);ctx.clip();ctx.fillStyle='#090c12';ctx.fillRect(x,y,11,11);
          ctx.fillStyle=colors[stickers[transfer.to]]?.hex||'#323d50';ctx.globalAlpha=1-t;ctx.fillRect(x,y+t*12,11,11);
          ctx.fillStyle=colors[stickers[transfer.from]]?.hex||'#323d50';ctx.globalAlpha=t;ctx.fillRect(x,y-(1-t)*12,11,11);ctx.restore();
          ctx.strokeStyle='#b4a0ff';ctx.lineWidth=.8;ctx.strokeRect(x,y,11,11);
        }
        return;
      }
      for(const path of s.paths){
        const p=pointAt(path,t),w=path.start.w+(path.end.w-path.start.w)*t,h=path.start.h+(path.end.h-path.start.h)*t;
        ctx.fillStyle=colors[stickers[path.from]]?.hex||'#323d50';ctx.fillRect(p.x-w/2+1,p.y-h/2+1,w-2,h-2);ctx.strokeStyle='#c6b5ff';ctx.lineWidth=1.2;ctx.strokeRect(p.x-w/2+1,p.y-h/2+1,w-2,h-2);
      }
    }
    finish(){
      const s=this.session;if(!s)return;
      if(s.base&&s.ctx){s.ctx.clearRect(0,0,s.canvas.width,s.canvas.height);s.ctx.drawImage(s.base,0,0);}else s.canvas?.remove();
      for(const [el,opacity]of s.oldOpacity)el.style.opacity=opacity;for(const el of s.marked)el.classList.remove('is-affected');s.net.classList.remove('net-turning');this.session=null;
    }
  }
  const api={planTransfers,pointAt,NetTurnView};if(typeof module!=='undefined')module.exports=api;else root.NetMotion=api;
})(typeof self!=='undefined'?self:globalThis);
