const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
const root=path.resolve(__dirname,'..');
const old=execFileSync('git',['show','64c8932af9a0b5cc886db25910b3923a16aa0677:examples/lambda-diagram-game/lambda-lab.html'],{cwd:root,maxBuffer:2000000});
const latest=fs.readFileSync(path.join(root,'examples/lambda-diagram-game/lambda-lab.html'));
const oldAuto='lambda-lab-v2',oldCp='lambda-lab-checkpoint-v2',auto='lambda-lab-hub-v3',cp='lambda-lab-hub-checkpoint-v3';
const server=http.createServer((req,res)=>res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'}).end(req.url.startsWith('/old')?old:latest));
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await pw.chromium.launch({headless:true});let count=0;const errors=[];
 try{
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:true,acceptDownloads:true}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const check=async(label,fn)=>{await fn();console.log(`PASS H${++count} ${width}px ${label}`);};
  const source=async(text)=>{await page.locator('#expression').fill(text);await page.locator('#convert').click();};
  const current=()=>page.locator('#current-expression').textContent();
  let originalArchive;
  const legacyContext=await browser.newContext(),legacyPage=await legacyContext.newPage();
  await legacyPage.goto(base+'/old');await legacyPage.locator('#function-name').fill('ID');await legacyPage.locator('#function-source').fill('λx.x');await legacyPage.locator('#function-add').click();
  await legacyPage.locator('#expression').fill('(λx.x) ((λy.y) z)');await legacyPage.locator('#convert').click();await legacyPage.locator('#step').click();await legacyPage.locator('#save-state').click();await legacyPage.waitForTimeout(400);
  const legacyValues=await legacyPage.evaluate(()=>({auto:localStorage.getItem('lambda-lab-v2'),checkpoint:localStorage.getItem('lambda-lab-checkpoint-v2')}));await legacyContext.close();
  await page.addInitScript(values=>{if(!sessionStorage.getItem('__lambda_legacy_seeded')){localStorage.setItem('lambda-lab-v2',values.auto);localStorage.setItem('lambda-lab-checkpoint-v2',values.checkpoint);sessionStorage.setItem('__lambda_legacy_seeded','1');}},legacyValues);
  await page.goto(base+'/new');
  await check('legacy progress and checkpoint migrate to manual restore with originals archived',async()=>{
   assert.equal(await current(),'(λx.x) (λy.y)');assert.equal(await page.locator('#step-count').textContent(),'0');assert.equal(await page.locator('#function-count').textContent(),'0 个函数');
   const status=await page.evaluate(()=>({storage:document.getElementById('storage-status').textContent,feedback:document.getElementById('save-feedback').textContent,dialog:document.getElementById('lambda-c5-review')?.textContent}));assert.equal(await page.locator('#restore-state').isEnabled(),true,`old saved state must be available for manual restore after migration: ${JSON.stringify(status)}`);await page.locator('#restore-state').click();assert.equal(await current(),'(λy.y) z');assert.equal(await page.locator('#step-count').textContent(),'1');assert.equal(await page.locator('#function-count').textContent(),'1 个函数');
   const data=await page.evaluate(({oldAuto,oldCp,auto,cp})=>({a:localStorage.getItem(oldAuto),c:localStorage.getItem(oldCp),n:localStorage.getItem(auto),nc:localStorage.getItem(cp),archive:localStorage.getItem('lambda-lab-hub-c5-conflict-archive-v1')}),{oldAuto,oldCp,auto,cp});
   assert.ok(JSON.parse(data.n).session);assert.ok(JSON.parse(data.nc));originalArchive=data.archive;
   const archived=JSON.parse(originalArchive).entries.map(entry=>entry.snapshot);assert.ok(archived.some(snapshot=>snapshot[oldAuto]===legacyValues.auto&&snapshot[oldCp]===legacyValues.checkpoint),`the C5 archive must retain exact original v2 bytes; captured lengths=${legacyValues.auto?.length}/${legacyValues.checkpoint?.length}; archived=${JSON.stringify(archived.map(snapshot=>[snapshot[oldAuto]===legacyValues.auto,snapshot[oldCp]===legacyValues.checkpoint,Object.keys(snapshot).filter(key=>key.includes('lambda-lab-v2')||key.includes('checkpoint-v2'))]))}`);
   await page.evaluate(()=>localStorage.setItem('other-game-sentinel','safe'));
  });
  let newSave;
  await check('manual restore, original function source and reduction history survive reload',async()=>{
   await page.locator('#function-name').fill('RAW');await page.locator('#function-source').fill('ID 3');await page.locator('#function-add').click();
   await source('(λa.a) u ((λb.b) v)');await page.locator('#step').click();assert.equal(await current(),'u ((λb.b) v)');
   await page.locator('#save-state').click();await page.reload();assert.equal(await current(),'(λx.x) (λy.y)');assert.equal(await page.locator('#step-count').textContent(),'0');
   await page.locator('#restore-state').click();assert.equal(await current(),'u ((λb.b) v)');
   await page.getByRole('button',{name:'编辑函数 RAW',exact:true}).click();assert.equal(await page.locator('#function-source').inputValue(),'ID 3');await page.locator('#function-cancel').click();
   newSave=await page.evaluate(key=>localStorage.getItem(key),auto);assert.equal(JSON.parse(newSave).version,2);assert.equal(JSON.parse(newSave).session.steps,1);
   assert.equal(await page.evaluate(()=>localStorage.getItem('lambda-lab-hub-c5-conflict-archive-v1')),originalArchive);
  });
  await check('separate old reader remains compatible with the latest save projection',async()=>{
   const values=await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),['lambda-lab-v2','lambda-lab-checkpoint-v2']);
   const readerContext=await browser.newContext(),reader=await readerContext.newPage();await reader.addInitScript(values=>{for(const [key,value] of Object.entries(values))if(value!==null)localStorage.setItem(key,value);},values);
   await reader.goto(base+'/old');assert.equal(await reader.locator('#current-expression').textContent(),'u ((λb.b) v)');assert.equal(await reader.locator('#function-count').textContent(),'2 个函数');assert.ok(await reader.locator('#save-feedback').isHidden());await readerContext.close();
  });
  await check('clear exports complete backup and never resurrects old saves or removes other data',async()=>{
   const event=page.waitForEvent('download');await page.locator('#clear-all').click();const file=await (await event).path();const backup=JSON.parse(fs.readFileSync(file));assert.equal(backup.version,2);assert.ok(backup.checkpoint);assert.equal(backup.session.steps,1);
   await page.reload();assert.equal(await page.locator('#expression').inputValue(),'(λx.x) (λy.y)');assert.equal(await page.locator('#function-count').textContent(),'0 个函数');assert.equal(await page.locator('#step-count').textContent(),'0');
   const clearedAuto=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),oldAuto));assert.notEqual(clearedAuto.session.steps,JSON.parse(legacyValues.auto).session.steps,'clear must not resurrect the old reduction history');assert.equal(await page.evaluate(key=>localStorage.getItem(key),oldCp),null);assert.equal(await page.evaluate(()=>localStorage.getItem('lambda-lab-hub-c5-conflict-archive-v1')),originalArchive);assert.equal(await page.evaluate(()=>localStorage.getItem('other-game-sentinel')),'safe');
   await page.locator('#import-file').setInputFiles(file);await page.waitForFunction(()=>document.getElementById('current-expression').textContent==='u ((λb.b) v)');await page.locator('#restore-state').click();assert.equal(await current(),'u ((λb.b) v)');
  });
  await check('native confirmed backup failure preserves state and mobile controls fit',async()=>{
   await page.evaluate(()=>{window.LambdaAndroid={saveFile(){},saveFileConfirmed(){return false;}};});await page.locator('#clear-all').click();assert.equal(await current(),'u ((λb.b) v)');assert.match(await page.locator('#save-feedback').textContent(),/清空未完成/);
   await page.evaluate(()=>{window.LambdaAndroid.saveFileConfirmed=(name,content)=>{window.testNativeBackup=JSON.parse(content);return true;};});await page.locator('#clear-all').click();assert.equal(await page.locator('#expression').inputValue(),'');assert.equal(await page.evaluate(()=>window.testNativeBackup.version),2);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await source('(λa.a) u ((λb.b) v)');await page.locator('#step').click();
   const dir=path.join(root,'doc/evidence/n13-browser');fs.mkdirSync(dir,{recursive:true});await page.locator('.execution-card').screenshot({path:path.join(dir,`lambda-${width}.png`)});
  });
  await context.close();
 }
 const blocked=await browser.newContext(),p=await blocked.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}}));await p.goto(base+'/new');assert.equal(await p.locator('#convert').isEnabled(),true);assert.equal(await p.locator('#restore-state').isEnabled(),false);await blocked.close();console.log(`PASS H${++count} blocked storage retains playable UI`);
 assert.deepEqual(errors,[]);console.log(`Hall Lambda checks: ${count} passed, 0 failed; browser ${browser.version()}; page errors 0.`);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
