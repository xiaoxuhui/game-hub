import test from 'node:test';import assert from 'node:assert/strict';
import {selectResourceCandidates,hexSelectionRecord,verifyHexSelection,assertFreshHexAssets,assertHexOnlySuccessor} from '../scripts/resource-selection.mjs';
import {selectionRecord,verifySelection,assertFreshSelectedAssets,assertSelectedSuccessor} from '../scripts/resource-selection.mjs';
function fixture(){const old={catalogSequence:'31',games:Array.from({length:7},(_,i)=>({id:'old-'+i,contentCode:1,assetId:i+1,archiveSha256:'b'.repeat(64)}))},hex={id:'hex-cell-lab',contentCode:1,archiveBytes:100,archiveSha256:'a'.repeat(64)},candidates=[{...old.games[0],contentCode:27},hex],context={producerCommit:'c'.repeat(40),previousSha:'d'.repeat(64),sequence:'32'};return {old,hex,candidates,context};}
test('hex-only selection excludes pending updates and leaves default all unchanged',()=>{const {old,hex,candidates}=fixture();assert.equal(selectResourceCandidates(old,candidates),candidates);assert.deepEqual(selectResourceCandidates(old,candidates,'hex-cell-lab'),[hex]);assert.throws(()=>selectResourceCandidates(old,candidates,'old-0'));assert.throws(()=>selectResourceCandidates({...old,games:[...old.games,hex]},candidates,'hex-cell-lab'));assert.throws(()=>selectResourceCandidates(old,[hex,hex],'hex-cell-lab'));assert.throws(()=>selectResourceCandidates(old,[],'hex-cell-lab'));});
test('selection binds producer previous signed bytes sequence old seven and complete candidate identity',()=>{const {old,hex,candidates,context}=fixture(),record=hexSelectionRecord(old,candidates,context);verifyHexSelection(record,old,candidates,context);for(const key of ['producerCommit','previousSha','nextSequence','previousGamesSha256'])assert.throws(()=>verifyHexSelection({...record,[key]:'changed'},old,candidates,context));for(const key of ['id','contentCode','archiveBytes','archiveSha256','descriptorSha256','assetName']){const changed=structuredClone(record);changed.selected[0][key]='changed';assert.throws(()=>verifyHexSelection(changed,old,candidates,context));}assert.throws(()=>verifyHexSelection(record,{...old,games:old.games.map((g,i)=>i?g:{...g,contentCode:2})},candidates,context));assert.throws(()=>verifyHexSelection(record,old,[{...hex,archiveBytes:101}],context));assert.throws(()=>verifyHexSelection({...record,extra:true},old,candidates,context));});
test('unknown prior hex uploads refuse fresh publication and successor cannot alter old games',()=>{const {old,hex}=fixture(),next={games:[...old.games,{...hex,assetId:8}]};assertHexOnlySuccessor(old,next,hex);assertFreshHexAssets([{name:'other.zip'}]);assert.throws(()=>assertFreshHexAssets([{name:'game-hex-cell-lab-1-'+hex.archiveSha256.slice(0,12)+'.zip'}]));assert.throws(()=>assertFreshHexAssets([{name:'game-hex-cell-lab-2-'+hex.archiveSha256.slice(0,12)+'.zip'}]));assert.throws(()=>assertHexOnlySuccessor(old,{games:next.games.map((g,i)=>i?g:{...g,contentCode:2})},hex));assert.throws(()=>assertHexOnlySuccessor(old,{games:[...next.games,{id:'another'}]},hex));assert.throws(()=>assertHexOnlySuccessor(old,{games:[...old.games,{...hex,assetId:8,archiveBytes:101}]},hex));});
test('malformed orphan hex names and case variants also block a fresh start',()=>{for(const name of ['game-hex-cell-lab-orphan.zip','GAME-HEX-CELL-LAB-1-AAAAAAAAAAAA.ZIP','game-hex-cell-lab.pending','game-hex-cell-lab-corrupt'])assert.throws(()=>assertFreshHexAssets([{name}]));});

