(function(root){
  const codes={W:'w',R:'r',G:'g',Y:'y',O:'o',B:'b',K:'k','白':'w','红':'r','绿':'g','黄':'y','橙':'o','蓝':'b','黑':'k','*':'k','?':null};
  const output={w:'W',r:'R',g:'G',y:'Y',o:'O',b:'B',k:'K'};
  function parseFace(text,expected){
    const clean=text.toUpperCase().replace(/[\s,，;；|\/]/g,''),out=[];
    if(!clean)throw Error('请填写该面的颜色。');
    let i=0;
    while(i<clean.length){
      const code=clean[i++];if(!Object.hasOwn(codes,code))throw Error(`无法识别“${code}”。请使用 白红绿黄橙蓝黑 或 W/R/G/Y/O/B/K。`);
      let digits='';while(i<clean.length&&/[0-9]/.test(clean[i]))digits+=clean[i++];
      const count=digits?Number(digits):1;
      if(!Number.isSafeInteger(count)||count<1||count>expected)throw Error(`重复数量必须是 1 到 ${expected} 的整数。`);
      if(out.length+count>expected)throw Error(`这个面只需要 ${expected} 格，填写数量过多。`);
      for(let n=0;n<count;n++)out.push(codes[code]);
    }
    if(out.length!==expected)throw Error(`这个面需要 ${expected} 格，目前填写了 ${out.length} 格。`);
    return out;
  }
  function formatFace(stickers,cols){
    const rows=[];for(let i=0;i<stickers.length;i+=cols)rows.push(stickers.slice(i,i+cols).map(c=>output[c]||'?').join(''));return rows.join('\n');
  }
  const api={parseFace,formatFace};if(typeof module!=='undefined')module.exports=api;else root.ColorInput=api;
})(typeof self!=='undefined'?self:globalThis);
