'use strict';
// The challenge reads the active picture without changing existing projects.
(() => {
  const puzzles = [
    {name:'十字', rows:['.#.','###','.#.']},
    {name:'小房子', rows:['.#.','###','#.#']},
    {name:'笑脸', rows:['#...#','.....','#...#','.###.']},
    {name:'小爱心', rows:['.#.#.','#####','.###.','..#..']}
  ];
  let selected=0;
  const button=document.createElement('button');button.type='button';button.textContent='像素挑战';button.title='打开像素图案挑战';
  document.querySelector('.file-actions').append(button);
  const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','像素图案挑战');
  dialog.style.cssText='max-width:min(30rem,90vw);padding:1.4rem;border:1px solid #ddd;border-radius:1rem;color:#211d34;background:#fff';
  dialog.innerHTML='<h2>像素图案挑战</h2><p>在当前帧画出下图，颜色和位置不限。其他像素会影响评分；可先用“新建”建立空白项目。</p><label>关卡 <select></select></label><pre aria-label="目标图案" style="font-size:1.4rem;line-height:1.1;letter-spacing:.3rem"></pre><p role="status" aria-live="polite"></p><button type="button" data-check>检查图案</button> <button type="button" data-close>返回画布</button>';
  document.body.append(dialog);const select=dialog.querySelector('select'),target=dialog.querySelector('pre'),status=dialog.querySelector('[role=status]');
  for(const [i,p] of puzzles.entries()){const option=document.createElement('option');option.value=String(i);option.textContent=p.name;select.append(option)}
  function drawTarget(){const p=puzzles[selected];target.textContent=p.rows.map(row=>[...row].map(c=>c==='#'?'■':'·').join('')).join('\n');status.textContent=''}
  function normalize(points){if(!points.length)return '';let minX=Infinity,minY=Infinity;for(const [x,y] of points){minX=Math.min(minX,x);minY=Math.min(minY,y)}return points.map(([x,y])=>`${x-minX},${y-minY}`).sort().join(';')}
  select.addEventListener('change',()=>{selected=Number(select.value);drawTarget()});
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());button.addEventListener('click',()=>{drawTarget();dialog.showModal()});
  dialog.querySelector('[data-check]').addEventListener('click',()=>{const wanted=[];puzzles[selected].rows.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='#')wanted.push([x,y])}));const pixels=framePixels(current()),actual=Array.from(pixels.keys(),v=>v.split(',').map(Number));status.textContent=normalize(actual)===normalize(wanted)?'挑战成功！图案完全一致。':`继续加油：目标 ${wanted.length} 格，当前 ${actual.length} 格。`;});
})();
