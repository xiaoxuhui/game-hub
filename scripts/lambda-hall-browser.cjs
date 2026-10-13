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
  let originalBackup;
  await page.goto(base+'/old');
  await check('old progress and checkpoint migrate while legacy bytes stay preserved',async()=>{
   await page.locator('#function-name').fill('ID');await page.locator('#function-source').fill('λx.x');await page.locator('#function-add').click();
   await source('(λx.x) ((λy.y) z)');await page.locator('#step').click();await page.locator('#save-state').click();
   await page.goto(base+'/new');assert.equal(await current(),'(λy.y) z');assert.equal(await page.locator('#step-count').textContent(),'1');assert.equal(await page.locator('#function-count').textContent(),'1 个函数');
   const data=await page.evaluate(({oldAuto,oldCp,auto,cp})=>({a:localStorage.getItem(oldAuto),c:localStorage.getItem(oldCp),n:localStorage.getItem(auto),nc:localStorage.getItem(cp),backup:localStorage.getItem('lambda-lab-hub-upgrade-backup-v2')}),{oldAuto,oldCp,auto,cp});
   const originals=JSON.parse(data.backup);assert.deepEqual(JSON.parse(data.n).session,JSON.parse(originals.auto).session);assert.equal(data.nc,originals.checkpoint);
   originalBackup=data.backup;await page.evaluate(()=>localStorage.setItem('other-game-sentinel','safe'));
  });
  let newSave;
  await check('full right/applicative/manual history and original function source survive reload',async()=>{
   await page.locator('#function-name').fill('RAW');await page.locator('#function-source').fill('ID 3');await page.locator('#function-add').click();
   await source('(λa.a) u ((λb.b) v)');await page.locator('#reduction-direction').selectOption('right');await page.locator('#reduction-order').selectOption('applicative');await page.locator('#step').click();assert.equal(await current(),'(λa.a) u v');
   await page.locator('#save-state').click();await page.reload();assert.equal(await current(),'(λa.a) u v');assert.equal(await page.locator('#reduction-direction').inputValue(),'right');assert.equal(await page.locator('#reduction-order').inputValue(),'applicative');
   await page.getByRole('button',{name:'编辑函数 RAW',exact:true}).click();assert.equal(await page.locator('#function-source').inputValue(),'ID 3');await page.locator('#function-cancel').click();
   newSave=await page.evaluate(key=>localStorage.getItem(key),auto);assert.equal(JSON.parse(newSave).version,3);assert.deepEqual(JSON.parse(newSave).session.paths,[['arg']]);
   assert.equal(await page.evaluate(()=>localStorage.getItem('lambda-lab-hub-upgrade-backup-v2')),originalBackup);
  });
  await check('old reader reads latest base and old steps merge into full history without dropping extensions',async()=>{
   await page.goto(base+'/old');assert.equal(await current(),'(λa.a) u v');assert.equal(await page.locator('#function-count').textContent(),'2 个函数');assert.ok(await page.locator('#save-feedback').isHidden());
   await page.locator('#step').click();assert.equal(await current(),'u v');await page.locator('#save-state').click();
   await page.goto(base+'/new');assert.equal(await current(),'u v');assert.equal(await page.locator('#step-count').textContent(),'2');assert.equal(await page.locator('#reduction-direction').inputValue(),'right');
   await page.getByRole('button',{name:'编辑函数 RAW',exact:true}).click();assert.equal(await page.locator('#function-source').inputValue(),'ID 3');await page.locator('#function-cancel').click();
   await page.locator('#restore-state').click();assert.equal(await current(),'u v');assert.equal(await page.locator('#step-count').textContent(),'2');
   await page.locator('#back').click();assert.equal(await current(),'(λa.a) u v');await page.locator('#back').click();assert.equal(await current(),'(λa.a) u ((λb.b) v)');await page.locator('[data-redex-hit][aria-label^="点击 λa "]').click();assert.equal(await current(),'u ((λb.b) v)');
  });
  await check('clear exports complete backup and never resurrects old saves or removes other data',async()=>{
   const oldBefore=await page.evaluate(({oldAuto,oldCp})=>[localStorage.getItem(oldAuto),localStorage.getItem(oldCp)],{oldAuto,oldCp});
   const event=page.waitForEvent('download');await page.locator('#clear-all').click();const file=await (await event).path();const backup=JSON.parse(fs.readFileSync(file));assert.equal(backup.version,3);assert.ok(backup.checkpoint);assert.deepEqual(backup.session.paths,[['fn']]);
   await page.reload();assert.equal(await page.locator('#expression').inputValue(),'');assert.equal(await page.locator('#function-count').textContent(),'0 个函数');
   assert.equal(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),oldAuto)).draft,'');assert.equal(await page.evaluate(key=>localStorage.getItem(key),oldCp),null);assert.equal(await page.evaluate(()=>localStorage.getItem('lambda-lab-hub-upgrade-backup-v2')),originalBackup);assert.equal(await page.evaluate(()=>localStorage.getItem('other-game-sentinel')),'safe');
   await page.locator('#import-file').setInputFiles(file);await page.waitForFunction(()=>document.getElementById('current-expression').textContent==='u ((λb.b) v)');await page.locator('#restore-state').click();assert.equal(await current(),'u v');
  });
  await check('native confirmed backup failure preserves state and mobile controls fit',async()=>{
   await page.evaluate(()=>{window.LambdaAndroid={saveFile(){},saveFileConfirmed(){return false;}};});await page.locator('#clear-all').click();assert.equal(await current(),'u v');assert.match(await page.locator('#save-feedback').textContent(),/清空未完成/);
   await page.evaluate(()=>{window.LambdaAndroid.saveFileConfirmed=(name,content)=>{window.testNativeBackup=JSON.parse(content);return true;};});await page.locator('#clear-all').click();assert.equal(await page.locator('#expression').inputValue(),'');assert.equal(await page.evaluate(()=>window.testNativeBackup.version),3);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await source('(λa.a) u ((λb.b) v)');await page.locator('#reduction-direction').selectOption('right');await page.locator('#step').click();
   const dir=path.join(root,'doc/evidence/n13-browser');fs.mkdirSync(dir,{recursive:true});await page.locator('.execution-card').screenshot({path:path.join(dir,`lambda-${width}.png`)});
  });
  await context.close();
 }
 const blocked=await browser.newContext(),p=await blocked.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}}));await p.goto(base+'/new');assert.equal(await p.locator('#convert').isEnabled(),true);assert.match(await p.locator('#storage-status').textContent(),/自动保存不可用/);await blocked.close();console.log(`PASS H${++count} blocked storage retains playable UI`);
 assert.deepEqual(errors,[]);console.log(`Hall Lambda checks: ${count} passed, 0 failed; browser ${browser.version()}; page errors 0.`);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
