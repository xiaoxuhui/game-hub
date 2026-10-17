import {test,expect} from '@playwright/test';
async function game(page,request,id){const value=(await (await request.get('catalog.json')).json()).games.find(g=>g.id===id);await page.goto(value.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');return new URL('.',page.url()).href;}
test('native Turing project and campaign validators load from the fixed game closure without running a second UI',async({page,request})=>{
  const prefix=await game(page,request,'turing'),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const result=await page.evaluate(async prefix=>{
    const codec=await import(prefix+'hub-runtime/native/turing/project-codec.mjs'),campaign=await import(prefix+'hub-runtime/native/turing/campaign.mjs');
    const project={format:'turing-machine-simulator',version:1,name:'original validator',description:'',input:'1',blankSymbol:'_',initialState:'q0',acceptStates:'',rejectStates:'',haltStates:'HALT',rules:'q0,1 -> HALT,1,N',maxSteps:1000,speed:10,extensions:{future:'kept'}};
    const accepted=codec.parseProjectJson(JSON.stringify(project));let rejected=false;try{codec.parseProjectJson(JSON.stringify({...project,maxSteps:null}));}catch{rejected=true;}
    const id=campaign.campaignLevels[0].id;return {accepted,rejected,progress:campaign.normalizeCampaignProgress({version:1,completedLevelIds:[id],drafts:{}}),id};
  },prefix);
  expect(result.accepted.extensions.future).toBe('kept');expect(result.rejected).toBe(true);expect(result.progress.completedLevelIds).toEqual([result.id]);await expect(page.locator('#generateRoute')).toBeVisible();expect(errors).toEqual([]);
});
test('native Lambda mirror recovery validates a private map and refuses a foreign write',async({page,request})=>{
  const prefix=await game(page,request,'lambda-diagram-game');await page.locator('#convert').click();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('lambda-lab-hub-v3')!==null)).toBe(true);
  await expect(page.locator('#game-hub-status')).toHaveText('已保存');
  const result=await page.evaluate(async prefix=>{
    const helpers=await import(prefix+'hub-runtime/native/lambda-storage.mjs');
    const before=localStorage.getItem('lambda-lab-hub-v3'),map=new Map(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)])),storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
    const adapter=helpers.createLambdaStorage(storage,LambdaSnapshot,helpers.migrateLambdaStorage);LambdaSnapshot.decode(adapter.getItem('lambda-lab-hub-v3'));
    map.set('lambda-lab-hub-journal-v3',JSON.stringify({schemaVersion:1,after:[['light-game/save','foreign write']]}));let rejected=false;try{adapter.getItem('lambda-lab-hub-v3');}catch{rejected=true;}
    return {rejected,unchanged:localStorage.getItem('lambda-lab-hub-v3')===before,foreign:localStorage.getItem('light-game/save')};
  },prefix);
  expect(result).toEqual({rejected:true,unchanged:true,foreign:null});await expect(page.locator('#convert')).toBeVisible();
});
