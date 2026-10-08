import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {packDynamic,verifyDynamicResources} from './scripts/dynamic-resources.mjs';
import {assetName} from './scripts/resource-protocol.mjs';
const root=process.cwd(),output=join(root,'.build/dynamic-candidate'),source=JSON.parse(readFileSync('dynamic-sources.lock.json')).sources[0];
const metadataPath=join(output,'games.unsigned.json'),metadata=readFileSync(metadataPath),game=JSON.parse(metadata)[0],oldPath=join(output,assetName(game));
const entries=source.files.map(path=>({path,data:readFileSync(join(root,'.build/dynamic-sources',source.id,source.directory,path))}));
const forged=packDynamic(source,entries.map(e=>e.path==='app.js'?{...e,data:Buffer.concat([e.data,Buffer.from('\n// forged candidate\n')])}:e));
const forgedPath=join(output,assetName(forged.game)),preserved=oldPath+'.verification-preserved';
let rejected=false;
try {renameSync(oldPath,preserved);writeFileSync(forgedPath,forged.archive);writeFileSync(metadataPath,JSON.stringify([forged.game],null,2)+'\n');
// Preserved original temporarily outside candidate so exact file inventory reaches source check.
renameSync(preserved,join(root,'.build/candidate-archive-verification-preserved'));
try {verifyDynamicResources(output,root);}catch(error){console.log('SYNCHRONIZED FORGERY REJECTED: '+error.message);rejected=/immutable source bytes/.test(error.message);}
} finally {
const {unlinkSync,existsSync}=await import('node:fs');if(existsSync(forgedPath))unlinkSync(forgedPath);writeFileSync(metadataPath,metadata);
const saved=join(root,'.build/candidate-archive-verification-preserved');if(existsSync(saved))renameSync(saved,oldPath);else if(existsSync(preserved))renameSync(preserved,oldPath);
}
if(!rejected)throw new Error('Actual verify did not reject forged source');
verifyDynamicResources(output,root);
const clone=join(root,'.build/dynamic-sources',source.id),app=join(clone,source.directory,'app.js'),before=readFileSync(app);
try {writeFileSync(app,Buffer.from(before.toString().replace(/\r?\n/g,'\r\n')));console.log('CRLF source status: '+JSON.stringify(execFileSync('git',['status','--porcelain=v1'],{cwd:clone,encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}}).trim()));
try {verifyDynamicResources(output,root);throw new Error('Unexpected CRLF acceptance');}catch(error){if(!/committed blob bytes|dirty/.test(error.message))throw error;console.log('NONBLOB WORKING BYTES REJECTED: '+error.message);}
} finally {writeFileSync(app,before);}
verifyDynamicResources(output,root);
