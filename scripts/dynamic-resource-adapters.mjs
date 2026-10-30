const decode = data => Buffer.from(data);
function replaceOnce(text, before, after, label) {
  if (text.split(before).length !== 2) throw new Error(`Dynamic adapter anchor mismatch: ${label}`);
  return text.replace(before, after);
}

function adaptLangtonsAnt(entries) {
  const files = new Map(entries.map(entry => [entry.path, decode(entry.data)]));
  let html = files.get('index.html')?.toString('utf8');
  let app = files.get('src/app.js')?.toString('utf8');
  if (!html || !app) throw new Error('Langton resource entry files missing');
  html = replaceOnce(html,
    '<button id="reset" type="button">重置</button>',
    '<button id="reset" type="button">重置</button>\n          <button id="hubExport" type="button">导出存档</button>\n          <button id="hubImport" type="button">导入存档</button>\n          <input id="hubImportFile" type="file" accept="application/json,.json" aria-label="选择兰顿蚂蚁存档" hidden>',
    'Langton controls');
  html = replaceOnce(html,
    '<script src="src/app.js"></script>',
    `<script src="src/app.js"></script>
  <script>
  (()=>{
    const exportButton=document.getElementById('hubExport'),importButton=document.getElementById('hubImport'),input=document.getElementById('hubImportFile'),status=document.getElementById('saveStatus');
    exportButton.addEventListener('click',()=>{try{const text=window.langtonsAntExport(),blob=new Blob([text],{type:'application/json'});if(blob.size>4*1024*1024)throw Error('存档超过4MiB');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='langtons-ant-save-v1.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='已请求导出存档文件。';}catch(error){status.textContent='导出失败：'+error.message;}});
    importButton.addEventListener('click',()=>input.click());
    input.addEventListener('change',async()=>{const file=input.files&&input.files[0];input.value='';if(!file)return;try{if(file.size>4*1024*1024)throw Error('存档超过4MiB');const candidate=window.AntStorage.decode(await file.text());if(!window.confirm('导入会替换当前画布和蚂蚁状态。继续吗？'))return;window.dispatchEvent(new CustomEvent('langtons-ant-import',{detail:candidate}));}catch(error){status.textContent='导入失败：'+error.message+'；当前画布保持不变。';}});
  })();
  </script>`,
    'Langton script');
  app = replaceOnce(app,
    '  sync();resize();requestAnimationFrame(animate);',
    `  window.langtonsAntExport=()=>S.encode(state,settings);
  window.addEventListener('langtons-ant-import',event=>{const candidate=event.detail;if(!candidate)return;pause();state=candidate.state;settings=candidate.settings;saveBlocked=false;dirty=true;needsDraw=true;applyView();sync();save();});
  sync();resize();requestAnimationFrame(animate);`,
    'Langton import event');
  files.set('index.html', Buffer.from(html)); files.set('src/app.js', Buffer.from(app));
  return [...files].map(([path,data]) => ({path,data}));
}

function adaptTurboWarp(entries) {
  const files = new Map(entries.map(entry => [entry.path, decode(entry.data)]));
  let html = files.get('index.html')?.toString('utf8');
  if (!html) throw new Error('TurboWarp entry page missing');
  html = replaceOnce(html,
    'banner.append(status,restart);',
    `const exportButton=document.createElement('button');exportButton.type='button';exportButton.textContent='导出存档';
  const importButton=document.createElement('button');importButton.type='button';importButton.textContent='导入存档';
  const fileInput=document.createElement('input');fileInput.type='file';fileInput.accept='application/json,.json';fileInput.setAttribute('aria-label','选择项目存档');fileInput.hidden=true;
  banner.append(status,restart,exportButton,importButton,fileInput);`,
    'TurboWarp controls');
  html = replaceOnce(html,
    'window.addEventListener(\'pagehide\',save);',
    `  const downloadState=data=>{const text=JSON.stringify(data,null,2),blob=new Blob([text],{type:'application/json'});if(blob.size>100000)throw Error('存档超过100KiB');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=config.id+'-save-v1.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  exportButton.addEventListener('click',()=>{try{if(!ready||locked)throw Error('项目尚未准备好');downloadState({schemaVersion:1,id:config.id,contract:config.id+'-dynamic-v1',variables:normalized()});status.textContent='已请求导出存档文件。';}catch(error){status.textContent='导出失败：'+error.message;}});
  importButton.addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',async()=>{const file=fileInput.files&&fileInput.files[0];fileInput.value='';if(!file)return;let previous=null;try{if(file.size>100000)throw Error('存档超过100KiB');if(!ready||locked||!idle())throw Error('作品正在初始化或执行，请暂停后再导入');const candidate=codec.parse(await file.text(),config,template);previous={schemaVersion:1,id:config.id,contract:config.id+'-dynamic-v1',variables:normalized()};let recoveryKey=config.id+'.recovery.'+Date.now(),suffix=0;while(localStorage.getItem(recoveryKey)!==null)recoveryKey=config.id+'.recovery.'+Date.now()+'.'+(++suffix);localStorage.setItem(recoveryKey,JSON.stringify(previous));if(vm.runtime.stopAll)vm.runtime.stopAll();await apply(candidate);await settle();last='';locked=false;restart.hidden=true;if(!save())throw Error('新状态未能保存');status.textContent='存档已导入并保存。';}catch(error){if(previous){try{await apply(previous);await settle();last='';save();}catch{locked=true;restart.hidden=false;}}status.textContent='导入失败：'+error.message+'；现有本机存档保留。';}});
  window.addEventListener('pagehide',save);`,
    'TurboWarp file handlers');
  files.set('index.html', Buffer.from(html));
  return [...files].map(([path,data]) => ({path,data}));
}

const adapters = {
  'langtons-ant-file-io-v1': { id: 'langtons-ant', apply: adaptLangtonsAnt },
  'turbowarp-file-io-v1': { id: null, apply: adaptTurboWarp },
};

export function adaptDynamicResource(source, entries) {
  if (!source.resourceIntegration) return entries.map(entry => ({path:entry.path,data:decode(entry.data)}));
  const adapter = adapters[source.resourceIntegration];
  if (!adapter || adapter.id && source.id !== adapter.id || adapter.id === null && !['turbowarp-neural-network','turbowarp-logic-lab'].includes(source.id)) throw new Error('Unreviewed dynamic resource adapter');
  const adapted=adapter.apply(entries);
  if (adapted.map(item=>item.path).sort().join('\0')!==[...source.files].sort().join('\0')) throw new Error('Dynamic adapter changed the locked file set');
  return adapted;
}
