import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {sha256} from './resource-protocol.mjs';

// The instrumentation APK receives only exact ZIPs from the independently verified production candidate.
execFileSync(process.execPath,['scripts/dynamic-resources.mjs','--verify'],{stdio:'inherit'});
const input=resolve('.build/dynamic-candidate');
const games=JSON.parse(readFileSync(resolve(input,'games.unsigned.json'),'utf8'));
const expected=new Map([
  ['turbowarp-neural-network','63943ff21d51ba4ba56f1817fc970c0fab88cde0'],
  ['turbowarp-logic-lab','04089708095ed77b4fde2c3c023406a79a3d68b5']
]);
const selected=[...expected].map(([id,revision])=>{
  const game=games.find(item=>item.id===id);
  if(!game || game.sourceRevision!==revision || game.contentCode!==1)throw Error(`Unexpected source for ${id}`);
  return game;
});
const output=resolve('android/app/build/generated/dynamic-device-assets/turbowarp-candidate');
mkdirSync(output,{recursive:true});
for(const game of selected){
  const name=`game-${game.id}-${game.contentCode}-${game.archiveSha256.slice(0,12)}.zip`;
  const source=resolve(input,name);
  if(sha256(readFileSync(source))!==game.archiveSha256)throw Error(`Candidate digest changed: ${game.id}`);
  copyFileSync(source,resolve(output,`${game.id}.zip`));
}
writeFileSync(resolve(output,'games.json'),JSON.stringify(selected,null,2)+'\n');
console.log('Prepared two exact TurboWarp candidate ZIPs for Android WebView test');
