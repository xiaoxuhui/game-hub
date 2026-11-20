const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),{chromium}=require('playwright');
const html=fs.readFileSync('.build/lambda-30s-experiment.html');
const server=http.createServer((_,res)=>res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end(html));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{const ctx=await browser.newContext(),page=await ctx.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#expression').fill('(λx.x x) (λx.x x)');await page.locator('#convert').click();await page.locator('#step').click();await page.waitForTimeout(500);
  const saved=await page.evaluate(()=>{for(const key of ['lambda-lab-hub-v4','lambda-lab-hub-v3']){const value=JSON.parse(localStorage.getItem(key));value.session.steps=300;delete value.session.paths;delete value.session.choices;localStorage.setItem(key,JSON.stringify(value));}return localStorage.getItem('lambda-lab-hub-v4')});
  await page.reload({waitUntil:'load',timeout:30000});assert.equal(await page.locator('#lambda-long-history').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('lambda-lab-hub-v4')),saved);
  assert.equal(await page.evaluate(()=>localStorage.getItem('lambda-hub-long-start-pending-v1')),null);
  await page.locator('#restore-state').click();await page.waitForFunction(()=>document.querySelector('#step-count').textContent.trim()==='300',null,{timeout:15000});
  assert.equal(await page.locator('#expression').inputValue(),'(λx.x x) (λx.x x)');
  const bounded=await page.evaluate(text=>{const snapshot=JSON.parse(text);snapshot.session.steps=50000000;const now=performance.now.bind(performance);let calls=0;performance.now=()=>calls++?now()+31000:now();try{LambdaSnapshot.decode(JSON.stringify(snapshot));return false}catch(error){return /超过30秒/.test(String(error.message))}finally{performance.now=now}},saved);
  assert.equal(bounded,true);assert.equal(await page.evaluate(()=>localStorage.getItem('lambda-lab-hub-v4')),saved);
  console.log('PASS: 300-step current save preserved on startup, no forced fallback, oversized replay stops without modifying it');await ctx.close();
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e.stack);server.close();process.exitCode=1});
