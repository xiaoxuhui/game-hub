(function(root){
  const faces=['U','R','F','D','L','B'];
  const key=(p,n)=>p.join(',')+'|'+n.join(',');
  function quarter(v,axis){const [x,y,z]=v;return axis==='X'?[x,z,-y]:axis==='Y'?[-z,y,x]:[y,-x,z];}
  class CuboidModel {
    constructor(dimensions=[3,3,3]){
      if(!Array.isArray(dimensions)||dimensions.length!==3||dimensions.some(n=>!Number.isInteger(n)||n<1||n>200))throw Error('X、Y、Z 必须是 1 到 200 的整数。');
      this.dims=[...dimensions];this.classic=dimensions.every(n=>n===3);this.pocket=dimensions.every(n=>n===2);
      const [X,Y,Z]=dimensions;this.shapes={U:[Z,X],R:[Y,Z],F:[Y,X],D:[Z,X],L:[Y,Z],B:[Y,X]};
      this.cells=[];this.offsets={};this.cache=new Map();this.sparseCache=new Map();
      for(const f of faces){this.offsets[f]=this.cells.length;const [rows,cols]=this.shapes[f];
        for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
          const x=2*c-X+1,y=Y-1-2*r,z=2*c-Z+1;
          const g={F:{p:[x,y,Z-1],n:[0,0,1],rot:''},B:{p:[-x,y,1-Z],n:[0,0,-1],rot:'rotateY(180deg)'},R:{p:[X-1,y,-z],n:[1,0,0],rot:'rotateY(90deg)'},L:{p:[1-X,y,z],n:[-1,0,0],rot:'rotateY(-90deg)'},U:{p:[x,Y-1,2*r-Z+1],n:[0,1,0],rot:'rotateX(90deg)'},D:{p:[x,1-Y,Z-1-2*r],n:[0,-1,0],rot:'rotateX(-90deg)'}}[f];
          this.cells.push({...g,face:f,row:r,col:c,index:r*cols+c,locked:this.classic&&r===1&&c===1});
        }
      }
      this.solved=this.cells.map(c=>c.face).join('');this.positions=new Map(this.cells.map((g,i)=>[key(g.p,g.n),i]));
      this.layers=dimensions.map(n=>Array.from({length:n},()=>[]));
      this.cells.forEach((g,i)=>g.p.forEach((v,a)=>this.layers[a][(v+dimensions[a]-1)/2].push(i)));
    }
    axisIndex(axis){const i=['X','Y','Z'].indexOf(axis);if(i<0)throw Error('旋转轴无效。');return i;}
    square(axis){const i=this.axisIndex(axis);return this.dims[(i+1)%3]===this.dims[(i+2)%3];}
    normalize(move){
      if(typeof move==='string'){
        const t={R:['X',1],L:['X',-1],U:['Y',1],D:['Y',-1],F:['Z',1],B:['Z',-1]}[move[0]];
        if(!t||!/^([URFDLB])('?|2)$/.test(move))throw Error('转动指令无效。');
        const ai=this.axisIndex(t[0]);return this.normalize({axis:t[0],layer:t[1]>0?this.dims[ai]-1:0,turns:(move.endsWith('2')?2:move.endsWith("'")?-1:1)*t[1]});
      }
      if(!move||typeof move!=='object')throw Error('转动指令无效。');
      const ai=this.axisIndex(move.axis);
      if(!Number.isInteger(move.layer)||move.layer<0||move.layer>=this.dims[ai]||![-2,-1,1,2].includes(move.turns))throw Error('转动层或角度无效。');
      if(Math.abs(move.turns)!==2&&!this.square(move.axis))throw Error('这个轴的截面不是正方形，只能旋转 180°。');
      return {axis:move.axis,layer:move.layer,turns:move.turns};
    }
    permutation(move){
      const sparse=this.sparsePermutation(move),permutation=this.cells.map((_,i)=>i);
      for(let j=0;j<sparse.to.length;j++)permutation[sparse.to[j]]=sparse.from[j];return permutation;
    }
    sparsePermutation(move){
      const m=this.normalize(move),q=(m.turns+4)%4,id=`${m.axis}:${m.layer}:${q}`;
      if(this.sparseCache.has(id))return this.sparseCache.get(id);
      const ai=this.axisIndex(m.axis),from=[],to=[];
      this.layers[ai][m.layer].forEach(i=>{
        const g=this.cells[i];
        let p=g.p,n=g.n;for(let j=0;j<q;j++){p=quarter(p,m.axis);n=quarter(n,m.axis);}
        const target=this.positions.get(key(p,n));if(target===undefined)throw Error('此转动会改变长方体尺寸。');
        if(target!==i){from.push(i);to.push(target);}
      });
      const sparse={from:Int32Array.from(from),to:Int32Array.from(to)};this.sparseCache.set(id,sparse);return sparse;
    }
    apply(text,move){
      if(text.length!==this.cells.length)throw Error('色块数量与尺寸不一致。');
      const p=this.sparsePermutation(move),out=text.split('');for(let j=0;j<p.to.length;j++)out[p.to[j]]=text[p.from[j]];return out.join('');
    }
    inverse(move){const m=this.normalize(move);return {...m,turns:Math.abs(m.turns)===2?2:-m.turns};}
    solverPattern(text){
      if(this.classic)return text;
      if(!this.pocket)throw Error('此尺寸不使用角块求解器。');
      const three=new CuboidModel(),out=Array(54).fill('*');
      faces.forEach((f,i)=>out[i*9+4]=f);
      this.cells.forEach((g,i)=>{const target=three.positions.get(key(g.p.map(v=>v*2),g.n));out[target]=text[i];});
      return out.join('');
    }
    isSolved(text){return text.length===this.solved.length&&[...text].every((c,i)=>c==='*'||c===this.solved[i]);}
    validate(text){
      if(text.length!==this.cells.length||/[^URFDLB*]/.test(text))throw Error('还有未填写的方格；不关心的格子可涂黑。');
      for(const f of faces)if([...text].filter(c=>c===f).length>[...this.solved].filter(c=>c===f).length)throw Error('颜色数量超过当前尺寸对应的面格数，请检查填色。');
    }
    legalMoves(){const out=[];for(const axis of ['X','Y','Z'])for(let layer=0;layer<this.dims[this.axisIndex(axis)];layer++)for(const turns of this.square(axis)?[1,-1,2]:[2])out.push({axis,layer,turns});return out;}
    randomScrambleLength(random=Math.random){
      const size=Math.max(...this.dims),min=Math.max(12,size*6),max=Math.max(24,size*12);
      return min+Math.floor(random()*(max-min+1));
    }
    scramble(count,random=Math.random){
      if(count===undefined)count=this.randomScrambleLength(random);
      if(!Number.isInteger(count)||count<0||count>10000)throw Error('打乱步数必须是 0 到 10000 的整数。');
      const possible=this.legalMoves(),moves=[];let state=this.solved,last='';
      for(let i=0;i<count;i++){
        const choices=possible.filter(m=>m.axis+':'+m.layer!==last),m=choices[Math.floor(random()*choices.length)];
        moves.push(m);state=this.apply(state,m);last=m.axis+':'+m.layer;
      }
      return {state,moves};
    }
    knownSolution(text,history){
      if(!Array.isArray(history)||history.length>10000)return null;
      let known=this.solved;
      try{for(const move of history)known=this.apply(known,move);}catch{return null;}
      if([...text].some((c,i)=>c!=='*'&&c!==known[i]))return null;
      const answer=[];let state=text;
      for(const move of [...history].reverse()){
        if(this.isSolved(state))break;
        const inverse=this.inverse(move);state=this.apply(state,inverse);answer.push(inverse);
      }
      return this.isSolved(state)?answer:null;
    }
    shortSolve(text,maxDepth=3,budget=60000){
      const moves=this.legalMoves();let nodes=0;
      const maxAffected=Math.max(...this.layers.flatMap(groups=>groups.map(g=>g.length)));
      const lowerBound=state=>{let wrong=0;for(let j=0;j<state.length;j++)if(state[j]!=='*'&&state[j]!==this.solved[j])wrong++;return Math.ceil(wrong/maxAffected);};
      const visit=(state,left,last,path)=>{
        if(this.isSolved(state))return path;if(!left||lowerBound(state)>left)return null;
        for(let i=0;i<moves.length;i++){
          const m=moves[i],layer=m.axis+':'+m.layer;if(layer===last)continue;
          if(++nodes>budget)return null;
          const next=this.apply(state,m),answer=visit(next,left-1,layer,[...path,m]);if(answer)return answer;
        }
        return null;
      };
      for(let depth=0;depth<=maxDepth&&nodes<=budget;depth++){const answer=visit(text,depth,'',[]);if(answer)return answer;}
      return null;
    }
    simplifyMoves(moves){
      let current=moves.map(m=>this.normalize(m)),changed=true;
      while(changed){const out=[];let i=0;
        while(i<current.length){const axis=current[i].axis,counts=new Map();
          while(i<current.length&&current[i].axis===axis){const m=current[i++];counts.set(m.layer,((counts.get(m.layer)||0)+m.turns+4)%4);}
          for(const [layer,q]of [...counts].sort((a,b)=>a[0]-b[0]))if(q)out.push({axis,layer,turns:q===3?-1:q});
        }
        changed=out.length<current.length;current=out;
      }
      return current;
    }
    optimizeSolution(text,moves){
      const simplified=this.simplifyMoves(moves),out=[];let state=text;
      // Removing exact repeated color states is valid even with travelling black masks.
      const seen=this.cells.length<=2400?new Map([[state,0]]):null;
      for(const move of simplified){
        if(this.isSolved(state))break;
        const next=this.apply(state,move);if(next===state)continue;
        out.push(move);state=next;
        if(seen){
          if(seen.has(state)){const cut=seen.get(state);out.length=cut;for(const [s,n]of seen)if(n>cut)seen.delete(s);}
          else seen.set(state,out.length);
        }
      }
      return this.isSolved(state)?out:null;
    }
    findSolution(text,history){
      this.validate(text);
      const budget=Math.min(12000,Math.max(80,Math.floor(5000000/this.cells.length)));
      const searched=this.shortSolve(text,3,budget);
      if(searched)return {moves:searched,method:'置换搜索',baseline:null};
      const known=this.knownSolution(text,history);if(known===null)return null;
      const moves=this.optimizeSolution(text,known);
      return moves===null?null:{moves,method:'置换化简（使用打乱记录）',baseline:known.length};
    }
    describe(move){
      const m=this.normalize(move),ai=this.axisIndex(m.axis),from=['左','下','后'][ai],view=['右','上','前'][ai];
      const angle=Math.abs(m.turns)===2?'180°':m.turns<0?'逆时针 90°':'顺时针 90°';
      return {...m,css:(m.axis==='Y'?-90:90)*m.turns,coordinate:2*m.layer-this.dims[ai]+1,title:`${m.axis} 轴 · 第 ${m.layer+1} 层 · ${angle}`,detail:`从${from}数第 ${m.layer+1} 层，正对${view}侧观察方向。`,token:`${m.axis}${m.layer+1}`};
    }
  }
  const api={CuboidModel};if(typeof module!=='undefined')module.exports=api;else root.Cuboid=api;
})(typeof self!=='undefined'?self:globalThis);
