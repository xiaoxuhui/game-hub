import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {replaceCanonical,readCanonical} from './save-fixtures.mjs';
const ids=['conway','eml','light','turing','abelian-sandpile','lambda-diagram-game','red-green-puzzle','mini-scratch'];
async function samples(page,game){
  if(game.id==='lambda-diagram-game'){await page.locator('#expression').fill('(λp.p) (λq.q)');await page.locator('#convert').click();await page.locator('#save-state').click();await expect(page.locator('#game-hub-status')).toHaveText('已保存');}
  return page.evaluate(async game=>{
    let entries;
    if(game.id==='conway')entries=[['conway-life-game.custom-patterns.v1',PatternLibrary.serializeLibrary(PatternLibrary.createLibrary([PatternLibrary.createPatternFromWorld(LifeEngine.createWorld([[0,0],[1,1]]),{name:'Whole backup pattern'})]))],['conway-life-game.logic-functions.v1',LogicFunctionLibrary.serializeLibrary(LogicFunctionLibrary.createLibrary())]];
    if(game.id==='eml'){const state=JSON.parse(EMLPersistence.serialize(EMLValueStore.createInitialState()));state.inputXId=state.valueOrder[0];state.inputYId=state.valueOrder[0];state.future={opaque:'retained EML extension'};entries=[['eml_workbench_v2',JSON.stringify(state)]];}
    if(game.id==='light'){const raw=LightStorage.emptySave();raw.stars.t01=3;entries=[['light-game/save',LightStorage.serializeSave(raw)]];}
    if(game.id==='turing')entries=[['turing-machine-simulator.project.v1',JSON.stringify({format:'turing-machine-simulator',version:1,name:'Whole backup project',description:'Preserve both strings',input:'101',blankSymbol:'_',initialState:'q0',acceptStates:'',rejectStates:'',haltStates:'HALT',rules:'q0,1 -> HALT,1,N',maxSteps:1000,speed:10})],['turing-machine-simulator.campaign.v1','{"version":1,"completedLevelIds":[],"drafts":{}}']];
    if(game.id==='abelian-sandpile'){const state=SandpileApp.snapshot();state.settings.amount=7;entries=[['abelian-sandpile.experiment.v1',SandpileStorage.encode(state,SandpileLevels)]];}
    if(game.id==='lambda-diagram-game')entries=Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)]);
    if(game.id==='red-green-puzzle')entries=[['red-green-puzzle.parameters.v1','{ "schemaVersion":1, "size":4 }']];
    if(game.id==='mini-scratch'){const {example}=await import(new URL('src/project.js',location.href));entries=[['inspiration-blocks-v5',JSON.stringify({...example(),name:'Whole backup project'})],['inspiration-blocks-v4-legacy-backup','opaque damaged legacy bytes']];}
    if(game.storage.prefixes[0])entries.push([game.storage.prefixes[0]+'whole-backup-proof',' opaque historical bytes \u0000 keep spacing ']);return entries;
  },game);
}
async function assertBase(page,id){
  if(id==='conway')expect(await page.evaluate(()=>PatternLibrary.loadLibrary(localStorage).patterns[0].name)).toBe('Whole backup pattern');
  if(id==='eml'){await expect(page.locator('#addButton')).toBeEnabled();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('eml_workbench_v2')).future.opaque)).toBe('retained EML extension');}
  if(id==='light')expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('light-game/save')).stars.t01)).toBe(3);
  if(id==='turing')await expect(page.locator('#input')).toHaveValue('101');
  if(id==='abelian-sandpile')await expect(page.locator('#amount')).toHaveValue('7');
  if(id==='lambda-diagram-game')await expect(page.locator('#expression')).toHaveValue('(λp.p) (λq.q)');
  if(id==='red-green-puzzle')await expect(page.locator('#sizeInput')).toHaveValue('4');
  if(id==='mini-scratch')await expect(page.locator('#projectName')).toHaveValue('Whole backup project');
}
async function assertRetained(page,id,backup){
  const entries=new Map((await readCanonical(page,id)).entries);
  for(const [key,value] of backup.entries)if(key.endsWith('whole-backup-proof')||key==='inspiration-blocks-v4-legacy-backup')expect(entries.get(key)).toBe(value);
  if(id==='eml')expect(JSON.parse(entries.get('eml_workbench_v2')).future).toEqual({opaque:'retained EML extension'});
  if(id==='turing'){const raw=JSON.parse(entries.get('turing-machine-simulator.project.v1'));expect(raw.name).toBe('Whole backup project');expect(raw.description).toBe('Preserve both strings');}
}
async function nativeWrite(page,id){
  const revision=(await readCanonical(page,id)).revision;
  if(id==='conway')await page.evaluate(()=>PatternLibrary.saveLibrary(localStorage,PatternLibrary.loadLibrary(localStorage)));
  if(id==='eml')await page.locator('#addButton').click();
  if(id==='light'){if(await page.locator('#overlay').isVisible())await page.keyboard.press('Escape');await page.locator('#btn-levels').click();await page.getByRole('button',{name:/折一下/}).click();await page.keyboard.press('1');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await page.locator('#btn-snapshots').click();await page.getByRole('button',{name:'保存当前布局',exact:true}).click();await page.locator('#snapshot-name').fill('Roundtrip write');await page.getByRole('button',{name:'保存',exact:true}).click();}
  if(id==='turing'){await page.locator('#input').fill('111');await page.locator('#apply').click();}
  if(id==='abelian-sandpile')await page.locator('#drop-selected').click();
  if(id==='lambda-diagram-game')await page.locator('#save-state').click();
  if(id==='red-green-puzzle'){await page.locator('#sizeInput').fill('5');await page.locator('#generateBtn').click();}
  if(id==='mini-scratch'){await page.locator('#projectName').fill('Whole backup written');await page.locator('#projectName').blur();}
  await expect.poll(async()=>(await readCanonical(page,id)).revision).toBeGreaterThan(revision);
}
for(const id of ids)test(`${id} native reader and complete backup restore retain exact entries before reload`,async({page,request},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));const game=(await(await request.get('catalog.json')).json()).games.find(game=>game.id===id);
  await page.goto(game.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');const entries=await samples(page,game);await page.goto('/hub/');await replaceCanonical(page,id,entries);await page.goto(game.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');await assertBase(page,id);
  if(id==='lambda-diagram-game'){await page.locator('#save-state').click();await expect(page.locator('#game-hub-status')).toHaveText('已保存');}
  if(id==='abelian-sandpile')await expect(page.locator('#save-status')).toContainText('已自动保存在本机');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#game-hub-backup').click()]),path=testInfo.outputPath('whole-backup.json');await download.saveAs(path);const bytes=await readFile(path),backup=JSON.parse(bytes);expect(backup.pending).toBe(false);expect(backup.entries).toEqual((await readCanonical(page,id)).entries);expect(backup.entries.length).toBeGreaterThan(0);
  await page.goto('/hub/');await replaceCanonical(page,id,[]);await page.goto(game.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');await page.locator('#game-hub-restore').click();await page.locator('#hub-restore-file').setInputFiles({name:'whole-backup.json',mimeType:'application/json',buffer:bytes});await expect(page.locator('#hub-restore-confirm')).toBeEnabled();await page.locator('#hub-restore-confirm').click();await expect(page.locator('#hub-restore-message')).toContainText('恢复完成');expect((await readCanonical(page,id)).entries).toEqual(backup.entries);await expect(page.locator('#game-hub-status')).toHaveAttribute('data-save-mode','readonly');await page.locator('#hub-restore-reload').click();await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');await assertBase(page,id);await expect(page.locator('#game-hub-status')).toHaveAttribute('data-save-mode','writable');await assertRetained(page,id,backup);await nativeWrite(page,id);await assertRetained(page,id,backup);const stored=(await readCanonical(page,id)).entries;expect(await page.evaluate(async({game,stored})=>{const root=new URL('.',location.href),{validateNativeSave}=await import(new URL('hub-runtime/native-save.mjs',root));return await validateNativeSave({id:game.id,storage:game.storage},stored,root);},{game,stored})).toEqual(stored);expect(errors).toEqual([]);
});
