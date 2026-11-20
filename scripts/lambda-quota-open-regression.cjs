const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),{chromium}=require('playwright');
const html=fs.readFileSync(process.env.LAMBDA_TEST_HTML||'examples/lambda-039-recovery-20261121/lambda-lab.html');
const server=http.createServer((_,res)=>res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end(html));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),url=`http://127.0.0.1:${server.address().port}/`;
  await page.goto(url);await page.locator('#expression').fill('(λsaved.saved) quota');await page.waitForTimeout(800);
  const before=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));assert.ok(before['lambda-lab-hub-v4']);
  await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===window.localStorage)throw new DOMException('simulated full storage','QuotaExceededError');return original.call(this,k,v)}});
  await page.reload();const dialog=page.getByRole('dialog').filter({hasText:'存储空间不足'});await dialog.waitFor({timeout:10000});
  const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'导出所有本机存档'}).click();const stream=await(await download).createReadStream();let exported='';for await(const chunk of stream)exported+=chunk;assert.equal(JSON.parse(exported).storage['lambda-lab-hub-v4'],before['lambda-lab-hub-v4']);
  await dialog.getByRole('button',{name:'只读打开'}).click();await page.locator('#restore-state').click();await page.waitForFunction(()=>document.querySelector('#expression').value==='(λsaved.saved) quota');
  assert.match(await page.locator('#save-feedback').innerText(),/不会自动保存/);
  assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))),before);
  console.log('PASS: quota failure offers raw export and read-only restore without modifying any original key');await context.close();
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e.stack);server.close();process.exitCode=1});
