import {chromium} from 'file:///C:/Users/25133/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root='D:/soft/.ci-tmp/game-hub-work/v030-final/examples',evidence='D:/soft/.ci-tmp/game-hub-work/v030-evidence/v040-new-games';
const browser=await chromium.launch({executablePath:'C:/Users/25133/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true});
const cases=[],errors=[],summaries=[];
const sha=data=>createHash('sha256').update(data).digest('hex');
try{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,acceptDownloads:true});
  for(const [id,port,entry] of [['abelian-sandpile',18405,'index.html'],['lambda-diagram-game',18406,'lambda-lab.html']]){
    const origin=`http://127.0.0.1:${port}`,page=await context.newPage();page.on('pageerror',e=>errors.push(`${id}: ${e.message}`));
    const proof=JSON.parse(readFileSync(join(root,id,'upstream-source.json')));
    await page.route(origin+'/**',async route=>{
      const file=new URL(route.request().url()).pathname.slice(1)||entry;
      if(!proof.outputs.some(f=>f.path===file)){await route.fulfill({status:404,body:''});return;}
      await route.fulfill({status:200,contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'application/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/plain',body:readFileSync(join(root,id,file)),headers:{'Cache-Control':'no-store'}});
    });
    await page.goto(origin+'/'+entry);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(id==='abelian-sandpile'){
      await page.waitForFunction(()=>document.getElementById('stat-total').textContent==='0');
      const board=page.locator('#main-board');await board.scrollIntoViewIfNeeded();const box=await board.boundingBox();
      await board.tap({position:{x:box.width/2,y:box.height/2}});await page.waitForFunction(()=>document.getElementById('stat-total').textContent==='1');
      await page.waitForFunction(()=>JSON.parse(localStorage.getItem('abelian-sandpile.experiment.v1')||'null')?.experiment?.state?.total===1);
      const stored=await page.evaluate(()=>localStorage.getItem('abelian-sandpile.experiment.v1'));
      await page.reload();await page.waitForFunction(()=>document.getElementById('stat-total').textContent==='1');
      assert.equal(await page.evaluate(()=>localStorage.getItem('abelian-sandpile.experiment.v1')),stored);
      await board.scrollIntoViewIfNeeded();await page.screenshot({path:join(evidence,'abelian-mobile.png')});
      const pending=page.waitForEvent('download');await page.locator('#export').tap();const download=await pending;
      const privatePath=join(evidence,'abelian-browser-self-private.json');await download.saveAs(privatePath);
      const data=readFileSync(privatePath),raw=JSON.parse(data);assert.equal(raw.gameId,'abelian-sandpile');
      await page.locator('#reset').tap();await page.locator('#confirm-action').tap();await page.waitForFunction(()=>document.getElementById('stat-total').textContent==='0');
      await page.locator('#import').setInputFiles(privatePath);await page.locator('#confirm-action').tap();await page.waitForFunction(()=>document.getElementById('stat-total').textContent==='1');
      await page.reload();await page.waitForFunction(()=>document.getElementById('stat-total').textContent==='1');
      summaries.push({id,exportBytes:data.length,exportSha256:sha(data),total:1,schemaVersion:raw.schemaVersion});
      cases.push('abelian: real mobile touch adds one grain, exact local reload, download, confirm reset/import and reload restore');
      await page.setViewportSize({width:1280,height:900});await page.locator('#main-board').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.getElementById('stat-total').textContent==='2');
      await page.screenshot({path:join(evidence,'abelian-desktop.png')});cases.push('abelian: desktop keyboard direction/Enter adds grain');
    }else{
      await page.locator('#expression').fill('(λx.x) (λy.y)');await page.locator('#convert').tap();await page.locator('#step').tap();await page.waitForFunction(()=>document.getElementById('step-count').textContent==='1');
      await page.locator('#save-state').tap();const current=await page.locator('#current-expression').textContent();
      await page.reload();await page.waitForFunction(()=>document.getElementById('step-count').textContent==='1');assert.equal(await page.locator('#current-expression').textContent(),current);
      assert.equal(await page.evaluate(()=>localStorage.getItem('abelian-sandpile.experiment.v1')),null);
      await page.locator('#diagram-viewport').scrollIntoViewIfNeeded();await page.screenshot({path:join(evidence,'lambda-mobile.png')});
      const pending=page.waitForEvent('download');await page.locator('#export-state').tap();const download=await pending;
      const privatePath=join(evidence,'lambda-browser-self-private.json');await download.saveAs(privatePath);const data=readFileSync(privatePath),raw=JSON.parse(data);
      await page.locator('#reset').tap();await page.waitForFunction(()=>document.getElementById('step-count').textContent==='0');
      await page.locator('#import-file').setInputFiles(privatePath);await page.waitForFunction(()=>document.getElementById('step-count').textContent==='1');assert.equal(await page.locator('#current-expression').textContent(),current);
      summaries.push({id,exportBytes:data.length,exportSha256:sha(data),steps:1,schemaVersion:raw.schemaVersion});
      cases.push('lambda: mobile convert/step, checkpoint/reload, export/reset/import restores step; separate origin has no abelian keys');
      await page.setViewportSize({width:1280,height:900});await page.locator('#expression').fill('(λx.x) (λz.z)');await page.locator('#expression').press('Control+Enter');await page.locator('#step').click();await page.waitForFunction(()=>document.getElementById('step-count').textContent==='1');
      await page.screenshot({path:join(evidence,'lambda-desktop.png')});cases.push('lambda: desktop Ctrl+Enter conversion and step');
    }
    await page.close();
  }
  assert.deepEqual(errors,[]);writeFileSync(join(evidence,'browser-result.json'),JSON.stringify({browser:await browser.version(),mobile:{width:390,height:844},desktop:{width:1280,height:900},cases,pageErrors:errors,summaries},null,2)+'\n');
  console.log(`PASS ${cases.length} real-browser groups; pageErrors=0`);
}finally{await browser.close();}
