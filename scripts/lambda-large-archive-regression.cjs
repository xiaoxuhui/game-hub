const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),{chromium}=require('playwright');
const html=fs.readFileSync(process.env.LAMBDA_TEST_HTML||'examples/lambda-roundtrip-20261121/lambda-lab.html');
const server=http.createServer((_,res)=>res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end(html));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#expression').fill('(λa.a) saved');await page.waitForTimeout(700);
 const raw=await page.evaluate(()=>localStorage.getItem('lambda-lab-hub-v4'));assert.ok(raw);
 const file=Buffer.from(JSON.stringify({schemaVersion:1,type:'raw-local-storage',game:'lambda-diagram-game',storage:{'lambda-lab-hub-v4':raw,'lambda-hub-unrelated':'x'.repeat(8*1024*1024)}}));
 let seen='';page.on('dialog',d=>{seen=d.message();return d.dismiss()});await page.locator('#import-file').setInputFiles({name:'large.json',mimeType:'application/json',buffer:file});
 await page.waitForTimeout(800);assert.match(seen,/saved/,'an exported raw archive larger than 8 MiB must still offer valid snapshots');console.log('PASS: large raw archive offers a valid snapshot');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e.stack);server.close();process.exitCode=1});
