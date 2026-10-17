import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {readCanonical} from './save-fixtures.mjs';
const inputs={conway:'#importPatternsInput',light:'#file-import',turing:'#fileInput','abelian-sandpile':'#import','lambda-diagram-game':'#import-file','mini-scratch':'#fileInput'};
for(const [id,input,entryPage] of Object.entries(inputs).flatMap(([id,input])=>id==='mini-scratch'?[[id,input,null],[id,input,'play.html']]:[[id,input,null]]))test(`${id}${entryPage?' standalone':''} native file import rejects lossy future fields before altering the current game`,async({page,request},testInfo)=>{
  const game=(await (await request.get('catalog.json')).json()).games.find(game=>game.id===id);await page.goto(entryPage?game.entryUrl.replace(/[^/]+$/,entryPage):game.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');
  if(id==='lambda-diagram-game'){await page.locator('#convert').click();await page.locator('#save-state').click();await expect(page.locator('#game-hub-status')).toHaveText('已保存');}
  const raw=await page.evaluate(async id=>{
    if(id==='conway')return JSON.parse(PatternLibrary.serializeLibrary(PatternLibrary.createLibrary([PatternLibrary.createPatternFromWorld(LifeEngine.createWorld([[0,0],[0,1]]),{name:'原生图案验证'})])));
    if(id==='light')return {...JSON.parse(LightStorage.serializeLevelFile(LightLevels.LEVELS[0],[])),id:'web-native-proof',title:'原生关卡验证'};
    if(id==='turing')return {format:'turing-machine-simulator',version:1,name:'future import',description:'',input:'1',blankSymbol:'_',initialState:'q0',acceptStates:'',rejectStates:'',haltStates:'HALT',rules:'q0,1 -> HALT,1,N',maxSteps:1000,speed:10};
    if(id==='abelian-sandpile'){const raw=JSON.parse(SandpileStorage.encode(SandpileApp.snapshot(),SandpileLevels));raw.settings.amount=2;return raw;}
    if(id==='lambda-diagram-game'){const raw=JSON.parse(localStorage.getItem('lambda-lab-hub-v3'));raw.draft='(λp.p) (λq.q)';raw.session={...raw.session,original:LambdaCore.parse(raw.draft),steps:0,dirty:false,halt:'',...(raw.session.paths?{paths:[]}:{} )};return raw;}
    const {example}=await import(new URL('src/project.js',location.href));return {...example(),name:'原生作品验证'};
  },id),before=await readCanonical(page,id);
  await page.locator(input).setInputFiles({name:'native.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...raw,future:{opaque:'must remain'}}))});
  await expect(page.locator('#game-hub-status')).toContainText('导入已拒绝');expect((await readCanonical(page,id)).entries).toEqual(before.entries);
  if(id==='conway')await page.keyboard.press('Escape');
  await page.locator(input).setInputFiles({name:'native.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(raw))});
  await page.locator('#hub-native-import-confirm').click();
  if(id==='conway'){await expect(page.locator('#confirmImportPatternsButton')).toBeEnabled();await page.locator('#confirmImportPatternsButton').click();await expect(page.locator('#game-hub-status')).toHaveText('已保存');expect(JSON.parse((await readCanonical(page,id)).entries.find(([key])=>key==='conway-life-game.custom-patterns.v1')[1]).patterns[0].name).toBe('原生图案验证');}
  if(id==='light')await expect.poll(()=>page.evaluate(()=>LightLevels.getLevel('web-native-proof')?.title)).toBe('原生关卡验证');
  if(id==='turing'){
    await expect.poll(async()=>JSON.parse((await readCanonical(page,id)).entries.find(([key])=>key==='turing-machine-simulator.project.v1')?.[1]??'null')?.name).toBe(raw.name);
    await page.evaluate(()=>{window.inputValueDescriptor=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');Object.defineProperty(HTMLInputElement.prototype,'value',{...inputValueDescriptor,set(value){if(this.id==='input'&&value==='11')throw Error('injected native apply failure');return inputValueDescriptor.set.call(this,value);}});});
    await page.locator(input).setInputFiles({name:'native-fails.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...raw,name:'must not leak',description:'must not leak description',input:'11'}))});await page.locator('#hub-native-import-confirm').click();await expect(page.locator('#errors')).toContainText('injected native apply failure');await page.evaluate(()=>Object.defineProperty(HTMLInputElement.prototype,'value',inputValueDescriptor));
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#exportProject').click()]),path=testInfo.outputPath('native-project-after-failed-import.json');await download.saveAs(path);const exported=JSON.parse(await readFile(path,'utf8'));expect(exported.name).toBe(raw.name);expect(exported.description).toBe(raw.description);
  }
  if(id==='abelian-sandpile'){await expect(page.locator('#confirm-dialog')).toBeVisible();await page.locator('#confirm-action').click();await expect(page.locator('#amount')).toHaveValue('2');await expect(page.locator('#game-hub-status')).toHaveText('已保存');}
  if(id==='lambda-diagram-game'){await expect(page.locator('#expression')).toHaveValue(raw.draft);await expect(page.locator('#save-feedback')).toContainText('存档已导入');}
  if(id==='mini-scratch')await expect(page.locator('#projectName')).toHaveValue('原生作品验证');
});
test('EML native FileReader retains unknown state fields and rejects invalid UTF8 without replacing saves',async({page,request})=>{
  const game=(await (await request.get('catalog.json')).json()).games.find(game=>game.id==='eml');await page.goto(game.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');
  const raw=await page.evaluate(()=>({...JSON.parse(EMLPersistence.serialize(EMLValueStore.createInitialState())),future:{opaque:'EML retained'}}));await page.locator('#importFile').setInputFiles({name:'eml.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(raw))});
  await page.locator('#hub-native-import-confirm').click();
  await expect.poll(async()=>JSON.parse((await readCanonical(page,'eml')).entries.find(([key])=>key==='eml_workbench_v2')?.[1]??'null')?.future?.opaque).toBe('EML retained');const before=await readCanonical(page,'eml');
  await page.locator('#importFile').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from([0xff])});await expect(page.locator('#game-hub-status')).toContainText('导入已拒绝');expect((await readCanonical(page,'eml')).entries).toEqual(before.entries);
});
