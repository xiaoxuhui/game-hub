import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateProof} from '../scripts/stage-upstreams.mjs';
import {sha256} from '../scripts/resource-protocol.mjs';
const lock=JSON.parse(readFileSync(new URL('../dynamic-upstreams.lock.json',import.meta.url)));
for(const source of lock.sources){
  test(`${source.id} committed integration bytes bind to exact upstream identity and reject forged proof`,()=>{
    const base=new URL(`../examples/${source.id}/`,import.meta.url),proof=JSON.parse(readFileSync(new URL('upstream-source.json',base)));
    const outputs=proof.outputs.map(f=>{const data=readFileSync(new URL(f.path,base));return {path:f.path,bytes:data.length,sha256:sha256(data)};});
    assert.doesNotThrow(()=>validateProof(proof,source,proof.inputs,outputs));
    for(const mutate of [p=>p.revision='a'.repeat(40),p=>p.outputs[0].sha256='0'.repeat(64),p=>p.inputs[0].path='../outside']){
      const fake=structuredClone(proof);mutate(fake);assert.throws(()=>validateProof(fake,source,proof.inputs,outputs));
    }
    if(source.kind==='inline-html'){
      const fake=structuredClone(proof);fake.trackedArtifact.matchesRebuild=false;assert.throws(()=>validateProof(fake,source,proof.inputs,outputs),/tracked artifact/);
    }
  });
}
