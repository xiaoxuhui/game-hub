import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {projectRoot,sourceLock} from './inputs.mjs';
import {files} from './files.mjs';
for(const directory of ['scripts/web','web/src','tests/web'])for(const file of files(join(projectRoot,directory)).filter(f=>/\.(?:mjs|js)$/.test(f.path)))execFileSync(process.execPath,['--check',join(projectRoot,directory,file.path)],{stdio:'inherit'});
const lock=sourceLock();const packageInfo=JSON.parse(readFileSync(join(projectRoot,'web/package.json')));
if(packageInfo.type!=='module'||packageInfo.version!=='0.1.0')throw Error('Independent web version contract');
console.log(`Web syntax and immutable source contract valid (${lock.sources.length} games)`);
