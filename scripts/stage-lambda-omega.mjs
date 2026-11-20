import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {protectLambdaOmega} from './lambda-omega-protection.mjs';
import {inspectResources} from './resource-bundle.mjs';
const base='examples/lambda-diagram-update-20261120',target='examples/lambda-diagram-omega-20261120',revision='b51cef1135d736c3b7e9cb777497e605552a5d25';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(existsSync(target))throw Error('Target already exists');
const original=readFileSync(`${base}/lambda-lab.html`),license=readFileSync(`${base}/LICENSE`),proof=JSON.parse(readFileSync(`${base}/upstream-source.json`));
for(const name of ['lambda-lab.html','LICENSE','upstream-source.json']){
 const tracked=execFileSync('git',['show',`${revision}:${base}/${name}`]);
 if(!tracked.equals(readFileSync(`${base}/${name}`)))throw Error(`Pinned Lambda input differs: ${name}`);
}
if(hash(original)!==proof.integration.outputSha256)throw Error('Pinned source proof differs');
const output=Buffer.from(protectLambdaOmega(original.toString('utf8')));
const metadata={...proof,hallProtection:{id:'lambda-omega-recovery-v1',sourceCommit:revision,inputSha256:hash(original),outputSha256:hash(output),adapterSha256:hash(readFileSync('scripts/lambda-omega-protection.mjs')),historyGuardSha256:hash(readFileSync('scripts/lambda-long-history-guard.inc.js'))}};
const entries=[{path:'lambda-lab.html',data:output},{path:'LICENSE',data:license},{path:'upstream-source.json',data:Buffer.from(JSON.stringify(metadata,null,2)+'\n')}];
inspectResources(entries,'lambda-diagram-game');mkdirSync(target);
for(const entry of entries)writeFileSync(`${target}/${entry.path}`,entry.data,{flag:'wx'});
console.log(`Staged Lambda Omega protection: ${hash(output)}`);
