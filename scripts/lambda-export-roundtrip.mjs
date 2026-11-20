/** Include append-only session backups when importing an all-local-data export. */
export function fixLambdaExportRoundTrip(source) {
 let html=source;
 const replace=(a,b)=>{if(html.split(a).length!==2)throw Error('Lambda recovery marker changed: '+a);html=html.replace(a,b)};
 const start='      const keys=Object.keys(archive.storage).filter(key=>';
 const end='        try{const state=S.decodeStartingState(raw);';
 const from=html.indexOf(start),to=html.indexOf(end,from);
 if(from<0||to<0||html.indexOf(start,from+start.length)>=0)throw Error('Lambda raw recovery boundary changed');
 const prior=html.slice(from,to);
 const filter=prior.match(/\.filter\(key=>(\/\^.+?\/\.test\(key\))\);/);
 if(!filter)throw Error('Lambda raw recovery filter changed');
 const replacement=`      const validKey=key=>${filter[1]};
      const entries=[];
      // Expand the immutable archives first, so earlier sessions remain visible
      // even when there are many individual running backups in the export.
      for(const name of Object.keys(archive.storage).filter(k=>/^lambda-hub-session-archive-v1\\.\\d+-[0-9a-f]{24}$/.test(k)).sort().reverse()){
        try{const nested=JSON.parse(archive.storage[name]);
          if(nested?.schemaVersion!==1||nested.type!=='raw-local-storage'||nested.game!=='lambda-diagram-game'||!nested.storage||typeof nested.storage!=='object'||Array.isArray(nested.storage))continue;
          for(const [key,raw] of Object.entries(nested.storage))if(validKey(key))entries.push([name+' / '+key,raw]);
        }catch{/* Invalid nested entries remain untouched in the original file. */}
      }
      for(const [key,raw] of Object.entries(archive.storage))if(validKey(key))entries.push([key,raw]);
      const candidates=[],seen=new Set();let longCount=0;
      for(const [key,raw] of entries.slice(0,128)){
        if(typeof raw!=='string'||seen.has(raw))continue;
`;
 html=html.slice(0,from)+replacement+html.slice(to);
 replace("(keys.length>128?' 仅显示前 128 个相关存储项，其他数据保留在原文件。':'')", "(entries.length>128?' 仅显示前 128 个相关存储项，其他数据保留在原文件。':'')");
 return html;
}
