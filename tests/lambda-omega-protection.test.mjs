import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {protectLambdaOmega} from '../scripts/lambda-omega-protection.mjs';

test('reviewed Omega transform matches the independently exercised prototype',()=>{
 execFileSync(process.execPath,['scripts/lambda-experiment-build.cjs'],{cwd:new URL('..',import.meta.url)});
 const source=readFileSync(new URL('../examples/lambda-diagram-update-20261120/lambda-lab.html',import.meta.url),'utf8');
 const expected=readFileSync(new URL('../.build/lambda-android-experiment.html',import.meta.url),'utf8');
 assert.equal(protectLambdaOmega(source),expected);
});

test('refuses an unexpected or already transformed resource',()=>{
 assert.throws(()=>protectLambdaOmega('<html>different resource</html>'),/marker changed/);
 const transformed=readFileSync(new URL('../.build/lambda-android-experiment.html',import.meta.url),'utf8');
 assert.throws(()=>protectLambdaOmega(transformed),/marker changed/);
});
