import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {projectRoot} from '../../scripts/web/inputs.mjs';
import {removeOwned} from '../../scripts/web/files.mjs';
import {replaceLocalOutput} from '../../scripts/web/local-output.mjs';

function fixture(){
  const buildRoot=join(projectRoot,'.build');mkdirSync(buildRoot,{recursive:true});
  const root=mkdtempSync(join(buildRoot,'web-handoff-test-'));
  const staging=join(root,'staging'),output=join(root,'output'),backup=join(root,'backup');
  mkdirSync(staging);writeFileSync(join(staging,'index.html'),'new');
  return {buildRoot:root,staging,output,backup,cleanup:()=>removeOwned(buildRoot,root)};
}
test('local handoff restores prior output after post-switch validation failure',()=>{
  const f=fixture();try{
    mkdirSync(f.output);writeFileSync(join(f.output,'index.html'),'old');
    assert.throws(()=>replaceLocalOutput({...f,validate:()=>{throw Error('post-check failed');}}),/post-check/);
    assert.equal(readFileSync(join(f.output,'index.html'),'utf8'),'old');assert.equal(existsSync(f.backup),false);
  }finally{f.cleanup();}
});
test('initial failed handoff exposes no invalid output; successful handoff removes backup',()=>{
  const f=fixture();try{
    assert.throws(()=>replaceLocalOutput({...f,validate:()=>{throw Error('post-check failed');}}),/post-check/);
    assert.equal(existsSync(f.output),false);
    mkdirSync(f.staging);writeFileSync(join(f.staging,'index.html'),'valid');
    assert.equal(replaceLocalOutput({...f,validate:()=>42}),42);
    assert.equal(readFileSync(join(f.output,'index.html'),'utf8'),'valid');assert.equal(existsSync(f.backup),false);
  }finally{f.cleanup();}
});
test('partial old-backup cleanup failure retains verified new output',()=>{
  const f=fixture();try{
    mkdirSync(f.output);writeFileSync(join(f.output,'index.html'),'old');writeFileSync(join(f.output,'other.txt'),'old-other');
    const cleanup=(_root,path)=>{unlinkSync(join(path,'index.html'));throw Error('injected cleanup failure');};
    assert.throws(()=>replaceLocalOutput({...f,validate:()=>true,cleanup}),/Verified output retained/);
    assert.equal(readFileSync(join(f.output,'index.html'),'utf8'),'new');
    assert.equal(existsSync(join(f.backup,'index.html')),false);
    assert.equal(readFileSync(join(f.backup,'other.txt'),'utf8'),'old-other');
  }finally{f.cleanup();}
});
