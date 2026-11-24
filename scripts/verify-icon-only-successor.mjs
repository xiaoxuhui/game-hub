import {readFileSync} from 'node:fs';
import {createPublicKey} from 'node:crypto';
import {readStoredZip} from './resource-bundle.mjs';
import {assetName,sha256,verifyEnvelope} from './resource-protocol.mjs';

// Compare every unchanged game byte to its current, signed public resource.
const key=createPublicKey({key:readFileSync('android/app/src/main/res/raw/resource_public_key.der'),format:'der',type:'spki'});
const {catalog}=verifyEnvelope(readFileSync('.build/current-expanded-icon-audit.json'),key,'resources-20261008');
const candidate=JSON.parse(readFileSync('.build/dynamic-candidate/games.unsigned.json','utf8'));
for(const game of candidate){
  const previous=catalog.games.find(g=>g.id===game.id);
  if(!previous || previous.contentCode+1!==game.contentCode || previous.sourceRevision!==game.sourceRevision || previous.sourceRepository!==game.sourceRepository || previous.version!==game.version || previous.storageContract!==game.storageContract) throw Error(`Unexpected source change: ${game.id}`);
  const response=await fetch(`https://api.github.com/repos/xiaoxuhui/game-hub/releases/assets/${previous.assetId}`,{headers:{Accept:'application/octet-stream','User-Agent':'game-hub-icons-audit'},signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error(`Download ${game.id}: HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length!==previous.archiveBytes || sha256(bytes)!==previous.archiveSha256)throw Error(`Published ZIP digest mismatch: ${game.id}`);
  const old=readStoredZip(bytes),now=readStoredZip(readFileSync(`.build/dynamic-candidate/${assetName(game)}`));
  const withoutIcon=now.filter(e=>e.path!=='hub-icon.png');
  if(now.length!==old.length+1 || withoutIcon.length!==old.length || old.some((e,i)=>e.path!==withoutIcon[i].path || !e.data.equals(withoutIcon[i].data))) throw Error(`Non-icon content changed: ${game.id}`);
  console.log(`Verified icon-only ${game.id}`);
}
console.log(`Verified ${candidate.length} icon-only upgrades against signed public ZIPs`);
