import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {integrateLambdaC5Html} from '../scripts/lambda-storage-integration.mjs';
import {protectLambda037} from '../scripts/lambda-037-protection.mjs';

test('current Lambda workspace retains manual restore and backs up before explicit replacement',()=>{
 const upstream=readFileSync(new URL('./fixtures/lambda-upstream-0.3.8.html',import.meta.url));
 const proof=JSON.parse(readFileSync(new URL('./fixtures/lambda-upstream-0.3.8.json',import.meta.url)));
 assert.equal(createHash('sha256').update(upstream).digest('hex'),proof.trackedArtifact.sha256);
 const actual=Buffer.from(protectLambda037(integrateLambdaC5Html(upstream).toString('utf8')));
 assert.deepEqual(actual,readFileSync(new URL('../examples/lambda-diagram-038-20261121/lambda-lab.html',import.meta.url)));
 const html=actual.toString('utf8');
 assert.match(html,/function prepareManualRestore\(\)/);
 assert.match(html,/encodingsFor:t=>L\.encodingsFor\(t,functions\)/);
 assert.match(html,/localStorage\.setItem\('lambda-lab-previous-v2',current\)/);
 assert.match(html,/storeSnapshot\(snapshot,\{checkpointText:null,removeLegacy:true\}\)/);
 assert.match(html,/checkpoint=null;\$\('restore-state'\)\.disabled=true;lastCaptured=signature\(captured\(\)\);return result/);
});
