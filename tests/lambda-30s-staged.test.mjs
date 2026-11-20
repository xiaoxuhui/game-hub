import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {protectLambdaOmega} from '../scripts/lambda-30s-protection.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
test('new Lambda resource is reproducible and keeps pinned source provenance',()=>{
 const base='examples/lambda-diagram-update-20261120/',target='examples/lambda-diagram-30s-20261120/';
 const input=read(base+'lambda-lab.html'),output=read(target+'lambda-lab.html'),proof=JSON.parse(read(target+'upstream-source.json')).hallProtection;
 assert.deepEqual(Buffer.from(protectLambdaOmega(input.toString('utf8'))),output);
 assert.equal(proof.inputSha256,hash(input));assert.equal(proof.outputSha256,hash(output));
 assert.equal(proof.adapterSha256,hash(read('scripts/lambda-30s-protection.mjs')));
 assert.equal(proof.historyGuardSha256,hash(read('scripts/lambda-long-history-30s.inc.js')));
 assert.deepEqual(read(base+'LICENSE'),read(target+'LICENSE'));
});
