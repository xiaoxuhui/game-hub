import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {preserveLambdaSessions} from '../scripts/lambda-preserve-sessions.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url)),hash=x=>createHash('sha256').update(x).digest('hex');
test('preservation resource reproduces exact issued content 14 and its adapter',()=>{
 const base='examples/lambda-diagram-038-20261121/',next='examples/lambda-preserve-20261121/';
 const source=read(base+'lambda-lab.html'),output=read(next+'lambda-lab.html'),proof=JSON.parse(read(next+'upstream-source.json')).hallSessionPreservation;
 assert.deepEqual(Buffer.from(preserveLambdaSessions(source.toString('utf8'))),output);
 assert.equal(proof.inputSha256,hash(source));assert.equal(proof.outputSha256,hash(output));assert.equal(proof.adapterSha256,hash(read('scripts/lambda-preserve-sessions.mjs')));
 assert.equal(proof.sourceCommit,'e11edee273a8c66763262c6d9a6732c7c88709de');assert.deepEqual(read(base+'LICENSE'),read(next+'LICENSE'));
});
test('preservation transform refuses unrecognized or already adapted content',()=>{
 assert.throws(()=>preserveLambdaSessions('<html/>'),/marker changed/);
 assert.throws(()=>preserveLambdaSessions(read('examples/lambda-preserve-20261121/lambda-lab.html').toString()),/marker changed/);
});
