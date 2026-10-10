import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
for(const root of ['D:/soft/.ci-tmp/game-hub-n10/work','D:/soft/.ci-tmp/game-hub-n10/repeat-producer']) {
 if(execFileSync('git',['status','--porcelain=v1','--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim())throw new Error('Own checkout must be clean');
 if(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()!=='35fb2b5061c9127a61fec8908d10de23d5514e8e')throw new Error('Own exact SHA required');
 for(const path of ['resource-sources.lock.json','resource-releases.lock.json','dynamic-sources.lock.json'])writeFileSync(join(root,path),execFileSync('git',['show',`HEAD:${path}`],{cwd:root}));
 if(execFileSync('git',['status','--porcelain=v1','--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim())throw new Error('Canonical blob checkout dirty');
}
console.log('Both owned clean producer locks now exact Git blob bytes');
