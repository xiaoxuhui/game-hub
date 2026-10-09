import { chromium } from 'file:///C:/Users/25133/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const source='D:/soft/.ci-tmp/game-hub-work/v030-final/examples/memory-demo';
const evidence='D:/soft/.ci-tmp/game-hub-work/v030-evidence/v040-resource-update';
const origin='http://127.0.0.1:18404';
const key='memory-demo-state-v1';
const legacy={schemaVersion:1,game:'memory-demo',matched:[],open:[0,1],moves:1,wins:0,complete:false};
const browser=await chromium.launch({executablePath:'C:/Users/25133/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true});
const cases=[], errors=[];
try {
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route(origin+'/**',async route=>{
  const pathname=new URL(route.request().url()).pathname;
  const file=pathname==='/'?'index.html':pathname.slice(1);
  if(!['index.html','app.js','core.js','style.css'].includes(file)){await route.fulfill({status:404,body:''});return;}
  await route.fulfill({status:200,contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'application/javascript; charset=utf-8':'text/css; charset=utf-8',body:readFileSync(join(source,file)),headers:{'Cache-Control':'no-store'}});
 });
 await context.addInitScript(({key,legacy})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(legacy));},{key,legacy});
 const state=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 const focused=()=>page.evaluate(()=>Array.from(document.querySelectorAll('#cards button')).indexOf(document.activeElement));
 const card=i=>page.locator('#cards button').nth(i);
 const focus=i=>card(i).focus();
 const press=key=>page.keyboard.press(key);
 await page.goto(origin+'/');await page.waitForFunction(()=>document.querySelectorAll('#cards button').length===6);
 assert.deepEqual(await state(),legacy);await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#cards button').length===6);assert.deepEqual(await state(),legacy);
 cases.push('real DOM loads and reloads unchanged content-1 schema/moves');
 await page.locator('#restart').click();await focus(0);await press('Enter');assert.equal(await focused(),0);
 await press('Tab');assert.equal(await focused(),1);await press('Space');assert.equal(await focused(),1);assert.equal((await state()).moves,1);
 cases.push('Enter and Space replace card DOM while keeping focus; native Tab reaches next card');
 await press('Home');assert.equal(await focused(),0);await press('End');assert.equal(await focused(),5);await press('ArrowLeft');assert.equal(await focused(),4);await press('ArrowUp');assert.equal(await focused(),1);await press('ArrowDown');assert.equal(await focused(),4);await press('ArrowRight');assert.equal(await focused(),5);
 cases.push('four arrows and Home/End change actual focus without changing saved moves');
 assert.equal((await state()).moves,1);
 await page.locator('#restart').click();await focus(0);await press('Enter');await press('ArrowDown');assert.equal(await focused(),3);await press('Enter');assert.equal(await focused(),4);assert.deepEqual((await state()).matched,[0,3]);assert.equal(await card(0).isDisabled(),true);await press('Home');assert.equal(await focused(),1);
 cases.push('matched disabled cards are skipped and next available card gains focus');
 await page.locator('#restart').click();for(const i of [0,3,1,5,2,4]){await focus(i);await press('Enter');}
 assert.equal(await page.evaluate(()=>document.activeElement.id),'restart');assert.equal((await state()).wins,1);assert.equal((await state()).complete,true);await press('Enter');assert.equal((await state()).wins,1);assert.equal((await state()).moves,0);assert.equal((await state()).complete,false);
 cases.push('complete board moves focus to restart; native Enter restarts and keeps wins');
 await page.locator('#import').setInputFiles({name:'legacy-content-1.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
 await page.waitForFunction(()=>document.getElementById('message').textContent==='已导入并保存存档。');assert.deepEqual(await state(),legacy);
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'memory-demo-save.json');
 const privateFile=join(evidence,'n6-browser-self-generated-export-private.json');await download.saveAs(privateFile);const bytes=readFileSync(privateFile);assert.deepEqual(JSON.parse(bytes),legacy);
 await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#cards button').length===6);assert.deepEqual(await state(),legacy);
 assert.match(await page.locator('main').textContent(),/键盘：用 Tab 或方向键选牌/);
 cases.push('real file input/download and reload preserve content-1 save; new keyboard hint visible');
 await page.screenshot({path:join(evidence,'n6-keyboard-phone.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 const sourceHashes=Object.fromEntries(['app.js','index.html','core.js'].map(name=>[name,createHash('sha256').update(readFileSync(join(source,name))).digest('hex')]));
 const result={browser:await browser.version(),viewport:{width:390,height:844},cases,passed:cases.length,pageErrors:errors,sourceHashes,exportBytes:bytes.length,exportSha256:createHash('sha256').update(bytes).digest('hex'),scope:'Actual Chromium DOM, native keyboard and browser file operations. Own isolated context and exact candidate files served through local request routing; not Android SAF or formal release acceptance.'};
 writeFileSync(join(evidence,'n6-feature-browser-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 await context.close();
} finally {await browser.close();}
