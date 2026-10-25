import {sha256,assetName} from './resource-protocol.mjs';
function insist(value,message){if(!value)throw Error(message);}
export function selectResourceCandidates(old,candidates,selector){
  if(selector===undefined)return candidates;
  insist(selector==='hex-cell-lab','Unsupported publication selection');
  insist(old.games.length===7&&new Set(old.games.map(g=>g.id)).size===7&&!old.games.some(g=>g.id==='hex-cell-lab'),'New hex requires unchanged seven-game previous catalog without hex');
  const selected=candidates.filter(g=>g.id==='hex-cell-lab');insist(selected.length===1&&selected[0].contentCode===1,'Exactly one initial hex candidate required');return selected;
}
export function hexSelectionRecord(old,candidates,{producerCommit,previousSha,sequence}){
  insist(/^[a-f0-9]{40}$/.test(producerCommit)&&/^[a-f0-9]{64}$/.test(previousSha)&&/^[1-9][0-9]{0,18}$/.test(sequence)&&BigInt(sequence)===BigInt(old.catalogSequence)+1n,'Invalid selection context');
  const [game]=selectResourceCandidates(old,candidates,'hex-cell-lab');
  return {schemaVersion:1,selector:'hex-cell-lab',producerCommit,previousSha,nextSequence:sequence,previousGamesSha256:sha256(JSON.stringify(old.games)),selected:[{id:game.id,contentCode:game.contentCode,archiveBytes:game.archiveBytes,archiveSha256:game.archiveSha256,descriptorSha256:sha256(JSON.stringify(game)),assetName:assetName(game)}]};
}
export function verifyHexSelection(record,old,candidates,context){insist(JSON.stringify(record)===JSON.stringify(hexSelectionRecord(old,candidates,context)),'Publication selection changed or missing');}
export function assertFreshHexAssets(assets){insist(!assets.some(a=>typeof a.name==='string'&&a.name.toLowerCase().startsWith('game-hex-cell-lab')),'Existing hex asset requires inspection and verified resume');}
export function assertHexOnlySuccessor(old,next,game){
  selectResourceCandidates(old,[game],'hex-cell-lab');insist(next.games.length===old.games.length+1&&new Set(next.games.map(g=>g.id)).size===next.games.length,'Hex-only successor must add exactly one game');
  for(const before of old.games)insist(JSON.stringify(next.games.find(g=>g.id===before.id))===JSON.stringify(before),'Hex-only publication altered an existing game');
  const added=next.games.find(g=>g.id==='hex-cell-lab');insist(added&&Number.isSafeInteger(added.assetId)&&added.assetId>0,'New hex asset identity missing');const {assetId,...descriptor}=added;insist(JSON.stringify(descriptor)===JSON.stringify(game),'Selected hex descriptor changed');
}
