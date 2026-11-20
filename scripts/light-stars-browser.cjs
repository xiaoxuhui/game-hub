const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const {readStoredZip}=await import('./resource-bundle.mjs'),{assetName,mime}=await import('./resource-protocol.mjs');
 let file=process.env.LIGHT_TEST_ZIP;if(!file){const games=JSON.parse(fs.readFileSync('.build/resource-candidate/games.unsigned.json'));file=path.join('.build/resource-candidate',assetName(games.find(g=>g.id==='light')))}
 const entries=new Map(readStoredZip(fs.readFileSync(file)).map(e=>[e.path,e.data])),prefix='/assets/games/light/';
 const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://127.0.0.1'),name=u.pathname.slice(prefix.length)||'index.html';if(!u.pathname.startsWith(prefix)||!entries.has(name)){res.writeHead(404).end();return}res.writeHead(200,{'Content-Type':mime(name),'Cache-Control':'no-store'}).end(entries.get(name))});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})}),url=`http://127.0.0.1:${server.address().port}${prefix}index.html`;
 try{for(const [label,viewport,mobile] of [['desktop',{width:1280,height:800},false],['phone',{width:390,height:844},true]]){
  const c=await b.newContext({viewport,isMobile:mobile,hasTouch:mobile,acceptDownloads:true}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.waitForFunction(()=>!document.querySelector('#btn-next').disabled);
  const raw=await p.evaluate(()=>localStorage.getItem('light-game/save'));assert.ok(raw,'completed initial level must persist its stars');const saved=JSON.parse(raw);assert.ok(Object.values(saved.stars).includes(3),'initial three stars must be in saved data');
  const first=await p.locator('#level-title').innerText();if(mobile)await p.locator('#btn-next').tap();else await p.locator('#btn-next').click();assert.notEqual(await p.locator('#level-title').innerText(),first);await p.reload();assert.deepEqual(JSON.parse(await p.evaluate(()=>localStorage.getItem('light-game/save'))).stars,saved.stars);
  const external=JSON.stringify({...saved,otherVersionData:{keep:'original'}});await p.evaluate(value=>{localStorage.setItem('light-game/save',value);__lightGame.state.stars={};__lightGame.selectLevel(LightLevels.LEVELS[0].id)},external);
  assert.equal(await p.evaluate(()=>localStorage.getItem('light-game/save')),external);assert.equal(await p.getByRole('button',{name:'导出原始存档'}).isVisible(),true);assert.deepEqual(errors,[]);await c.close();
  for(const unknown of ['{broken',JSON.stringify({schema:'light-game/save',version:99,stars:{},boards:{},snapshots:[]}),JSON.stringify({schema:'light-game/save',version:1,stars:{},boards:{},snapshots:[],future:{value:'keep'}})]){
   const context=await b.newContext({viewport,acceptDownloads:true});await context.addInitScript(value=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('light-game/save',value);sessionStorage.setItem('seeded','1')}},unknown);const page=await context.newPage();await page.goto(url);await page.getByRole('button',{name:'导出原始存档'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('light-game/save')),unknown);
   const event=page.waitForEvent('download');await page.getByRole('button',{name:'导出原始存档'}).click();let exported='';for await(const chunk of await(await event).createReadStream())exported+=chunk;assert.equal(exported,unknown);await page.reload();assert.equal(await page.evaluate(()=>localStorage.getItem('light-game/save')),unknown);await context.close();
  }
  console.log('PASS '+label+' stars persist; corrupt, future and externally changed saves remain exportable and unmodified');
 }}finally{await b.close();server.close()}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
