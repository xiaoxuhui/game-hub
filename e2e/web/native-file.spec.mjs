import {test,expect} from '@playwright/test';
import {readCanonical} from './save-fixtures.mjs';
const inputs={conway:'#importPatternsInput',light:'#file-import',turing:'#fileInput','abelian-sandpile':'#import','lambda-diagram-game':'#import-file','mini-scratch':'#fileInput'};
for(const [id,input] of Object.entries(inputs))test(`${id} native file import rejects lossy future fields before altering the current game`,async({page,request})=>{
  const game=(await (await request.get('catalog.json')).json()).games.find(game=>game.id===id);await page.goto(game.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');
  if(id==='lambda-diagram-game'){await page.locator('#convert').click();await expect(page.locator('#game-hub-status')).toHaveText('已保存');}
  const raw=await page.evaluate(async id=>{
    if(id==='conway')return JSON.parse(PatternLibrary.serializeLibrary(PatternLibrary.createLibrary()));
    if(id==='light')return JSON.parse(LightStorage.serializeLevelFile(LightLevels.LEVELS[0],[]));
    if(id==='turing')return {format:'turing-machine-simulator',version:1,name:'future import',description:'',input:'1',blankSymbol:'_',initialState:'q0',acceptStates:'',rejectStates:'',haltStates:'HALT',rules:'q0,1 -> HALT,1,N',maxSteps:1000,speed:10};
    if(id==='abelian-sandpile')return JSON.parse(SandpileStorage.encode(SandpileApp.snapshot(),SandpileLevels));
    if(id==='lambda-diagram-game')return JSON.parse(localStorage.getItem('lambda-lab-hub-v3'));
    const {example}=await import(new URL('src/project.js',location.href));return {...example(),name:'future import'};
  },id),before=await readCanonical(page,id);
  await page.locator(input).setInputFiles({name:'native.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...raw,future:{opaque:'must remain'}}))});
  await expect(page.locator('#game-hub-status')).toContainText('导入已拒绝');expect((await readCanonical(page,id)).entries).toEqual(before.entries);
});
