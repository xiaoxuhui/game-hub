import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {validateOnlineCatalog,changes,snapshot} from '../../web/src/core/online-catalog.mjs';
const original=JSON.parse(readFileSync(new URL('../../.build/web-dist/catalog.json',import.meta.url)));
test('actual eight-game output catalog is valid',()=>{validateOnlineCatalog(original,original.basePath);});
for(const field of ['files','sourceFiles'])test(`actual same-code ${field} hash mutation is refused`,()=>{
  const next=structuredClone(original);next.games[0][field][0].sha256='f'.repeat(64);
  assert.throws(()=>{validateOnlineCatalog(next,next.basePath);changes(snapshot(original),next);});
});