test('Ant selection requires eight unique old games including hex and only initial Ant',()=>{
  const f=fixture(),old={catalogSequence:'32',games:[...f.old.games,{...f.hex,assetId:8}]},ant={...f.hex,id:'langtons-ant'},candidates=[...f.candidates,ant],context={...f.context,sequence:'33'};
  assert.deepEqual(selectResourceCandidates(old,candidates,'langtons-ant'),[ant]);const record=selectionRecord(old,candidates,'langtons-ant',context);verifySelection(record,old,candidates,'langtons-ant',context);
  for(const bad of [f.old,{...old,games:old.games.map(g=>g.id==='hex-cell-lab'?ant:g)},{...old,games:[...old.games,ant]},{...old,games:[...old.games.slice(1),old.games[0],old.games[0]]}])assert.throws(()=>selectResourceCandidates(bad,candidates,'langtons-ant'));
  for(const values of [[],[ant,ant],[{...ant,contentCode:2}]])assert.throws(()=>selectResourceCandidates(old,values,'langtons-ant'));
  for(const key of ['producerCommit','previousSha','nextSequence','previousGamesSha256','selector'])assert.throws(()=>verifySelection({...record,[key]:'changed'},old,candidates,'langtons-ant',context));
  for(const key of Object.keys(record.selected[0])){const bad=structuredClone(record);bad.selected[0][key]='changed';assert.throws(()=>verifySelection(bad,old,candidates,'langtons-ant',context));}
  assert.throws(()=>verifySelection(record,{...old,games:old.games.map((g,i)=>i?g:{...g,version:'changed'})},candidates,'langtons-ant',context));
  assert.throws(()=>verifySelection(record,old,[{...ant,releaseNotes:'changed'}],'langtons-ant',context));
  const next={games:[...old.games,{...ant,assetId:9}]};assertSelectedSuccessor(old,next,ant,'langtons-ant');
  for(let i=0;i<8;i++){const bad=structuredClone(next);bad.games[i].version='changed';assert.throws(()=>assertSelectedSuccessor(old,bad,ant,'langtons-ant'));}
  assert.throws(()=>assertSelectedSuccessor(old,{games:[...next.games,{id:'extra'}]},ant,'langtons-ant'));
  for(const name of ['game-langtons-ant-1-a.zip','GAME-LANGTONS-ANT.pending','game-langtons-ant-orphan'])assert.throws(()=>assertFreshSelectedAssets([{name}],'langtons-ant'));assertFreshSelectedAssets([{name:'game-hex-cell-lab-1-a.zip'}],'langtons-ant');
});
test('two-game publication admits exactly two initial games and preserves all 11 existing descriptors',()=>{
 const old={catalogSequence:'39',games:Array.from({length:11},(_,i)=>({id:'old-'+i,contentCode:1,assetId:i+1,archiveSha256:'b'.repeat(64)}))};
 const games=['lights-out-matrix','learning-machine'].map((id,i)=>({id,contentCode:1,archiveBytes:100+i,archiveSha256:(i?'c':'a').repeat(64)}));
 const context={producerCommit:'c'.repeat(40),previousSha:'d'.repeat(64),sequence:'40'};
 assert.deepEqual(selectResourceCandidates(old,[...games,{id:'unrelated'}],'two-new-games'),games);
 const record=selectionRecord(old,games,'two-new-games',context);verifySelection(record,old,games,'two-new-games',context);assert.equal(record.selected.length,2);
 for(const bad of [[],[games[0]], [...games,games[0]],[games[0],{...games[1],contentCode:2}]])assert.throws(()=>selectResourceCandidates(old,bad,'two-new-games'));
 for(const bad of [{...old,games:old.games.slice(1)},{...old,games:[...old.games.slice(1),games[0]]}])assert.throws(()=>selectResourceCandidates(bad,games,'two-new-games'));
 const next={games:[...old.games,...games.map((g,i)=>({...g,assetId:12+i}))]};assertSelectedSuccessor(old,next,games,'two-new-games');
 const altered=structuredClone(next);altered.games[0].contentCode=2;assert.throws(()=>assertSelectedSuccessor(old,altered,games,'two-new-games'));
 assert.throws(()=>assertSelectedSuccessor(old,{games:[...next.games,{id:'extra'}]},games,'two-new-games'));
 for(const id of games.map(g=>g.id))assert.throws(()=>assertFreshSelectedAssets([{name:'game-'+id+'-orphan.zip'}],'two-new-games'));
 const changed=structuredClone(record);changed.selected[1].archiveBytes=1;assert.throws(()=>verifySelection(changed,old,games,'two-new-games',context));
});
