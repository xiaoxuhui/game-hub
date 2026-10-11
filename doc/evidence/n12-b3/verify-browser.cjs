const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/25133/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const task='D:/soft/.ci-tmp/game-hub-n12',root=task+'/work',evidence=task+'/evidence/browser';fs.mkdirSync(evidence,{recursive:true});
 const {readStoredZip}=await import(pathToFileURL(root+'/scripts/resource-bundle.mjs'));
 const {mime}=await import(pathToFileURL(root+'/scripts/resource-protocol.mjs'));
 const oldRoot='D:/soft/game-hub-archives/n10-20261010/candidates';
 const gameSets={};
 for(const [id,kind] of [['conway','resource-candidate'],['abelian-sandpile','dynamic-candidate']]){
  const oldFile=fs.readdirSync(oldRoot+'/'+kind).find(n=>n.startsWith('game-'+id+'-'));
  const newFile=fs.readdirSync(root+'/.build/'+kind).find(n=>n.startsWith('game-'+id+'-'));
  const unpack=file=>new Map(readStoredZip(fs.readFileSync(file)).map(e=>[e.path,e.data]));
  gameSets[id]={old:unpack(oldRoot+'/'+kind+'/'+oldFile),new:unpack(root+'/.build/'+kind+'/'+newFile),current:'old'};
 }
 const server=http.createServer((req,res)=>{
  const pieces=new URL(req.url,'http://local').pathname.slice(1).split('/');const id=pieces.shift();
  const name=pieces.join('/')||'index.html',data=gameSets[id]?.[gameSets[id].current].get(name);
  if(!data){res.writeHead(404);res.end('not found');return;}
  res.writeHead(200,{'Content-Type':mime(name),'Cache-Control':'no-store'});res.end(data);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});const results=[];
 try{
 for(const size of [{name:'desktop',width:1280,height:900},{name:'mobile',width:390,height:844}]){
  for(const id of ['conway','abelian-sandpile']){
   gameSets[id].current='old';const context=await browser.newContext({viewport:{width:size.width,height:size.height},hasTouch:size.name==='mobile',acceptDownloads:true});
   const page=await context.newPage(),errors=[],httpErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)httpErrors.push(r.url());});
   await page.goto(base+'/'+id+'/');
   await page.evaluate(()=>localStorage.setItem('__n12_unrelated','preserve'));
   if(id==='conway'){
    const timestamp='2026-10-12T00:00:00.000Z';
    const library={format:'conway-life-pattern-library',version:1,patterns:[{id:'custom-n12-old',name:'N12旧方块',description:'旧资源真实导入',width:2,height:2,cells:[[0,0],[0,1],[1,0],[1,1]],createdAt:timestamp,updatedAt:timestamp}]};
    await page.locator('#importPatternsInput').setInputFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(library))});
    await page.locator('#confirmImportPatternsButton').click();
    const functions={format:'conway-life-logic-function-library',version:2,functions:[{id:'function-n12-old',name:'OLD',code:'AND(A,B)',inputs:[{name:'A',defaultValue:1},{name:'B',defaultValue:0}],createdAt:timestamp,updatedAt:timestamp}]};
    await page.locator('#importLogicFunctionsInput').setInputFiles({name:'functions.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(functions))});
    await page.locator('#confirmImportLogicFunctionsButton').click();
    const saved=await page.evaluate(()=>[localStorage.getItem('conway-life-game.custom-patterns.v1'),localStorage.getItem('conway-life-game.logic-functions.v1')]);
    assert.ok(saved.every(Boolean));
    gameSets[id].current='new';await page.reload();
    assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('conway-life-game.custom-patterns.v1'),localStorage.getItem('conway-life-game.logic-functions.v1')]),saved);
    assert.equal(await page.locator('#presetSelect option[value="custom:custom-n12-old"]').textContent(),'N12旧方块');
    // Emulate the actual WebView lack of the optional browser file API; not a success stub.
    await page.evaluate(()=>{window.showDirectoryPicker=undefined;window.showSaveFilePicker=undefined;});
    await page.locator('#exportDeleteAllRecordsButton').click();
    await page.waitForFunction(()=>document.getElementById('exportAllRecordsError').textContent.includes('不支持'));
    assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('conway-life-game.custom-patterns.v1'),localStorage.getItem('conway-life-game.logic-functions.v1')]),saved);
    const newer=structuredClone(library);newer.patterns[0].id='custom-n12-import';newer.patterns[0].name='N12新增方块';
    await page.locator('#importAllRecordsInput').setInputFiles({name:'new.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(newer))});
    await page.locator('#confirmImportAllRecordsButton').click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('conway-life-game.custom-patterns.v1')).patterns.length===2);
    const downloadPromise=page.waitForEvent('download');await page.locator('#exportPatternsButton').click();const download=await downloadPromise;
    const file=path.join(evidence,`${size.name}-patterns.json`);await download.saveAs(file);
    assert.equal(JSON.parse(fs.readFileSync(file)).patterns.length,2);
    await page.locator('#stepButton').click();assert.equal(await page.locator('#generationValue').textContent(),'1');
   }else{
    await page.waitForSelector('html[data-ready="true"]');
    await page.locator('#amount').fill('7');await page.locator('#amount').dispatchEvent('change');
    await page.locator('#main-board').click();await page.waitForFunction(()=>SandpileApp.snapshot().experiment.state.added===7);
    await page.waitForFunction(()=>!!localStorage.getItem('abelian-sandpile.experiment.v1'));
    const before=await page.evaluate(()=>SandpileApp.snapshot());
    gameSets[id].current='new';await page.reload();await page.waitForSelector('html[data-ready="true"]');
    const after=await page.evaluate(()=>SandpileApp.snapshot());assert.deepEqual(after,before);
    await page.locator('#pour-interval').fill('250');await page.locator('#pour-interval').dispatchEvent('change');
    assert.equal(await page.locator('#pour-interval').evaluate(e=>e.checkValidity()),true);
    await page.locator('#repeat-drop').click();await page.waitForFunction(()=>SandpileApp.snapshot().experiment.state.added>=14);
    assert.equal(await page.evaluate(()=>SandpileApp.pouring.interval),250);
    await page.locator('#repeat-drop').click();assert.equal(await page.evaluate(()=>SandpileApp.pouring),null);
    await page.locator('#pour-interval').fill('');await page.locator('#repeat-drop').click();assert.equal(await page.evaluate(()=>SandpileApp.pouring),null);
    await page.locator('#pour-interval').fill('251');await page.locator('#repeat-drop').click();await page.waitForFunction(()=>!!SandpileApp.pouring);await page.locator('#repeat-drop').click();
   }
   assert.equal(await page.evaluate(()=>localStorage.getItem('__n12_unrelated')),'preserve');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:path.join(evidence,`${size.name}-${id}.png`),fullPage:true});
   assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);
   results.push({id,viewport:size.name,status:'PASS',pageErrors:errors,httpErrors});await context.close();
  }
 }
 fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({browser:browser.version(),results},null,2));console.log(JSON.stringify(results));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
