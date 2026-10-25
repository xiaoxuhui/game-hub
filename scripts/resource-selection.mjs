import {sha256,assetName} from './resource-protocol.mjs';
function insist(value,message){if(!value)throw Error(message);}
export function selectResourceCandidates(old,candidates,selector){
  if(selector===undefined)return candidates;
  insist(['hex-cell-lab','langtons-ant'].includes(selector),'Unsupported publication selection');
  const expected=selector==='hex-cell-lab'?7:8;
  insist(old.games.length===expected&&new Set(old.games.map(g=>g.id)).size===expected&&!old.games.some(g=>g.id===selector)&&(selector!=='langtons-ant'||old.games.some(g=>g.id==='hex-cell-lab')),'New game requires exact previous catalog without selected ID');
  const selected=candidates.filter(g=>g.id===selector);insist(selected.length===1&&selected[0].contentCode===1,'Exactly one initial selected candidate required');return selected;
}
export function selectionRecord(old,candidates,selector,{producerCommit,previousSha,sequence}){
  insist(/^[a-f0-9]{40}$/.test(producerCommit)&&/^[a-f0-9]{64}$/.test(previousSha)&&/^[1-9][0-9]{0,18}$/.test(sequence)&&BigInt(sequence)===BigInt(old.catalogSequence)+1n,'Invalid selection context');
  const [game]=selectResourceCandidates(old,candidates,selector);
  return {schemaVersion:1,selector,producerCommit,previousSha,nextSequence:sequence,previousGamesSha256:sha256(JSON.stringify(old.games)),selected:[{id:game.id,contentCode:game.contentCode,archiveBytes:game.archiveBytes,archiveSha256:game.archiveSha256,descriptorSha256:sha256(JSON.stringify(game)),assetName:assetName(game)}]};
}
export function verifySelection(record,old,candidates,selector,context){insist(JSON.stringify(record)===JSON.stringify(selectionRecord(old,candidates,selector,context)),'Publication selection changed or missing');}
export function assertFreshSelectedAssets(assets,selector){insist(['hex-cell-lab','langtons-ant'].includes(selector),'Unsupported publication selection');insist(!assets.some(a=>typeof a.name==='string'&&a.name.toLowerCase().startsWith('game-'+selector)),'Existing selected asset requires inspection and verified resume');}
export function assertSelectedSuccessor(old,next,game,selector){
  selectResourceCandidates(old,[game],selector);insist(next.games.length===old.games.length+1&&new Set(next.games.map(g=>g.id)).size===next.games.length,'Selected successor must add exactly one game');
  for(const before of old.games)insist(JSON.stringify(next.games.find(g=>g.id===before.id))===JSON.stringify(before),'Selected publication altered an existing game');
  const added=next.games.find(g=>g.id===selector);insist(added&&Number.isSafeInteger(added.assetId)&&added.assetId>0,'New selected asset identity missing');const {assetId,...descriptor}=added;insist(JSON.stringify(descriptor)===JSON.stringify(game),'Selected descriptor changed');
}
// Keep the original hex contract API and records byte-compatible for recovery/audit.
export const hexSelectionRecord=(old,candidates,context)=>selectionRecord(old,candidates,'hex-cell-lab',context);
export const verifyHexSelection=(record,old,candidates,context)=>verifySelection(record,old,candidates,'hex-cell-lab',context);
export const assertFreshHexAssets=assets=>assertFreshSelectedAssets(assets,'hex-cell-lab');
export const assertHexOnlySuccessor=(old,next,game)=>assertSelectedSuccessor(old,next,game,'hex-cell-lab');
