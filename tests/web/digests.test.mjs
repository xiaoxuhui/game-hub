import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {sha256Hex,fileTreeDigest} from '../../web/src/core/digests.mjs';
import {treeHash} from '../../scripts/web/files.mjs';
const native=data=>createHash('sha256').update(data).digest('hex');
test('portable SHA256 matches native empty, Unicode, million-byte and binary vectors without WebCrypto',()=>{
  for(const value of ['', '游戏大厅 λ', 'a'.repeat(1000000),new Uint8Array(Array.from({length:8192},(_,i)=>i%256))])assert.equal(sha256Hex(value),native(value));
  const entries=[{path:'a.js',data:Buffer.from('a')},{path:'b.css',data:Buffer.from('b')}];
  assert.equal(fileTreeDigest(entries.map(e=>({path:e.path,bytes:e.data.length,sha256:native(e.data),mime:e.path.endsWith('.js')?'application/javascript':'text/css'}))),treeHash(entries));
});
test('vendored SHA implementation matches exact pinned upstream bytes apart from documented import/map adjustments',()=>{
  const directory=new URL('../../web/src/vendor/noble-hashes/',import.meta.url),proof=JSON.parse(readFileSync(new URL('provenance.json',directory)));
  assert.equal(proof.version,'1.8.0');assert.equal(JSON.parse(readFileSync(new URL('../../node_modules/@noble/hashes/package.json',import.meta.url))).version,'1.8.0');
  for(const file of proof.files){
    const original=readFileSync(new URL('../../node_modules/@noble/hashes/esm/'+file.path,import.meta.url)),actual=readFileSync(new URL(file.path,directory));
    let text=original.toString().replace(/^\/\/# sourceMappingURL=.*\r?\n?/gm,'');if(file.path==='utils.js')text=text.replace("from '@noble/hashes/crypto'","from './crypto.js'");
    assert.equal(native(original),file.originalSha256);assert.equal(native(actual),file.adaptedSha256);assert.equal(actual.toString(),text);
  }
  const license=readFileSync(new URL('LICENSE',directory));assert.equal(native(license),proof.licenseSha256);assert.equal(license.compare(readFileSync(new URL('../../node_modules/@noble/hashes/LICENSE',import.meta.url))),0);
});
