import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {integrateLambdaC5Html} from '../scripts/lambda-storage-integration.mjs';

test('current Lambda workspace retains manual restore and backs up before explicit replacement',()=>{
 const upstream=readFileSync(new URL('./fixtures/lambda-upstream-d097.html',import.meta.url));
 assert.equal(createHash('sha256').update(upstream).digest('hex'),'0e65b21716f08e599cc357ffa15ceed1383ca93912e9e94e060aa00185aa51f0');
 const actual=integrateLambdaC5Html(upstream);
 assert.deepEqual(actual,readFileSync(new URL('../examples/lambda-diagram-update-20261120/lambda-lab.html',import.meta.url)));
 const html=actual.toString('utf8');
 assert.match(html,/function prepareManualRestore\(\)/);
 assert.match(html,/encodingsFor:t=>L\.encodingsFor\(t,functions\)/);
 assert.match(html,/localStorage\.setItem\('lambda-lab-previous-v2',current\)/);
 assert.match(html,/storeSnapshot\(snapshot,\{checkpointText:null,removeLegacy:true\}\)/);
 assert.match(html,/checkpoint=null;\$\('restore-state'\)\.disabled=true;lastCaptured=signature\(captured\(\)\);return result/);
});
