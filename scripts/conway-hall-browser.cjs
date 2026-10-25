// Actual resource controls at an APK-style loopback path, production bridge JS + native stub.
// Chromium is not Android WebView/SAF, physical device, or offline cold-start evidence.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../evidence/c2-browser');fs.mkdirSync(out,{recursive:true});
 const {mime,assetName}=await import('./resource-protocol.mjs');let entries;
 if(process.argv[2]==='--candidate'){
  const {readStoredZip}=await import('./resource-bundle.mjs'),games=JSON.parse(fs.readFileSync(path.join(root,'.build/resource-candidate/games.unsigned.json'))),game=games.find(g=>g.id==='conway');
  entries=new Map(readStoredZip(fs.readFileSync(path.join(root,'.build/resource-candidate',assetName(game)))).map(e=>[e.path,e.data]));
 }else if(process.argv[2]==='--integration'){
  const directory=path.resolve(root,'../source-validation/conway-life-game');
  const {integrateConwayResource}=await import('./conway-resource-integration.mjs');
  integrateConwayResource({id:'conway',revision:'a531a560b3ecce070be80fb6470cbc916971bce4',resourceIntegration:'conway-v2-world-archive-v1',repository:'https://github.com/xiaoxuhui/conway-life-game.git'},directory);
  entries=new Map();for(const name of fs.readdirSync(directory,{recursive:true})){const full=path.join(directory,name);if(fs.statSync(full).isFile()&&!name.startsWith('.git'))entries.set(name.replaceAll('\\','/'),fs.readFileSync(full));}
 }else throw Error('Use --integration once on pristine independent source, or --candidate');
 const kt=fs.readFileSync(path.join(root,'android/app/src/main/java/com/xiaoxuhui/gamehub/MainActivity.kt'),'utf8'),bridge=kt.match(/private val EXPORT_BRIDGE_JS = """([\s\S]*?)"""\.trimIndent\(\)/)[1].replaceAll('__BRIDGE__','GameHubBridge');
 const prefix='/assets/games/conway/';
 const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),name=u.pathname.slice(prefix.length),data=u.pathname.startsWith(prefix)&&entries.get(name);if(!data){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime(name),'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'"});res.end(data);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),errors=[],external=[];let checks=0;
 const fixture=(rule='B36/S23',generation=42)=>({format:'conway-life-game',version:2,generation,alive:[[0,0],[0,1],[1,0]],view:{centerRow:3.5,centerColumn:-4.25,cellSize:12},rule});
 const old=require('../tests/fixtures/conway-reader-7d857.cjs');
 try{for(const [label,viewport,mobile]of [['desktop',{width:1440,height:1000},false],['phone',{width:390,height:844},true]]){
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.protocol==='blob:')return route.continue();if(u.origin!==origin||!u.pathname.startsWith(prefix)){external.push(u.href);return route.abort();}return route.continue();});
  await page.addInitScript({content:'window.__exports=[];window.GameHubBridge={saveFile:(name,text)=>{window.__exports.push({name,text});return true;}};\n'+bridge});
  await page.goto(origin+prefix+'index.html');await page.waitForSelector('#hubWorldBackupsButton');await page.evaluate(()=>localStorage.setItem('other-game.sentinel','keep'));
  const activate=async selector=>mobile?page.locator(selector).tap():page.locator(selector).click();
  const check=async(name,fn)=>{await fn();console.log(`PASS C${++checks} ${label} ${name}`);};
  const importFile=async data=>page.locator('#importInput').setInputFiles({name:'world.json',mimeType:'application/json',buffer:Buffer.from(typeof data==='string'?data:JSON.stringify(data))});
  const generation=async expected=>page.waitForFunction(value=>document.getElementById('generationValue').textContent.replaceAll(',','')===String(value),expected);
  const exportFile=async accept=>{const before=await page.evaluate(()=>__exports.length);page.once('dialog',dialog=>accept?dialog.accept():dialog.dismiss());await activate('#exportButton');await page.waitForFunction(n=>__exports.length>n,before);return JSON.parse(await page.evaluate(()=>__exports.at(-1).text));};
  await check('new rule UI imports and exports legal old v2 base through production bridge stub',async()=>{
   await importFile(fixture());await generation(42);assert.equal(await page.locator('#activeRule').textContent(),'B36/S23');const saved=await exportFile(true);assert.equal(saved.version,2);assert.equal(saved.rule,'B36/S23');assert.equal(old.deserialize(saved).generation,42);assert.equal(old.deserialize(saved).view.centerRow,3.5);
  });
  await check('nondefault export cancellation preserves world and produces no download',async()=>{const before=await page.evaluate(()=>__exports.length);page.once('dialog',d=>d.dismiss());await activate('#exportButton');await page.waitForFunction(()=>!document.querySelector('dialog[aria-label="正在处理世界存档"]').open);assert.equal(await page.evaluate(()=>__exports.length),before);await generation(42);assert.equal(await page.locator('#activeRule').textContent(),'B36/S23');});
  await check('same-base different-rule backups offer every explicit choice and cancel preserves world',async()=>{
   await importFile(fixture('B2/S'));await generation(42);
   const base=fixture();delete base.rule;await importFile(base);const dialog=page.getByRole('dialog',{name:'正在处理世界存档'});
   await dialog.getByRole('button',{name:/恢复 B36\/S23/}).first().waitFor();
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('conway-hub-world-archive-v1')).entries);
   for(const rule of ['B36/S23','B2/S'])assert.equal(await dialog.getByRole('button',{name:new RegExp('恢复 '+rule)}).count(),saved.filter(entry=>entry.rule===rule).length);
   await page.keyboard.press('ArrowRight');await page.keyboard.press('c');assert.equal(await page.locator('#generationValue').textContent(),'42');
   await dialog.getByRole('button',{name:'取消导入'}).click();assert.equal(await page.locator('#activeRule').textContent(),'B2/S');
   await importFile(base);await dialog.getByRole('button',{name:/恢复 B36\/S23/}).first().click();await page.waitForFunction(()=>document.getElementById('activeRule').textContent==='B36/S23'&&!document.querySelector('dialog[aria-label="正在处理世界存档"]').open);
  });
  await check('changed legacy base needs explicit default-rule acknowledgement; cancel protects full world',async()=>{
   const base=fixture(undefined,43);delete base.rule;page.once('dialog',d=>d.dismiss());await importFile(base);await page.waitForFunction(()=>!document.querySelector('dialog[aria-label="正在处理世界存档"]').open);await generation(42);
   page.once('dialog',d=>d.accept());await importFile(base);await generation(43);assert.equal(await page.locator('#activeRule').textContent(),'B3/S23');
  });
  await check('invalid new world is rejected before replacing current state',async()=>{await importFile({version:99});await page.waitForTimeout(100);await generation(43);assert.equal(await page.locator('#activeRule').textContent(),'B3/S23');});
  await check('backup manager exports complete raw collection and restores a chosen full rule',async()=>{
   await activate('#hubWorldBackupsButton');const panel=page.getByRole('dialog',{name:'完整世界备份'});await panel.getByRole('button',{name:'恢复此份'}).first().waitFor();const count=await page.evaluate(()=>__exports.length);await panel.getByRole('button',{name:'导出全部备份原文'}).click();await page.waitForFunction(n=>__exports.length>n,count);const archive=JSON.parse(await page.evaluate(()=>__exports.at(-1).text));assert.ok(archive.entries.length>=3);assert.ok(archive.entries.some(e=>e.rule==='B2/S'));
   const row=panel.locator('.hub-backup-row').filter({hasText:'B2/S'}).first();await row.getByRole('button',{name:'恢复此份'}).click();await generation(42);assert.equal(await page.locator('#activeRule').textContent(),'B2/S');
  });
  await check('quota failure cancellation preserves board, rule, generation, view and raw archive',async()=>{
   const raw=await page.evaluate(()=>localStorage.getItem('conway-hub-world-archive-v1'));
   await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='conway-hub-world-archive-v1')throw Error('injected quota');return original.call(this,k,v);};});
   page.once('dialog',d=>d.dismiss());await importFile(fixture('B3/S23',77));await page.waitForFunction(()=>!document.querySelector('dialog[aria-label="正在处理世界存档"]').open);await generation(42);assert.equal(await page.locator('#activeRule').textContent(),'B2/S');assert.equal(await page.evaluate(()=>localStorage.getItem('conway-hub-world-archive-v1')),raw);
   const exported=await exportFile(true);assert.equal(exported.generation,42);assert.equal(exported.view.centerRow,3.5);assert.equal(exported.rule,'B2/S');
  });
  await check('backup collection file control imports raw archives and rejects bad collection without replacing originals',async()=>{
   const raw=await page.evaluate(()=>localStorage.getItem('conway-hub-world-archive-v1'));
   await activate('#hubWorldBackupsButton');const panel=page.getByRole('dialog',{name:'完整世界备份'});
   await panel.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":99}')});await panel.getByRole('status').filter({hasText:'版本或数量无效'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('conway-hub-world-archive-v1')),raw);
   await panel.locator('input[type=file]').setInputFiles({name:'archive.json',mimeType:'application/json',buffer:Buffer.from(raw)});await panel.getByRole('status').filter({hasText:'已合并'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('conway-hub-world-archive-v1')),raw);await panel.getByRole('button',{name:'关闭',exact:true}).click();
  });
  await check('reload keeps raw backups, corrupt archive stays exportable and unrelated key survives confirmed clear',async()=>{
   await page.reload();await page.waitForSelector('#hubWorldBackupsButton');await page.evaluate(()=>localStorage.setItem('conway-hub-world-archive-v1','{broken'));
   await activate('#hubWorldBackupsButton');const panel=page.getByRole('dialog',{name:'完整世界备份'});await panel.getByRole('status').filter({hasText:'无法读取列表'}).waitFor();const count=await page.evaluate(()=>__exports.length);await panel.getByRole('button',{name:'导出全部备份原文'}).click();await page.waitForFunction(n=>__exports.length>n,count);assert.equal(await page.evaluate(()=>__exports.at(-1).text),'{broken');
   page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:'清理本游戏完整备份'}).click();await panel.getByRole('status').filter({hasText:'已清理'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('conway-hub-world-archive-v1')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('other-game.sentinel')),'keep');
   await page.screenshot({path:path.join(out,label+'-backups.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await panel.getByRole('button',{name:'关闭',exact:true}).click();
  });
  await check('storage denial still allows game evolution and manual export after explicit backup failure',async()=>{
   await page.addInitScript(()=>{const original=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k==='conway-hub-world-archive-v1')throw Error('injected denial');return original.call(this,k);};});await page.reload();await page.waitForSelector('#hubWorldBackupsButton');page.once('dialog',d=>d.accept());await importFile(fixture('B3/S23',9));await generation(9);await activate('#stepButton');await generation(10);const before=await page.evaluate(()=>__exports.length);await activate('#exportButton');await page.waitForFunction(n=>__exports.length>n,before);assert.equal(JSON.parse(await page.evaluate(()=>__exports.at(-1).text)).generation,10);
  });
  await page.screenshot({path:path.join(out,label+'-world.png'),fullPage:true});await context.close();
  await check('empty world with custom rule/generation/view is backed up before replacement and remains manually exportable',async()=>{
   const extra=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile}),empty=await extra.newPage();
   empty.on('pageerror',error=>errors.push(error.message));
   await extra.route('**/*',route=>{const u=new URL(route.request().url());if(u.protocol==='blob:')return route.continue();if(u.origin!==origin||!u.pathname.startsWith(prefix)){external.push(u.href);return route.abort();}return route.continue();});
   await empty.addInitScript({content:'window.__exports=[];window.GameHubBridge={saveFile:(name,text)=>{window.__exports.push({name,text});return true;}};\n'+bridge});
   try {
    await empty.goto(origin+prefix+'index.html');await empty.waitForSelector('#hubWorldBackupsButton');
    const emptyWorld={...fixture('B36/S23',63),alive:[]};
    const load=async value=>empty.locator('#importInput').setInputFiles({name:'world.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
    await load(emptyWorld);await empty.waitForFunction(()=>document.getElementById('generationValue').textContent==='63'&&!document.querySelector('dialog[aria-label="正在处理世界存档"]').open);
    await empty.locator('#zoomInButton').click();
    const before=await empty.evaluate(()=>({rule:document.getElementById('activeRule').textContent,generation:document.getElementById('generationValue').textContent,zoom:document.getElementById('zoomValue').textContent}));
    await load(fixture('B3/S23',64));await empty.waitForFunction(()=>document.getElementById('generationValue').textContent==='64'&&!document.querySelector('dialog[aria-label="正在处理世界存档"]').open);
    const saved=await empty.evaluate(()=>JSON.parse(localStorage.getItem('conway-hub-world-archive-v1')).entries);
    const kept=saved.find(entry=>entry.aliveCount===0&&entry.rule==='B36/S23'&&entry.generation===63&&JSON.parse(entry.fullText).view.cellSize!==12);
    assert.ok(kept,'empty current world including changed view must survive replacement');
    await load(JSON.parse(kept.fullText));await empty.waitForFunction(()=>document.getElementById('generationValue').textContent==='63'&&!document.querySelector('dialog[aria-label="正在处理世界存档"]').open);
    assert.equal(await empty.locator('#zoomValue').textContent(),before.zoom);
    await empty.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='conway-hub-world-archive-v1')throw Error('injected empty quota');return original.call(this,k,v);};});
    empty.once('dialog',d=>d.dismiss());await load(fixture('B3/S23',65));await empty.waitForFunction(()=>!document.querySelector('dialog[aria-label="正在处理世界存档"]').open);assert.equal(await empty.locator('#generationValue').textContent(),'63');assert.equal(await empty.locator('#activeRule').textContent(),before.rule);assert.equal(await empty.locator('#zoomValue').textContent(),before.zoom);
    await empty.evaluate(()=>{const original=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k==='conway-hub-world-archive-v1')throw Error('injected empty denial');return original.call(this,k);};});
    assert.equal(await empty.locator('#exportButton').isEnabled(),true,'empty custom world must have a manual export route');
    empty.once('dialog',d=>d.accept());await empty.locator('#exportButton').click();await empty.waitForFunction(()=>__exports.length>0);
    const exported=JSON.parse(await empty.evaluate(()=>__exports.at(-1).text));assert.deepEqual(exported.alive,[]);assert.equal(exported.rule,'B36/S23');assert.equal(exported.generation,63);assert.equal(exported.view.cellSize,JSON.parse(kept.fullText).view.cellSize);assert.equal(old.deserialize(exported).generation,63);
   }finally{await extra.close();}
  });
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(`PASS ${checks} actual Conway resource-control checks; pageerrors=0 external=0; physical device/SAF not claimed`);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
