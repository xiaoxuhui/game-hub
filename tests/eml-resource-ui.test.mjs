import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{sha256}from'../scripts/resource-protocol.mjs';import{adaptEMLTexts,prepareEMLResource,EML_UI_INPUTS}from'../scripts/eml-resource-integration.mjs';import{EML_REVISION,EML_INTEGRATION}from'../scripts/eml-legacy-reader.mjs';
const names={'src/app.js':'app','src/template.html':'template','src/styles.css':'styles','scripts/build.mjs':'build'},inputs=Object.fromEntries(Object.entries(names).map(([path,name])=>[path,readFileSync(new URL(`fixtures/eml/new-${name}.txt`,import.meta.url))]));
test('EML exact source UI and old interaction fixture retain source identities and license references',()=>{
 const base=new URL('fixtures/eml/',import.meta.url),proof=JSON.parse(readFileSync(new URL('ui-source-proof.json',base)));assert.equal(proof.length,5);for(const entry of proof){assert.equal(entry.repository,'https://github.com/xiaoxuhui/EML.git');const bytes=readFileSync(new URL(entry.fixture,base));assert.equal(sha256(bytes),entry.sha256);assert.equal(bytes.length,entry.bytes);assert.ok(['2616c9e9b081762b01599cc79da919d20340d0a2',EML_REVISION].includes(entry.revision));}for(const[path,hash]of Object.entries(EML_UI_INPUTS))assert.equal(sha256(inputs[path]),hash);
});
test('EML resource UI waits for explicit cache choice and wraps all real persistence/file controls with relative runtime closure',()=>{
 const result=adaptEMLTexts(inputs),app=result.sources['src/app.js'].toString(),template=result.sources['src/template.html'].toString();
 assert.doesNotThrow(()=>new Function(app));for(const bytes of Object.values(result.runtimes))assert.doesNotThrow(()=>new Function(bytes.toString()));
 assert.match(app,/let state = await restoreState\(\)/);assert.match(app,/await Persistence.loadFromCache\(hubCompatibility.storage\)/);assert.match(app,/Persistence.saveToCache\(hubCompatibility.storage, state\)/);assert.match(app,/hubCompatibility.exportCompatible\(state\)/);assert.match(app,/await hubCompatibility.importFile\(file\)/);assert.match(app,/hubCompatibility.clear\(\)/);assert.match(app,/hubCompatibility.mount/);assert.equal(Object.keys(result.runtimes).length,4);
 for(const path of Object.keys(result.runtimes)){assert.ok(template.includes('src="'+path+'"'));assert.ok(template.indexOf('src="'+path+'"')<template.indexOf('/*__SCRIPTS__*/'));}
 assert.equal(Object.hasOwn(result.sources,'scripts/build.mjs'),false);assert.equal(inputs['src/app.js'].includes(Buffer.from('hubCompatibility')),false);
});
test('EML UI identity or any fixed input change rejects before source writes',()=>{
 for(const path of Object.keys(inputs))assert.throws(()=>adaptEMLTexts({...inputs,[path]:Buffer.concat([inputs[path],Buffer.from('\n')])}),/Unreviewed/);
 const source={id:'eml',revision:EML_REVISION,resourceIntegration:EML_INTEGRATION};for(const patch of[{id:'conway'},{revision:'0'.repeat(40)},{resourceIntegration:'unknown'}])assert.throws(()=>prepareEMLResource({...source,...patch},'nonexistent-directory'),/Unreviewed/);
});
