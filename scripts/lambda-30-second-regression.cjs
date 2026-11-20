const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),{chromium}=require('playwright');
const html=fs.readFileSync('examples/lambda-diagram-30s-20261120/lambda-lab.html');
const server=http.createServer((_,res)=>res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end(html));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{const page=await browser.newPage({acceptDownloads:true});await page.goto(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(await page.locator('#growth-window').inputValue(),'30000');
  assert.equal(await page.evaluate(()=>LambdaRunGuard.DEFAULT_MS),30000);
  await page.locator('#expression').fill('(λx.x x) (λx.x x)');await page.locator('#convert').click();await page.waitForTimeout(400);
  let downloaded=false;page.on('download',()=>{downloaded=true});await page.locator('#fast-run').click();await page.waitForTimeout(1500);
  assert.equal(downloaded,false,'must not misclassify a run after one second');
  await page.evaluate(()=>{const old=performance.now.bind(performance);performance.now=()=>old()+31000});
  await page.waitForEvent('download',{timeout:5000});
  console.log('PASS: 30-second default and no early cycle export; true cycle offers backup after observation');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e.stack);server.close();process.exitCode=1});
