import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {protectLambdaOmega} from '../scripts/lambda-omega-protection.mjs';
import {inspectResources} from '../scripts/resource-bundle.mjs';
const root=new URL('../',import.meta.url),read=path=>readFileSync(new URL(path,root)),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('staged Lambda protection is reproducible from the pinned existing resource',()=>{
 const input=read('examples/lambda-diagram-update-20261120/lambda-lab.html'),output=read('examples/lambda-diagram-omega-20261120/lambda-lab.html');
 const metadata=JSON.parse(read('examples/lambda-diagram-omega-20261120/upstream-source.json'));
 assert.deepEqual(output,Buffer.from(protectLambdaOmega(input.toString('utf8'))));
 assert.equal(metadata.hallProtection.sourceCommit,'b51cef1135d736c3b7e9cb777497e605552a5d25');
 assert.equal(metadata.hallProtection.inputSha256,hash(input));assert.equal(metadata.hallProtection.outputSha256,hash(output));
 assert.equal(metadata.hallProtection.adapterSha256,hash(read('scripts/lambda-omega-protection.mjs')));
 assert.equal(metadata.hallProtection.historyGuardSha256,hash(read('scripts/lambda-long-history-guard.inc.js')));
 assert.deepEqual(read('examples/lambda-diagram-omega-20261120/LICENSE'),read('examples/lambda-diagram-update-20261120/LICENSE'));
 inspectResources(['lambda-lab.html','LICENSE','upstream-source.json'].map(path=>({path,data:read('examples/lambda-diagram-omega-20261120/'+path)})),'lambda-diagram-game');
});
