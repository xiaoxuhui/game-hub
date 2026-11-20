import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {fixLambdaExportRoundTrip} from '../scripts/lambda-export-roundtrip.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url)),hash=x=>createHash('sha256').update(x).digest('hex');
test('round-trip resource reproduces pinned content 15 without changing the source',()=>{
 const base='examples/lambda-preserve-20261121/',target='examples/lambda-roundtrip-20261121/',source=read(base+'lambda-lab.html'),out=read(target+'lambda-lab.html'),proof=JSON.parse(read(target+'upstream-source.json')).hallRoundTripFix;
 assert.deepEqual(Buffer.from(fixLambdaExportRoundTrip(source.toString('utf8'))),out);assert.equal(proof.inputSha256,hash(source));assert.equal(proof.outputSha256,hash(out));assert.equal(proof.adapterSha256,hash(read('scripts/lambda-export-roundtrip.mjs')));assert.deepEqual(read(base+'LICENSE'),read(target+'LICENSE'));
 assert.throws(()=>fixLambdaExportRoundTrip(out.toString()),/marker changed|boundary changed/);
});
