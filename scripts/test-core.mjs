import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
// Keep the original dependency-free Android/resource suite usable in cold CI.
// Web adapters and their frozen-source integration tests run in test:web.
const directory=new URL('../tests/',import.meta.url),tests=readdirSync(directory,{withFileTypes:true}).filter(entry=>entry.isFile()&&/\.test\.(?:mjs|cjs|js)$/.test(entry.name)).map(entry=>fileURLToPath(new URL(entry.name,directory))).sort();
if(!tests.length)throw Error('Core test suite is empty');
console.log(`Core suite: ${tests.length} test files (web suite: pnpm run test:web)`);
const result=spawnSync(process.execPath,['--test',...process.argv.slice(2),...tests],{stdio:'inherit'});if(result.error)throw result.error;process.exitCode=result.status??1;
