import {chromium} from 'file:///C:/Users/25133/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url)),directory=join(root,'examples/red-green-puzzle');
const evidence=resolve(process.argv[2]);mkdirSync(evidence,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Users/25133/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true});
const checks=[],errors=[],timings=[];
const origin='http://127.0.0.1:18409';
try{
  for(const [name,viewport,hasTouch] of [['mobile',{width:390,height:844},true],['desktop',{width:1280,height:900},false]]){
    const context=await browser.newContext({viewport,hasTouch});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(`${name}: ${e.message}`));
    await page.route(origin+'/**',route=>{const file=new URL(route.request().url()).pathname.slice(1)||'index.html';if(!['index.html','core.js','app.js','LICENSE'].includes(file))return route.fulfill({status:404,body:''});return route.fulfill({status:200,contentType:file.endsWith('.js')?'application/javascript; charset=utf-8':'text/html; charset=utf-8',body:readFileSync(join(directory,file))});});
    await page.goto(origin+'/index.html');await page.waitForFunction(()=>document.getElementById('rowStat').textContent==='行数 43');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('#sizeInput').fill('10');const start=Date.now();
    if(hasTouch)await page.locator('#generateBtn').tap();else await page.locator('#sizeInput').press('Enter');
    await page.waitForFunction(()=>document.getElementById('rowStat').textContent==='行数 683');timings.push({viewport:name,generate10Ms:Date.now()-start});
    assert.equal(await page.locator('.row').count(),683);assert.equal(await page.locator('.state-text').last().textContent(),'1111111111');
    const saved=await page.evaluate(()=>localStorage.getItem('red-green-puzzle.parameters.v1'));
    await page.locator('#sizeInput').fill('11');await page.locator('#generateBtn').click();await page.waitForFunction(()=>!document.getElementById('notice').hidden);
    assert.equal(await page.locator('.row').count(),683);assert.equal(await page.evaluate(()=>localStorage.getItem('red-green-puzzle.parameters.v1')),saved);
    for(const invalid of ['0','20','-1','1.5','']){await page.locator('#sizeInput').fill(invalid);await page.locator('#generateBtn').click();assert.equal(await page.locator('.row').count(),683);}
    await page.reload();await page.waitForFunction(()=>document.getElementById('rowStat').textContent==='行数 683');assert.equal(await page.locator('#sizeInput').inputValue(),'10');
    await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Denied for test')}}});document.execCommand=()=>false;});
    await page.locator('#copyBtn').click();await page.waitForFunction(()=>!document.getElementById('copyText').hidden);
    assert.ok((await page.locator('#copyText').inputValue()).endsWith('682: 1111111111'));assert.match(await page.locator('#copyStatus').textContent(),/手动复制/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:join(evidence,`red-green-${name}-fallback.png`),fullPage:true});
    await page.evaluate(()=>{window.__copied='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text}}});});
    await page.locator('#copyBtn').click();await page.waitForFunction(()=>document.getElementById('copyStatus').textContent.includes('已复制'));
    assert.ok((await page.evaluate(()=>window.__copied)).endsWith('682: 1111111111'));
    await page.locator('#sizeInput').fill('1');await page.locator('#generateBtn').click();await page.locator('#generateBtn').click();assert.equal(await page.locator('.row').count(),2);
    await page.evaluate(()=>localStorage.setItem('red-green-puzzle.parameters.v1','{"schemaVersion":1,"size":20}'));await page.reload();await page.waitForFunction(()=>document.getElementById('rowStat').textContent==='行数 43');
    await page.screenshot({path:join(evidence,`red-green-${name}-default.png`),fullPage:true});
    await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new Error('Storage denied for test');}}));
    await page.reload();await page.waitForFunction(()=>document.getElementById('rowStat').textContent==='行数 43');
    assert.match(await page.locator('#notice').textContent(),/不能保存/);assert.equal(await page.locator('#sizeInput').inputValue(),'6');
    checks.push(`${name}: real generate/Enter/touch, 683 rows, invalid input preserves data, cold reload, clipboard success mock and forced-denial manual fallback, repeated generate, corrupt saved size fallback, denied storage remains usable, no page overflow`);
    await context.close();
  }
  assert.deepEqual(errors,[]);writeFileSync(join(evidence,'browser-result.json'),JSON.stringify({checks,errors,timings},null,2)+'\n');console.log(JSON.stringify({checks:checks.length,pageErrors:errors.length,timings}));
}finally{await browser.close();}
