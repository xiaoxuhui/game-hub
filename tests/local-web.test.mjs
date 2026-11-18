import test from 'node:test';
import assert from 'node:assert/strict';
import {createZip} from '../scripts/resource-bundle.mjs';
import {sha256} from '../scripts/resource-protocol.mjs';
import {verifyArchive,assignPorts} from '../scripts/install-local-web.mjs';
test('local installation validates both the whole archive and each signed file',()=>{
 const entries=[{path:'index.html',data:Buffer.from('<h1>game</h1>')},{path:'LICENSE',data:Buffer.from('MIT')}],zip=createZip(entries),game={id:'example',entryPage:'index.html',archiveBytes:zip.length,archiveSha256:sha256(zip),files:entries.map(e=>({path:e.path,bytes:e.data.length,sha256:sha256(e.data)}))};
 assert.equal(verifyArchive(game,zip).length,2);assert.throws(()=>verifyArchive({...game,archiveSha256:'0'.repeat(64)},zip),/摘要/);assert.throws(()=>verifyArchive({...game,files:game.files.slice(1)},zip),/数量/);assert.throws(()=>verifyArchive({...game,files:game.files.map(f=>({...f,sha256:'0'.repeat(64)}))},zip),/校验/);
});
test('game ports are deterministic, distinct and independent of input order',()=>{
 const inputs=['lambda-diagram-game','conway','eml','light','turing'].map(id=>({id})),one=assignPorts(inputs),two=assignPorts([...inputs].reverse());assert.deepEqual(one,two);assert.equal(new Set(one.map(x=>x.port)).size,inputs.length);assert.ok(one.every(x=>x.port>=18500&&x.port<=19499));
});
