import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {readCanonical,replaceCanonical} from './save-fixtures.mjs';
const KEY='red-green-puzzle.parameters.v1';
async function setup(page,request){const game=(await(await request.get('catalog.json')).json()).games.find(g=>g.id==='red-green-puzzle');await page.goto(game.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');return game;}
async function download(page,testInfo){const [d]=await Promise.all([page.waitForEvent('download'),page.locator('#game-hub-backup').click()]);const path=testInfo.outputPath('backup.json');await d.saveAs(path);return readFile(path);}
for(const [kind,raw] of [['future','{"schemaVersion":1,"size":4,"future":{"retain":"exact bytes"}}'],['damaged','{ broken native JSON']])test(`${kind} native readonly save can explicitly restore a verified backup and retains original raw bytes`,async({page,request},testInfo)=>{
  await setup(page,request);await page.locator('#sizeInput').fill('5');await page.locator('#generateBtn').click();await expect(page.locator('#game-hub-status')).toHaveText('已保存');const backup=await download(page,testInfo);
  await page.locator('#game-hub-return').click();await expect(page).toHaveURL(/\/hub\/$/);await expect(page.locator('#games a')).toHaveCount(8);await replaceCanonical(page,'red-green-puzzle',[[KEY,raw]]);const game=await setup(page,request);await expect(page.locator('#game-hub-status')).toHaveAttribute('data-save-mode','readonly');
  await page.locator('#game-hub-restore').click();await page.locator('#hub-restore-file').setInputFiles({name:'known-backup.json',mimeType:'application/json',buffer:backup});await expect(page.locator('#hub-restore-confirm')).toBeEnabled();await expect(page.locator('#hub-restore-preview')).toContainText('受保护原档');
  await page.locator('#hub-restore-confirm').click();await expect(page.locator('#hub-restore-message')).toContainText('恢复完成');expect((await readCanonical(page,game.id)).entries).toEqual(JSON.parse(backup).entries);
  const preserved=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('game-hub-web.saves./hub/',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('backups'),q=tx.objectStore('backups').index('gameId').getAll('red-green-puzzle');q.onsuccess=()=>resolve(q.result.map(row=>row.record.entries));tx.oncomplete=()=>db.close();};}));expect(preserved).toContainEqual([[KEY,raw]]);
  await page.locator('#hub-restore-reload').click();await expect(page.locator('#sizeInput')).toHaveValue('5');await expect(page.locator('#game-hub-status')).toHaveAttribute('data-save-mode','writable');
});
for(const stage of ['preview','committed'])test(`late readonly draft remains separately exportable during ${stage} recovery`,async({page,request},testInfo)=>{
  const game=await setup(page,request);const backup=await download(page,testInfo);await page.locator('#game-hub-return').click();await expect(page).toHaveURL(/\/hub\/$/);await expect(page.locator('#games a')).toHaveCount(8);await replaceCanonical(page,game.id,[[KEY,'{"schemaVersion":1,"size":4,"future":true}']]);
  // Optional exact old-module replay proves the regression with the same fixture.
  // It is test-only, never changes the build and is absent from normal CI.
  if(process.env.WEB_REPRO_RECOVERY_329==='1'){
    const revision='329e057a6e9f686c845e381ce88ddd3687fc2cc5';
    for(const name of ['save-session.mjs','restore-ui.mjs']){
      const bytes=execFileSync('git',['show',`${revision}:web/src/runtime/${name}`]);
      await page.route(`**/hub-runtime/${name}`,route=>route.fulfill({status:200,contentType:'application/javascript',body:bytes}));
    }
    console.log('TEST ONLY: exact recovery modules replayed from '+revision);
  }
  const root=new URL('.',new URL(game.entryUrl,page.url())).href;
  const state=await page.evaluate(async root=>{
    const {startSaveSession}=await import(new URL('hub-runtime/save-session.mjs',root)),{mountRestore}=await import(new URL('hub-runtime/restore-ui.mjs',root)),context=await(await fetch(new URL('hub-runtime/context.json',root))).json();
    const saves=await startSaveSession({gameId:context.id,scope:context.storage,basePath:context.basePath});window.recoverySession=saves;saves.protectWrites('原生格式保护');
    const bar=document.createElement('aside');document.body.append(bar);mountRestore({bar,saves,context,gameRoot:new URL(root)});return saves.snapshot();
  },root);
  expect(state).toMatchObject({canonicalRead:true,pending:false,mode:'readonly'});
  await page.locator('#game-hub-restore').click();await expect(page.locator('#hub-restore-export-draft')).toBeDisabled();
  if(stage==='committed'){await page.locator('#hub-restore-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:backup});await expect(page.locator('#hub-restore-confirm')).toBeEnabled();await page.locator('#hub-restore-confirm').click();await expect(page.locator('#hub-restore-message')).toContainText('恢复完成');}
  await page.evaluate(key=>{try{recoverySession.storage.setItem(key,'late draft after modal opened');}catch{}},KEY);
  if(stage==='preview'){await page.locator('#hub-restore-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:backup});await expect(page.locator('#hub-restore-confirm')).toBeEnabled();await expect(page.locator('#hub-restore-preview')).toContainText('未保存草稿');}
  await expect(page.locator('#hub-restore-export-draft')).toBeEnabled();const [d]=await Promise.all([page.waitForEvent('download'),page.locator('#hub-restore-export-draft').click()]);const path=testInfo.outputPath('late-draft.json');await d.saveAs(path);const draft=JSON.parse(await readFile(path,'utf8'));expect(draft.pending).toBe(true);expect(draft.entries).toEqual([[KEY,'late draft after modal opened']]);
  if(stage==='committed')expect((await readCanonical(page,game.id)).entries).toEqual(JSON.parse(backup).entries);
});
async function api(page,request){const game=await setup(page,request),root=new URL('.',new URL(game.entryUrl,page.url())).href;await page.goto('./');await page.evaluate(async root=>{const {startSaveSession}=await import(new URL('hub-runtime/save-session.mjs',root));window.opts={gameId:'protected-demo',scope:{keys:['demo.save'],prefixes:[]},basePath:'/protected-test/'};window.start=startSaveSession;window.a=await start(opts);a.storage.setItem('demo.save','raw future');await a.flush();a.protectWrites('原生写保护');},root);}
test('committed canonical save stops being offered as an unsaved draft',async({page,request})=>{
  const game=await setup(page,request),root=new URL('.',new URL(game.entryUrl,page.url())).href;await page.goto('./');
  const result=await page.evaluate(async root=>{
    const {startSaveSession}=await import(new URL('hub-runtime/save-session.mjs',root)),{mountRestore}=await import(new URL('hub-runtime/restore-ui.mjs',root)),context=await(await fetch(new URL('hub-runtime/context.json',root))).json(),saves=await startSaveSession({gameId:context.id,scope:context.storage,basePath:context.basePath});
    const bar=document.createElement('aside');document.body.append(bar);mountRestore({bar,saves,context,gameRoot:new URL(root)});document.querySelector('#game-hub-restore').click();
    saves.storage.setItem('red-green-puzzle.parameters.v1','{"schemaVersion":1,"size":6}');const pendingEnabled=!document.querySelector('#hub-restore-export-draft').disabled;await saves.flush();const committedDisabled=document.querySelector('#hub-restore-export-draft').disabled,pending=saves.snapshot().pending;saves.close();return {pendingEnabled,committedDisabled,pending};
  },root);expect(result).toEqual({pendingEnabled:true,committedDisabled:true,pending:false});
});
test('protected recovery explicitly binds unsaved draft and keeps native import disabled',async({page,request})=>{
  await api(page,request);const result=await page.evaluate(async()=>{try{a.storage.setItem('demo.save','draft one');}catch{}const first=await a.prepareRestore([['demo.save','candidate']]);const info={protected:first.protectedOriginal,draft:first.hasDraft};const nativeBlocked=await a.prepareImport().then(()=>false,()=>true);try{a.storage.setItem('demo.save','draft two');}catch{}const changed=await a.restore(first.token).then(()=>false,()=>true);const second=await a.prepareRestore([['demo.save','candidate']]);await a.restore(second.token);const b=await start(opts),value=b.storage.getItem('demo.save'),draft=a.snapshot().entries;a.close();b.close();return {info,nativeBlocked,changed,value,draft};});expect(result).toEqual({info:{protected:true,draft:true},nativeBlocked:true,changed:true,value:'candidate',draft:[['demo.save','draft two']]});
});
test('takeover revokes native recovery permission even without notifications',async({page,request})=>{
  await api(page,request);const result=await page.evaluate(async()=>{const p=await a.prepareRestore([['demo.save','candidate']]);const b=await start({...opts,environment:{localStorage,indexedDB,crypto}});b.storage.setItem('demo.save','new owner');await b.flush();const blocked=await a.restore(p.token).then(()=>false,()=>true),c=await start(opts),value=c.storage.getItem('demo.save');a.close();b.close();c.close();return {blocked,value};});expect(result).toEqual({blocked:true,value:'new owner'});
});
test('unknown outer save record never becomes recoverable through native protection',async({page,request})=>{
  await api(page,request);const result=await page.evaluate(async()=>{a.close();await new Promise((resolve,reject)=>{const r=indexedDB.open('game-hub-web.saves./protected-test/',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('saves','readwrite');tx.objectStore('saves').put({schema:2,gameId:opts.gameId,unknown:'preserve'});tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};});const b=await start(opts);b.protectWrites('原生写保护');const blocked=await b.prepareRestore([['demo.save','candidate']]).then(()=>false,()=>true);b.close();return blocked;});expect(result).toBe(true);
});
