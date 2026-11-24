(function(root) {
  const faces = ['U','R','F','D','L','B'];
  const names = {U:'上',R:'右',F:'前',D:'下',L:'左',B:'后'};
  const turns = {R:{axis:'X',layer:1,css:90},L:{axis:'X',layer:-1,css:-90},U:{axis:'Y',layer:1,css:-90},D:{axis:'Y',layer:-1,css:90},F:{axis:'Z',layer:1,css:90},B:{axis:'Z',layer:-1,css:-90}};
  function parity(a) { let n=0; for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i]>a[j])n++; return n%2; }
  function validate(text, Cube) {
    if(text.length!==54 || /[^URFDLB]/.test(text)) throw Error('还有未填写的方格，请补齐六个面。');
    for(const f of faces) if([...text].filter(x=>x===f).length!==9) throw Error('每种颜色必须恰好 9 格，请检查颜色计数。');
    if(faces.some((f,i)=>text[i*9+4]!==f)) throw Error('中心颜色不匹配，请检查六面的方向。');
    const c=Cube.fromString(text);
    if(new Set(c.cp).size!==8 || new Set(c.ep).size!==12 || c.asString()!==text) throw Error('色块组合不符合真实魔方，请检查相邻面方向和角块、棱块的颜色。');
    if(c.co.reduce((a,b)=>a+b,0)%3) throw Error('角块朝向不合法：可能有角块被单独扭转，或填色方向有误。');
    if(c.eo.reduce((a,b)=>a+b,0)%2) throw Error('棱块朝向不合法：可能有一条棱被翻转，或填色方向有误。');
    if(parity(c.cp)!==parity(c.ep)) throw Error('块的位置不合法：可能有两块被互换，请核对填色或实物装配。');
    return c;
  }
  function geometry(face,index) {
    const r=Math.floor(index/3),c=index%3;
    return {F:{p:[c-1,1-r,1],n:[0,0,1],rot:''},B:{p:[1-c,1-r,-1],n:[0,0,-1],rot:'rotateY(180deg)'},R:{p:[1,1-r,1-c],n:[1,0,0],rot:'rotateY(90deg)'},L:{p:[-1,1-r,c-1],n:[-1,0,0],rot:'rotateY(-90deg)'},U:{p:[c-1,1,r-1],n:[0,1,0],rot:'rotateX(90deg)'},D:{p:[c-1,-1,1-r],n:[0,-1,0],rot:'rotateX(-90deg)'}}[face];
  }
  // Black is a travelling wildcard sticker, not a seventh physical face color.
  function isPatternSolved(text) { return text.length===54&&[...text].every((c,i)=>c==='*'||c===faces[Math.floor(i/9)]); }
  function validatePattern(text,Cube) {
    if(text.length!==54||/[^URFDLB*]/.test(text))throw Error('还有未填写的方格，请补齐六个面；不需要还原的格子可涂黑。');
    if(faces.some((f,i)=>text[i*9+4]!==f))throw Error('中心颜色不匹配，请检查六面的方向。');
    if(!text.includes('*'))return validate(text,Cube);
    for(const f of faces)if([...text].filter(c=>c===f).length>9)throw Error('非黑色的每种颜色不能超过 9 格；黑色格数不限。');
    return null;
  }
  const cornerSlots=[[8,9,20],[6,18,38],[0,36,47],[2,45,11],[29,26,15],[27,44,24],[33,53,42],[35,17,51]];
  const edgeSlots=[[5,10],[7,19],[3,37],[1,46],[32,16],[28,25],[30,43],[34,52],[23,12],[21,41],[50,39],[48,14]];
  const solved=faces.map(f=>f.repeat(9)).join('');
  function completePattern(text,Cube) {
    const full=validatePattern(text,Cube);if(full)return full;
    function group(slots,wantedParity) {
      const width=slots[0].length;
      const candidates=slots.map((indices,slot)=>{
        const out=[];
        // Prefer retaining the solved piece where unconstrained.
        const pieces=[slot,...slots.map((_,i)=>i).filter(i=>i!==slot)];
        for(const piece of pieces)for(let ori=0;ori<width;ori++){
          if(slots[piece].every((source,n)=>{const target=indices[(n+ori)%width];return text[target]==='*'||text[target]===solved[source];}))out.push({piece,ori});
        }
        return out;
      });
      const order=slots.map((_,i)=>i).sort((a,b)=>candidates[a].length-candidates[b].length);
      const orderParity=parity(order),failed=new Set(),result=Array(slots.length);
      function search(depth,used,sum,inv) {
        if(depth===slots.length)return sum===0&&(inv^orderParity)===wantedParity;
        const key=used+','+sum+','+inv;if(failed.has(key))return false;
        const slot=order[depth];
        for(const c of candidates[slot]){
          if(used&(1<<c.piece))continue;
          let added=0;for(let p=c.piece+1;p<slots.length;p++)if(used&(1<<p))added^=1;
          result[slot]=c;
          if(search(depth+1,used|(1<<c.piece),(sum+c.ori)%width,inv^added))return true;
        }
        failed.add(key);return false;
      }
      return search(0,0,0,0)?result:null;
    }
    for(let p=0;p<2;p++){
      const corners=group(cornerSlots,p);if(!corners)continue;
      const edges=group(edgeSlots,p);if(!edges)continue;
      const cube=new Cube();cube.cp=corners.map(c=>c.piece);cube.co=corners.map(c=>c.ori);cube.ep=edges.map(c=>c.piece);cube.eo=edges.map(c=>c.ori);
      const completed=cube.asString();
      if([...text].some((c,i)=>c!=='*'&&c!==completed[i]))throw Error('无法匹配非黑色格子，请核对填色。');
      return validate(completed,Cube);
    }
    throw Error('这些非黑色格子无法通过真实魔方转动同时还原。请检查填色，或将不关心的格子涂黑。');
  }
  const geom=faces.flatMap(f=>Array.from({length:9},(_,i)=>geometry(f,i)));
  const positionKey=(p,n)=>p.join(',')+'|'+n.join(',');
  const positions=new Map(geom.map((g,i)=>[positionKey(g.p,g.n),i]));
  function quarter(v,axis,sign) {
    const [x,y,z]=v;return axis==='X'?[x,-sign*z,sign*y]:axis==='Y'?[sign*z,y,-sign*x]:[-sign*y,sign*x,z];
  }
  const permutations=Object.fromEntries(faces.map(face=>{
    const t=turns[face],axis={X:0,Y:1,Z:2}[t.axis],permutation=geom.map((_,i)=>i);
    geom.forEach((g,i)=>{if(g.p[axis]===t.layer)permutation[positions.get(positionKey(quarter(g.p,t.axis,-t.layer),quarter(g.n,t.axis,-t.layer)))]=i;});
    return [face,permutation];
  }));
  function applyMove(text,move) {
    const permutation=permutations[move[0]],count=move.endsWith('2')?2:move.endsWith("'")?3:1;
    for(let n=0;n<count;n++)text=permutation.map(i=>text[i]).join('');
    return text;
  }
  // A small search handles simple partial goals without unnecessarily solving hidden colors.
  function shortPatternSolution(text,maxDepth=3) {
    function visit(state,left,last,path){
      if(isPatternSolved(state))return path;
      if(!left)return null;
      for(const f of faces){if(f===last)continue;for(const suffix of ['',"'",'2']){
        const move=f+suffix,result=visit(applyMove(state,move),left-1,f,[...path,move]);if(result)return result;
      }}
      return null;
    }
    for(let d=0;d<=maxDepth;d++){const found=visit(text,d,'',[]);if(found)return found;}
    return null;
  }
  function describe(move) {
    const f=move[0],t=turns[f],amount=move.endsWith('2')?2:move.endsWith("'")?-1:1;
    return {...t,face:f,amount,title:`${t.axis} 轴 · ${names[f]}层 · ${Math.abs(amount)===2?'180°':amount<0?'逆时针 90°':'顺时针 90°'}`,detail:`正对${names[f]}面（${f}）观察，只转动${names[f]}侧一层。`};
  }
  const api={faces,names,turns,validate,geometry,describe,isPatternSolved,validatePattern,completePattern,applyMove,shortPatternSolution};
  if(typeof module!=='undefined')module.exports=api;else root.CubeCore=api;
})(typeof self!=='undefined'?self:globalThis);
