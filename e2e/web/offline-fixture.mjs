// Node-only integration fixture. No private key or runtime trust override is
// written into either build. Production verify rejects the marked test output.
import {cpSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {files,metadata,removeOwned} from '../../scripts/web/files.mjs';
import {verifyWeb} from '../../scripts/web/build.mjs';
import {signedPayload,signPayload,testSpki,TEST_KEY_ID} from '../../tests/fixtures/web-signed.mjs';
export async function prepareOfflineFixture(projectRoot,production){
  const root=join(projectRoot,'.build/web-offline-fixture'),basePath=production.basePath,origin='http://127.0.0.1:18428';
  if(existsSync(root))removeOwned(join(projectRoot,'.build'),root);cpSync(join(projectRoot,'.build/web-dist'),root,{recursive:true});
  const shell={schemaVersion:1,build:production.sourceCommit,basePath,files:production.files.filter(f=>!f.path.startsWith('games/')&&!['catalog.json','sw.js'].includes(f.path)&&!f.path.startsWith('__hub/current'))};
  const trust=resolve(projectRoot,'web/src/update/trust.mjs');let replacements=0;
  const compiled=await build({absWorkingDir:projectRoot,entryPoints:[join(projectRoot,'web/sw/entry.mjs')],bundle:true,write:false,metafile:true,format:'iife',platform:'browser',target:'es2022',charset:'utf8',legalComments:'inline',define:{__HUB_BUILD__:JSON.stringify(production.sourceCommit),__HUB_BASE__:JSON.stringify(basePath),__HUB_SHELL__:JSON.stringify(shell)},plugins:[{name:'node-only-public-test-identity',setup(builder){builder.onLoad({filter:/[\\/]update[\\/]trust\.mjs$/},args=>{
    if(resolve(args.path)!==trust)throw Error('Unexpected trust input');let contents=readFileSync(trust,'utf8');
    for(const [name,value] of [['PINNED_KEY_ID',TEST_KEY_ID],['PINNED_SPKI_BASE64',Buffer.from(testSpki).toString('base64')]]){
      const pattern=new RegExp(`export const ${name}='[^']+';`,'g'),matches=contents.match(pattern);if(matches?.length!==1)throw Error('Test trust replacement ambiguous');contents=contents.replace(pattern,`export const ${name}=${JSON.stringify(value)};`);
    }replacements++;return {contents,loader:'js',resolveDir:join(projectRoot,'web/src/update')};
  });
  // Explicit local red reproduction only; the production builder has no alias.
  if(process.env.WEB_RPC_REVIEW_RED==='1')builder.onLoad({filter:/[\\/]sw[\\/]resources\.mjs$/},()=>({contents:execFileSync('git',['show','3e1da25:web/sw/resources.mjs'],{cwd:projectRoot,encoding:'utf8'}),loader:'js',resolveDir:join(projectRoot,'web/sw')}));
  }}]});
  if(replacements!==1||compiled.outputFiles.length!==1||Object.values(compiled.metafile.outputs).some(o=>o.imports.length))throw Error('Invalid test SW closure');
  const timingProbe=`\n// Test timing only: keep real WebCrypto verification, then pause its result.\nconst originalVerify=crypto.subtle.verify.bind(crypto.subtle);crypto.subtle.verify=async(...args)=>{const valid=await originalVerify(...args);if(valid)try{await fetch(${JSON.stringify(origin+basePath+'__fixture/verified.json')},{cache:'no-store'});}catch{}return valid;};\n`;
  writeFileSync(join(root,'sw.js'),Buffer.concat([Buffer.from(compiled.outputFiles[0].contents),Buffer.from(timingProbe)]));
  const catalog=JSON.parse(readFileSync(join(root,'catalog.json'),'utf8')),payload=signedPayload({catalog,origin,basePath});
  payload.issuedAt=new Date(Date.now()-1000).toISOString();payload.expiresAt=new Date(Date.now()+3600000).toISOString();
  const normal=signPayload(payload),expired=signPayload({...payload,issuedAt:new Date(Date.now()-7200000).toISOString(),expiresAt:new Date(Date.now()-3600000).toISOString()});
  const changed=JSON.parse(normal);changed.signatureBase64=(changed.signatureBase64[0]==='A'?'B':'A')+changed.signatureBase64.slice(1);
  const tampered=Buffer.from(JSON.stringify(changed));mkdirSync(join(root,'__hub'),{recursive:true});writeFileSync(join(root,'__hub/current.json'),normal);
  const manifest={...production,testOnly:'ephemeral-public-key-no-production-verification',files:metadata(files(root).filter(f=>f.path!=='build-manifest.json'))};
  writeFileSync(join(root,'build-manifest.json'),JSON.stringify(manifest));
  let rejected=false;try{verifyWeb(projectRoot,root);}catch(error){if(!error.message.includes('manifest differs'))throw error;rejected=true;}if(!rejected)throw Error('Production verifier accepted a test identity');
  writeFileSync(join(projectRoot,'.build/web-offline-info.json'),JSON.stringify({origin,basePath,build:production.sourceCommit,games:catalog.games.map(g=>({id:g.id,files:g.files.length,entryUrl:g.entryUrl}))}));
  return {root,variants:{normal,expired,tampered}};
}
