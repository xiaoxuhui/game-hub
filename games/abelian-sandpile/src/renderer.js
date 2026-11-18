(function (root) {
  'use strict';
  const colors = ['#203e38', '#d9caa2', '#59a992', '#efad58', '#f06d5e'];
  function draw(canvas, state, selected, allowed = [], wave = null) {
    const size = Math.max(1, canvas.getBoundingClientRect().width), ratio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(size * ratio); canvas.height = canvas.width;
    const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio); const cell = size / state.width;
    ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < state.height; y++) for (let x = 0; x < state.width; x++) {
      const value = state.cells[y * state.width + x]; ctx.fillStyle = colors[Math.min(4, value)];
      ctx.fillRect(x * cell, y * cell, cell + .2, cell + .2);
      if (state.width <= 9) {
        ctx.strokeStyle = '#ffffff26'; ctx.lineWidth = 1; ctx.strokeRect(x * cell, y * cell, cell, cell);
        ctx.fillStyle = value === 0 || value === 2 || value >= 4 ? '#fff' : '#263d34';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `600 ${Math.max(12, cell * .28)}px system-ui`;
        ctx.fillText(String(value), (x + .5) * cell, (y + .5) * cell);
      }
    }
    if(wave)for(const [indices,color,inset]of [[wave.receivers,'#63c3f2',4],[wave.sources,'#e65b44',7],[wave.newlyUnstable,'#a171d4',10]]){
      ctx.strokeStyle=color;ctx.lineWidth=2.5;
      for(const i of indices){const x=i%state.width,y=Math.floor(i/state.width);ctx.strokeRect(x*cell+inset,y*cell+inset,cell-inset*2,cell-inset*2);}
    }
    for (const { x, y } of allowed) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.strokeRect(x * cell + 5, y * cell + 5, cell - 10, cell - 10); ctx.setLineDash([]);
    }
    if (selected) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, Math.min(3, cell / 8));
      ctx.strokeRect(selected.x * cell + 1, selected.y * cell + 1, cell - 2, cell - 2);
    }
  }
  function hit(canvas, state, clientX, clientY) {
    const box = canvas.getBoundingClientRect();
    if (clientX < box.left || clientY < box.top || clientX >= box.right || clientY >= box.bottom) return null;
    return { x: Math.floor((clientX - box.left) / box.width * state.width), y: Math.floor((clientY - box.top) / box.height * state.height) };
  }
  root.SandpileRenderer = Object.freeze({ draw, hit });
})(globalThis);
