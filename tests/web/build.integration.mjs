import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,cpSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {projectRoot} from '../../scripts/web/inputs.mjs';
import {verifyWeb} from '../../scripts/web/build.mjs';
import {removeOwned,sha256} from '../../scripts/web/files.mjs';

const buildRoot=join(projectRoot,'.build'),source=join(buildRoot,'web-dist');
function copy(){
  mkdirSync(buildRoot,{recursive:true});const root=mkdtempSync(join(buildRoot,'web-tamper-test-'));
  cpSync(source,root,{recursive:true});return {root,cleanup:()=>removeOwned(buildRoot,root)};
}
test('clean full build verifies against source lock and current adapter',()=>{verifyWeb(projectRoot,source);});
for(const attack of ['file','forged-hash','game-entry','unregistered-file'])test(`full verifier rejects ${attack}`,()=>{
  const f=copy();try{
    const manifestPath=join(f.root,'build-manifest.json'),manifest=JSON.parse(readFileSync(manifestPath));
    if(attack==='file'||attack==='forged-hash'){
      const entry=manifest.files.find(item=>item.path==='app.mjs'),data=Buffer.from('/* corrupted */');
      writeFileSync(join(f.root,entry.path),data);
      if(attack==='forged-hash'){entry.bytes=data.length;entry.sha256=sha256(data);writeFileSync(manifestPath,JSON.stringify(manifest));}
    }else if(attack==='game-entry'){
      manifest.games[0].entryUrl='/forged/index.html';writeFileSync(manifestPath,JSON.stringify(manifest));
    }else writeFileSync(join(f.root,'unexpected.txt'),'not admitted');
    assert.throws(()=>verifyWeb(projectRoot,f.root),/differs|mismatch/);
  }finally{f.cleanup();}
});
