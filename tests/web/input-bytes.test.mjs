import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,realpathSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {assertClean,projectRoot} from '../../scripts/web/inputs.mjs';
import {inside,files} from '../../scripts/web/files.mjs';
test('a Git-clean CRLF-filtered source cannot build under the different committed LF identity',()=>{
  const parent=join(projectRoot,'.build');mkdirSync(parent,{recursive:true});const root=mkdtempSync(join(parent,'web-byte-proof-'));
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  try{
    git(['init','-q']);git(['config','core.autocrlf','false']);git(['config','user.name','test']);git(['config','user.email','test@example.invalid']);
    mkdirSync(join(root,'web/src'),{recursive:true});writeFileSync(join(root,'.gitattributes'),'* text=auto eol=lf\n');writeFileSync(join(root,'web/src/source.mjs'),'export const answer=42;\n');
    git(['add','.']);git(['commit','-qm','fixture']);assertClean(root);
    writeFileSync(join(root,'web/src/source.mjs'),'export const answer=42;\r\n');
    git(['add','web/src/source.mjs']); // Git normalizes the index but retains raw working bytes.
    assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');
    assert.throws(()=>assertClean(root),/Committed input bytes differ/);
  }finally{inside(parent,root);if(realpathSync(root)!==resolve(root))throw Error('Fixture path changed');rmSync(root,{recursive:true,force:true});}
});
test('a Git-ignored extra runtime asset cannot enter a commit-addressed web build',()=>{
  const parent=join(projectRoot,'.build');mkdirSync(parent,{recursive:true});const root=mkdtempSync(join(parent,'web-byte-proof-'));
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  try{
    git(['init','-q']);git(['config','core.autocrlf','false']);git(['config','user.name','test']);git(['config','user.email','test@example.invalid']);
    mkdirSync(join(root,'web/src'),{recursive:true});writeFileSync(join(root,'web/src/source.mjs'),'export const answer=42;\n');git(['add','.']);git(['commit','-qm','fixture']);
    writeFileSync(join(root,'.git/info/exclude'),'local.svg\n');writeFileSync(join(root,'web/src/local.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>\n');
    assert.equal(git(['status','--porcelain=v1','--untracked-files=all']),'');assert.equal(files(join(root,'web/src')).length,2);
    assert.throws(()=>assertClean(root),/Untracked build input/);
  }finally{inside(parent,root);if(realpathSync(root)!==resolve(root))throw Error('Fixture path changed');rmSync(root,{recursive:true,force:true});}
});
