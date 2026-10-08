import {readFileSync,writeFileSync} from 'node:fs';
import {createPublicKey} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {strictJson,signCatalog,verifyEnvelope} from './resource-protocol.mjs';
import {validateDynamicCatalog} from './dynamic-protocol.mjs';
import {captureReleaseSnapshot,validateReleaseSnapshot} from './resource-catalog.mjs';
const tag='game-resources-v2';
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [mode,input,keyPath,keyId,output,snapshot]=process.argv.slice(2);
    if(mode==='capture' && input && !keyPath) {writeFileSync(input,JSON.stringify(await captureReleaseSnapshot(fetch,tag),null,2)+'\n',{flag:'wx'});console.log('Captured complete public v2 assets');}
    else if(mode==='sign' && output && snapshot) {
      const payload=validateDynamicCatalog(strictJson(readFileSync(input)));validateReleaseSnapshot(payload,strictJson(readFileSync(snapshot),4194304),tag);
      const key=readFileSync(keyPath==='-'?0:keyPath),signed=signCatalog(payload,key,keyId),checked=verifyEnvelope(signed,key,keyId);validateDynamicCatalog(checked.catalog);
      writeFileSync(output,signed,{flag:'wx'});console.log(`Signed dynamic sequence ${payload.catalogSequence}; ${checked.payloadSha256}`);
    } else if(mode==='verify' && keyId && !output) {
      const bytes=readFileSync(keyPath),key=keyPath.endsWith('.der')?createPublicKey({key:bytes,format:'der',type:'spki'}):bytes;
      const checked=verifyEnvelope(readFileSync(input),key,keyId);validateDynamicCatalog(checked.catalog);console.log(`Verified dynamic sequence ${checked.catalog.catalogSequence}; ${checked.payloadSha256}`);
    } else throw new Error('Usage: dynamic-catalog.mjs capture snapshot.json | sign payload.json key-path-or-stdin key-id output.json snapshot.json | verify envelope.json public-key-path key-id');
  }catch(error){console.error(error.message);process.exitCode=1;}
}
