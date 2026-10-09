import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dynamicSources,packDynamic,verifyPackedDynamic} from '../scripts/dynamic-resources.mjs';
import {attachAssets,validateReleaseSnapshot} from '../scripts/resource-catalog.mjs';
import {assetName} from '../scripts/resource-protocol.mjs';
const source=dynamicSources(readFileSync(new URL('../dynamic-sources.lock.json',import.meta.url))).sources[0];
const entries=source.files.map(path=>({path,data:readFileSync(new URL(`../examples/memory-demo/${path}`,import.meta.url))}));
test('dynamic ZIP is repeatable, exact-manifest and keeps source lock immutable',()=>{
  const first=packDynamic(source,entries),second=packDynamic(source,[...entries].reverse());assert.deepEqual(first,second);
  assert.equal(first.game.sourceRevision,'80898b3ba78ea51a62533c42362f00a4e37421f1');
  assert.throws(()=>packDynamic(source,entries.slice(1)));assert.throws(()=>packDynamic(source,[...entries,{path:'extra.txt',data:Buffer.from('x')}]));
  assert.throws(()=>packDynamic({...source,storageContract:'other'},entries));
  const invalid=JSON.parse(readFileSync(new URL('../dynamic-sources.lock.json',import.meta.url)));invalid.sources[0].revision='main';assert.throws(()=>dynamicSources(Buffer.from(JSON.stringify(invalid))));
});
test('synchronously forged ZIP and candidate metadata cannot claim locked source bytes',()=>{
  const first=packDynamic(source,entries);
  assert.doesNotThrow(()=>verifyPackedDynamic(source,entries,first.game,first.archive));
  const changed=entries.map(e=>e.path==='app.js'?{...e,data:Buffer.concat([e.data,Buffer.from('\n// forged candidate\n')])}:e);
  const forged=packDynamic(source,changed);
  assert.throws(()=>verifyPackedDynamic(source,entries,forged.game,forged.archive),/immutable source bytes/);
});
test('v2 snapshot rejects wrong channel, missing retired ZIP and asset reuse',()=>{
  const {game}=packDynamic(source,entries),release={tag_name:'game-resources-v2',draft:false,prerelease:true,id:10};
  const assets=[{id:100,name:assetName(game),state:'uploaded',size:game.archiveBytes,digest:`sha256:${game.archiveSha256}`}];
  const attached=attachAssets([game],release,assets,'game-resources-v2');
  const payload={releaseId:10,games:attached},snapshot={schemaVersion:1,pageSize:100,release,assetPages:[{page:1,hasNext:false,assets}]};
  assert.doesNotThrow(()=>validateReleaseSnapshot(payload,snapshot,'game-resources-v2'));
  assert.throws(()=>validateReleaseSnapshot(payload,snapshot));
  payload.games[0].available=false;assert.throws(()=>validateReleaseSnapshot(payload,{...snapshot,assetPages:[{page:1,hasNext:false,assets:[]}]},'game-resources-v2'));
  assert.throws(()=>attachAssets([game],release,[...assets,assets[0]],'game-resources-v2'));
});
