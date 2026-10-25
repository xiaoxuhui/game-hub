import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HEX_REVISION,HEX_FILES} from '../scripts/hex-cell-lab-source.mjs';
import {sha256} from '../scripts/resource-protocol.mjs';
import {inspectResources} from '../scripts/resource-bundle.mjs';
test('hex-cell source closure preserves fixed runtime bytes and both MIT licenses',()=>{
  const root=new URL('../examples/hex-cell-lab/',import.meta.url),proof=JSON.parse(readFileSync(new URL('upstream-source.json',root))),entries=HEX_FILES.map(path=>({path,data:readFileSync(new URL(path,root))}));
  assert.equal(proof.revision,HEX_REVISION);assert.equal(proof.version,'1.4.0');assert.equal(proof.license.spdx,'MIT');assert.match(proof.license.authorization,/explicitly approved/);assert.deepEqual(proof.adaptations,[]);
  for(const e of entries){const input=proof.inputs.find(i=>i.path===e.path),output=proof.outputs.find(i=>i.path===e.path);assert.equal(input.sha256,sha256(e.data));assert.deepEqual(input,output);}
  assert.match(readFileSync(new URL('LICENSE',root),'utf8'),/^MIT License/);const vendor=readFileSync(new URL('vendor/jsep-1.4.0/LICENSE',root),'utf8');assert.match(vendor,/Copyright \(c\) 2013 Stephen Oney/);assert.match(vendor,/Permission is hereby granted, free of charge/);assert.match(vendor,/THE SOFTWARE IS PROVIDED "AS IS"/);
  assert.doesNotThrow(()=>inspectResources(entries,'hex-cell-lab'));assert.match(entries.find(e=>e.path==='src/app.js').data.toString(),/KEY='cell-lab-v1'/);
  const html=entries.find(e=>e.path==='index.html').data.toString();for(const match of html.matchAll(/<(script|link|img|base)\b[^>]*?(?:src|href)=["']([^"']+)["']/g)){if(match[1]==='base'){assert.equal(match[2],'./');continue;}if(match[2].startsWith('data:')||match[2].startsWith('#'))continue;assert.ok(HEX_FILES.includes(match[2].replace(/^\.\//,'')),'Unlisted runtime '+match[2]);}
});
