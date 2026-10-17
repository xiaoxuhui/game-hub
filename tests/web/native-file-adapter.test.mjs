import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guardNativeFileReads} from '../../scripts/web/native-file-adapter.mjs';
test('native file adapter rewrites only audited await reads and refuses layout or call-count drift',()=>{
  const original=Buffer.from('async function importProject(file){const value=JSON.parse(await file.text());return value;}'),files=[{path:'src/app.js',data:original},{path:'src/assets.js',data:Buffer.from('await file.text()')}],result=guardNativeFileReads('mini-scratch',files);
  assert.match(result[0].data.toString(),/await globalThis.GameHubReadNativeFile\(file\)/);assert.equal(result[1].data.toString(),'await file.text()');assert.equal(files[0].data,original);
  assert.throws(()=>guardNativeFileReads('mini-scratch',[]),/layout/);assert.throws(()=>guardNativeFileReads('mini-scratch',[{path:'src/app.js',data:Buffer.from('async function f(){return 1}')}]),/count/);
  assert.throws(()=>guardNativeFileReads('mini-scratch',[{path:'src/app.js',data:Buffer.from('async function f(){return await object.file.text()}')}]),/expression/);
});
test('EML validation precedes its native FileReader without mutating the readonly result property',()=>{
  const text='const reader=new FileReader();reader.onload=()=>use(reader.result);reader.readAsText(file,"utf-8");',result=guardNativeFileReads('eml',[{path:'hub-inline-eml-workbench-html-0-ui.js',data:Buffer.from(text)}])[0].data.toString();
  assert.match(result,/GameHubReadNativeFile\(file\)\.then/);assert.match(result,/reader\.readAsText\(new Blob/);assert.doesNotMatch(result,/reader\.result\s*=/);
});
