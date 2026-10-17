import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {historicalSample,historicalReader} from '../fixtures/mini-history/read.mjs';
for(const slot of [1,2,3,4])test(`fixed mini v${slot} helper identities and actual old reader accept its native sample`,async()=>{
  const root=new URL(`../fixtures/mini-history/v${slot}/`,import.meta.url),proof=JSON.parse(readFileSync(new URL('provenance.json',root))),hash=data=>createHash('sha256').update(data).digest('hex');
  assert.equal(proof.repository,'https://github.com/xiaoxuhui/mini-scratch.git');assert.match(proof.revision,/^[0-9a-f]{40}$/);assert.equal(proof.slot,slot);
  assert.deepEqual(readdirSync(root).sort(),[...proof.files.map(f=>f.path),'sample.json','provenance.json'].sort());
  for(const file of [...proof.files,proof.sample]){const data=readFileSync(new URL(file.path,root));assert.equal(data.length,file.bytes);assert.equal(hash(data),file.sha256);}
  assert.match(readFileSync(new URL('LICENSE',root),'utf8'),/^MIT License/);
  const raw=historicalSample(slot),parsed=JSON.parse(raw);assert.deepEqual(await historicalReader(slot,[[`inspiration-blocks-v${slot}`,raw]]),parsed);
  if(slot>=2){assert.ok(parsed.variables.length);assert.ok(parsed.blocks.some(b=>b.type==='whenKey'));}
  if(slot>=3)assert.ok(parsed.blocks.find(b=>b.type==='define').parameters.length);
  if(slot===4){assert.equal(parsed.eventScripts,true);assert.ok(parsed.blocks.some(b=>b.type==='whenFlag'));}
});
