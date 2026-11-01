import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPublicKey} from 'node:crypto';
import {sha256,LIMITS} from './resource-protocol.mjs';
import {captureReleaseSnapshot} from './resource-catalog.mjs';
import {validateBootstrap} from './expanded-bootstrap.mjs';
import {publicDownloadUrl} from './resource-successor.mjs';

async function publicBytes(asset,request){
  const response=await request(String(publicDownloadUrl(asset)),{headers:{'User-Agent':'game-hub-expanded-review','Cache-Control':'no-cache'},signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error(`Asset HTTP ${response.status}`);
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>LIMITS.envelope)throw Error('Catalog asset exceeds limit');chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);if(asset.state!=='uploaded'||size!==asset.size||asset.digest!==`sha256:${sha256(bytes)}`)throw Error('Catalog asset bytes mismatch');return bytes;
}
export async function inspectExpandedBootstrap(request,publicKey,expectedSha,online=false,now=Date.now(),expectedReleaseId=407394942){
  if(!/^[a-f0-9]{64}$/.test(expectedSha))throw Error('Exact legacy SHA required');
  const snapshot=await captureReleaseSnapshot(request,'game-resources-v2'),assets=snapshot.assetPages.flatMap(p=>p.assets),legacy=assets.filter(a=>a.name==='catalog.signed.json');
  if(legacy.length!==1)throw Error('Legacy current catalog unavailable');
  const bytes=await publicBytes(legacy[0],request);if(sha256(bytes)!==expectedSha)throw Error('Legacy current catalog moved');
  const result=validateBootstrap(snapshot,bytes,publicKey,now,expectedReleaseId,online);
  if(online){const expanded=assets.filter(a=>a.name==='catalog-expanded.signed.json');if(expanded.length!==1)throw Error('Expanded current catalog unavailable');const actual=await publicBytes(expanded[0],request);if(!actual.equals(bytes))throw Error('Expanded catalog differs from legacy bytes');}
  return {snapshot,bytes,result};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const [mode,directory,expectedSha]=process.argv.slice(2);if(!['preflight','online'].includes(mode)||!directory||!expectedSha||process.argv.length!==5)throw Error('Usage: expanded-bootstrap-check.mjs preflight|online evidence-directory legacy-sha');
    const der=readFileSync(new URL('../android/app/src/main/res/raw/resource_public_key.der',import.meta.url));if(sha256(der)!=='649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673')throw Error('Production public key changed');
    const key=createPublicKey({key:der,format:'der',type:'spki'}),state=await inspectExpandedBootstrap(fetch,key,expectedSha,mode==='online');
    const put=(name,data)=>writeFileSync(join(directory,name),data,{flag:'wx'});
    put(`bootstrap-${mode}-snapshot.json`,JSON.stringify(state.snapshot,null,2)+'\n');put(`bootstrap-${mode}-result.json`,JSON.stringify(state.result,null,2)+'\n');if(mode==='preflight')put('legacy-for-expanded.signed.json',state.bytes);
    console.log(`Verified ${mode} expanded bootstrap; legacy sequence ${state.result.sequence}; sha256 ${state.result.catalogSha256}`);
  }catch(error){console.error(error.message);process.exitCode=1;}
}
