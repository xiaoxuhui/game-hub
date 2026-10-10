import { chromium } from 'file:///C:/Users/25133/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const evidence='D:/soft/.ci-tmp/game-hub-n10/evidence/c1-browser';mkdirSync(evidence,{recursive:true});
const oldHtml=readFileSync('D:/soft/.ci-tmp/game-hub-n10/evidence/old-lambda-0.3.0.html');
const newHtml=readFileSync('D:/soft/.ci-tmp/game-hub-n10/work/examples/lambda-diagram-game/lambda-lab.html');
const browser=await chromium.launch({executablePath:'C:/Users/25133/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true});
const cases=[],errors=[];
try {
 for(const viewport of [{width:390,height:844},{width:1280,height:900}]) {
  const context=await browser.newContext({viewport,hasTouch:viewport.width===390,acceptDownloads:true});const page=await context.newPage();let upgraded=false;
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('http://127.0.0.1:18416/**',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:upgraded?newHtml:oldHtml,headers:{'Cache-Control':'no-store'}}));
  await page.goto('http://127.0.0.1:18416/lambda-lab.html');
  await page.locator('#expression').fill('(λx.x) (λy.y)');await page.locator('#convert').click();await page.locator('#step').click();
  await page.waitForFunction(()=>document.querySelector('#step-count').textContent==='1');await page.locator('#save-state').click();
  const expression=await page.locator('#current-expression').textContent();
  const downloadOld=page.waitForEvent('download');await page.locator('#export-state').click();const oldSave=join(evidence,`own-old-save-${viewport.width}.json`);await (await downloadOld).saveAs(oldSave);
  await page.evaluate(()=>localStorage.setItem('__n10_unrelated_test_key','preserve'));
  upgraded=true;await page.reload();await page.waitForFunction(()=>document.querySelector('#step-count').textContent==='1');
  assert.equal(await page.locator('#current-expression').textContent(),expression);assert.equal(await page.locator('#restore-state').isEnabled(),true);
  await page.locator('#reset').click();await page.waitForFunction(()=>document.querySelector('#step-count').textContent==='0');
  await page.locator('#restore-state').click();await page.waitForFunction(()=>document.querySelector('#step-count').textContent==='1');
  await page.locator('#import-file').setInputFiles(oldSave);await page.waitForFunction(()=>document.querySelector('#step-count').textContent==='1');
  assert.equal(await page.locator('#current-expression').textContent(),expression);
  await page.locator('#save-state').click(); const downloadNew=page.waitForEvent('download');await page.locator('#export-state').click();const newSave=join(evidence,`own-new-save-${viewport.width}.json`);await (await downloadNew).saveAs(newSave);
  const backup=page.waitForEvent('download');await page.locator('#clear-all').click();const backupFile=join(evidence,`own-clear-backup-${viewport.width}.json`);await (await backup).saveAs(backupFile);
  await page.waitForFunction(()=>document.querySelector('#step-count').textContent==='0');assert.equal(await page.evaluate(()=>localStorage.getItem('__n10_unrelated_test_key')),'preserve');
  await page.locator('#import-file').setInputFiles(newSave);await page.waitForFunction(()=>document.querySelector('#step-count').textContent==='1');assert.equal(await page.locator('#current-expression').textContent(),expression);
  assert.equal(await page.locator('#restore-state').isEnabled(),false); await page.locator('#import-file').setInputFiles(backupFile); await page.waitForFunction(()=>!document.querySelector('#restore-state').disabled); assert.equal(await page.locator('#current-expression').textContent(),expression); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#diagram-viewport').scrollIntoViewIfNeeded();await page.screenshot({path:join(evidence,`lambda-${viewport.width}.png`)});
  cases.push({viewport,origin:'http://127.0.0.1:18416',checks:['0.3.0 actual convert/step/checkpoint/export','same-origin 0.3.1 reload restores current frame and old checkpoint','actual old export imports into 0.3.1','new full backup / clear exports first and preserves unrelated storage','new full backup imports and restores current expression'],oldSaveSha256:createHash('sha256').update(readFileSync(oldSave)).digest('hex'),newSaveSha256:createHash('sha256').update(readFileSync(newSave)).digest('hex'),fullBackupSha256:createHash('sha256').update(readFileSync(backupFile)).digest('hex')});
  await context.close();
 }
 assert.deepEqual(errors,[]);writeFileSync(join(evidence,'result.json'),JSON.stringify({browser:browser.version(),cases,pageErrors:errors,boundary:'Fresh desktop Chromium with routed exact frozen HTML, Android formal WebView tested separately'},null,2)+'\n');console.log('PASS two viewports; old/new real saves compatible; pageErrors=0');
} finally {await browser.close()}
