import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {nativeTuring,nativeLambda,splitEmlBeforeUI} from '../../scripts/web/native-validation.mjs';
import {sourceLock,projectRoot,readSource} from '../../scripts/web/inputs.mjs';
import {removeOwned} from '../../scripts/web/files.mjs';
import {auditNativeSource} from '../../scripts/web/audit-native.mjs';
test('EML native libraries are split before UI without changing or reordering any source byte',()=>{
  const source=sourceLock().sources.find(s=>s.id==='eml'),html=readSource(projectRoot,source).find(f=>f.path.endsWith('.html')).data.toString('utf8'),scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];assert.equal(scripts.length,1);
  const original=scripts[0][1],[libraries,ui]=splitEmlBeforeUI(original);assert.equal(libraries+ui,original);assert.match(libraries,/root\.EMLPersistence =/);assert.doesNotMatch(libraries,/root\.EMLApp =/);assert.match(ui,/root\.EMLApp =/);
  assert.throws(()=>splitEmlBeforeUI(original+'\ndocument.body.remove();'),/boundary/);assert.throws(()=>splitEmlBeforeUI(original.replace('root.EMLPersistence =','root.UnknownPersistence =')),/boundary/);
});
test('frozen native Turing validators compile without UI and retain the old project format',async()=>{
  const source=sourceLock().sources.find(s=>s.id==='turing'),output=nativeTuring(projectRoot,source),parent=join(projectRoot,'.build');mkdirSync(parent,{recursive:true});const root=mkdtempSync(join(parent,'web-native-validator-'));
  try{
    for(const file of output)writeFileSync(join(root,file.path),file.data);
    const codec=await import(pathToFileURL(join(root,'project-codec.mjs'))),campaign=await import(pathToFileURL(join(root,'campaign.mjs')));
    const project={format:'turing-machine-simulator',version:1,name:'old reader',description:'',input:'1',blankSymbol:'_',initialState:'q0',acceptStates:'',rejectStates:'',haltStates:'HALT',rules:'q0,1 -> HALT,1,N',maxSteps:1000,speed:10,extensions:{future:'preserve'}};
    assert.deepEqual(codec.parseProjectJson(JSON.stringify(project)),project);
    for(const patch of [{maxSteps:null},{format:'other'},{version:2},{rules:'bad rules'}])assert.throws(()=>codec.parseProjectJson(JSON.stringify({...project,...patch})));
    const id=campaign.campaignLevels[0].id,progress={version:1,completedLevelIds:[id],drafts:{[id]:'q0,_ -> HALT,1,N'}};assert.deepEqual(campaign.normalizeCampaignProgress(progress),progress);
    assert.throws(()=>nativeTuring(projectRoot,{...source,revision:'a'.repeat(40)}),/provenance/);
  }finally{removeOwned(parent,root);}
});
test('native source audit checks every fixed upstream byte and rejects a changed source or HTTP failure',async()=>{
  const manifest=JSON.parse(readFileSync(join(projectRoot,'web/native-validation/turing/provenance.json'))),calls=[];
  const fetcher=async url=>{calls.push(url);const source=manifest.files.find(f=>url.endsWith('/'+f.sourcePath));assert.ok(url.includes('/'+manifest.revision+'/'));return new Response(readFileSync(join(projectRoot,'web/native-validation/turing',source.path)));};
  const result=await auditNativeSource(projectRoot,fetcher);assert.equal(result.files,5);assert.equal(calls.length,5);
  await assert.rejects(auditNativeSource(projectRoot,async url=>url.endsWith('/core.ts')?new Response('tampered'):fetcher(url)),/audit failed/);
  await assert.rejects(auditNativeSource(projectRoot,async url=>url.endsWith('/LICENSE')?new Response('missing',{status:404}):fetcher(url)),/audit failed/);
});
test('Lambda validation reuses the fixed native migration and mirror helpers without loading its UI',async()=>{
  const source=sourceLock().sources.find(s=>s.id==='lambda-diagram-game'),raw=readSource(projectRoot,source),output=nativeLambda(source,raw),parent=join(projectRoot,'.build');mkdirSync(parent,{recursive:true});const root=mkdtempSync(join(parent,'web-native-validator-'));
  try{
    for(const file of output)writeFileSync(join(root,file.path),file.data);
    const helpers=await import(pathToFileURL(join(root,'lambda-storage.mjs')));assert.equal(typeof helpers.createLambdaStorage,'function');assert.equal(typeof helpers.migrateLambdaStorage,'function');
    const map=new Map(),storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)},adapter=helpers.createLambdaStorage(storage,{decode(){throw Error('unexpected decode');}},helpers.migrateLambdaStorage);
    assert.equal(adapter.getItem('lambda-lab-hub-v3'),null);assert.equal(map.size,0);
  }finally{removeOwned(parent,root);}
});
