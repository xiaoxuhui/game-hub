const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),{chromium}=require('playwright');
const old=fs.readFileSync('examples/lambda-diagram-038-20261121/lambda-lab.html');
const current=fs.readFileSync(process.env.LAMBDA_TEST_HTML||'examples/lambda-preserve-20261121/lambda-lab.html');let active=old;
const server=http.createServer((_,res)=>res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end(active));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{const page=await browser.newPage({acceptDownloads:true});await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#expression').fill('(λoriginal.original) preserved');await page.waitForTimeout(800);active=current;await page.reload();
  await page.locator('#expression').fill('(λa.a) first');await page.waitForTimeout(600);await page.locator('#expression').fill('(λb.b) second');await page.waitForTimeout(600);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出所有本机存档'}).click();const stream=await(await download).createReadStream();let data='';for await(const c of stream)data+=c;
  let prompt='';const selected=page.waitForEvent('dialog').then(d=>{prompt=d.message();const row=prompt.split('\n').find(line=>line.includes('preserved'));return row?d.accept(row.match(/^\d+/)?.[0]):d.dismiss()});await page.locator('#import-file').setInputFiles({name:'all.json',mimeType:'application/json',buffer:Buffer.from(data)});await selected;
  assert.match(prompt,/preserved/,'raw export must offer the archived original session for recovery');
  await page.waitForFunction(()=>document.querySelector('#expression').value==='(λoriginal.original) preserved',null,{timeout:10000});
  console.log('PASS: exported local storage restores the selected earlier archived session');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e.stack);server.close();process.exitCode=1});
