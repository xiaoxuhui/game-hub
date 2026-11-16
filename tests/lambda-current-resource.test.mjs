import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {integrateLambdaC5Html} from '../scripts/lambda-storage-integration.mjs';

test('current Lambda workspace retains manual restore and backs up before explicit replacement',()=>{
 const upstream=readFileSync(new URL('./fixtures/lambda-upstream-cb7bf98.html',import.meta.url));
 const actual=integrateLambdaC5Html(upstream);
 assert.deepEqual(actual,readFileSync(new URL('../examples/lambda-diagram-update/lambda-lab.html',import.meta.url)));
 const html=actual.toString('utf8');
 assert.match(html,/function prepareManualRestore\(\)/);
 assert.match(html,/encodingsFor:t=>L\.encodingsFor\(t,functions\)/);
 assert.match(html,/checkpoint=null;\$\('restore-state'\)\.disabled=true;persist\(true\);return result/);
});
