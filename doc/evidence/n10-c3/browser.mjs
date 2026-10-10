import {chromium} from 'file:///C:/Users/25133/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const root='D:/soft/.ci-tmp/game-hub-n10/work',out='D:/soft/.ci-tmp/game-hub-n10/evidence/c3-browser';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Users/25133/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true});
const cases=[],errors=[];
try {
 for(const viewport of [{width:390,height:844},{width:1280,height:900}]) for(const id of ['light','turing']) {
  const context=await browser.newContext({viewport,hasTouch:viewport.width===390,acceptDownloads:true});const page=await context.newPage();let updated=false;
  page.on('pageerror',e=>errors.push(`${id}: ${e.message}`));page.on('dialog',d=>d.accept());
  const origin='http://127.0.0.1:18417';
  await page.route(origin+'/**',async route=>{
   const path=decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
   if(path.includes('..'))return route.fulfill({status:404,body:''});
   const file=join(root,updated?'.build/resource-source-assets/games':'android/app/src/main/assets/games',path);
   if(!existsSync(file))return route.fulfill({status:404,body:''});
   const mime=path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':path.endsWith('.html')?'text/html':'text/plain';
   await route.fulfill({status:200,contentType:mime+'; charset=utf-8',body:readFileSync(file),headers:{'Cache-Control':'no-store'}});
  });
  await page.goto(`${origin}/${id}/index.html`);await page.evaluate(()=>localStorage.setItem('__n10_unrelated_test_key','preserve'));
  if(id==='light') {
   await page.waitForFunction(()=>!!globalThis.__lightGame);
   await page.waitForFunction(()=>globalThis.__lightGame.state.stars.t01===3);
   if(await page.locator('#overlay').isVisible())await page.getByRole('button',{name:'下一关',exact:true}).last().click();
   else await page.locator('#btn-next').click();
   await page.waitForFunction(()=>document.querySelector('#level-title').textContent==='折一下');
   await page.locator('#toolbar button').first().click();
   const canvas=page.locator('#stage');await canvas.scrollIntoViewIfNeeded();
   const point=await page.evaluate(()=>{const c=document.querySelector('#stage'),r=c.getBoundingClientRect();const s=Math.min(r.width/7,r.height/5);return {x:r.width/2,y:r.height/2}});
   await canvas.click({position:point});
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('light-game/save'))?.boards?.t02?.length>0);
   await page.locator('#btn-snapshots').click();await page.getByRole('button',{name:'保存当前布局',exact:true}).click();await page.locator('#snapshot-name').fill('N10旧版真实布局');await page.getByRole('button',{name:'保存',exact:true}).click();
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('light-game/save')));assert.equal(saved.snapshots[0].name,'N10旧版真实布局');
   updated=true;await page.reload();await page.waitForFunction(()=>!!globalThis.LightStorage);
   assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('light-game/save'))),saved);
   if(await page.locator('#overlay').isVisible())await page.getByRole('button',{name:'下一关',exact:true}).last().click();
   await page.locator('#btn-levels').click();await page.getByRole('button',{name:/折一下/}).click();
   await page.locator('#btn-snapshots').click();await page.getByRole('button',{name:/N10旧版真实布局/}).click();
   assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('light-game/save')).boards.t02),saved.boards.t02);
   await page.locator('#btn-clear').click();await page.locator('#btn-clear').click();await page.waitForFunction(()=>!JSON.parse(localStorage.getItem('light-game/save')).boards.t02);await page.locator('#btn-undo').click();
   assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('light-game/save')).boards.t02),saved.boards.t02);
   await page.screenshot({path:join(out,`light-${viewport.width}.png`)});
  } else {
   await page.locator('#input').fill('101101');await page.locator('#apply').click();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('turing-machine-simulator.project.v1'))?.input==='101101');
   const project=await page.evaluate(()=>localStorage.getItem('turing-machine-simulator.project.v1'));
   await page.locator('#step').click();await page.waitForFunction(()=>Number(document.querySelector('#stepCount').textContent)>0);
   await page.goto(`${origin}/${id}/campaign.html`);await page.locator('#rulesEditor').fill('#N10旧版真实草稿');
   await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('turing-machine-simulator.campaign.v1')).drafts).includes('#N10旧版真实草稿'));
   const campaign=await page.evaluate(()=>localStorage.getItem('turing-machine-simulator.campaign.v1'));
   updated=true;await page.reload();assert.equal(await page.locator('#rulesEditor').inputValue(),'#N10旧版真实草稿');assert.equal(await page.evaluate(()=>localStorage.getItem('turing-machine-simulator.campaign.v1')),campaign);
   await page.goto(`${origin}/${id}/index.html`);assert.equal(await page.locator('#input').inputValue(),'101101');assert.equal(await page.evaluate(()=>localStorage.getItem('turing-machine-simulator.project.v1')),project);
   await page.locator('#step').click();await page.waitForFunction(()=>Number(document.querySelector('#stepCount').textContent)>0);await page.locator('#reset').click();await page.waitForFunction(()=>Number(document.querySelector('#stepCount').textContent)===0);
   await page.screenshot({path:join(out,`turing-${viewport.width}.png`)});
  }
  assert.equal(await page.evaluate(()=>localStorage.getItem('__n10_unrelated_test_key')),'preserve');
  cases.push({id,viewport,origin,checks:id==='light'?['old actual level progress, canvas placement and named snapshot','same-origin new load preserves progress/board/snapshot','new actual snapshot restore and clear/undo']:['old actual input/apply/single step and campaign draft','same-origin new load preserves project and campaign','new actual step and reset'],boundary:'Desktop Chromium with actual frozen bundle bytes; Android formal resource install is a separate gate'});await context.close();
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'result.json'),JSON.stringify({browser:browser.version(),cases,pageErrors:errors},null,2)+'\n');console.log('PASS 4 actual old/new gameplay and save cases');
} finally {await browser.close()}
