import {test,expect} from '@playwright/test';
for(const id of ['conway','eml','light','turing','abelian-sandpile','lambda-diagram-game','red-green-puzzle','mini-scratch'])test(`${id} validates native save bytes without changing real storage and rejects a bad primary slot`,async({page,request})=>{
  const game=(await (await request.get('catalog.json')).json()).games.find(g=>g.id===id);await page.goto(game.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');
  if(id==='lambda-diagram-game'){await page.locator('#convert').click();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('lambda-lab-hub-v3')!==null)).toBe(true);await expect(page.locator('#game-hub-status')).toHaveText('已保存');}
  const result=await page.evaluate(async game=>{
    const root=new URL('.',location.href),api=await import(new URL('hub-runtime/native-save.mjs',root));let entries;
    if(game.id==='conway')entries=[['conway-life-game.custom-patterns.v1',PatternLibrary.serializeLibrary(PatternLibrary.createLibrary())],['conway-life-game.logic-functions.v1',LogicFunctionLibrary.serializeLibrary(LogicFunctionLibrary.createLibrary())]];
    if(game.id==='eml')entries=[['eml_workbench_v2',EMLPersistence.serialize(EMLValueStore.createInitialState())]];
    if(game.id==='light')entries=[['light-game/save',LightStorage.serializeSave(LightStorage.emptySave())]];
    if(game.id==='turing')entries=[['turing-machine-simulator.project.v1',JSON.stringify({format:'turing-machine-simulator',version:1,name:'compatible',description:'',input:'1',blankSymbol:'_',initialState:'q0',acceptStates:'',rejectStates:'',haltStates:'HALT',rules:'q0,1 -> HALT,1,N',maxSteps:1000,speed:10})],['turing-machine-simulator.campaign.v1','{"version":1,"completedLevelIds":[],"drafts":{}}']];
    if(game.id==='abelian-sandpile')entries=[['abelian-sandpile.experiment.v1',SandpileStorage.encode(SandpileApp.snapshot(),SandpileLevels)]];
    if(game.id==='lambda-diagram-game')entries=Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)]);
    if(game.id==='red-green-puzzle')entries=[['red-green-puzzle.parameters.v1','{ "schemaVersion":1, "size":4 }']];
    if(game.id==='mini-scratch'){const project=await import(new URL('src/project.js',root));entries=[['inspiration-blocks-v5',JSON.stringify(project.example())],['inspiration-blocks-v4-legacy-backup','opaque historical damaged bytes']];}
    const before=Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)]),accepted=await api.validateNativeSave({id:game.id,storage:game.storage},entries,root);
    const bad=entries.map((pair,index)=>index===0?[pair[0],'{"unsupported":true}']:pair);let rejected=false;try{await api.validateNativeSave({id:game.id,storage:game.storage},bad,root);}catch{rejected=true;}
    const future=entries.map((pair,index)=>index===0?[pair[0],JSON.stringify({...JSON.parse(pair[1]),future:{opaque:'must remain'}})]:pair);let futureRejected=false;try{await api.validateNativeSave({id:game.id,storage:game.storage},future,root);}catch{futureRejected=true;}
    window.futureNativeEntries=future;
    return {exact:JSON.stringify(accepted)===JSON.stringify(entries),rejected,futureRejected,unchanged:JSON.stringify(before)===JSON.stringify(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)]))};
  },game);
  expect(result).toEqual({exact:true,rejected:true,futureRejected:id!=='eml',unchanged:true});
  await page.evaluate(()=>{for(const [key,value] of futureNativeEntries)localStorage.setItem(key,value);});await expect(page.locator('#game-hub-status')).toHaveText('已保存');
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.reload();await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');await expect(page.locator('#game-hub-status')).toHaveAttribute('data-save-mode',id==='eml'?'writable':'readonly');expect(errors).toEqual([]);
});
test('EML clone-based native UI writer retains future state, value and expression fields during a real save',async({page,request})=>{
  const game=(await (await request.get('catalog.json')).json()).games.find(g=>g.id==='eml');await page.goto(game.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');
  await page.evaluate(()=>{const state=JSON.parse(EMLPersistence.serialize(EMLValueStore.createInitialState())),id=state.valueOrder[0];state.inputXId=id;state.inputYId=id;state.future={opaque:'root'};state.values[id].future={opaque:'value'};state.values[id].canonicalExpression.future={opaque:'expression'};localStorage.setItem('eml_workbench_v2',JSON.stringify(state));});
  await expect(page.locator('#game-hub-status')).toHaveText('已保存');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');await page.locator('#addButton').click();
  await expect.poll(()=>page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('eml_workbench_v2')).derivations).length)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('eml_workbench_v2')),value=state.values[state.valueOrder[0]];return [state.future.opaque,value.future.opaque,value.canonicalExpression.future.opaque];})).toEqual(['root','value','expression']);
});
test('sandpile authoritative save cannot hide conflicting or future mirror fields',async({page,request})=>{
  const game=(await (await request.get('catalog.json')).json()).games.find(g=>g.id==='abelian-sandpile');await page.goto(game.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');
  const result=await page.evaluate(async game=>{
    const root=new URL('.',location.href),api=await import(new URL('hub-runtime/native-save.mjs',root)),raw=SandpileStorage.encode(SandpileApp.snapshot(),SandpileLevels),data=JSON.parse(raw),before=Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)]);
    const entries=[['abelian-sandpile.experiment.v1',raw],['abelian-sandpile.progress.v1',JSON.stringify(data.progress)],['abelian-sandpile.settings.v1',JSON.stringify(data.settings)]];
    const accepted=await api.validateNativeSave({id:game.id,storage:game.storage},entries,root),rejected=[];
    for(const [key,value] of [['abelian-sandpile.progress.v1',{...data.progress,future:{opaque:true}}],['abelian-sandpile.settings.v1',{...data.settings,speed:data.settings.speed===60?59:60}],['abelian-sandpile.settings.v1',{...data.settings,future:true}]]){try{await api.validateNativeSave({id:game.id,storage:game.storage},entries.map(pair=>pair[0]===key?[key,JSON.stringify(value)]:pair),root);rejected.push(false);}catch{rejected.push(true);}}
    return {exact:JSON.stringify(accepted)===JSON.stringify(entries),rejected,unchanged:JSON.stringify(before)===JSON.stringify(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)]))};
  },game);expect(result).toEqual({exact:true,rejected:[true,true,true],unchanged:true});
});
