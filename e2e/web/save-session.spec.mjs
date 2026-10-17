import {test,expect} from '@playwright/test';
const KEY='red-green-puzzle.parameters.v1';
async function entry(request){return (await (await request.get('catalog.json')).json()).games.find(g=>g.id==='red-green-puzzle').entryUrl;}
async function ready(page){await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');}
test('game save persists through reload while raw legacy and foreign keys remain untouched',async({page,request})=>{
  await page.addInitScript(()=>{if(!localStorage.getItem('seeded')){localStorage.setItem('red-green-puzzle.parameters.v1','{"schemaVersion":1,"size":3,"future":"keep raw"}');localStorage.setItem('light-game/save','foreign opaque');localStorage.setItem('seeded','1');}});
  await page.goto(await entry(request));await ready(page);await expect(page.locator('#sizeInput')).toHaveValue('3');
  await page.locator('#sizeInput').fill('4');await page.locator('#generateBtn').click();await expect(page.locator('#game-hub-status')).toHaveText('已保存');
  await page.reload();await ready(page);await expect(page.locator('#sizeInput')).toHaveValue('4');
  expect(await page.evaluate(()=>localStorage.getItem('light-game/save'))).toBe(null);
  const hall=await page.context().newPage();await hall.goto('/hub/');
  expect(await hall.evaluate(()=>localStorage.getItem('light-game/save'))).toBe('foreign opaque');
  expect(await hall.evaluate(()=>JSON.parse(localStorage.getItem('red-green-puzzle.parameters.v1')).future)).toBe('keep raw');
});
test('unknown authoritative save format only permits explicitly incomplete emergency export',async({page,request},testInfo)=>{
  await page.goto('/hub/');
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('game-hub-web.saves./hub/',1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('saves',{keyPath:'gameId'});request.result.createObjectStore('backups',{keyPath:'id'}).createIndex('gameId','gameId');};
    request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('saves','readwrite');tx.objectStore('saves').put({schema:2,gameId:'red-green-puzzle',opaque:'future canonical bytes'});tx.oncomplete=()=>{db.close();resolve();};};
  }));
  await page.goto(await entry(request));await ready(page);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#game-hub-backup').click()]);
  const path=testInfo.outputPath('future-emergency.json');await download.saveAs(path);
  const {readFile}=await import('node:fs/promises'),backup=JSON.parse(await readFile(path,'utf8'));
  expect(download.suggestedFilename()).toContain('emergency');expect(backup.canonicalRead).toBe(false);expect(backup.warning).toContain('未能读取正式存档');
  await expect(page.locator('#game-hub-backup')).toHaveText('应急导出');
});
test('denied IDB access never labels legacy or default session data as a complete backup',async({page,request},testInfo)=>{
  await page.addInitScript(()=>{Object.defineProperty(window,'indexedDB',{value:{open(){throw new DOMException('test denied','SecurityError');}}});});
  await page.goto(await entry(request));await ready(page);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#game-hub-backup').click()]);
  const path=testInfo.outputPath('denied-emergency.json');await download.saveAs(path);
  const {readFile}=await import('node:fs/promises'),backup=JSON.parse(await readFile(path,'utf8'));
  expect(download.suggestedFilename()).toContain('emergency');expect(backup.canonicalRead).toBe(false);expect(backup.warning).toContain('未能读取正式存档');
});
test('new game tab takes ownership; older tab cannot overwrite and can download its draft',async({page,context,request},testInfo)=>{
  const url=await entry(request);await page.goto(url);await ready(page);
  const newer=await context.newPage();await newer.goto(url);await ready(newer);
  await expect(page.locator('#game-hub-status')).toHaveAttribute('data-save-mode','readonly');
  await newer.locator('#sizeInput').fill('5');await newer.locator('#generateBtn').click();await expect(newer.locator('#game-hub-status')).toHaveText('已保存');
  const blocked=await page.evaluate(key=>{try{localStorage.setItem(key,'{"schemaVersion":1,"size":8}');return false;}catch{return true;}},KEY);expect(blocked).toBe(true);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#game-hub-backup').click()]);
  const path=testInfo.outputPath('conflict-backup.json');await download.saveAs(path);
  const {readFile}=await import('node:fs/promises'),backup=JSON.parse(await readFile(path,'utf8'));
  expect(backup.gameId).toBe('red-green-puzzle');expect(backup.mode).toBe('readonly');expect(JSON.parse(backup.entries.find(([k])=>k===KEY)[1]).size).toBe(8);
  await newer.reload();await ready(newer);await expect(newer.locator('#sizeInput')).toHaveValue('5');
});
test('journal quota failure is visible and preserves an exportable attempted save',async({page,request},testInfo)=>{
  await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('game-hub-web.journal.'))throw new DOMException('test quota','QuotaExceededError');return original.call(this,key,value);};});
  await page.goto(await entry(request));await ready(page);
  await expect(page.locator('#game-hub-status')).toHaveAttribute('data-save-mode','readonly');await expect(page.locator('#game-hub-status')).toContainText('空间不足');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#game-hub-backup').click()]);const path=testInfo.outputPath('quota-backup.json');await download.saveAs(path);
  const {readFile}=await import('node:fs/promises'),backup=JSON.parse(await readFile(path,'utf8'));expect(backup.pending).toBe(true);expect(backup.entries.some(([key])=>key===KEY)).toBe(true);
});
test('readonly draft retains multiple failed key writes without changing the newer tab',async({page,context,request},testInfo)=>{
  const game=(await (await request.get('catalog.json')).json()).games.find(g=>g.id==='conway');
  await page.goto(game.entryUrl);await ready(page);const newer=await context.newPage();await newer.goto(game.entryUrl);await ready(newer);
  await expect(page.locator('#game-hub-status')).toHaveAttribute('data-save-mode','readonly');
  await page.evaluate(()=>{for(const [key,value] of [['conway-life-game.draft-a','first failed write'],['conway-life-game.draft-b','second failed write']]){try{localStorage.setItem(key,value);}catch{ /* expected readonly */ }}});
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#game-hub-backup').click()]);const path=testInfo.outputPath('multi-key-draft.json');await download.saveAs(path);
  const {readFile}=await import('node:fs/promises'),backup=JSON.parse(await readFile(path,'utf8'));
  expect(backup.entries).toContainEqual(['conway-life-game.draft-a','first failed write']);expect(backup.entries).toContainEqual(['conway-life-game.draft-b','second failed write']);
  expect(await newer.evaluate(()=>[localStorage.getItem('conway-life-game.draft-a'),localStorage.getItem('conway-life-game.draft-b')])).toEqual([null,null]);
});
