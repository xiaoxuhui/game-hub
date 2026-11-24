import {Game,columnLabel,ATTITUDES} from './engine.js';
const $=id=>document.getElementById(id);
export class MapEditor{
  constructor({getPlayers,getCountries=()=>[],onApply,onClose}){
    Object.assign(this,{getPlayers,getCountries,onApply,onClose,brush:'land',brushSize:1,zoom:false,history:[],active:false,mode:'terrain',selectedCountry:0,targetCountry:1});
    this.canvas=$('mapEditorCanvas');this.ctx=this.canvas.getContext('2d');this.dialog=$('mapEditorDialog');
    document.querySelectorAll('[data-map-brush]').forEach(b=>b.onclick=()=>{this.brush=b.dataset.mapBrush;this.draw();});
    $('editorBrushSize').onchange=e=>{this.brushSize=Number(e.target.value);};
    $('editorMapSize').onchange=e=>this.resize(Number(e.target.value));
    $('editorFillLand').onclick=()=>this.fill('land');$('editorFillSea').onclick=()=>this.fill('sea');
    $('editorRandom').onclick=()=>{this.remember();this.cells=this.random(this.size);this.sanitizeStarts();this.draw();};
    $('editorUndo').onclick=()=>{const previous=this.history.pop();if(previous){Object.assign(this,previous);this.placementError='';this.draw();}};
    $('editorZoom').onclick=()=>{this.zoom=!this.zoom;this.draw();};
    $('editorCancel').onclick=() => this.close();$('editorClose').onclick=()=>this.close();
    $('editorApply').onclick=()=>{if(this.landCount()<this.getPlayers())return;const map={w:this.size,h:this.size,cells:[...this.cells],starts:[...this.starts],relations:this.relations.map(row=>[...row])};this.close();this.onApply(map);};
    document.querySelectorAll('[data-editor-mode]').forEach(b=>b.onclick=()=>{this.mode=b.dataset.editorMode;this.placementError='';this.draw();});
    $('editorNation').onchange=e=>{this.selectedCountry=Number(e.target.value);if(this.targetCountry===this.selectedCountry)this.targetCountry=(this.selectedCountry+1)%this.countries.length;this.placementError='';this.draw();};
    $('editorRelationTarget').onchange=e=>{this.targetCountry=Number(e.target.value);this.draw();};
    $('editorInitialAttitude').onchange=e=>{this.remember();this.relations[this.selectedCountry][this.targetCountry]=Number(e.target.value);this.draw();};
    $('editorBothDirections').onclick=()=>{if(this.countries.length<2)return;this.remember();this.relations[this.targetCountry][this.selectedCountry]=this.relations[this.selectedCountry][this.targetCountry];this.draw();};
    $('editorClearStarts').onclick=()=>{this.remember();this.starts.fill(null);this.placementError='';this.draw();};
    this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.close();});
    this.dialog.addEventListener('close',()=>{if(this.active){this.active=false;this.onClose();}});
    this.canvas.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();this.remember();this.pointer=e.pointerId;this.canvas.setPointerCapture(e.pointerId);this.last=this.point(e);this.stroke(this.last,this.last);};
    this.canvas.onpointermove=e=>{if(this.pointer!==e.pointerId)return;e.preventDefault();const next=this.point(e);this.stroke(this.last,next);this.last=next;};
    const finish=e=>{if(this.pointer===e.pointerId){this.pointer=null;this.last=null;}};
    this.canvas.onpointerup=finish;this.canvas.onpointercancel=finish;this.canvas.onlostpointercapture=finish;
    this.canvas.onkeydown=e=>{
      const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      if(moves[e.key]){e.preventDefault();this.cursor.x=Math.max(0,Math.min(this.size-1,this.cursor.x+moves[e.key][0]));this.cursor.y=Math.max(0,Math.min(this.size-1,this.cursor.y+moves[e.key][1]));this.draw();}
      else if(e.key===' '||e.key==='Enter'){e.preventDefault();this.remember();this.stroke(this.cursor,this.cursor);}
    };
    window.addEventListener('resize',()=>{if(this.active)this.draw();});
  }
  random(size){return new Game({w:size,h:size,humans:1,ai:0,ocean:true,seed:Date.now()%2147483647}).cells.map(c=>c.terrain);}
  open(map){
    this.size=map.w;this.cells=[...map.cells];this.history=[];this.cursor={x:0,y:0};this.pointer=null;this.zoom=false;this.active=true;
    const countries=this.getCountries();this.countries=Array.from({length:this.getPlayers()},(_,id)=>countries[id]??{name:`国家${id+1}`,color:'#51ddc0'});
    this.starts=this.countries.map((_,id)=>map.starts?.[id]??null);this.relations=this.countries.map((_,from)=>this.countries.map((_,to)=>from===to?0:map.relations?.[from]?.[to]??1));
    this.mode='terrain';this.selectedCountry=0;this.targetCountry=this.countries.length>1?1:0;this.placementError='';
    $('editorNation').innerHTML=this.countries.map((c,id)=>`<option value="${id}">${id+1} · ${c.name}</option>`).join('');
    $('editorMapSize').value=this.size;this.dialog.showModal();this.draw();
  }
  close(){if(!this.active)return;this.active=false;this.pointer=null;this.dialog.close();this.onClose();}
  resize(size){this.size=size;this.cells=this.random(size);this.history=[];this.cursor={x:0,y:0};this.starts.fill(null);this.placementError='';this.draw();}
  landCount(){return this.cells.filter(t=>t==='land').length;}
  remember(){this.history.push({cells:[...this.cells],starts:[...this.starts],relations:this.relations.map(row=>[...row])});if(this.history.length>20)this.history.shift();}
  sanitizeStarts(){this.starts=this.starts.map(id=>id!==null&&this.cells[id]!=='land'?null:id);}
  fill(terrain){this.remember();this.cells.fill(terrain);this.sanitizeStarts();this.draw();}
  point(e){const rect=this.canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(this.size-1,Math.floor((e.clientX-rect.left)/rect.width*this.size))),y:Math.max(0,Math.min(this.size-1,Math.floor((e.clientY-rect.top)/rect.height*this.size)))};}
  stroke(from,to){
    if(this.mode==='initial'){
      const id=to.y*this.size+to.x,occupied=this.starts.findIndex((start,owner)=>owner!==this.selectedCountry&&start===id);
      this.placementError=this.cells[id]!=='land'?'首都只能放在陆地上。':occupied>=0?`这里已是${this.countries[occupied].name}的初始首都。`:'';
      if(!this.placementError)this.starts[this.selectedCountry]=id;
      this.cursor={...to};this.draw();return;
    }
    let x=from.x,y=from.y;const dx=Math.abs(to.x-x),dy=-Math.abs(to.y-y),sx=x<to.x?1:-1,sy=y<to.y?1:-1;let error=dx+dy;
    while(true){
      const radius=Math.floor(this.brushSize/2);
      for(let yy=Math.max(0,y-radius);yy<=Math.min(this.size-1,y+radius);yy++)for(let xx=Math.max(0,x-radius);xx<=Math.min(this.size-1,x+radius);xx++)this.cells[yy*this.size+xx]=this.brush;
      if(x===to.x&&y===to.y)break;const twice=2*error;if(twice>=dy){error+=dy;x+=sx;}if(twice<=dx){error+=dx;y+=sy;}
    }
    this.sanitizeStarts();this.cursor={...to};this.draw();
  }
  draw(){
    document.querySelectorAll('[data-editor-mode]').forEach(b=>{const selected=b.dataset.editorMode===this.mode;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',selected);});
    document.querySelectorAll('.editor-terrain-tools').forEach(el=>el.hidden=this.mode!=='terrain');$('editorInitialSettings').hidden=this.mode!=='initial';
    $('editorNation').value=this.selectedCountry;
    const options=this.countries.map((c,id)=>id===this.selectedCountry?'':`<option value="${id}">${id+1} · ${c.name}</option>`).join('');
    if($('editorRelationTarget').innerHTML!==options)$('editorRelationTarget').innerHTML=options;
    $('editorRelationTarget').value=this.targetCountry;
    const hasOthers=this.countries.length>1;for(const id of ['editorRelationTarget','editorInitialAttitude','editorBothDirections'])$(id).disabled=!hasOthers;
    const from=this.selectedCountry,to=this.targetCountry,spot=this.starts[from];
    $('editorPlacementNote').textContent=this.placementError||`${this.countries[from].name}：${spot===null?'自动选址':columnLabel(spot%this.size)+(Math.floor(spot/this.size)+1)}。点击陆地指定该国的一格初始首都，编号对应国家。`;
    $('editorInitialAttitude').value=hasOthers?this.relations[from][to]:1;
    $('editorRelationNote').textContent=hasOthers?`${this.countries[from].name} → ${this.countries[to].name}：${ATTITUDES[this.relations[from][to]]}；反向：${ATTITUDES[this.relations[to][from]]}。每个方向独立，之后按正常外交规则变化。`:'只有一个国家，无需设置国家间关系。';
    $('editorClearStarts').disabled=this.starts.every(id=>id===null);
    const pixels=this.size*16;if(this.canvas.width!==pixels){this.canvas.width=pixels;this.canvas.height=pixels;}
    this.cells.forEach((terrain,id)=>{this.ctx.fillStyle=terrain==='sea'?'#215a78':'#50613d';this.ctx.fillRect(id%this.size*16,Math.floor(id/this.size)*16,16,16);});
    this.ctx.strokeStyle='#101b1b55';this.ctx.lineWidth=1;this.ctx.beginPath();
    for(let i=0;i<=this.size;i++){this.ctx.moveTo(i*16,0);this.ctx.lineTo(i*16,pixels);this.ctx.moveTo(0,i*16);this.ctx.lineTo(pixels,i*16);}this.ctx.stroke();
    this.starts.forEach((id,owner)=>{if(id===null)return;const x=id%this.size*16,y=Math.floor(id/this.size)*16;this.ctx.fillStyle=this.countries[owner].color;this.ctx.fillRect(x+1,y+1,14,14);this.ctx.fillStyle='#10221b';this.ctx.font='bold 9px sans-serif';this.ctx.textAlign='center';this.ctx.fillText(String(owner+1),x+8,y+11);});
    this.ctx.strokeStyle='#edfff6';this.ctx.lineWidth=2;this.ctx.strokeRect(this.cursor.x*16+1,this.cursor.y*16+1,14,14);
    const viewport=$('mapEditorViewport'),width=this.zoom?this.size*24:Math.max(40,Math.min(viewport.clientWidth-2,viewport.clientHeight||innerHeight*.45,innerHeight*.45,600));
    this.canvas.style.width=width+'px';this.canvas.style.height=width+'px';
    const land=this.landCount(),players=this.getPlayers(),valid=land>=players;
    $('editorStatus').textContent=`${this.size} × ${this.size} · 陆地 ${land} 格 · 海洋 ${this.cells.length-land} 格 · 开局 ${players} 国`;
    const specified=this.starts.filter(id=>id!==null).length;
    $('editorError').textContent=valid?`${specified?`已指定 ${specified} 国首都，其余自动分配。`:'首都自动分配在陆地上。'}每国仍从一格和 20 兵力开始。`:`还需要至少 ${players-land} 格陆地，才能容纳 ${players} 个国家。`;
    $('editorError').classList.toggle('invalid',!valid);$('editorApply').disabled=!valid;$('editorUndo').disabled=!this.history.length;
    $('editorZoom').textContent=this.zoom?'显示全图':'放大绘制';$('editorZoom').setAttribute('aria-pressed',this.zoom);
    document.querySelectorAll('[data-map-brush]').forEach(b=>{const selected=b.dataset.mapBrush===this.brush;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',selected);});
    this.canvas.setAttribute('aria-label',`地图画布，${columnLabel(this.cursor.x)}${this.cursor.y+1}，当前${this.mode==='initial'?this.countries[from].name+'首都选址':(this.brush==='land'?'陆地':'海洋')+'笔刷'}。方向键移动，空格或回车绘制。`);
  }
}
